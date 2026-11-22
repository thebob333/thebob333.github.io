import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { goalActions } from '@/hooks/useGoals';
import { PUSHBACK, SHAPES, STATUSES } from '@/lib/goal-shapes';
import type { Goal, GoalShape, GoalStatus, Pushback } from '@/types/goals';
import { cn } from '@/lib/utils';

interface Form {
  title: string; why: string; endGoal: string; deadline: string;
  shape: GoalShape; pushback: Pushback; status: GoalStatus;
  metricName: string; metricUnit: string; metricStart: string; metricTarget: string; higherIsBetter: boolean;
}

const fromGoal = (g: Goal): Form => ({
  title: g.title, why: g.why ?? '', endGoal: g.endGoal ?? '', deadline: g.deadline ?? '',
  shape: g.shape ?? 'build', pushback: g.pushback ?? 'honest', status: g.status ?? 'active',
  metricName: g.metric?.name ?? '', metricUnit: g.metric?.unit ?? '',
  metricStart: g.metric?.start?.toString() ?? '', metricTarget: g.metric?.target?.toString() ?? '',
  higherIsBetter: g.metric?.higherIsBetter ?? true,
});

const num = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) ? Number(s) : undefined);

/** Everything about a goal in one place: what it is, why, its shape, the coach's style and its status. */
export function GoalSettingsSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [f, setF] = useState<Form | null>(null);
  useEffect(() => { setF(goal ? fromGoal(goal) : null); }, [goal]);
  if (!goal || !f) return null;
  const set = (p: Partial<Form>) => setF(prev => ({ ...prev!, ...p }));

  const save = () => {
    if (!f.title.trim()) return;
    const metric = f.shape === 'better' && f.metricName.trim()
      ? { name: f.metricName.trim(), unit: f.metricUnit.trim(), start: num(f.metricStart), target: num(f.metricTarget), higherIsBetter: f.higherIsBetter }
      : goal.metric;
    goalActions.updateGoal(goal.id, {
      title: f.title.trim(), why: f.why.trim() || undefined, endGoal: f.endGoal.trim(), deadline: f.deadline || undefined,
      shape: f.shape, pushback: f.pushback, status: f.status, metric,
    });
    toast.success(f.status !== (goal.status ?? 'active') && f.status !== 'active'
      ? `Goal marked ${STATUSES.find(s => s.value === f.status)!.label.toLowerCase()}`
      : 'Saved');
    onClose();
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">Goal settings</DialogTitle></DialogHeader>
        <form className="-mx-1 max-h-[68vh] space-y-5 overflow-y-auto px-1 pb-1 pt-1" onSubmit={e => { e.preventDefault(); save(); }}>
          <Input value={f.title} onChange={e => set({ title: e.target.value })} className="h-12 rounded-xl text-body font-semibold" aria-label="Goal" />

          <div>
            <FieldLabel>Why it matters</FieldLabel>
            <Textarea value={f.why} onChange={e => set({ why: e.target.value })} rows={2} className="rounded-xl" placeholder="The real reason. You'll see it when things get hard." />
          </div>

          <div>
            <FieldLabel>What kind of goal is it?</FieldLabel>
            <div className="grid gap-2">
              {SHAPES.map(s => {
                const on = f.shape === s.value;
                const Icon = s.icon;
                return (
                  <button key={s.value} type="button" aria-pressed={on} onClick={() => set({ shape: s.value })}
                    className={cn('pressable flex items-center gap-3 rounded-xl px-3 py-2.5 text-left', on ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-body font-semibold">{s.label}</span>
                      <span className={cn('block text-footnote', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{s.examples}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {f.shape === 'better' && (
            <div className="rounded-2xl bg-secondary/60 p-3">
              <FieldLabel>What you measure</FieldLabel>
              <div className="grid grid-cols-[1fr_96px] gap-2">
                <Input value={f.metricName} onChange={e => set({ metricName: e.target.value })} placeholder="e.g. 5K time" className="h-11 rounded-xl bg-card" />
                <Input value={f.metricUnit} onChange={e => set({ metricUnit: e.target.value })} placeholder="unit" className="h-11 rounded-xl bg-card" />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Input type="number" inputMode="decimal" value={f.metricStart} onChange={e => set({ metricStart: e.target.value })} placeholder="Where you are" className="h-11 rounded-xl bg-card" />
                <Input type="number" inputMode="decimal" value={f.metricTarget} onChange={e => set({ metricTarget: e.target.value })} placeholder="Target" className="h-11 rounded-xl bg-card" />
              </div>
              <div className="mt-2">
                <Chips<string> label="Direction" value={f.higherIsBetter ? 'up' : 'down'} onChange={v => set({ higherIsBetter: v === 'up' })}
                  options={[{ value: 'up', label: 'Higher is better' }, { value: 'down', label: 'Lower is better' }]} />
              </div>
            </div>
          )}

          <div>
            <FieldLabel>Coach style</FieldLabel>
            <Chips<Pushback> label="Coach style" value={f.pushback} onChange={pushback => set({ pushback })} options={PUSHBACK} />
            <p className="mt-1.5 text-footnote text-muted-foreground">{PUSHBACK.find(p => p.value === f.pushback)!.hint} It challenges the path, never your ambition.</p>
          </div>

          <div>
            <FieldLabel>What success looks like</FieldLabel>
            <Textarea value={f.endGoal} onChange={e => set({ endGoal: e.target.value })} rows={2} className="rounded-xl" placeholder="How you'll know it's done" />
          </div>

          <div>
            <FieldLabel>Target date</FieldLabel>
            <div className="flex gap-2">
              <Input type="date" value={f.deadline} onChange={e => set({ deadline: e.target.value })} className="h-11 rounded-xl" />
              {f.deadline && <Button type="button" variant="ghost" className="h-11" onClick={() => set({ deadline: '' })}>Clear</Button>}
            </div>
          </div>

          <div>
            <FieldLabel>Status</FieldLabel>
            <Chips<GoalStatus> label="Status" value={f.status} onChange={status => set({ status })} options={STATUSES} />
            {f.status === 'paused' && <p className="mt-1.5 text-footnote text-muted-foreground">Paused goals leave Today and aren't adjusted until you resume them.</p>}
          </div>
        </form>
        <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={save} disabled={!f.title.trim()}>Save</Button>
      </DialogContent>
    </Dialog>
  );
}
