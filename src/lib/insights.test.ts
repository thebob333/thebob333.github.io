import { describe, expect, it } from 'vitest';
import { isStreakMilestone, newRecordsIn, summarizeWeek, trainingNudges } from './insights';
import { isReviewDue, reviewWeekStart } from '@/components/today/WeeklyReview';
import { seedSampleData, removeSampleData, getSampleRecord } from './sample-data';
import { stores } from '@/lib/storage';
import type { Goal } from '@/types/goals';
import type { WorkoutSession, ExerciseConfig } from '@/types/workout';

const goal: Goal = {
  id: 'g', title: 'G', description: '', endGoal: '', createdAt: '', phases: [{
    id: 'p', title: 'P', description: '', order: 0, tasks: [{
      id: 't', title: 'T', description: '', status: 'not_started', order: 0, todos: [],
      habits: [{ id: 'h', title: 'Run', frequency: 'daily', active: true }],
    }],
  }],
};
const session = (date: string, weight: number, reps = 5, exercise = 'bench_press'): WorkoutSession => ({
  id: date + weight, date, splitDay: 'push', exercises: [{ exercise, date, sets: [{ weight, reps, rpe: 3 }] }],
});

describe('weekly summary', () => {
  it('counts habit completion, perfect days, workouts, new records and practices on target', () => {
    const logs = ['2026-11-16', '2026-11-17', '2026-11-18'].map(date => ({ habitId: 'h', date, completed: true }));
    const sessions = [session('2026-11-09T10:00:00', 135), session('2026-11-18T10:00:00', 145)];
    const w = summarizeWeek('2026-11-16', [goal], logs, sessions);
    expect(w.habitsDue).toBe(7);
    expect(w.habitsDone).toBe(3);
    expect(w.perfectDays).toBe(3);
    expect(w.workouts).toBe(1);
    expect(w.newPRs.map(p => p.label)).toEqual(['Bench Press']);
    expect(w.practices).toBe(1);
    expect(w.practicesOnTarget).toBe(0); // 3 of 7 for a daily practice
  });
});

describe('records & milestones', () => {
  it('a heavier set is a record; the first ever session is not', () => {
    expect(newRecordsIn(session('2026-11-20', 145), [session('2026-11-10', 135)])).toEqual([{ label: 'Bench Press', value: '145 lbs' }]);
    expect(newRecordsIn(session('2026-11-20', 145), [])).toEqual([]);
  });

  it('streak milestones', () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(8)).toBe(false);
    expect(isStreakMilestone(100)).toBe(true);
  });

  it('flags stalled lifts', () => {
    const cfg: ExerciseConfig = { exercise: 'bench_press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 135, weightIncrement: 5 };
    const nudges = trainingNudges([session('2026-11-10', 135, 4), session('2026-11-12', 135, 4)], [cfg]);
    expect(nudges[0]).toMatchObject({ kind: 'deload', title: 'Bench Press has stalled' });
  });
});

describe('weekly review timing', () => {
  it('Sunday reviews this week; Monday reviews last week; other days nothing is due', () => {
    expect(reviewWeekStart('2026-11-22')).toBe('2026-11-16'); // Sunday
    expect(reviewWeekStart('2026-11-23')).toBe('2026-11-16'); // Monday
    expect(isReviewDue('2026-11-22', undefined)).toBe(true);
    expect(isReviewDue('2026-11-23', '2026-11-16')).toBe(false);
    expect(isReviewDue('2026-11-25', undefined)).toBe(false);
    expect(reviewWeekStart('2026-11-25')).toBe('2026-11-23'); // mid-week: this week so far
  });
});

describe('sample data', () => {
  it('can be added and removed without touching your own data', () => {
    stores.REPEATABLE_BLOCKS.set([{ id: 'mine', title: 'Mine', categoryId: 'work', startHour: 9, startMinute: 0, durationMinutes: 30, repeatPattern: 'daily', enabled: true }]);
    seedSampleData();
    expect(stores.GOALS.get()).toHaveLength(1);
    expect(stores.REPEATABLE_BLOCKS.get()).toHaveLength(2);
    expect(stores.WEEKLY_PLAN.get()).not.toBeNull();
    removeSampleData();
    expect(stores.GOALS.get()).toEqual([]);
    expect(stores.REPEATABLE_BLOCKS.get().map(r => r.id)).toEqual(['mine']);
    expect(stores.WEEKLY_PLAN.get()).toBeNull();
    expect(getSampleRecord()).toBeNull();
  });
});
