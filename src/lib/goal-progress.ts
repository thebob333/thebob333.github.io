/**
 * What "progress" means depends on the goal's shape: distance to the target
 * for "get better", consistency for "keep up", steps done for everything else.
 * One function, so the list, the goal screen and Today always agree.
 */
import type { Goal, HabitLog, MetricEntry } from '@/types/goals';
import { calculateGoalProgress } from '@/types/goals';
import { weeksOnTarget } from '@/lib/practice';
import type { DateKey } from '@/lib/dates';

export interface GoalProgress { value: number; label: string }

export function goalProgress(goal: Goal, metrics: MetricEntry[], logs: HabitLog[], today: DateKey): GoalProgress {
  const m = goal.metric;
  if (goal.shape === 'better' && m && m.target !== undefined) {
    const values = metrics.filter(e => e.goalId === goal.id).sort((a, b) => a.date.localeCompare(b.date)).map(e => e.value);
    const start = m.start ?? values[0];
    const latest = values[values.length - 1] ?? start;
    if (start !== undefined && latest !== undefined && m.target !== start) {
      return { value: Math.max(0, Math.min(100, Math.round(((latest - start) / (m.target - start)) * 100))), label: `of the way to ${m.target} ${m.unit}` };
    }
  }
  const hasSteps = goal.phases.some(p => p.tasks.some(t => (t.todos ?? []).length > 0));
  if (goal.shape === 'keep' || (goal.shape === 'become' && !hasSteps)) {
    const habits = goal.phases.flatMap(p => p.tasks.flatMap(t => t.habits ?? [])).filter(h => h.active);
    const c = habits.map(h => weeksOnTarget(h, logs, today));
    const of = c.reduce((n, x) => n + x.of, 0);
    if (of > 0) return { value: Math.round((c.reduce((n, x) => n + x.hit, 0) / of) * 100), label: 'of recent weeks on target' };
  }
  return { value: calculateGoalProgress(goal), label: 'complete' };
}
