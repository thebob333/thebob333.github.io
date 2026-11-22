import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { acceptAdjustment, runEngine, undoAdjustment } from '@/lib/adapt';
import { dateKeyOf, type DateKey } from '@/lib/dates';
import type { Adjustment } from '@/types/goals';

/** Latest day anything was done: a practice, a to-do or a workout. */
function lastActivityDay(): DateKey | undefined {
  let last = '';
  for (const l of stores.HABIT_LOGS.get()) if (l.completed && l.date > last) last = l.date;
  for (const s of stores.SESSIONS.get()) { const d = dateKeyOf(s.date); if (d > last) last = d; }
  for (const g of stores.GOALS.get()) for (const p of g.phases) for (const t of p.tasks) for (const td of t.todos ?? []) {
    if (td.doneAt) { const d = dateKeyOf(td.doneAt); if (d > last) last = d; }
  }
  return last || undefined;
}

const setStatus = (id: string, status: Adjustment['status']) =>
  stores.ADJUSTMENTS.update(prev => prev.map(a => (a.id === id ? { ...a, status, seen: true } : a)));

export const engineActions = {
  /** Safe to call often: it only changes anything once per week or after a clear slip. */
  run(today: DateKey) {
    const res = runEngine({
      goals: stores.GOALS.get(),
      logs: stores.HABIT_LOGS.get(),
      adjustments: stores.ADJUSTMENTS.get(),
      state: stores.ENGINE.get(),
      today,
      lastActivity: lastActivityDay(),
    });
    if (!res.changed) return;
    if (res.goals !== stores.GOALS.get()) stores.GOALS.set(res.goals);
    if (res.added.length) stores.ADJUSTMENTS.update(prev => [...prev, ...res.added].slice(-300));
    stores.ENGINE.set(res.state);
  },

  undo(id: string) {
    const a = stores.ADJUSTMENTS.get().find(x => x.id === id);
    if (!a || a.status !== 'applied') return;
    stores.GOALS.update(goals => undoAdjustment(goals, a));
    setStatus(id, 'undone');
    toast.success(`${a.title}: change undone`);
  },

  accept(id: string) {
    const a = stores.ADJUSTMENTS.get().find(x => x.id === id);
    if (!a || a.status !== 'pending') return;
    stores.GOALS.update(goals => acceptAdjustment(goals, a));
    setStatus(id, 'applied');
  },

  decline(id: string) {
    setStatus(id, 'declined');
  },

  dismiss(ids: string[]) {
    const set = new Set(ids);
    stores.ADJUSTMENTS.update(prev => (prev.some(a => set.has(a.id) && !a.seen) ? prev.map(a => (set.has(a.id) ? { ...a, seen: true } : a)) : prev));
  },
};

/** Runs the engine when the app opens and again at midnight / when it resumes. */
export function useEngineRunner() {
  const today = useTodayKey();
  useEffect(() => {
    engineActions.run(today);
  }, [today]);
}

/** Changes you haven't looked at yet (newest first). */
export function useUnseenAdjustments(): Adjustment[] {
  const all = useStore(stores.ADJUSTMENTS);
  return useMemo(() => all.filter(a => !a.seen).sort((a, b) => b.at.localeCompare(a.at)), [all]);
}
