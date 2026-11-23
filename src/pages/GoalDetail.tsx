import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Archive, ArrowDown, ArrowUp, Bookmark, CalendarDays, Check, ChevronDown, Copy, Pause, Plus, Settings2, Sparkles, Star, Trash2, Pencil, X, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useGoals, goalActions } from '@/hooks/useGoals';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import { ListRow, CheckCircle } from '@/components/app/ListRow';
import { RowMenu } from '@/components/app/RowMenu';
import { ProgressRing } from '@/components/ProgressRing';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { TaskSheet, type TaskRef } from '@/components/goals/TaskSheet';
import { CoachPlanSheet } from '@/components/goals/CoachPlanSheet';
import { QuickFormSheet } from '@/components/goals/QuickFormSheet';
import { EditItemDialog, type EditTarget } from '@/components/goals/EditItemDialog';
import { calculatePhaseProgress } from '@/types/goals';
import { addDays, dateKeyOf, daysBetween, todayKey } from '@/lib/dates';
import { spreadPhaseDeadlines } from '@/lib/goal-tree';
import { currentPhase, domainStyle, dueText, goalSummary, isTaskComplete, taskSummary, calculateTaskProgress } from '@/lib/goal-meta';
import type { Goal } from '@/types/goals';
import { GoalSettingsSheet } from '@/components/goals/GoalSettingsSheet';
import { GoalPractices } from '@/components/goals/GoalPractices';
import { MetricCard } from '@/components/goals/MetricCard';
import { ForecastCard } from '@/components/goals/ForecastCard';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { goalProgress } from '@/lib/goal-progress';
import { PUSHBACK, STATUSES, shapeInfo } from '@/lib/goal-shapes';

export default function GoalDetailPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const { goals, toggleToDo, restoreGoal } = useGoals();
  const allMetrics = useStore(stores.METRICS);
  const habitLogs = useStore(stores.HABIT_LOGS);
  const { focusIds, toggle: toggleFocus, max } = useWeeklyFocus();
  const [task, setTask] = useState<TaskRef | null>(null);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addTaskPhase, setAddTaskPhase] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProtocol, setShowProtocol] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [stepDraft, setStepDraft] = useState('');

  const goal = goals.find(g => g.id === goalId);
  if (!goal) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <PageHeader title="Goal not found" back="/goals" />
        <p className="text-body text-muted-foreground">It may have been deleted.</p>
      </div>
    );
  }

  const s = goalSummary(goal);
  const style = domainStyle(goal.domain);
  const focused = focusIds.includes(goal.id);
  const nowPhase = currentPhase(goal);
  const hasTasks = goal.phases.some(p => p.tasks.length > 0);
  const shape = shapeInfo(goal.shape);
  const ShapeIcon = shape.icon;
  const status = goal.status ?? 'active';
  const hero = goalProgress(goal, allMetrics, habitLogs, todayKey());
  const checklist = goal.phases.flatMap(p => p.tasks.flatMap(t => (t.todos ?? []).map(todo => ({ todo, phase: p, task: t }))));

  const withUndo = (message: string, action: () => void, snapshot: Goal = goal) => {
    action();
    toast.success(message, { action: { label: 'Undo', onClick: () => restoreGoal(snapshot) } });
  };

  const spread = () => {
    if (!goal.deadline) { toast('Set a target date first', { description: 'Edit the goal to add one.' }); return; }
    const phases = spreadPhaseDeadlines(goal.phases, todayKey(), dateKeyOf(goal.deadline), addDays, daysBetween);
    if (!phases) { toast.error('The target date has already passed'); return; }
    withUndo('Deadlines spread by workload', () => goalActions.updateGoal(goal.id, { phases }));
  };

  const markNextDone = () => {
    if (!s.next) return;
    const { phase, task: t, todo } = s.next;
    toggleToDo(goal.id, phase.id, t.id, todo.id);
    toast.success(`Done: ${todo.title}`, { action: { label: 'Undo', onClick: () => toggleToDo(goal.id, phase.id, t.id, todo.id) } });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <PageHeader
        title={goal.title}
        back="/goals"
        actions={
          <>
            <HeaderButton label={focused ? 'Remove from focus' : 'Make a focus goal'} onClick={() => {
              const r = toggleFocus(goal.id);
              if (r === 'full') toast(`You can focus on ${max} goals at a time`);
            }}>
              <Star className={`h-[18px] w-[18px] ${focused ? 'fill-warning text-warning' : ''}`} />
            </HeaderButton>
            <RowMenu label="Goal actions" className="h-9 w-9 rounded-full bg-secondary md:h-9 md:w-9" items={[
              { label: 'Goal settings', icon: Settings2, onSelect: () => setSettingsOpen(true) },
              { label: 'Plan with the coach', icon: Sparkles, onSelect: () => setAiOpen(true) },
              { label: 'Spread deadlines', icon: CalendarDays, onSelect: spread },
              { label: 'Duplicate', icon: Copy, separated: true, onSelect: () => { const c = goalActions.cloneGoal(goal.id); if (c) navigate(`/goals/${c.id}`); toast.success('Goal duplicated'); } },
              { label: 'Save as blueprint', icon: Bookmark, onSelect: () => { goalActions.saveAsTemplate(goal.id); toast.success('Saved as a blueprint'); } },
              { label: goal.archived ? 'Restore goal' : 'Archive goal', icon: Archive, separated: true, onSelect: () => {
                goalActions.archiveGoal(goal.id);
                toast.success(goal.archived ? 'Goal restored' : 'Goal archived', { action: { label: 'Undo', onClick: () => goalActions.archiveGoal(goal.id) } });
              } },
              { label: 'Delete goal…', icon: Trash2, destructive: true, onSelect: () => setConfirmDelete(true) },
            ]} />
          </>
        }
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] p-6 text-white shadow-[0_12px_36px_-14px_rgb(60_40_200/0.5)]" style={{ background: style.gradient }}>
        <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="relative">
          <button type="button" onClick={() => setSettingsOpen(true)} className="mb-4 flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-footnote font-semibold backdrop-blur-sm">
            <ShapeIcon className="h-3.5 w-3.5" /> {shape.label} · {PUSHBACK.find(p => p.value === (goal.pushback ?? 'honest'))!.label} coach
            {status !== 'active' && <> · {STATUSES.find(x => x.value === status)!.label}</>}
          </button>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[44px] font-bold leading-none tracking-tight tabular-nums">{hero.value}%</p>
              <p className="mt-1 text-footnote font-semibold uppercase tracking-wider text-white/80">{hero.label}</p>
            </div>
            {s.daysLeft !== null && (
              <p className="shrink-0 text-right text-footnote font-semibold text-white/85">{s.daysLeft < 0 ? `${-s.daysLeft} days past target` : `${s.daysLeft} days left`}</p>
            )}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${hero.value}%` }} />
          </div>
          <p className="mt-2 text-footnote font-medium text-white/80">
            {[s.todosTotal ? `${s.todosDone}/${s.todosTotal} steps` : null, s.habits ? `${s.habits} practice${s.habits === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ') || 'Nothing planned yet'}
          </p>
          {goal.why
            ? <p className="mt-4 text-body text-white/90"><span className="font-semibold">Why: </span>{goal.why}</p>
            : goal.endGoal && <p className="mt-4 text-body text-white/90">“{goal.endGoal}”</p>}
          {s.next && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
              <div className="min-w-0 flex-1">
                <p className="text-footnote font-semibold uppercase tracking-wider text-white/75">Next up</p>
                <p className="truncate text-headline">{s.next.todo.title}</p>
              </div>
              <button type="button" onClick={markNextDone} aria-label={`Mark ${s.next.todo.title} done`}
                className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-neutral-900">
                <Check className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          )}
        </div>
      </section>

      {status === 'paused' && (
        <div className="surface flex items-center gap-3 p-4">
          <Pause className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="min-w-0 flex-1 text-footnote text-muted-foreground">Paused. It's off Today and the plan isn't adjusting.</p>
          <button type="button" onClick={() => goalActions.updateGoal(goal.id, { status: 'active' })} className="pressable h-9 rounded-full bg-primary px-3.5 text-footnote font-semibold text-primary-foreground">Resume</button>
        </div>
      )}

      {goal.shape === 'better' && <MetricCard goal={goal} onSetUp={() => setSettingsOpen(true)} />}

      {(hasTasks || goal.shape === 'better') && <ForecastCard goal={goal} />}

      <GoalPractices goal={goal} onEdit={setEdit} onAdd={() => {
        const p = goal.phases.find(ph => ph.tasks.length) ?? goal.phases[0];
        if (p?.tasks[0]) setTask({ goalId: goal.id, phaseId: p.id, taskId: p.tasks[0].id });
        else if (p) setAddTaskPhase(p.id);
      }} />

      {goal.ifThen && goal.ifThen.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">When things get in the way</h2>
          <div className="list-group">
            {goal.ifThen.map((t, i) => (
              <div key={i} className="flex items-start gap-2 px-4 py-2.5">
                <Zap className="mt-1 h-3.5 w-3.5 shrink-0 text-warning" />
                <p className="min-w-0 flex-1 text-body">{t}</p>
                <button type="button" aria-label="Remove" onClick={() => goalActions.updateGoal(goal.id, { ifThen: goal.ifThen!.filter((_, j) => j !== i) })} className="-mr-2 flex h-8 w-8 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {goal.shape === 'once' && (
        <section className="space-y-2">
          <h2 className="section-label">Checklist</h2>
          <div className="list-group">
            {checklist.map(({ todo, phase, task: t }) => (
              <ListRow key={todo.id} muted={todo.done}
                leading={<CheckCircle done={todo.done} color="hsl(var(--tasks))" label={todo.title} onToggle={() => toggleToDo(goal.id, phase.id, t.id, todo.id)} />}
                title={todo.title} subtitle={todo.deadline && !todo.done ? dueText(todo.deadline) : undefined}
                onClick={() => setTask({ goalId: goal.id, phaseId: phase.id, taskId: t.id })} />
            ))}
            <form className="flex items-center gap-2 px-3 py-2" onSubmit={e => {
              e.preventDefault();
              const title = stepDraft.trim();
              if (!title) return;
              const phase = goal.phases[0];
              if (!phase) return;
              if (phase.tasks[0]) goalActions.addToDo(goal.id, phase.id, phase.tasks[0].id, title);
              else { goalActions.addTask(goal.id, phase.id, 'Checklist', ''); toast('Tap again to add the step'); }
              setStepDraft('');
            }}>
              <Plus className="ml-1 h-5 w-5 shrink-0 text-tasks" />
              <input value={stepDraft} onChange={e => setStepDraft(e.target.value)} placeholder={checklist.length ? 'Add a step' : 'First step, e.g. Watch a 2-minute video'} enterKeyHint="done"
                className="h-10 min-w-0 flex-1 bg-transparent px-1 text-body outline-none placeholder:text-muted-foreground" />
              {stepDraft && <button type="submit" className="h-9 shrink-0 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground">Add</button>}
            </form>
          </div>
        </section>
      )}

      {hasTasks && goal.shape !== 'once' && <h2 className="section-label -mb-3">{shape.stages}</h2>}

      {!hasTasks && goal.shape !== 'once' && (
        <div className="surface p-5">
          <p className="text-headline">Break it down</p>
          <p className="mt-1 text-body text-muted-foreground">Let AI draft a full plan in a minute, or add tasks yourself.</p>
          <div className="mt-4 flex gap-2">
            <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={() => setAiOpen(true)}><Sparkles className="mr-1.5 h-4 w-4" /> Plan with the coach</Button>
            <Button variant="secondary" className="h-12 rounded-xl text-body" onClick={() => setAddTaskPhase(goal.phases[0]?.id ?? null)} disabled={!goal.phases.length}>Add a task</Button>
          </div>
        </div>
      )}

      {/* Stages ("Do once" goals are just the checklist above) */}
      {goal.shape !== 'once' && goal.phases.map((phase, pi) => {
        const isNow = phase.id === nowPhase?.id && hasTasks;
        const pp = calculatePhaseProgress(phase);
        const allDone = phase.tasks.length > 0 && phase.tasks.every(isTaskComplete);
        return (
          <section key={phase.id} className="space-y-2">
            <div className="flex items-end justify-between gap-2 px-1">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-[20px] font-bold tracking-tight">
                  <span className="truncate">{phase.title}</span>
                  {isNow && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary-foreground">Now</span>}
                  {allDone && <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={3} />}
                </h2>
                <p className="text-footnote text-muted-foreground">
                  {phase.tasks.length ? `${pp}%` : 'No tasks yet'}{phase.deadline ? ` · ${dueText(phase.deadline)}` : ''}
                </p>
              </div>
              <RowMenu label={`Actions for ${phase.title}`} items={[
                { label: 'Add task', icon: Plus, onSelect: () => setAddTaskPhase(phase.id) },
                { label: 'Edit phase', icon: Pencil, onSelect: () => setEdit({ kind: 'phase', goalId: goal.id, phase }) },
                { label: 'Move up', icon: ArrowUp, separated: true, disabled: pi === 0, onSelect: () => goalActions.reorderPhases(goal.id, phase.id, 'up') },
                { label: 'Move down', icon: ArrowDown, disabled: pi === goal.phases.length - 1, onSelect: () => goalActions.reorderPhases(goal.id, phase.id, 'down') },
                { label: 'Delete phase', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo(`Deleted phase "${phase.title}"`, () => goalActions.deletePhase(goal.id, phase.id)) },
              ]} />
            </div>
            <div className="list-group">
              {phase.tasks.map(t => {
                const done = isTaskComplete(t);
                return (
                  <ListRow
                    key={t.id}
                    onClick={() => setTask({ goalId: goal.id, phaseId: phase.id, taskId: t.id })}
                    chevron
                    muted={done}
                    leading={done
                      ? <span className="flex h-9 w-9 items-center justify-center rounded-full bg-success text-white"><Check className="h-5 w-5" strokeWidth={3} /></span>
                      : <ProgressRing value={calculateTaskProgress(t)} size={36} strokeWidth={3.5} showPercent={false} />}
                    title={t.title}
                    subtitle={[taskSummary(t), t.deadline && !done ? dueText(t.deadline) : null].filter(Boolean).join(' · ')}
                  />
                );
              })}
              <button type="button" onClick={() => setAddTaskPhase(phase.id)} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-body font-semibold text-primary">
                <Plus className="h-5 w-5" /> Add task
              </button>
            </div>
          </section>
        );
      })}

      <div className="flex gap-2">
        {goal.shape !== 'once' && <Button variant="secondary" className="h-12 flex-1 rounded-2xl text-body font-semibold" onClick={() => setAddPhaseOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add stage</Button>}
        <Button variant="secondary" className="h-12 flex-1 rounded-2xl text-body font-semibold" onClick={() => setAiOpen(true)}><Sparkles className="mr-1.5 h-4 w-4" /> Plan with the coach</Button>
      </div>

      {goal.adaptationProtocol && (
        <section>
          <button type="button" onClick={() => setShowProtocol(v => !v)} aria-expanded={showProtocol}
            className="flex h-11 w-full items-center justify-between px-1 text-footnote font-semibold text-muted-foreground">
            If things change
            <ChevronDown className={`h-4 w-4 transition-transform ${showProtocol ? 'rotate-180' : ''}`} />
          </button>
          {showProtocol && (
            <div className="list-group">
              {([['Ahead of schedule', goal.adaptationProtocol.ahead, 'text-success'], ['Falling behind', goal.adaptationProtocol.behind, 'text-warning'], ['Blocked', goal.adaptationProtocol.blocked, 'text-destructive']] as const)
                .filter(([, text]) => text)
                .map(([label, text, color]) => (
                  <div key={label} className="px-4 py-3">
                    <p className={`text-footnote font-semibold ${color}`}>{label}</p>
                    <p className="text-body">{text}</p>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      <TaskSheet target={task} onClose={() => setTask(null)} onEdit={setEdit} />
      <EditItemDialog target={edit} onClose={() => setEdit(null)} />
      <GoalSettingsSheet goal={settingsOpen ? goal : null} onClose={() => setSettingsOpen(false)} />
      <CoachPlanSheet goal={aiOpen ? goal : null} onClose={() => setAiOpen(false)} />
      <QuickFormSheet open={addPhaseOpen} title="Add stage" placeholder="e.g. Build" cta="Add stage"
        onSubmit={(name, deadline) => goalActions.addPhase(goal.id, name, '', deadline)} onClose={() => setAddPhaseOpen(false)} />
      <QuickFormSheet open={!!addTaskPhase} title="Add task" placeholder="e.g. Get proper running shoes" cta="Add task"
        onSubmit={(name, deadline) => addTaskPhase && goalActions.addTask(goal.id, addTaskPhase, name, '', deadline)} onClose={() => setAddTaskPhase(null)} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-title">Delete “{goal.title}”?</DialogTitle></DialogHeader>
          <p className="text-body text-muted-foreground">This removes the goal with all its phases, tasks, to-dos and habits. You can undo for a few seconds afterwards.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" className="h-12 flex-1 rounded-xl font-semibold" onClick={() => {
              const snapshot = goal;
              setConfirmDelete(false);
              navigate('/goals');
              goalActions.deleteGoal(goal.id);
              toast.success('Goal deleted', { action: { label: 'Undo', onClick: () => restoreGoal(snapshot) } });
            }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

