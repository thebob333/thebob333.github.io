/**
 * Fills a Plan day with blocks from your routines and to-dos due that day.
 *
 * - Each auto-created block remembers where it came from (routine id / to-do
 *   id), so moving or renaming it never creates a duplicate.
 * - Blocks you delete are remembered per day ("dismissed") and not re-created.
 * - Due to-dos go into the first free slot from 9 AM instead of stacking.
 */
import type { RepeatableBlock, TimeBlock, PlanDismissed } from '@/lib/storage';
import { addDays } from '@/lib/dates';

export const DAY_START_MIN = 5 * 60;
export const DAY_END_MIN = 23 * 60;

export interface DueTodo {
  todoId: string;
  title: string;
  effort?: string;
}

export const tplKey = (id: string) => `tpl:${id}`;
export const todoKey = (id: string) => `todo:${id}`;

const start = (b: Pick<TimeBlock, 'startHour' | 'startMinute'>) => b.startHour * 60 + b.startMinute;

/** First gap of `duration` minutes at or after `from` that doesn't overlap any block. */
export function findFreeSlot(dayBlocks: Pick<TimeBlock, 'startHour' | 'startMinute' | 'durationMinutes'>[], duration: number, from = 9 * 60): number {
  const busy = dayBlocks
    .map(b => [start(b), start(b) + b.durationMinutes] as const)
    .sort((a, b) => a[0] - b[0]);
  let t = from;
  for (const [s, e] of busy) {
    if (e <= t) continue;
    if (s >= t + duration) break;
    t = Math.max(t, e);
  }
  if (t + duration > DAY_END_MIN) t = Math.max(DAY_START_MIN, DAY_END_MIN - duration);
  return t;
}

export function effortMinutes(effort?: string): number {
  return effort === 'LOW' ? 15 : effort === 'HIGH' ? 60 : 30;
}

/** Returns the same array when nothing needs to change (so callers can skip a write). */
export function autofillDay(
  blocks: TimeBlock[],
  dayName: string,
  routines: RepeatableBlock[],
  dueTodos: DueTodo[],
  dismissed: PlanDismissed,
  newId: () => string,
): TimeBlock[] {
  const gone = new Set(dismissed[dayName] ?? []);
  let all = blocks;
  let changed = false;

  // Habits live in the checklist now, not the planner.
  if (all.some(b => b.dayName === dayName && b.habitId)) {
    all = all.filter(b => !(b.dayName === dayName && b.habitId));
    changed = true;
  }

  const day = () => all.filter(b => b.dayName === dayName);
  const added: TimeBlock[] = [];

  for (const r of routines) {
    if (gone.has(tplKey(r.id))) continue;
    const linked = day().find(b => b.sourceTemplateId === r.id) ?? added.find(b => b.sourceTemplateId === r.id);
    if (linked) continue;
    // Older blocks made before blocks remembered their routine: adopt by title + time.
    const legacy = day().find(b => !b.sourceTemplateId && !b.todoId && b.title === r.title && b.startHour === r.startHour && b.startMinute === r.startMinute);
    if (legacy) {
      all = all.map(b => (b.id === legacy.id ? { ...b, sourceTemplateId: r.id } : b));
      changed = true;
      continue;
    }
    added.push({
      id: newId(), dayName, categoryId: r.categoryId, title: r.title,
      startHour: r.startHour, startMinute: r.startMinute, durationMinutes: r.durationMinutes,
      sourceTemplateId: r.id,
    });
  }

  for (const t of dueTodos) {
    if (gone.has(todoKey(t.todoId))) continue;
    if (day().some(b => b.todoId === t.todoId) || added.some(b => b.todoId === t.todoId)) continue;
    const duration = effortMinutes(t.effort);
    const slot = findFreeSlot([...day(), ...added], duration);
    added.push({
      id: newId(), dayName, categoryId: 'goals', title: t.title,
      startHour: Math.floor(slot / 60), startMinute: slot % 60, durationMinutes: duration,
      todoId: t.todoId,
    });
  }

  if (added.length === 0 && !changed) return blocks;
  return [...all, ...added];
}

/** Remember that an auto-created block was removed so it isn't re-created that day. */
export function dismissBlock(dismissed: PlanDismissed, block: TimeBlock, today: string): PlanDismissed {
  const keys = [block.sourceTemplateId && tplKey(block.sourceTemplateId), block.todoId && todoKey(block.todoId)].filter(Boolean) as string[];
  if (keys.length === 0) return dismissed;
  const next: PlanDismissed = {};
  // Keep the map small: drop entries for days more than ~2 months back.
  const cutoffKey = addDays(today, -60);
  for (const [day, list] of Object.entries(dismissed)) if (day >= cutoffKey) next[day] = list;
  next[block.dayName] = [...new Set([...(next[block.dayName] ?? []), ...keys])];
  return next;
}

export function undismissBlock(dismissed: PlanDismissed, block: TimeBlock): PlanDismissed {
  const keys = new Set([block.sourceTemplateId && tplKey(block.sourceTemplateId), block.todoId && todoKey(block.todoId)].filter(Boolean));
  const list = dismissed[block.dayName];
  if (!list || keys.size === 0) return dismissed;
  return { ...dismissed, [block.dayName]: list.filter(k => !keys.has(k)) };
}
