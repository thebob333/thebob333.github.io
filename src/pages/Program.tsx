import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Dumbbell, Play, Repeat } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { activeWorkoutActions, useActiveWorkout } from '@/hooks/useWorkouts';
import { stores } from '@/lib/storage';
import { addDays, dayOfWeek, parseDateKey, startOfWeekKey, type DateKey } from '@/lib/dates';
import { flattenTodos } from '@/lib/goal-tree';
import { plannerDayKey } from '@/lib/plan-time';
import { getDaysRemaining } from '@/types/goals';
import { getExerciseLabel } from '@/types/workout';
import { splitLabel } from '@/lib/gym-format';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import DailyTimeBlocks, { type BacklogTodo } from '@/components/DailyTimeBlocks';
import { RoutinesSheet } from '@/components/plan/RoutinesSheet';
import { PlanSuggestions } from '@/components/plan/PlanSuggestions';
import { cn } from '@/lib/utils';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Plan: time-block any day, with your training and routines filled in. */
export default function PlanPage() {
  const navigate = useNavigate();
  const calendarToday = useTodayKey();
  // Plan's day runs 5 AM–3 AM, so at 1 AM you're still on last night.
  const today = useMemo(() => plannerDayKey(), [calendarToday]); // eslint-disable-line react-hooks/exhaustive-deps
  const { goals, toggleToDo } = useGoals();
  const { days: plan } = useWeeklyPlan();
  const hasPlan = useStore(stores.WEEKLY_PLAN) !== null;
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const timeBlocks = useStore(stores.TIME_BLOCKS);
  const active = useActiveWorkout();
  const [selected, setSelected] = useState<DateKey>(today);
  const [routinesOpen, setRoutinesOpen] = useState(false);

  const isToday = selected === today;
  const weekStart = startOfWeekKey(selected, 1);
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dayIdx = (dayOfWeek(selected) + 6) % 7; // 0 = Monday
  const dayPlan = hasPlan ? plan[dayIdx] : null;
  const date = parseDateKey(selected);

  // ─── To-dos: due on this day (and overdue, on today), plus everything unscheduled ───
  const all = useMemo(() => flattenTodos(goals).map(({ todo, goal, phase, task }) => ({
    todoId: todo.id, title: todo.title, done: todo.done, deadline: todo.deadline, effort: todo.effort,
    goalId: goal.id, goalTitle: goal.title, phaseId: phase.id, phaseTitle: phase.title, taskId: task.id, taskTitle: task.title,
  })), [goals]);
  const scheduled = useMemo(() => new Set(timeBlocks.map(b => b.todoId).filter(Boolean)), [timeBlocks]);
  const due = useMemo<BacklogTodo[]>(() => all
    .filter(t => !t.done && t.deadline && (t.deadline === selected || (isToday && t.deadline < selected)))
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!)), [all, selected, isToday]);
  const backlog = useMemo<BacklogTodo[]>(() => all
    .filter(t => !t.done && !scheduled.has(t.todoId))
    .sort((a, b) => {
      const da = getDaysRemaining(a.deadline, calendarToday); const db = getDaysRemaining(b.deadline, calendarToday);
      return da !== null && db !== null ? da - db : da !== null ? -1 : db !== null ? 1 : 0;
    }), [all, scheduled, calendarToday]);
  const todoStates = useMemo(() => Object.fromEntries(all.map(t => [t.todoId, t.done])), [all]);

  const startWorkout = () => {
    if (!dayPlan) return;
    if (!active) {
      activeWorkoutActions.load(dayPlan.splitDay, []);
      dayPlan.exercises.forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
    }
    navigate('/gym');
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom)-max(0.75rem,env(safe-area-inset-top)))] max-w-2xl flex-col gap-3 md:h-[calc(100dvh-6.5rem)]">
      <div className="shrink-0">
        <PageHeader
          eyebrow={`${date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}${isToday ? ' · Today' : ''}`}
          title={date.toLocaleDateString(undefined, { weekday: 'long' })}
          actions={<>
            {!isToday && (
              <button type="button" onClick={() => setSelected(today)} className="h-9 rounded-full bg-primary/10 px-3.5 text-footnote font-semibold text-primary">Today</button>
            )}
            <HeaderButton label="Routines" onClick={() => setRoutinesOpen(true)}><Repeat className="h-[18px] w-[18px]" /></HeaderButton>
          </>}
        />
      </div>

      {/* Week strip */}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" aria-label="Previous week" onClick={() => setSelected(addDays(selected, -7))} className="flex h-14 w-8 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="grid flex-1 grid-cols-7">
          {week.map((k, i) => {
            const on = k === selected;
            const isT = k === today;
            const trains = hasPlan && plan[i].splitDay !== 'rest';
            return (
              <button key={k} type="button" onClick={() => setSelected(k)} aria-label={parseDateKey(k).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} aria-pressed={on}
                className="flex flex-col items-center gap-1 py-1">
                <span className={cn('text-[11px] font-semibold', isT && !on ? 'text-primary' : 'text-muted-foreground')}>{LETTERS[i]}</span>
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-headline tabular-nums transition-colors',
                  on ? 'bg-primary text-primary-foreground' : isT ? 'text-primary' : 'text-foreground')}>
                  {parseDateKey(k).getDate()}
                </span>
                <span className={cn('h-1.5 w-1.5 rounded-full', trains ? 'bg-move' : 'bg-transparent')} />
              </button>
            );
          })}
        </div>
        <button type="button" aria-label="Next week" onClick={() => setSelected(addDays(selected, 7))} className="flex h-14 w-8 shrink-0 items-center justify-center text-muted-foreground">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Training for this day */}
      {dayPlan && dayPlan.splitDay !== 'rest' ? (
        <div className="surface flex shrink-0 items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-move/15 text-move"><Dumbbell className="h-[18px] w-[18px]" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-headline">{isToday && active ? 'Workout in progress' : `${splitLabel(dayPlan.splitDay)} day`}</p>
            <p className="truncate text-footnote text-muted-foreground">{dayPlan.exercises.map(e => getExerciseLabel(e, customExercises)).join(' · ') || 'No exercises planned'}</p>
          </div>
          <button type="button" onClick={startWorkout} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-move px-3.5 text-footnote font-semibold text-white">
            <Play className="h-3.5 w-3.5 fill-current" /> {isToday && active ? 'Resume' : 'Start'}
          </button>
        </div>
      ) : (
        <Link to="/gym?s=program" className="flex shrink-0 items-center gap-2 px-1 text-footnote text-muted-foreground">
          <Dumbbell className="h-4 w-4" /> {dayPlan ? 'Rest day' : 'No training planned'} · <span className="font-semibold text-primary">{dayPlan ? 'Edit week' : 'Plan your week'}</span>
        </Link>
      )}

      <PlanSuggestions day={selected} />

      {/* Timeline */}
      <div className="surface min-h-0 flex-1 overflow-hidden">
        <DailyTimeBlocks
          dayName={selected}
          onToggleTodo={id => { const t = all.find(x => x.todoId === id); if (t) toggleToDo(t.goalId, t.phaseId, t.taskId, t.todoId); }}
          backlogTodos={backlog}
          deadlineTodos={due}
          todoStates={todoStates}
        />
      </div>

      <RoutinesSheet open={routinesOpen} onClose={() => setRoutinesOpen(false)} />
    </div>
  );
}
