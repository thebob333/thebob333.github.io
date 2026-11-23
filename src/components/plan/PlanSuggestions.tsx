import { useMemo } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/hooks/useStore';
import { stores, generateId, type TimeBlock } from '@/lib/storage';
import { getTodaysHabits } from '@/lib/habits';
import { findFreeSlot } from '@/lib/plan-autofill';
import { formatClock, plannerNowMinutes, plannerDayKey } from '@/lib/plan-time';
import type { DateKey } from '@/lib/dates';

const durationFor = (h: { amount?: number; unit?: string }) => (h.amount && /^min/i.test(h.unit ?? '') ? Math.min(240, Math.max(10, Math.round(h.amount))) : 30);

/**
 * Practices due this day that don't have a time yet, each with a suggested free
 * slot. One tap puts it on the plan (ask-first: nothing is placed on its own).
 */
export function PlanSuggestions({ day }: { day: DateKey }) {
  const goals = useStore(stores.GOALS);
  const logs = useStore(stores.HABIT_LOGS);
  const blocks = useStore(stores.TIME_BLOCKS);

  const suggestions = useMemo(() => {
    const dayBlocks = blocks.filter(b => b.dayName === day);
    const placed = new Set(dayBlocks.map(b => b.habitId).filter(Boolean));
    const isToday = day === plannerDayKey();
    // Start after "now" on today (rounded up to the quarter hour), else 7 AM.
    const from = isToday ? Math.max(7 * 60, Math.ceil(plannerNowMinutes() / 15) * 15) : 7 * 60;
    const taken = [...dayBlocks];
    return getTodaysHabits(goals, logs, day)
      .filter(h => !h.completed && !placed.has(h.habit.id))
      .slice(0, 4)
      .map(h => {
        const duration = durationFor(h.habit);
        const start = findFreeSlot(taken, duration, from);
        taken.push({ startHour: Math.floor(start / 60), startMinute: start % 60, durationMinutes: duration } as TimeBlock);
        return { h, start, duration };
      });
  }, [goals, logs, blocks, day]);

  if (suggestions.length === 0) return null;

  const add = (items: typeof suggestions) => {
    const made: TimeBlock[] = items.map(({ h, start, duration }) => ({
      id: generateId(), dayName: day, categoryId: 'goals', title: h.habit.title, habitId: h.habit.id,
      startHour: Math.floor(start / 60), startMinute: start % 60, durationMinutes: duration,
    }));
    stores.TIME_BLOCKS.update(prev => [...prev, ...made]);
    const ids = new Set(made.map(b => b.id));
    toast.success(made.length === 1 ? `${made[0].title} at ${formatClock(items[0].start)}` : `${made.length} practices added`, {
      action: { label: 'Undo', onClick: () => stores.TIME_BLOCKS.update(prev => prev.filter(b => !ids.has(b.id))) },
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
        {suggestions.map(sg => (
          <button key={sg.h.habit.id} type="button" onClick={() => add([sg])}
            className="pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-primary/10 pl-3 pr-2.5 text-footnote font-semibold text-primary">
            {sg.h.habit.title} · {formatClock(sg.start)} <Plus className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
      {suggestions.length > 1 && (
        <button type="button" onClick={() => add(suggestions)} className="h-9 shrink-0 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground">Fit all</button>
      )}
    </div>
  );
}
