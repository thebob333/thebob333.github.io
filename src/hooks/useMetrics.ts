import { useMemo } from 'react';
import { toast } from 'sonner';
import { stores, generateId } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { todayKey } from '@/lib/dates';
import type { MetricEntry } from '@/types/goals';

export const metricActions = {
  /** One entry per goal per day: logging again the same day replaces it. */
  log(goalId: string, value: number, date = todayKey()) {
    const prev = stores.METRICS.get().find(m => m.goalId === goalId && m.date === date);
    stores.METRICS.update(all => [...all.filter(m => !(m.goalId === goalId && m.date === date)), { id: generateId(), goalId, date, value }]);
    toast.success('Progress logged', { action: { label: 'Undo', onClick: () => stores.METRICS.update(all => [...all.filter(m => !(m.goalId === goalId && m.date === date)), ...(prev ? [prev] : [])]) } });
  },
  remove(entry: MetricEntry) {
    stores.METRICS.update(all => all.filter(m => m.id !== entry.id));
    toast.success('Entry removed', { action: { label: 'Undo', onClick: () => stores.METRICS.update(all => [...all, entry]) } });
  },
};

export function useGoalMetrics(goalId: string): MetricEntry[] {
  const all = useStore(stores.METRICS);
  return useMemo(() => all.filter(m => m.goalId === goalId).sort((a, b) => a.date.localeCompare(b.date)), [all, goalId]);
}
