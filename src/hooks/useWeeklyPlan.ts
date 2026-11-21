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

export function updatePlanDays(fn: (days: DayPlan[]) => DayPlan[]) {
  stores.WEEKLY_PLAN.update(prev => {
    const days = fn(normalizePlanDays(prev));
    return { id: prev?.id ?? generateId(), name: prev?.name ?? 'My Program', days };
  });
}

export function useWeeklyPlan() {
  const plan = useStore(stores.WEEKLY_PLAN);
  const days = useMemo(() => normalizePlanDays(plan), [plan]);
  return { days, updateDays: updatePlanDays };
}
