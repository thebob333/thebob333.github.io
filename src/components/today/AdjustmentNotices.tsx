import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Flag, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import type { Adjustment, PracticeLoad } from '@/types/goals';
import { engineActions, useUnseenAdjustments } from '@/hooks/useAdaptation';
import { cn } from '@/lib/utils';

const loadText = (l: PracticeLoad) => `${l.perWeek >= 7 ? 'Daily' : `${l.perWeek}×/wk`}${l.amount !== undefined ? ` · ${l.amount}` : ''}`;

const META: Record<Adjustment['kind'], { icon: typeof TrendingUp; tone: string; label: string }> = {
  up: { icon: TrendingUp, tone: 'text-success bg-success/10', label: 'Stepped up' },
  ease: { icon: TrendingDown, tone: 'text-warning bg-warning/15', label: 'Eased off' },
  restart: { icon: RotateCcw, tone: 'text-primary bg-primary/10', label: 'Restart week' },
  flag: { icon: Flag, tone: 'text-info bg-info/10', label: 'Worth a rethink' },
};

function Notice({ a }: { a: Adjustment }) {
  const navigate = useNavigate();
  const m = META[a.kind];
  const Icon = m.icon;
  const changed = a.kind !== 'flag' && (a.before.perWeek !== a.after.perWeek || a.before.amount !== a.after.amount);
  const btn = 'pressable h-9 rounded-full px-3.5 text-footnote font-semibold';

  return (
    <div className="flex gap-3 px-4 py-3.5">
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.tone)}><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-footnote font-semibold text-muted-foreground">{a.status === 'pending' ? 'Suggested' : m.label}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-body font-semibold">
          {a.title}
          {changed && <span className="flex items-center gap-1 text-footnote font-medium tabular-nums text-muted-foreground">{loadText(a.before)} <ArrowRight className="h-3 w-3" /> <span className="text-foreground">{loadText(a.after)}</span></span>}
        </p>
        <p className="mt-0.5 text-footnote text-muted-foreground">{a.reason}</p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {a.status === 'pending' ? (
            <>
              <button type="button" className={cn(btn, 'bg-primary text-primary-foreground')} onClick={() => engineActions.accept(a.id)}>Accept</button>
              <button type="button" className={cn(btn, 'bg-secondary')} onClick={() => engineActions.decline(a.id)}>Keep as is</button>
            </>
          ) : a.kind === 'flag' ? (
            <>
              <button type="button" className={cn(btn, 'bg-primary text-primary-foreground')} onClick={() => { engineActions.dismiss([a.id]); navigate(`/goals/${a.goalId}`); }}>Open goal</button>
              <button type="button" className={cn(btn, 'bg-secondary')} onClick={() => engineActions.dismiss([a.id])}>Got it</button>
            </>
          ) : (
            <>
              <button type="button" className={cn(btn, 'bg-secondary')} onClick={() => engineActions.dismiss([a.id])}>Got it</button>
              {changed && <button type="button" className={cn(btn, 'text-muted-foreground')} onClick={() => engineActions.undo(a.id)}>Undo</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "What changed and why": every automatic adjustment is visible, explained in
 * one sentence, and can be undone. Restart weeks are grouped into one card.
 */
export function AdjustmentNotices() {
  const unseen = useUnseenAdjustments();
  const [showAll, setShowAll] = useState(false);
  if (unseen.length === 0) return null;

  const restarts = unseen.filter(a => a.kind === 'restart' && a.status === 'applied');
  const others = unseen.filter(a => !(a.kind === 'restart' && a.status === 'applied'));
  const shown = showAll ? others : others.slice(0, 2);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="section-label">Your plan adapted</h2>
        {unseen.length > 1 && (
          <button type="button" onClick={() => engineActions.dismiss(unseen.filter(a => a.status !== 'pending').map(a => a.id))} className="text-footnote font-semibold text-primary">
            Dismiss all
          </button>
        )}
      </div>
      <div className="list-group">
        {restarts.length > 0 && (
          <div className="flex gap-3 px-4 py-3.5">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><RotateCcw className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-body font-semibold">Welcome back — this is a restart week</p>
              <p className="mt-0.5 text-footnote text-muted-foreground">
                No catching up. For the next 7 days, just the easy version of {restarts.length === 1 ? restarts[0].title : `${restarts.length} practices`}, then the plan builds back up on its own.
              </p>
              <div className="mt-2.5 flex gap-2">
                <button type="button" className="pressable h-9 rounded-full bg-primary px-3.5 text-footnote font-semibold text-primary-foreground" onClick={() => engineActions.dismiss(restarts.map(r => r.id))}>Let's go</button>
                <button type="button" className="pressable h-9 rounded-full px-3.5 text-footnote font-semibold text-muted-foreground" onClick={() => restarts.forEach(r => engineActions.undo(r.id))}>Undo</button>
              </div>
            </div>
          </div>
        )}
        {shown.map(a => <Notice key={a.id} a={a} />)}
      </div>
      {others.length > 2 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="w-full py-1 text-footnote font-semibold text-primary">
          {showAll ? 'Show fewer' : `Show ${others.length - 2} more`}
        </button>
      )}
    </section>
  );
}
