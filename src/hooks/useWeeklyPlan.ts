import { useMemo } from 'react';
import { stores, generateId } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import type { SplitDay, WeeklyPlan } from '@/types/workout';

export const PLAN_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

export interface DayPlan {
  day: string;
  splitDay: SplitDay;
  exercises: string[];
}

/** Always exactly 7 days, Monday first, whatever shape was saved. */
export function normalizePlanDays(plan: WeeklyPlan | null): DayPlan[] {
  return PLAN_DAYS.map(day => {
    const saved = plan?.days?.find(d => d.day === day);
    return {
      day,
      splitDay: (saved?.splitDay as SplitDay) || 'rest',
      exercises: Array.isArray(saved?.exercises) ? [...saved.exercises] : [],
    };
  });
}

export const SPLIT_OPTIONS: SplitDay[] = ['push', 'pull', 'legs', 'upper', 'lower', 'rest'];

export const SPLIT_EXERCISE_SUGGESTIONS: Record<SplitDay, string[]> = {
  push: ['bench_press', 'overhead_press'],
  pull: ['barbell_row', 'pull_up', 'deadlift'],
  legs: ['squat', 'deadlift'],
  upper: ['bench_press', 'overhead_press', 'barbell_row', 'pull_up'],
  lower: ['squat', 'deadlift'],
  rest: [],
};

export function updatePlanDays(fn: (days: DayPlan[]) => DayPlan[]) {
  stores.WEEKLY_PLAN.update(prev => {
    const days = fn(normalizePlanDays(prev));
    return { id: prev?.id ?? generateId(), name: prev?.name ?? 'My Program', days };
  });
}

/** Change a day's split; fills in suggested exercises when the day was empty or switched type. */
export function setDaySplit(dayIdx: number, splitDay: SplitDay) {
  updatePlanDays(days => days.map((d, i) => {
    if (i !== dayIdx) return d;
    return { ...d, splitDay, exercises: splitDay === 'rest' ? [] : [...SPLIT_EXERCISE_SUGGESTIONS[splitDay]] };
  }));
}

export function addPlanExercise(dayIdx: number, exercise: string) {
  updatePlanDays(days => days.map((d, i) => (i === dayIdx && !d.exercises.includes(exercise) ? { ...d, exercises: [...d.exercises, exercise] } : d)));
}

export function removePlanExercise(dayIdx: number, exercise: string) {
  updatePlanDays(days => days.map((d, i) => (i === dayIdx ? { ...d, exercises: d.exercises.filter(e => e !== exercise) } : d)));
}

export function useWeeklyPlan() {
  const plan = useStore(stores.WEEKLY_PLAN);
  const days = useMemo(() => normalizePlanDays(plan), [plan]);
  return { days, updateDays: updatePlanDays };
}
