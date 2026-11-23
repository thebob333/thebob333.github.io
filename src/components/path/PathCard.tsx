import { useMemo, useState } from 'react';
import { ChevronRight, Map as MapIcon, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { buildPath, pathDate, type PathNode } from '@/lib/path';
import type { DateKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';
import { cn } from '@/lib/utils';
import { PathMap } from './PathMap';
import { PathView } from './PathView';

const TONE = { ahead: 'text-success', 'on-track': 'text-success', 'at-risk': 'text-warning', behind: 'text-destructive' } as const;
const LABEL = { ahead: 'ahead of target', 'on-track': 'on track', 'at-risk': 'target at risk', behind: 'behind target' } as const;

/** The Path at a glance on a goal; tap for the full map. */
export function PathCard({ goal, today, onOpenTask, onRethink }: {
  goal: Goal;
  today: DateKey;
  onOpenTask: (node: PathNode) => void;
  onRethink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const plan = useMemo(() => buildPath(goal, today), [goal, today]);
  if (!plan.nodes.length) return null;
  const unseen = (goal.architect?.history ?? []).filter(h => !h.seen).length;

  return (
    <section className="space-y-2">
      <h2 className="section-label">The Path</h2>
      <button type="button" onClick={() => setOpen(true)} className="pressable surface block w-full overflow-hidden text-left">
        <div className="flex items-start gap-3 px-4 pt-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><MapIcon className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-headline">{plan.finish ? <>Likely done {pathDate(plan.finish, today)}</> : 'Every step done 🎉'}</p>
            <p className="text-footnote text-muted-foreground">
              {plan.vsDeadline && <span className={cn('font-semibold', TONE[plan.vsDeadline])}>{LABEL[plan.vsDeadline]} · </span>}
              {Math.round(plan.remainingHours)}h left at {plan.hoursPerWeek}h/week
              {unseen > 0 && <span className="font-semibold text-info"> · plan updated</span>}
            </p>
          </div>
          <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        <div className="pointer-events-none mt-2 max-h-[150px] overflow-hidden">
          <PathMap plan={plan} today={today} compact />
        </div>
        {plan.bottleneck && (
          <p className="flex items-center gap-1.5 border-t border-border/70 px-4 py-2.5 text-footnote">
            <Zap className="h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="truncate"><span className="text-muted-foreground">Matters most now:</span> <b>{plan.bottleneck.title}</b></span>
          </p>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-title">The Path</DialogTitle>
            <DialogDescription>{goal.title}</DialogDescription>
          </DialogHeader>
          <div className="-mx-1 max-h-[74vh] overflow-y-auto px-1 pb-1">
            <PathView goal={goal} today={today} onOpenTask={onOpenTask} onRethink={() => { setOpen(false); onRethink(); }} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
