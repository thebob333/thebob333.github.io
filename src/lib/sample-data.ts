/**
 * Optional sample data for first-time users, tracked so it can be removed in
 * one tap without touching anything they created themselves.
 */
import { stores, generateId } from '@/lib/storage';
import { goalActions } from '@/hooks/useGoals';
import { normalizePlanDays } from '@/hooks/useWeeklyPlan';
import type { SplitDay } from '@/types/workout';

const SAMPLE_KEY = 'telos_sample'; // device-only bookkeeping, not backed up

interface SampleRecord { goals: string[]; routines: string[]; plan: boolean }

export function getSampleRecord(): SampleRecord | null {
  try {
    const raw = localStorage.getItem(SAMPLE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function seedSampleData() {
  const goal = goalActions.createFromTemplate({
    id: 'sample', name: 'Run a half marathon', description: 'Build up to 13.1 miles without injury.',
    endGoal: 'Cross the finish line feeling strong.', domain: 'PHYSICAL', durationDays: 84, createdAt: '',
    phases: [
      { title: 'Foundation', description: 'Build the habit and an aerobic base.', offsetDays: 28, tasks: [
        { title: 'Get set up', description: '', offsetDays: 7, todos: [
          { title: 'Buy proper running shoes', effort: 'LOW', offsetDays: 0 },
          { title: 'Pick a race and sign up', effort: 'MED', offsetDays: 3 },
          { title: 'Benchmark — run 2 miles without stopping', effort: 'HIGH', isBenchmark: true, offsetDays: 14 },
        ], habits: [{ title: 'Run', frequency: '3x/week', target: '20–30 minutes', evolution: 'NEW' }] },
        { title: 'Recover well', description: '', todos: [], habits: [{ title: 'Stretch', frequency: 'daily', target: '10 minutes', evolution: 'NEW' }] },
      ] },
      { title: 'Build', description: 'Add distance week by week.', offsetDays: 70, tasks: [
        { title: 'Long runs', description: '', todos: [{ title: 'Benchmark — run 10k', effort: 'HIGH', isBenchmark: true, offsetDays: 56 }], habits: [] },
      ] },
      { title: 'Race', description: 'Taper and run it.', offsetDays: 84, tasks: [] },
    ],
  });

  const hadPlan = stores.WEEKLY_PLAN.get() !== null;
  if (!hadPlan) {
    const split: Record<string, SplitDay> = { Monday: 'push', Tuesday: 'pull', Thursday: 'legs', Saturday: 'upper' };
    const days = normalizePlanDays(null).map(d => {
      const sd = split[d.day] ?? 'rest';
      const ex = { push: ['bench_press', 'overhead_press'], pull: ['barbell_row', 'pull_up'], legs: ['squat', 'deadlift'], upper: ['bench_press', 'barbell_row'], lower: [], rest: [] }[sd];
      return { ...d, splitDay: sd, exercises: ex };
    });
    stores.WEEKLY_PLAN.set({ id: generateId(), name: 'Sample split', days });
  }

  const routineId = generateId();
  stores.REPEATABLE_BLOCKS.update(r => [...r, { id: routineId, title: 'Morning run', categoryId: 'workout', startHour: 7, startMinute: 0, durationMinutes: 45, repeatPattern: 'custom', customDays: ['Monday', 'Wednesday', 'Friday'], enabled: true }]);

  const record: SampleRecord = { goals: [goal.id], routines: [routineId], plan: !hadPlan };
  try { localStorage.setItem(SAMPLE_KEY, JSON.stringify(record)); } catch { /* ignore */ }
}

export function removeSampleData() {
  const rec = getSampleRecord();
  if (!rec) return;
  rec.goals.forEach(id => goalActions.deleteGoal(id));
  stores.REPEATABLE_BLOCKS.update(r => r.filter(x => !rec.routines.includes(x.id)));
  if (rec.plan) stores.WEEKLY_PLAN.set(null);
  try { localStorage.removeItem(SAMPLE_KEY); } catch { /* ignore */ }
}

export function keepSampleData() {
  try { localStorage.removeItem(SAMPLE_KEY); } catch { /* ignore */ }
}
