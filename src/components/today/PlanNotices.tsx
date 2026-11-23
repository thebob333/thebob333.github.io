import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { undoLastChange } from '@/lib/day-zero';

const btn = 'pressable h-9 rounded-full px-3.5 text-footnote font-semibold';

/** When a Day Zero plan rebuilt itself (you slipped or got ahead): what changed, with Undo. */
export function PlanNotices() {
  const navigate = useNavigate();
  const goals = useStore(stores.GOALS);
  const items = useMemo(() => goals.flatMap(g => {
    const h = (g.architect?.history ?? []).filter(x => !x.seen).at(-1);
    return h ? [{ goal: g, h }] : [];
  }), [goals]);
  if (!items.length) return null;

  const seen = (goalId: string) => stores.GOALS.update(list => list.map(g => (g.id === goalId && g.architect
    ? { ...g, architect: { ...g.architect, history: g.architect.history.map(x => ({ ...x, seen: true })) } } : g)));

  return (
    <section className="space-y-2">
      <h2 className="section-label">Your plans adjusted</h2>
      <div className="list-group">
        {items.map(({ goal, h }) => (
          <div key={h.id} className="flex gap-3 px-4 py-3.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info"><MapIcon className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-footnote font-semibold text-muted-foreground">Path rebuilt</p>
              <p className="text-body font-semibold">{goal.title}</p>
              <p className="mt-0.5 text-footnote text-muted-foreground">{h.note}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button type="button" className={`${btn} bg-primary text-primary-foreground`} onClick={() => { seen(goal.id); navigate(`/goals/${goal.id}`); }}>See the path</button>
                <button type="button" className={`${btn} bg-secondary`} onClick={() => seen(goal.id)}>OK</button>
                {goal.architect?.undo && (
                  <button type="button" className={`${btn} bg-secondary`} onClick={() => {
                    stores.GOALS.update(list => list.map(g => (g.id === goal.id ? undoLastChange(g, new Date(), () => crypto.randomUUID()) : g)));
                    seen(goal.id);
                    toast.success('Plan change undone');
                  }}>Undo</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
