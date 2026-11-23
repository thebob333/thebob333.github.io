import { toast } from 'sonner';
import { stores, generateId } from '@/lib/storage';
import { metricActions } from '@/hooks/useMetrics';
import { dateKeyOf } from '@/lib/dates';
import type { CardioEntry } from '@/types/workout';

export const cardioActions = {
  /** Log a cardio session; optionally also log its time (minutes) to a "get better" goal. */
  add(entry: Omit<CardioEntry, 'id'>, logToGoalId?: string): CardioEntry {
    const e: CardioEntry = { ...entry, id: generateId() };
    stores.CARDIO.update(list => [...list, e]);
    if (logToGoalId) metricActions.log(logToGoalId, Math.round((e.seconds / 60) * 100) / 100, dateKeyOf(e.date));
    else toast.success('Logged', { action: { label: 'Undo', onClick: () => cardioActions.remove(e.id, true) } });
    return e;
  },
  remove(id: string, silent = false) {
    const removed = stores.CARDIO.get().find(x => x.id === id);
    stores.CARDIO.update(list => list.filter(x => x.id !== id));
    if (removed && !silent) toast.success('Removed', { action: { label: 'Undo', onClick: () => stores.CARDIO.update(list => [...list, removed]) } });
  },
};
