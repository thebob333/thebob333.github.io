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

export type EditTarget =
  | { kind: 'goal'; goal: Goal }
  | { kind: 'phase'; goalId: string; phase: Phase }
  | { kind: 'task'; goalId: string; phaseId: string; task: Task }
  | { kind: 'todo'; goalId: string; phaseId: string; taskId: string; todo: ToDo }
  | { kind: 'habit'; goalId: string; phaseId: string; taskId: string; habit: Habit };

const TITLES = { goal: 'Edit goal', phase: 'Edit phase', task: 'Edit task', todo: 'Edit to-do', habit: 'Edit habit' } as const;
const FREQUENCIES = ['daily', 'weekdays', 'weekends', '3x/week', '4x/week', '5x/week', 'mon/wed/fri', 'tue/thu'];

interface Form {
  title: string;
  description: string;
  endGoal: string;
  deadline: string;
  domain: string;
  status: Status;
  effort: string;
  isBenchmark: boolean;
  frequency: string;
  target: string;
}

function initial(t: EditTarget): Form {
  const base: Form = { title: '', description: '', endGoal: '', deadline: '', domain: '', status: 'not_started', effort: '', isBenchmark: false, frequency: 'daily', target: '' };
  switch (t.kind) {
    case 'goal': return { ...base, title: t.goal.title, description: t.goal.description ?? '', endGoal: t.goal.endGoal ?? '', deadline: t.goal.deadline ?? '', domain: t.goal.domain ?? '' };
    case 'phase': return { ...base, title: t.phase.title, description: t.phase.description ?? '', deadline: t.phase.deadline ?? '' };
    case 'task': return { ...base, title: t.task.title, description: t.task.description ?? '', deadline: t.task.deadline ?? '', status: t.task.status };
    case 'todo': return { ...base, title: t.todo.title, deadline: t.todo.deadline ?? '', effort: t.todo.effort ?? '', isBenchmark: !!t.todo.isBenchmark };
    case 'habit': return { ...base, title: t.habit.title, frequency: t.habit.frequency, target: t.habit.target ?? '' };
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
      case 'habit':
        goalActions.updateHabit(target.goalId, target.phaseId, target.taskId, target.habit.id, {
          title, frequency: form.frequency.trim() || 'daily', target: form.target.trim() || undefined,
        });
        break;
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
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); save(); }}>
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
            {kind === 'habit' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-freq">How often</Label>
                  <Input id="edit-freq" list="habit-frequencies" value={form.frequency} onChange={e => set({ frequency: e.target.value })} />
                  <datalist id="habit-frequencies">{FREQUENCIES.map(f => <option key={f} value={f} />)}</datalist>
                  <p className="text-xs text-muted-foreground">e.g. daily, weekdays, 3x/week, mon/wed/fri</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-target">Target (optional)</Label>
                  <Input id="edit-target" value={form.target} onChange={e => set({ target: e.target.value })} placeholder="e.g. 30 minutes, 150g protein" />
                </div>
              </>
            )}
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
