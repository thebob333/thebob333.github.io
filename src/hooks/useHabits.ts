import { HabitLog } from '@/types/goals';
import { stores } from '@/lib/storage';
import { todayKey, type DateKey } from '@/lib/dates';
import { useStore } from '@/hooks/useStore';

const L = stores.HABIT_LOGS;

/** One write per action, always from the latest logs; never leaves duplicate (habit, day) rows. */
export const habitActions = {
  checkIn(habitId: string, value?: number, date: DateKey = todayKey()) {
    L.update(logs => {
      const rest = logs.filter(l => !(l.habitId === habitId && l.date === date));
      const entry: HabitLog = { habitId, date, completed: true, value, at: new Date().toISOString() };
      return [...rest, entry];
    });
  },

  undo(habitId: string, date: DateKey = todayKey()) {
    L.update(logs => {
      if (!logs.some(l => l.habitId === habitId && l.date === date)) return logs;
      return logs.filter(l => !(l.habitId === habitId && l.date === date));
    });
  },

  toggleCheckIn(habitId: string, date: DateKey = todayKey()) {
    const done = L.get().some(l => l.habitId === habitId && l.date === date && l.completed);
    if (done) habitActions.undo(habitId, date);
    else habitActions.checkIn(habitId, undefined, date);
  },
};

export function useHabits() {
  const logs = useStore(L);
  return { logs, ...habitActions };
}
