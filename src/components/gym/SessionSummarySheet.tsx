import { useState } from 'react';
import { ArrowDown, ArrowUp, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { workoutActions } from '@/hooks/useWorkouts';
import { fmtLb } from '@/lib/gym-format';
import type { SessionSummary } from '@/lib/gym-stats';

/** What you just did, what you beat, and what's planned for next time (with Undo on lighter weeks). */
export function SessionSummarySheet({ summary, onClose }: { summary: SessionSummary | null; onClose: () => void }) {
  const [undone, setUndone] = useState<string[]>([]);
  if (!summary) return null;

  const stat = (value: string, label: string) => (
    <div className="surface px-2 py-3 text-center">
      <p className="text-[22px] font-bold leading-7 tabular-nums">{value}</p>
      <p className="text-footnote text-muted-foreground">{label}</p>
    </div>
  );

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">Workout done</DialogTitle></DialogHeader>
        <div className="-mx-1 max-h-[66vh] space-y-4 overflow-y-auto px-1 pb-1">
          <div className="grid grid-cols-3 gap-2">
            {stat(summary.minutes ? `${summary.minutes}m` : '—', 'time')}
            {stat(String(summary.sets), summary.sets === 1 ? 'set' : 'sets')}
            {stat(fmtLb(summary.volume), 'lb moved')}
          </div>
          {summary.vsLast !== null && (
            <p className={`flex items-center gap-1 text-body font-medium ${summary.vsLast >= 0 ? 'text-success' : 'text-muted-foreground'}`}>
              {summary.vsLast >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              {Math.abs(summary.vsLast)}% {summary.vsLast >= 0 ? 'more' : 'less'} volume than your last session like this
            </p>
          )}

          {summary.records.length > 0 && (
            <div className="rounded-2xl bg-warning/15 p-3">
              <p className="flex items-center gap-1.5 text-footnote font-semibold text-warning"><Trophy className="h-4 w-4" /> New record{summary.records.length > 1 ? 's' : ''}</p>
              {summary.records.map(r => <p key={r.label} className="text-body font-semibold">{r.label} · {r.value}</p>)}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-headline">Next time</p>
            {summary.next.length === 0 ? (
              <p className="text-footnote text-muted-foreground">Same targets. Hit the top of the rep range on every set and the weight goes up.</p>
            ) : (
              <div className="list-group">
                {summary.next.map(n => {
                  const gone = undone.includes(n.exercise);
                  return (
                    <div key={n.exercise} className="flex items-center gap-3 px-4 py-3">
                      {n.kind === 'lighter' ? <ArrowDown className="h-4 w-4 shrink-0 text-warning" /> : <ArrowUp className="h-4 w-4 shrink-0 text-success" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium">{n.label}: {n.from} → {n.to} {n.unit}</p>
                        <p className="text-footnote text-muted-foreground">
                          {n.kind === 'lighter' ? (gone ? 'Kept at your current weight' : 'Stalled lately — a lighter week, then build back up') : n.kind === 'reps' ? 'More reps before more weight' : 'You earned it'}
                        </p>
                      </div>
                      {n.kind === 'lighter' && !gone && (
                        <button type="button" className="h-9 rounded-full bg-secondary px-3 text-footnote font-semibold" onClick={() => {
                          workoutActions.updateConfig(n.exercise, { currentWeight: n.from });
                          setUndone(u => [...u, n.exercise]);
                          toast.success(`${n.label} stays at ${n.from} lb`);
                        }}>Undo</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={onClose}>Done</Button>
      </DialogContent>
    </Dialog>
  );
}
