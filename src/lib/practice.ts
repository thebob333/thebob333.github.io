/**
 * Practices (recurring habits) and their load: how many sessions a week, and
 * optionally an amount per session that can grow. Shared by the adaptation
 * engine, Today and the goal screens so they always agree.
 */
import type { Habit, HabitLog, PracticeLoad } from '@/types/goals';
import { mentionedDays } from '@/lib/habits';
import { addDays, dayOfWeek, startOfWeekKey, type DateKey } from '@/lib/dates';

/** Weeks start on Monday for the engine and goal screens. */
export const weekStart = (day: DateKey): DateKey => startOfWeekKey(day, 1);

/** Sessions per week implied by a frequency string. */
export function derivePerWeek(frequency: string | undefined): number {
  const f = (frequency || 'daily').toLowerCase().trim();
  if (f === 'daily' || f === 'every day') return 7;
  if (f === 'weekdays') return 5;
  if (f === 'weekends') return 2;
  const m = f.match(/^(\d+)\s*x\s*\/\s*week$/);
  if (m) return clamp(parseInt(m[1], 10), 1, 7);
  const days = mentionedDays(f);
  if (days.length) return days.length;
  if (f.includes('week')) return 1;
  return 7;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function perWeekOf(h: Habit): number {
  return clamp(Math.round(h.perWeek ?? derivePerWeek(h.frequency)), 1, 7);
}

export function maxPerWeekOf(h: Habit): number {
  return clamp(Math.round(h.maxPerWeek ?? Math.max(perWeekOf(h), derivePerWeek(h.frequency))), 1, 7);
}

export function frequencyFor(perWeek: number): string {
  return perWeek >= 7 ? 'daily' : `${perWeek}x/week`;
}

/** Specific weekdays (0 = Sun) only when the frequency names exactly `perWeek` days. */
export function fixedDays(h: Habit): number[] | null {
  const f = (h.frequency || '').toLowerCase().trim();
  const pw = perWeekOf(h);
  if (f === 'weekdays' && pw === 5) return [1, 2, 3, 4, 5];
  if (f === 'weekends' && pw === 2) return [0, 6];
  const days = mentionedDays(f);
  return days.length && days.length === pw ? days : null;
}

/** Unique days completed between `from` and `to` (inclusive). */
export function doneBetween(habitId: string, logs: HabitLog[], from: DateKey, to: DateKey): number {
  const days = new Set<string>();
  for (const l of logs) if (l.habitId === habitId && l.completed && l.date >= from && l.date <= to) days.add(l.date);
  return days.size;
}

export function isDoneOn(habitId: string, logs: HabitLog[], day: DateKey): boolean {
  return logs.some(l => l.habitId === habitId && l.date === day && l.completed);
}

export function inRestart(h: Habit, day: DateKey): boolean {
  return !!h.restartUntil && day <= h.restartUntil;
}

/**
 * Is this practice on today's list?
 * - Fixed days ("mon/wed/fri", weekdays): only on those days.
 * - Daily: every day.
 * - "3x/week": every day until this week's sessions are done (then it rests).
 * Done-today always stays visible (as completed).
 */
export function isPracticeDue(h: Habit, logs: HabitLog[], day: DateKey): boolean {
  if (!h.active) return false;
  if (isDoneOn(h.id, logs, day)) return true;
  const days = fixedDays(h);
  if (days) return days.includes(dayOfWeek(day));
  const pw = perWeekOf(h);
  if (pw >= 7) return true;
  return doneBetween(h.id, logs, weekStart(day), addDays(day, -1)) < pw;
}

/** "3×/week · 20 min" */
export function loadLabel(h: Habit, load: PracticeLoad = { perWeek: perWeekOf(h), amount: h.amount }): string {
  const freq = load.perWeek >= 7 ? 'Daily' : `${load.perWeek}×/week`;
  return load.amount ? `${freq} · ${load.amount} ${h.unit ?? ''}`.trim() : freq;
}

/** The next step up, or null when it's already at the level you're building toward. */
export function stepUp(h: Habit): PracticeLoad | null {
  const pw = perWeekOf(h);
  if (pw < maxPerWeekOf(h)) return { perWeek: pw + 1, amount: h.amount };
  if (h.amount !== undefined && h.step && (h.maxAmount === undefined || h.amount + h.step <= h.maxAmount)) {
    return { perWeek: pw, amount: h.amount + h.step };
  }
  return null;
}

/** One notch easier, or null at the floor (1×/week and the smallest amount). */
export function easeOff(h: Habit): PracticeLoad | null {
  const pw = perWeekOf(h);
  if (pw > 1) return { perWeek: pw - 1, amount: h.amount };
  if (h.amount !== undefined && h.step && h.amount - h.step >= h.step) return { perWeek: pw, amount: h.amount - h.step };
  return null;
}

/** The fields to write onto a habit for a given load. */
export function withLoad(h: Habit, load: PracticeLoad): Habit {
  return {
    ...h,
    perWeek: load.perWeek,
    frequency: fixedDays(h) && load.perWeek === perWeekOf(h) ? h.frequency : frequencyFor(load.perWeek),
    ...(load.amount !== undefined ? { amount: load.amount } : {}),
  };
}

export const currentLoad = (h: Habit): PracticeLoad => ({ perWeek: perWeekOf(h), amount: h.amount });
export const sameLoad = (a: PracticeLoad, b: PracticeLoad) => a.perWeek === b.perWeek && (a.amount ?? null) === (b.amount ?? null);

/** Weeks (Mon-start) in the last `n` complete weeks where the target was hit. */
export function weeksOnTarget(h: Habit, logs: HabitLog[], today: DateKey, n = 6): { hit: number; of: number } {
  let hit = 0;
  let of = 0;
  const thisWeek = weekStart(today);
  for (let i = 1; i <= n; i++) {
    const ws = addDays(thisWeek, -7 * i);
    if (h.since && h.since > addDays(ws, 6)) break;
    of++;
    if (doneBetween(h.id, logs, ws, addDays(ws, 6)) >= perWeekOf(h)) hit++;
  }
  return { hit, of };
}
