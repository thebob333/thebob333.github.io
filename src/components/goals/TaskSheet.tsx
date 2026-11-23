import { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Pause, Pencil, Play, Plus, Send, Trash2, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { RowMenu } from '@/components/app/RowMenu';
import { CheckCircle } from '@/components/app/ListRow';
import { Input } from '@/components/ui/input';
import { useGoals, goalActions } from '@/hooks/useGoals';
import { useHabits } from '@/hooks/useHabits';
import { useTodayKey } from '@/hooks/useToday';
import { isHabitCompletedOn } from '@/lib/habits';
import { doneBetween, loadLabel, perWeekOf, weekStart } from '@/lib/practice';
import { addDays } from '@/lib/dates';
import { dueText } from '@/lib/goal-meta';
import { calculateTaskProgress } from '@/types/goals';
import type { EditTarget } from './EditItemDialog';
import { buildPath, effortOf, isPathTask, pathDate } from '@/lib/path';
import { cn } from '@/lib/utils';

export interface TaskRef { goalId: string; phaseId: string; taskId: string }

const FREQUENCIES = ['daily', 'weekdays', '3x/week', 'weekends', 'mon/wed/fri'];
const EFFORT_DOT: Record<string, string> = { LOW: 'bg-success', MED: 'bg-warning', HIGH: 'bg-destructive' };

/** Everything about one task in a single sheet: to-dos, habits and notes, with inline adding. */
export function TaskSheet({ target, onClose, onEdit }: { target: TaskRef | null; onClose: () => void; onEdit: (t: EditTarget) => void }) {
  const { goals, restoreGoal } = useGoals();
  const { logs, toggleCheckIn } = useHabits();
  const today = useTodayKey();
  const [todoDraft, setTodoDraft] = useState('');
  const [todoDate, setTodoDate] = useState('');
  const [habitDraft, setHabitDraft] = useState('');
  const [habitFreq, setHabitFreq] = useState('daily');
  const [noteDraft, setNoteDraft] = useState('');

  const goal = goals.find(g => g.id === target?.goalId);
  const phase = goal?.phases.find(p => p.id === target?.phaseId);
  const task = phase?.tasks.find(t => t.id === target?.taskId);
  const open = !!target && !!task;

  const withUndo = (message: string, action: () => void) => {
    const snapshot = goal;
    action();
    toast.success(message, snapshot ? { action: { label: 'Undo', onClick: () => restoreGoal(snapshot) } } : undefined);
  };

  if (!target) return null;
  const { goalId, phaseId, taskId } = target;
  const todos = task?.todos ?? [];
  const habits = task?.habits ?? [];
  const notes = [...(task?.notes ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const progress = task ? calculateTaskProgress(task) : 0;

  const addTodo = () => {
    if (!todoDraft.trim()) return;
    goalActions.addToDo(goalId, phaseId, taskId, todoDraft.trim(), todoDate || undefined);
    setTodoDraft('');
    setTodoDate('');
  };
  const addHabit = () => {
    if (!habitDraft.trim()) return;
    goalActions.addHabit(goalId, phaseId, taskId, habitDraft.trim(), habitFreq);
    setHabitDraft('');
  };
  const addNote = () => {
    if (!noteDraft.trim()) return;
    goalActions.addNote(goalId, phaseId, taskId, noteDraft.trim());
    setNoteDraft('');
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        {task && (
          <>
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-footnote font-medium text-muted-foreground">{goal?.title} · {phase?.title}</p>
                  <DialogTitle className="text-title">{task.title}</DialogTitle>
                </div>
                <RowMenu
                  label="Task actions"
                  className="bg-secondary"
                  items={[
                    { label: 'Edit task', icon: Pencil, onSelect: () => onEdit({ kind: 'task', goalId, phaseId, task }) },
                    ...(todos.length === 0 ? [{
                      label: task.status === 'complete' ? 'Mark not done' : 'Mark done',
                      icon: CheckCircle2,
                      onSelect: () => goalActions.updateTask(goalId, phaseId, taskId, { status: task.status === 'complete' ? 'not_started' : 'complete' }),
                    }] : []),
                    { label: 'Delete task', icon: Trash2, destructive: true, separated: true, onSelect: () => { onClose(); withUndo(`Deleted "${task.title}"`, () => goalActions.deleteTask(goalId, phaseId, taskId)); } },
                  ]}
                />
              </div>
            </DialogHeader>

            {task.description && <p className="-mt-1 mb-3 text-body text-muted-foreground">{task.description}</p>}

            <div className="mb-5 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-footnote font-semibold tabular-nums text-muted-foreground">{progress}%</span>
              {task.deadline && <span className="text-footnote text-muted-foreground">· {dueText(task.deadline)}</span>}
            </div>

            {/* To-dos */}
            <h3 className="mb-1.5 text-headline">To-dos</h3>
            <div className="list-group mb-5">
              {todos.map((todo, i) => (
                <div key={todo.id} className="flex min-h-[54px] items-center gap-3 px-4 py-1.5">
                  <CheckCircle done={todo.done} color="hsl(var(--tasks))" label={todo.title}
                    onToggle={() => goalActions.toggleToDo(goalId, phaseId, taskId, todo.id)} />
                  <div className="min-w-0 flex-1">
                    <p className={`flex items-center gap-1.5 text-body font-medium ${todo.done ? 'text-muted-foreground line-through' : ''}`}>
                      {todo.isBenchmark && <Trophy className="h-3.5 w-3.5 shrink-0 text-warning" />}
                      <span className="truncate">{todo.title}</span>
                    </p>
                    {(todo.deadline || todo.effort) && (
                      <p className="flex items-center gap-1.5 text-footnote text-muted-foreground">
                        {todo.effort && <span className={`h-1.5 w-1.5 rounded-full ${EFFORT_DOT[todo.effort]}`} />}
                        {todo.deadline && !todo.done && dueText(todo.deadline)}
                      </p>
                    )}
                  </div>
                  <RowMenu label={`Actions for ${todo.title}`} items={[
                    { label: 'Edit', icon: Pencil, onSelect: () => onEdit({ kind: 'todo', goalId, phaseId, taskId, todo }) },
                    { label: 'Move up', icon: ArrowUp, disabled: i === 0, onSelect: () => goalActions.reorderTodos(goalId, phaseId, taskId, todo.id, 'up') },
                    { label: 'Move down', icon: ArrowDown, disabled: i === todos.length - 1, onSelect: () => goalActions.reorderTodos(goalId, phaseId, taskId, todo.id, 'down') },
                    { label: 'Delete', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo('To-do deleted', () => goalActions.deleteToDo(goalId, phaseId, taskId, todo.id)) },
                  ]} />
                </div>
              ))}
              <form className="flex items-center gap-2 px-3 py-2" onSubmit={e => { e.preventDefault(); addTodo(); }}>
                <Plus className="ml-1 h-5 w-5 shrink-0 text-primary" />
                <Input value={todoDraft} onChange={e => setTodoDraft(e.target.value)} placeholder="Add a to-do" enterKeyHint="done"
                  className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
                {todoDraft && (
                  <label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-secondary text-muted-foreground" title="Due date">
                    <CalendarDays className="h-4 w-4" />
                    <input type="date" value={todoDate} onChange={e => setTodoDate(e.target.value)} className="absolute inset-0 opacity-0" aria-label="Due date" />
                  </label>
                )}
                {todoDraft && <button type="submit" className="h-9 shrink-0 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground">Add</button>}
              </form>
            </div>

            {/* Habits */}
            <h3 className="mb-1.5 text-headline">Practices</h3>
            <div className="list-group mb-5">
              {habits.map(h => {
                const done = isHabitCompletedOn(h.id, today, logs);
                const ws = weekStart(today);
                const weekDone = doneBetween(h.id, logs, ws, addDays(ws, 6));
                return (
                  <div key={h.id} className={`flex min-h-[54px] items-center gap-3 px-4 py-1.5 ${h.active ? '' : 'opacity-60'}`}>
                    <CheckCircle done={done} color="hsl(var(--habits))" label={h.title} onToggle={() => h.active && toggleCheckIn(h.id)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body font-medium">{h.title}{h.target ? ` · ${h.target}` : ''}</p>
                      <p className="flex items-center gap-1.5 text-footnote text-muted-foreground">
                        {h.active ? <>{loadLabel(h)}{perWeekOf(h) < 7 && <span className="font-semibold text-habits">· {Math.min(weekDone, perWeekOf(h))} of {perWeekOf(h)} this week</span>}</> : 'Paused'}
                      </p>
                    </div>
                    <RowMenu label={`Actions for ${h.title}`} items={[
                      { label: 'Edit', icon: Pencil, onSelect: () => onEdit({ kind: 'habit', goalId, phaseId, taskId, habit: h }) },
                      { label: h.active ? 'Pause' : 'Resume', icon: h.active ? Pause : Play, onSelect: () => goalActions.toggleHabit(goalId, phaseId, taskId, h.id) },
                      { label: 'Delete', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo('Practice deleted', () => goalActions.deleteHabit(goalId, phaseId, taskId, h.id)) },
                    ]} />
                  </div>
                );
              })}
              <form className="flex items-center gap-2 px-3 py-2" onSubmit={e => { e.preventDefault(); addHabit(); }}>
                <Plus className="ml-1 h-5 w-5 shrink-0 text-habits" />
                <Input value={habitDraft} onChange={e => setHabitDraft(e.target.value)} placeholder="Add a practice" enterKeyHint="done"
                  className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
                {habitDraft && (
                  <>
                    <select value={habitFreq} onChange={e => setHabitFreq(e.target.value)} aria-label="How often"
                      className="h-9 shrink-0 rounded-full bg-secondary px-2 text-footnote font-medium">
                      {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                    <button type="submit" className="h-9 shrink-0 rounded-full px-3 text-footnote font-semibold text-white" style={{ backgroundColor: 'hsl(var(--habits))' }}>Add</button>
                  </>
                )}
              </form>
            </div>

            {/* On the Path */}
            {goal && isPathTask(task) && (() => {
              const others = goal.phases.flatMap(p => p.tasks.filter(t => t.id !== task.id && isPathTask(t)));
              const plan = buildPath(goal, today);
              const node = plan.nodes.find(n => n.id === task.id);
              const deps = node?.deps ?? [];
              const toggleDep = (id: string) => {
                // First time links are set by hand: write down the stage-order links so nothing else changes.
                if (plan.implicit) {
                  const phases = goal.phases.map(p => ({ ...p, tasks: p.tasks.map(t => {
                    const n = plan.nodes.find(x => x.id === t.id);
                    return n ? { ...t, dependsOn: n.deps } : t;
                  }) }));
                  goalActions.updateGoal(goal.id, { phases });
                }
                const next = deps.includes(id) ? deps.filter(d => d !== id) : [...deps, id];
                goalActions.updateTask(goalId, phaseId, taskId, { dependsOn: next });
              };
              const num = (v: string) => (v.trim() === '' ? undefined : Math.max(0, Number(v) || 0));
              return (
                <div className="mb-5">
                  <h3 className="mb-1.5 text-headline">On the Path</h3>
                  <div className="surface space-y-3 p-3">
                    {node && node.state !== 'done' && (
                      <p className="text-footnote text-muted-foreground">
                        Planned {node.start === node.end ? pathDate(node.end, today) : `${pathDate(node.start, today)} – ${pathDate(node.end, today)}`}
                        {node.critical && <span className="font-semibold text-warning"> · sets your finish date</span>}
                        {node.downstream > 0 && <> · {node.downstream} step{node.downstream === 1 ? '' : 's'} wait on this</>}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block">
                        <span className="mb-1 block text-footnote font-semibold text-muted-foreground">Hands-on hours</span>
                        <Input type="number" inputMode="decimal" min={0} step={0.5} defaultValue={task.effortHours ?? ''} placeholder={`≈ ${Math.round(effortOf(task) * 10) / 10}`}
                          onBlur={e => goalActions.updateTask(goalId, phaseId, taskId, { effortHours: num(e.target.value) })} className="h-11 rounded-xl" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-footnote font-semibold text-muted-foreground">Then wait (days)</span>
                        <Input type="number" inputMode="numeric" min={0} defaultValue={task.waitDays ?? ''} placeholder="0"
                          onBlur={e => goalActions.updateTask(goalId, phaseId, taskId, { waitDays: num(e.target.value) })} className="h-11 rounded-xl" />
                      </label>
                    </div>
                    {others.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">Needs first</p>
                        <div className="flex flex-wrap gap-1.5">
                          {others.map(t => {
                            const on = deps.includes(t.id);
                            return (
                              <button key={t.id} type="button" aria-pressed={on} onClick={() => toggleDep(t.id)}
                                className={cn('pressable max-w-full truncate rounded-full px-3 py-1.5 text-footnote font-semibold', on ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                                {t.title}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <button type="button" aria-pressed={!!task.milestone} onClick={() => goalActions.updateTask(goalId, phaseId, taskId, { milestone: !task.milestone })}
                      className={cn('pressable flex h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold', task.milestone ? 'bg-warning/15 text-warning' : 'bg-secondary')}>
                      <Trophy className="h-3.5 w-3.5" /> {task.milestone ? 'Milestone' : 'Mark as milestone'}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Notes */}
            <h3 className="mb-1.5 text-headline">Notes</h3>
            <form className="mb-2 flex gap-2" onSubmit={e => { e.preventDefault(); addNote(); }}>
              <Input value={noteDraft} onChange={e => setNoteDraft(e.target.value)} placeholder="What did you learn or decide?" enterKeyHint="send" className="h-11 rounded-xl" />
              <button type="submit" disabled={!noteDraft.trim()} aria-label="Add note" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
            {notes.length > 0 && (
              <div className="list-group">
                {notes.map(n => (
                  <div key={n.id} className="flex items-start gap-2 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-body">{n.text}</p>
                      <p className="text-footnote text-muted-foreground">{new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                    </div>
                    <RowMenu label="Note actions" items={[{ label: 'Delete note', icon: Trash2, destructive: true, onSelect: () => withUndo('Note deleted', () => goalActions.deleteNote(goalId, phaseId, taskId, n.id)) }]} />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
