import { HabitLog } from '@/types/goals';
import { stores } from '@/lib/storage';
import { todayKey, type DateKey } from '@/lib/dates';
import { useStore } from '@/hooks/useStore';
import { getCurrentStreak } from '@/lib/habits';
import { isStreakMilestone } from '@/lib/insights';
import { toast } from 'sonner';

const L = stores.HABIT_LOGS;

function findHabitTitle(habitId: string): string | undefined {
  for (const g of stores.GOALS.get()) for (const p of g.phases) for (const t of p.tasks) {
    const h = (t.habits ?? []).find(x => x.id === habitId);
    if (h) return h.title;
  }
  return undefined;
}

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
    if (done) {
      habitActions.undo(habitId, date);
      return;
    }
    habitActions.checkIn(habitId, undefined, date);
    // Celebrate streak milestones (7, 14, 30, 50, 100… days).
    const streak = getCurrentStreak(habitId, L.get(), date);
    if (isStreakMilestone(streak)) {
      const title = findHabitTitle(habitId);
      toast(`🔥 ${streak}-day streak${title ? `: ${title}` : ''}!`, { description: 'Consistency is the whole game. Keep it going.', duration: 6000 });
    }
  },
};

export function useHabits() {
  const logs = useStore(L);
  return { logs, ...habitActions };
}
