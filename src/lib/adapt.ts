/**
 * The adaptation engine (docs/apex-blueprint.md §7.1).
 *
 * Plans are hypotheses. Once a week (and right away after a clear slip) each
 * practice's load is compared with what actually happened and turned up, held
 * or eased — like progressive overload in the Gym. Slipping becomes an
 * adjustment instead of the end of the plan.
 *
 * Pure and deterministic: same input → same output, no AI, works offline.
 * Every change is recorded as an Adjustment with a reason and Undo.
 */
import type { Adjustment, EngineState, Goal, Habit, HabitLog, PracticeLoad } from '@/types/goals';
import { addDays, dayOfWeek, daysBetween, type DateKey } from '@/lib/dates';
import {
  currentLoad, doneBetween, easeOff, fixedDays, inRestart, isDoneOn, perWeekOf, stepUp, weekStart, withLoad,
} from '@/lib/practice';
import { getAllActiveHabits } from '@/lib/habits';

/** Hit at least this share of the week's plan → step up. */
export const STEP_UP_AT = 0.9;
/** Below this share (or 2 misses in a row) → ease off. */
export const EASE_BELOW = 0.5;
/** Days with nothing logged before a restart week kicks in. */
export const RESTART_AFTER_DAYS = 7;
/** Eased this many weeks running → flag it for a rethink. */
export const FLAG_AFTER_EASES = 3;

export interface EngineInput {
  goals: Goal[];
  logs: HabitLog[];
  adjustments: Adjustment[];
  state: EngineState;
  today: DateKey;
  /** Latest day anything was done (habit, to-do, workout) — for the restart rule. */
  lastActivity?: DateKey;
  now?: Date;
  newId?: () => string;
}

export interface EngineResult {
  goals: Goal[];
  added: Adjustment[];
  state: EngineState;
  changed: boolean;
}

type Ctx = { goalId: string; habit: Habit };

function patchHabit(goals: Goal[], goalId: string, habitId: string, fn: (h: Habit) => Habit): Goal[] {
  return goals.map(g => g.id !== goalId ? g : {
    ...g,
    phases: g.phases.map(p => ({
      ...p,
      tasks: p.tasks.map(t => ({
        ...t,
        habits: (t.habits ?? []).map(h => (h.id === habitId ? fn(h) : h)),
      })),
    })),
  });
}

const describe = (h: Habit, l: PracticeLoad) =>
  `${l.perWeek >= 7 ? 'daily' : `${l.perWeek}×/week`}${l.amount !== undefined ? `, ${l.amount} ${h.unit ?? ''}`.trimEnd() : ''}`;

/** Ease-type adjustments for a habit, most recent first, stopping at the first non-ease. */
function easeRun(adjustments: Adjustment[], habitId: string): number {
  const mine = adjustments
    .filter(a => a.habitId === habitId && a.status !== 'undone' && a.status !== 'declined' && a.kind !== 'flag')
    .sort((a, b) => b.week.localeCompare(a.week) || b.at.localeCompare(a.at));
  let n = 0;
  for (const a of mine) {
    if (a.kind === 'ease' || a.kind === 'restart') n++;
    else break;
  }
  return n;
}

/** The last two days this practice was due before today were both missed. */
function missedTwoInARow(h: Habit, logs: HabitLog[], today: DateKey): boolean {
  const days = fixedDays(h) ?? (perWeekOf(h) >= 7 ? [0, 1, 2, 3, 4, 5, 6] : null);
  if (!days) return false;
  const due: DateKey[] = [];
  for (let d = addDays(today, -1); due.length < 2 && daysBetween(d, today) <= 14; d = addDays(d, -1)) {
    if (h.since && d < h.since) return false;
    if (days.includes(dayOfWeek(d))) due.push(d);
  }
  return due.length === 2 && due.every(d => !isDoneOn(h.id, logs, d));
}

export function runEngine(input: EngineInput): EngineResult {
  const { logs, today } = input;
  const now = (input.now ?? new Date()).toISOString();
  const newId = input.newId ?? (() => crypto.randomUUID());
  let goals = input.goals;
  const added: Adjustment[] = [];
  const all = () => [...input.adjustments, ...added];
  const state: EngineState = { ...input.state };
  const goalById = new Map(goals.map(g => [g.id, g]));

  const record = (c: Ctx, kind: Adjustment['kind'], week: DateKey, before: PracticeLoad, after: PracticeLoad, reason: string,
    opts: { pending?: boolean; quiet?: boolean } = {}) => {
    added.push({
      id: newId(), goalId: c.goalId, habitId: c.habit.id, title: c.habit.title, kind, week, at: now,
      before, after, reason,
      status: kind === 'flag' || opts.quiet ? 'info' : opts.pending ? 'pending' : 'applied',
      seen: !!opts.quiet,
    });
  };

  const apply = (c: Ctx, kind: 'up' | 'ease' | 'restart', week: DateKey, after: PracticeLoad, reason: string, extra: Partial<Habit> = {}) => {
    const before = currentLoad(c.habit);
    const auto = c.habit.auto !== false;
    // Restart weeks always apply (they're the safety net); other changes respect "ask first".
    const pending = !auto && kind !== 'restart';
    record(c, kind, week, before, after, reason, { pending });
    if (!pending) goals = patchHabit(goals, c.goalId, c.habit.id, h => ({ ...withLoad(h, after), ...extra }));
  };

  const practices = (): Ctx[] => getAllActiveHabits(goals)
    .filter(fh => {
      const g = goalById.get(fh.goalId);
      return !g?.archived && (!g?.status || g.status === 'active');
    })
    .map(fh => ({ goalId: fh.goalId, habit: fh.habit }));

  // 1) Restart week after time away.
  const away = input.lastActivity ? daysBetween(input.lastActivity, today) : 0;
  if (input.lastActivity && away >= RESTART_AFTER_DAYS) {
    for (const c of practices()) {
      if (inRestart(c.habit, today)) continue;
      if (c.habit.since && daysBetween(c.habit.since, today) < RESTART_AFTER_DAYS) continue;
      // Already restarted for this stretch away? (restartUntil set after the last activity)
      if (c.habit.restartUntil && c.habit.restartUntil >= input.lastActivity) continue;
      const after = easeOff(c.habit) ?? currentLoad(c.habit);
      apply(c, 'restart', weekStart(today), after,
        `Welcome back. ${away} days away, so this week is a gentle restart: just the easy version, then we build back up.`,
        { restartUntil: addDays(today, 6) });
    }
  }

  // 2) Weekly review of last week (Mon–Sun), once.
  const lastWeek = addDays(weekStart(today), -7);
  if (!state.lastWeek || state.lastWeek < lastWeek) {
    const weekEnd = addDays(lastWeek, 6);
    for (const c of practices()) {
      const h = c.habit;
      if (h.since && h.since > lastWeek) continue; // didn't exist for the whole week
      if (h.restartUntil && h.restartUntil >= lastWeek) continue; // restart weeks aren't judged
      if (added.some(a => a.habitId === h.id && a.kind === 'restart')) continue;
      const planned = perWeekOf(h);
      const done = Math.min(planned, doneBetween(h.id, logs, lastWeek, weekEnd));
      const ratio = done / planned;
      if (ratio >= STEP_UP_AT) {
        const up = stepUp(h);
        if (up) apply(c, 'up', lastWeek, up, `You hit ${done} of ${planned} last week. Stepping up to ${describe(h, up)}.`);
      } else if (ratio < EASE_BELOW) {
        const down = easeOff(h);
        if (down) {
          apply(c, 'ease', lastWeek, down, `${done} of ${planned} last week. Easing to ${describe(h, down)} so it fits your real week.`);
        }
        // Count floor weeks too, so a practice stuck at the bottom still gets flagged.
        if (!down) record(c, 'ease', lastWeek, currentLoad(h), currentLoad(h), `${done} of ${planned} last week, already at the easiest level.`, { quiet: true });
        if (easeRun(all(), h.id) >= FLAG_AFTER_EASES && !all().some(a => a.habitId === h.id && a.kind === 'flag' && a.week === lastWeek)) {
          record(c, 'flag', lastWeek, currentLoad(h), currentLoad(h),
            `Eased ${FLAG_AFTER_EASES} weeks running. Worth rethinking the approach: a different time, a smaller version, or a different method.`);
        }
      }
    }
    state.lastWeek = lastWeek;
  }

  // 3) Mid-week slip: two due days missed in a row → ease now (once per week).
  const thisWeek = weekStart(today);
  for (const c of practices()) {
    const h = c.habit;
    if (inRestart(h, today)) continue;
    if (all().some(a => a.habitId === h.id && a.week === thisWeek && (a.kind === 'ease' || a.kind === 'restart'))) continue;
    if (!missedTwoInARow(h, logs, today)) continue;
    const down = easeOff(h);
    if (down) apply(c, 'ease', thisWeek, down, `Missed the last two sessions. Easing to ${describe(h, down)} for now — better a smaller plan you keep than a big one you drop.`);
  }

  return { goals, added, state, changed: added.length > 0 || state.lastWeek !== input.state.lastWeek };
}

/** Undo an applied change (only if the practice hasn't changed since). */
export function undoAdjustment(goals: Goal[], a: Adjustment): Goal[] {
  return patchHabit(goals, a.goalId, a.habitId, h => {
    const rest = { ...withLoad(h, a.before) };
    if (a.kind === 'restart') delete rest.restartUntil;
    return rest;
  });
}

/** Accept a proposed change ("ask first" practices). */
export function acceptAdjustment(goals: Goal[], a: Adjustment): Goal[] {
  return patchHabit(goals, a.goalId, a.habitId, h => withLoad(h, a.after));
}
