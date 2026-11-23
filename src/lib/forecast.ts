/**
 * Honest finish-date forecasts from your own data (docs/apex-blueprint.md §7.4).
 * Plain statistics, not AI guesses: a range, and only once there's enough data.
 * "Become" goals never get a forecast.
 */
import type { Goal, MetricEntry } from '@/types/goals';
import { addDays, dateKeyOf, daysBetween, type DateKey } from '@/lib/dates';

export const MIN_ENTRIES = 3;
export const MIN_SPAN_DAYS = 14;

export type Forecast =
  | { kind: 'range'; from: DateKey; to: DateKey; likely: DateKey; basis: string }
  | { kind: 'done'; basis: string }
  | { kind: 'stalled'; basis: string }
  | { kind: 'not-enough'; basis: string };

/** Least-squares line through (day, value) points. */
function fit(points: { x: number; y: number }[]) {
  const n = points.length;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const slope = sxx ? sxy / sxx : 0;
  const intercept = my - slope * mx;
  const resid = points.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
  const se = n > 2 && sxx ? Math.sqrt(resid / (n - 2) / sxx) : Math.abs(slope);
  return { slope, intercept, se };
}

const clampDays = (d: number) => Math.min(3650, Math.max(1, Math.round(d)));

/** "Get better" goals: when does the trend of your measure reach the target? */
export function metricForecast(goal: Goal, entries: MetricEntry[], today: DateKey): Forecast {
  const m = goal.metric;
  if (!m || m.target === undefined) return { kind: 'not-enough', basis: 'Set a target to see a forecast.' };
  const mine = entries.filter(e => e.goalId === goal.id).sort((a, b) => a.date.localeCompare(b.date));
  if (mine.length < MIN_ENTRIES || daysBetween(mine[0].date, mine[mine.length - 1].date) < MIN_SPAN_DAYS) {
    return { kind: 'not-enough', basis: `A forecast appears after ${MIN_ENTRIES}+ entries over ${MIN_SPAN_DAYS}+ days.` };
  }
  const latest = mine[mine.length - 1].value;
  const better = (a: number, b: number) => (m.higherIsBetter ? a >= b : a <= b);
  if (better(latest, m.target)) return { kind: 'done', basis: `You've reached ${m.target} ${m.unit}.` };

  const origin = mine[0].date;
  const { slope, intercept, se } = fit(mine.map(e => ({ x: daysBetween(origin, e.date), y: e.value })));
  const towards = m.higherIsBetter ? slope > 0 : slope < 0;
  if (!towards || Math.abs(slope) < 1e-9) return { kind: 'stalled', basis: 'Not trending toward the target yet. Keep logging; adjust the practice if it stays flat.' };

  const now = daysBetween(origin, today);
  const at = (s: number) => (m.target! - intercept) / s - now; // days from today
  const likely = at(slope);
  // A steeper slope finishes sooner; a shallower one (still moving the right way) later.
  const fast = at(slope + Math.sign(slope) * se);
  const slowSlope = slope - Math.sign(slope) * se;
  const slow = Math.sign(slowSlope) === Math.sign(slope) && Math.abs(slowSlope) > 1e-9 ? at(slowSlope) : likely * 2.5;
  // Real life is noisier than any trend line: the range is always at least ±20%.
  const lo = clampDays(Math.min(fast, likely * 0.8));
  const hi = clampDays(Math.max(slow, likely * 1.2));
  return {
    kind: 'range', from: addDays(today, lo), to: addDays(today, hi), likely: addDays(today, clampDays(likely)),
    basis: `From the trend of your last ${mine.length} entries.`,
  };
}

/** "Build" / "do once" goals: at your recent pace of finishing steps, when are the rest done? */
export function stepForecast(goal: Goal, today: DateKey): Forecast {
  const todos = goal.phases.flatMap(p => p.tasks.flatMap(t => t.todos ?? []));
  const remaining = todos.filter(t => !t.done).length;
  if (todos.length && !remaining) return { kind: 'done', basis: 'Every step is done.' };
  const doneDays = todos.filter(t => t.done && t.doneAt).map(t => dateKeyOf(t.doneAt!)).sort();
  if (doneDays.length < MIN_ENTRIES || daysBetween(doneDays[0], today) < MIN_SPAN_DAYS) {
    return { kind: 'not-enough', basis: `A forecast appears once you've finished ${MIN_ENTRIES}+ steps over ${MIN_SPAN_DAYS}+ days.` };
  }
  // Steps per week over the last 4 weeks (or since you started, if sooner).
  const windowStart = [addDays(today, -28), doneDays[0]].sort().reverse()[0];
  const recent = doneDays.filter(d => d >= windowStart).length;
  const weeks = Math.max(1, daysBetween(windowStart, today) / 7);
  const perWeek = recent / weeks;
  if (perWeek <= 0) return { kind: 'stalled', basis: 'No steps finished in the last 4 weeks.' };
  const likely = (remaining / perWeek) * 7;
  return {
    kind: 'range', from: addDays(today, clampDays(likely * 0.75)), to: addDays(today, clampDays(likely * 1.5)), likely: addDays(today, clampDays(likely)),
    basis: `${remaining} steps left at your recent pace of ${perWeek.toFixed(1)} a week. Plans tend to grow, so the range leans later.`,
  };
}

export function goalForecast(goal: Goal, entries: MetricEntry[], today: DateKey): Forecast | null {
  if (goal.shape === 'become' || goal.shape === 'keep') return null;
  if (goal.shape === 'better') return metricForecast(goal, entries, today);
  return stepForecast(goal, today);
}

/** Compare a forecast with the goal's target date. */
export function vsDeadline(f: Forecast, deadline?: string): 'ahead' | 'on-track' | 'at-risk' | 'behind' | null {
  if (f.kind !== 'range' || !deadline) return null;
  const d = dateKeyOf(deadline);
  if (f.to <= d) return 'ahead';
  if (f.likely <= d) return 'on-track';
  if (f.from <= d) return 'at-risk';
  return 'behind';
}
