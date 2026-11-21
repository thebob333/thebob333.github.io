import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';

export const MAX_FOCUS = 3;

/** Shared by the Weekly Focus panel and every star, so they can never disagree. */
export function toggleFocus(goalId: string): 'added' | 'removed' | 'full' {
  let result: 'added' | 'removed' | 'full' = 'full';
  stores.WEEKLY_FOCUS.update(ids => {
    if (ids.includes(goalId)) {
      result = 'removed';
      return ids.filter(id => id !== goalId);
    }
    if (ids.length >= MAX_FOCUS) {
      result = 'full';
      return ids;
    }
    result = 'added';
    return [...ids, goalId];
  });
  return result;
}

export function useWeeklyFocus() {
  const focusIds = useStore(stores.WEEKLY_FOCUS);
  return { focusIds, toggle: toggleFocus, max: MAX_FOCUS };
}
