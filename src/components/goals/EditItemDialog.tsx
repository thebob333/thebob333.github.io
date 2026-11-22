import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EffortLevel, Goal, GoalDomain, Habit, Phase, Status, Task, ToDo } from '@/types/goals';
import { goalActions } from '@/hooks/useGoals';
import { toast } from 'sonner';
import { fixedDays, frequencyFor, maxPerWeekOf, perWeekOf } from '@/lib/practice';
import { cn } from '@/lib/utils';

export type EditTarget =
  | { kind: 'goal'; goal: Goal }
  | { kind: 'phase'; goalId: string; phase: Phase }
  | { kind: 'task'; goalId: string; phaseId: string; task: Task }
  | { kind: 'todo'; goalId: string; phaseId: string; taskId: string; todo: ToDo }
  | { kind: 'habit'; goalId: string; phaseId: string; taskId: string; habit: Habit };

const TITLES = { goal: 'Edit goal', phase: 'Edit stage', task: 'Edit task', todo: 'Edit step', habit: 'Edit practice' } as const;
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

interface Form {
  title: string;
  description: string;
  endGoal: string;
  deadline: string;
  domain: string;
  status: Status;
  effort: string;
  isBenchmark: boolean;
  target: string;
  perWeek: number;
  maxPerWeek: number;
  days: number[];
  amount: string;
  unit: string;
  step: string;
  maxAmount: string;
  minimum: string;
  auto: boolean;
}

function initial(t: EditTarget): Form {
  const base: Form = {
    title: '', description: '', endGoal: '', deadline: '', domain: '', status: 'not_started', effort: '', isBenchmark: false, target: '',
    perWeek: 3, maxPerWeek: 3, days: [], amount: '', unit: '', step: '', maxAmount: '', minimum: '', auto: true,
  };
  switch (t.kind) {
    case 'goal': return { ...base, title: t.goal.title, description: t.goal.description ?? '', endGoal: t.goal.endGoal ?? '', deadline: t.goal.deadline ?? '', domain: t.goal.domain ?? '' };
    case 'phase': return { ...base, title: t.phase.title, description: t.phase.description ?? '', deadline: t.phase.deadline ?? '' };
    case 'task': return { ...base, title: t.task.title, description: t.task.description ?? '', deadline: t.task.deadline ?? '', status: t.task.status };
    case 'todo': return { ...base, title: t.todo.title, deadline: t.todo.deadline ?? '', effort: t.todo.effort ?? '', isBenchmark: !!t.todo.isBenchmark };
    case 'habit': {
      const h = t.habit;
      return {
        ...base, title: h.title, target: h.target ?? '',
        perWeek: perWeekOf(h), maxPerWeek: maxPerWeekOf(h), days: fixedDays(h) ?? [],
        amount: h.amount?.toString() ?? '', unit: h.unit ?? '', step: h.step?.toString() ?? '', maxAmount: h.maxAmount?.toString() ?? '',
        minimum: h.minimum ?? '', auto: h.auto !== false,
      };
    }
  }
}

/** One sheet to edit anything in the goal tree. */
export function EditItemDialog({ target, onClose }: { target: EditTarget | null; onClose: () => void }) {
  const [form, setForm] = useState<Form | null>(null);
  useEffect(() => { setForm(target ? initial(target) : null); }, [target]);
  const set = (patch: Partial<Form>) => setForm(f => (f ? { ...f, ...patch } : f));

  const save = () => {
    if (!target || !form || !form.title.trim()) return;
    const title = form.title.trim();
    const deadline = form.deadline || undefined;
    switch (target.kind) {
      case 'goal':
        goalActions.updateGoal(target.goal.id, { title, description: form.description, endGoal: form.endGoal, deadline, domain: (form.domain || undefined) as GoalDomain });
        break;
      case 'phase':
        goalActions.updatePhase(target.goalId, target.phase.id, { title, description: form.description, deadline });
        break;
      case 'task':
        goalActions.updateTask(target.goalId, target.phaseId, target.task.id, {
          title, description: form.description, deadline,
          // Status only matters for tasks without to-dos (otherwise it's worked out from the to-dos).
          ...(target.task.todos.length === 0 ? { status: form.status } : {}),
        });
        break;
      case 'todo':
        goalActions.updateToDo(target.goalId, target.phaseId, target.taskId, target.todo.id, {
          title, deadline, effort: (form.effort || undefined) as EffortLevel, isBenchmark: form.isBenchmark || undefined,
        });
        break;
      case 'habit': {
        const n = (v: string) => (v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : undefined);
        const perWeek = form.days.length || form.perWeek;
        const frequency = form.days.length && form.days.length < 7
          ? DAY_ORDER.filter(d => form.days.includes(d)).map(d => DAY_KEYS[d]).join('/')
          : frequencyFor(perWeek);
        goalActions.updateHabit(target.goalId, target.phaseId, target.taskId, target.habit.id, {
          title, frequency, perWeek, maxPerWeek: Math.max(perWeek, form.maxPerWeek),
          target: form.target.trim() || undefined,
          amount: n(form.amount), unit: form.unit.trim() || undefined, step: n(form.step), maxAmount: n(form.maxAmount),
          minimum: form.minimum.trim() || undefined, auto: form.auto,
        });
        break;
      }
    }
    toast.success('Saved');
    onClose();
  };

  const kind = target?.kind;
  const hasDeadline = kind && kind !== 'habit';
  const hasDescription = kind === 'goal' || kind === 'phase' || kind === 'task';

  return (
    <Dialog open={!!target} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{kind ? TITLES[kind] : ''}</DialogTitle></DialogHeader>
        {form && (
          <form className="-mx-1 max-h-[72vh] space-y-4 overflow-y-auto px-1 pb-1 pt-1" onSubmit={e => { e.preventDefault(); save(); }}>
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Input id="edit-title" value={form.title} onChange={e => set({ title: e.target.value })} autoFocus />
            </div>
            {hasDescription && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-desc">Description</Label>
                <Textarea id="edit-desc" value={form.description} onChange={e => set({ description: e.target.value })} rows={3} />
              </div>
            )}
            {kind === 'goal' && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-end">What success looks like</Label>
                <Textarea id="edit-end" value={form.endGoal} onChange={e => set({ endGoal: e.target.value })} rows={2} />
              </div>
            )}
            {hasDeadline && (
              <div className="space-y-1.5">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <div className="flex gap-2">
                  <Input id="edit-deadline" type="date" value={form.deadline} onChange={e => set({ deadline: e.target.value })} />
                  {form.deadline && <Button type="button" variant="ghost" className="h-10" onClick={() => set({ deadline: '' })}>Clear</Button>}
                </div>
              </div>
            )}
            {kind === 'goal' && (
              <div className="space-y-1.5">
                <Label>Area of life</Label>
                <Select value={form.domain || 'none'} onValueChange={v => set({ domain: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="PHYSICAL">Physical</SelectItem>
                    <SelectItem value="CREATIVE">Creative</SelectItem>
                    <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                    <SelectItem value="INTELLECTUAL">Intellectual</SelectItem>
                    <SelectItem value="LIFESTYLE">Lifestyle</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {kind === 'task' && target.kind === 'task' && target.task.todos.length === 0 && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {(['not_started', 'in_progress', 'complete'] as Status[]).map(st => (
                    <button key={st} type="button" role="radio" aria-checked={form.status === st} onClick={() => set({ status: st })}
                      className={`h-9 rounded-lg text-xs font-medium ${form.status === st ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>
                      {st === 'not_started' ? 'Not started' : st === 'in_progress' ? 'In progress' : 'Done'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">This task has no to-dos, so you set its progress here.</p>
              </div>
            )}
            {kind === 'todo' && (
              <>
                <div className="space-y-1.5">
                  <Label>Effort</Label>
                  <div role="radiogroup" className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">
                    {[['', 'Unset'], ['LOW', 'Low'], ['MED', 'Medium'], ['HIGH', 'High']].map(([v, l]) => (
                      <button key={l} type="button" role="radio" aria-checked={form.effort === v} onClick={() => set({ effort: v })}
                        className={`h-9 rounded-lg text-xs font-medium ${form.effort === v ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={form.isBenchmark} onChange={e => set({ isBenchmark: e.target.checked })} />
                  Benchmark (a milestone that proves progress)
                </label>
              </>
            )}
            {kind === 'habit' && (() => {
              const chip = (on: boolean) => cn('pressable h-9 min-w-9 rounded-full px-3 text-footnote font-semibold', on ? 'bg-primary text-primary-foreground' : 'bg-secondary');
              const perWeek = form.days.length || form.perWeek;
              return (
                <>
                  <div className="space-y-1.5">
                    <Label>How often, right now</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[7, 6, 5, 4, 3, 2, 1].map(n => (
                        <button key={n} type="button" className={chip(!form.days.length && form.perWeek === n)} onClick={() => set({ perWeek: n, days: [], maxPerWeek: Math.max(n, form.maxPerWeek) })}>
                          {n === 7 ? 'Daily' : `${n}×`}
                        </button>
                      ))}
                    </div>
                    <p className="pt-1 text-xs text-muted-foreground">Or on set days:</p>
                    <div className="flex gap-1.5">
                      {DAY_ORDER.map(d => {
                        const on = form.days.includes(d);
                        return (
                          <button key={d} type="button" aria-pressed={on} aria-label={DAY_KEYS[d]} className={cn(chip(on), 'flex-1 px-0')}
                            onClick={() => {
                              const days = on ? form.days.filter(x => x !== d) : [...form.days, d];
                              set({ days, maxPerWeek: Math.max(days.length, form.maxPerWeek) });
                            }}>
                            {DAY_KEYS[d].slice(0, 1).toUpperCase()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Building toward</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {[7, 6, 5, 4, 3, 2, 1].filter(n => n >= perWeek).map(n => (
                        <button key={n} type="button" className={chip(Math.max(perWeek, form.maxPerWeek) === n)} onClick={() => set({ maxPerWeek: n })}>
                          {n === 7 ? 'Daily' : `${n}×/week`}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">When you keep hitting the plan, it steps up toward this. When life gets busy, it eases off.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount per session (optional)</Label>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <Input type="number" inputMode="decimal" value={form.amount} onChange={e => set({ amount: e.target.value })} placeholder="e.g. 20" />
                      <Input value={form.unit} onChange={e => set({ unit: e.target.value })} placeholder="minutes, pages…" />
                    </div>
                    {form.amount && (
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="number" inputMode="decimal" value={form.step} onChange={e => set({ step: e.target.value })} placeholder="Grow by (e.g. 5)" aria-label="Grow by" />
                        <Input type="number" inputMode="decimal" value={form.maxAmount} onChange={e => set({ maxAmount: e.target.value })} placeholder="Up to (optional)" aria-label="Up to" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-min">Easy version for bad weeks</Label>
                    <Input id="edit-min" value={form.minimum} onChange={e => set({ minimum: e.target.value })} placeholder="e.g. Put on shoes and walk 10 minutes" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-target">Details (optional)</Label>
                    <Input id="edit-target" value={form.target} onChange={e => set({ target: e.target.value })} placeholder="e.g. easy pace, 150g protein" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>When the plan adapts</Label>
                    <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                      {([[true, 'Automatically'], [false, 'Ask me first']] as const).map(([v, l]) => (
                        <button key={l} type="button" role="radio" aria-checked={form.auto === v} onClick={() => set({ auto: v })}
                          className={`h-9 rounded-lg text-xs font-medium ${form.auto === v ? 'bg-card shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Either way you see every change on Today, with Undo.</p>
                  </div>
                </>
              );
            })()}
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" className="h-11 flex-1" onClick={onClose}>Cancel</Button>
              <Button type="submit" className="h-11 flex-1 font-semibold" disabled={!form.title.trim()}>Save</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
