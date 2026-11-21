import { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompoundExercise, EXERCISE_LABELS, SplitDay } from '@/types/workout';
import { useGoals } from '@/hooks/useGoals';
import { useHabits } from '@/hooks/useHabits';
import { getTodaysHabits } from '@/lib/habits';
import { getDaysRemaining } from '@/types/goals';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { activeWorkoutActions } from '@/hooks/useWorkouts';
import { getExerciseLabel } from '@/types/workout';
import { toDateKey, parseDateKey } from '@/lib/dates';
import {
  Calendar, Dumbbell, X, Settings2, Settings, ChevronLeft, ChevronRight, Repeat, Flame, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DailyTimeBlocks from '@/components/DailyTimeBlocks';
import { CheckRow, StreakBadge } from '@/components/today/HabitCheckRow';
import RepeatableBlockManager from '@/components/RepeatableBlockManager';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getMonday(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}
const SPLIT_COLORS: Record<SplitDay, string> = {
  push: 'bg-primary/10 text-primary border-primary/20',
  pull: 'bg-teal/10 text-teal border-teal/20',
  legs: 'bg-coral/10 text-coral border-coral/20',
  upper: 'bg-primary/10 text-primary border-primary/20',
  lower: 'bg-teal/10 text-teal border-teal/20',
  rest: 'bg-muted text-muted-foreground border-muted',
};

interface FlatTodo {
  todoId: string;
  todoTitle: string;
  done: boolean;
  deadline?: string;
  effort?: string;
  goalId: string;
  goalTitle: string;
  phaseId: string;
  phaseTitle: string;
  taskId: string;
  taskTitle: string;
}

export default function ProgramPage() {
  const { goals, toggleToDo } = useGoals();
  const { logs: habitLogs, toggleCheckIn } = useHabits();
  const { days: plan } = useWeeklyPlan();
  const navigate = useNavigate();
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const timeBlocks = useStore(stores.TIME_BLOCKS);
  const assignedTodoIds = useMemo(() => {
    const ids = new Set<string>();
    timeBlocks.forEach(b => { if (b.todoId) ids.add(b.todoId); });
    return ids;
  }, [timeBlocks]);
  const contacts = useStore(stores.CONTACTS);
  const todayKey = useTodayKey();
  const today = useMemo(() => parseDateKey(todayKey), [todayKey]);
  const [selectedDate, setSelectedDate] = useState(() => new Date(today));
  const [weekStart, setWeekStart] = useState(() => getMonday(today));
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const selectedDayIdx = (selectedDate.getDay() + 6) % 7; // 0=Mon
  const isToday = isSameDay(selectedDate, today);
  const selectedDateKey = toDateKey(selectedDate);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showHabits, setShowHabits] = useState<boolean | null>(null); // null = auto (<=5 expanded)

  const allTodos = useMemo<FlatTodo[]>(() => {
    const todos: FlatTodo[] = [];
    goals.forEach(g => {
      g.phases.forEach(p => {
        p.tasks.forEach(t => {
          t.todos.forEach(td => {
            todos.push({
              todoId: td.id, todoTitle: td.title, done: td.done, deadline: td.deadline, effort: td.effort,
              goalId: g.id, goalTitle: g.title,
              phaseId: p.id, phaseTitle: p.title,
              taskId: t.id, taskTitle: t.title,
            });
          });
        });
      });
    });
    return todos;
  }, [goals]);

  const todaysHabits = useMemo(() => getTodaysHabits(goals, habitLogs, todayKey), [goals, habitLogs, todayKey]);
  const habitsCompleted = todaysHabits.filter(h => h.completed).length;
  const habitsExpanded = showHabits === null ? todaysHabits.length <= 5 : showHabits;

  // Todos whose deadline matches the selected date, plus overdue ones when viewing today
  const deadlineTodosForDay = useMemo(() => {
    return allTodos
      .filter(t => {
        if (t.done || !t.deadline) return false;
        if (t.deadline === selectedDateKey) return true;
        // When viewing today, also show overdue todos
        if (isToday && t.deadline < selectedDateKey) return true;
        return false;
      })
      .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
      .map(t => ({
        todoId: t.todoId, title: t.todoTitle, goalTitle: t.goalTitle,
        goalId: t.goalId, phaseTitle: t.phaseTitle, taskTitle: t.taskTitle,
        deadline: t.deadline, effort: t.effort,
      }));
  }, [allTodos, selectedDateKey, isToday]);

  // Goal IDs that have habits today (for filter)
  const habitGoalIds = useMemo(() => {
    const ids = new Set<string>();
    todaysHabits.forEach(h => ids.add(h.goalId));
    return Array.from(ids);
  }, [todaysHabits]);
  const [habitGoalFilter, setHabitGoalFilter] = useState<string>('all');
  const [longPressHabit, setLongPressHabit] = useState<string | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredHabits = useMemo(() => {
    if (habitGoalFilter === 'all') return todaysHabits;
    return todaysHabits.filter(h => h.goalId === habitGoalFilter);
  }, [todaysHabits, habitGoalFilter]);
  const filteredCompleted = filteredHabits.filter(h => h.completed).length;

  const backlog = useMemo(() => allTodos
    .filter(t => !t.done && !assignedTodoIds.has(t.todoId))
    .sort((a, b) => {
      const daysA = getDaysRemaining(a.deadline, todayKey);
      const daysB = getDaysRemaining(b.deadline, todayKey);
      if (daysA !== null && daysB !== null) return daysA - daysB;
      if (daysA !== null) return -1;
      if (daysB !== null) return 1;
      return 0;
    }), [allTodos, assignedTodoIds, todayKey]);

  const handleToggleTodo = useCallback((todo: FlatTodo) => {
    toggleToDo(todo.goalId, todo.phaseId, todo.taskId, todo.todoId);
  }, [toggleToDo]);

  const todoStates = useMemo(() => {
    const states: Record<string, boolean> = {};
    allTodos.forEach(t => { states[t.todoId] = t.done; });
    return states;
  }, [allTodos]);

  /** Open Gym with this day's planned exercises already filled in. */
  const startWorkout = () => {
    activeWorkoutActions.load(currentPlan.splitDay, []);
    currentPlan.exercises.forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
    navigate('/gym');
  };

  const goDay = (dir: -1 | 1) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + dir);
    setSelectedDate(next);
    // If we move out of the current week, shift the week
    const nextMonday = getMonday(next);
    if (nextMonday.getTime() !== weekStart.getTime()) {
      setWeekStart(nextMonday);
    }
  };

  const goWeek = (dir: -1 | 1) => {
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + dir * 7);
    setWeekStart(nextWeekStart);
    const nextSelected = new Date(selectedDate);
    nextSelected.setDate(nextSelected.getDate() + dir * 7);
    setSelectedDate(nextSelected);
  };

  const goToday = () => {
    setSelectedDate(new Date(today));
    setWeekStart(getMonday(today));
  };

  const currentPlan = plan[selectedDayIdx];

  return (
    <div className="flex flex-col h-[calc(100dvh-5.25rem-env(safe-area-inset-bottom)-max(0.75rem,env(safe-area-inset-top)))] md:h-[calc(100dvh-4.5rem)] max-w-5xl mx-auto">
      {/* DAY SELECTOR */}
      <div className="flex-shrink-0 pb-3">
        {/* Mobile: big swipeable day header */}
        <div className="flex items-center justify-between mb-2 md:hidden">
          <button onClick={() => goDay(-1)} aria-label="Previous day" className="p-3 rounded-xl bg-card border border-border active:bg-accent">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{DAYS[selectedDayIdx]}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MONTH_SHORT[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
            </p>
            <div className="flex items-center justify-center gap-2 mt-1">
              {isToday && (
                <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">TODAY</Badge>
              )}
              {!isToday && (
                <button onClick={goToday} className="h-8 rounded-full border border-primary/30 px-3 text-xs font-medium text-primary">Back to today</button>
              )}
              {currentPlan.splitDay !== 'rest' && (
                <Badge variant="outline" className={`capitalize text-[11px] ${SPLIT_COLORS[currentPlan.splitDay]}`}>
                  <Dumbbell className="h-3 w-3 mr-1" />
                  {currentPlan.splitDay}
                </Badge>
              )}
            </div>
          </div>
          <button onClick={() => goDay(1)} aria-label="Next day" className="p-3 rounded-xl bg-card border border-border active:bg-accent">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Week navigation + Day pills */}
        <div className="flex items-center gap-1 mb-1">
          <button onClick={() => goWeek(-1)} aria-label="Previous week" className="flex h-11 w-9 items-center justify-center rounded-lg bg-card border border-border active:bg-accent flex-shrink-0">
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <div className="grid grid-cols-7 gap-1 flex-1">
            {weekDays.map((date, idx) => {
              const isSelected = isSameDay(date, selectedDate);
              const isDayToday = isSameDay(date, today);
              const dayPlan = plan[idx];
              return (
                <button
                  key={toDateKey(date)}
                  onClick={() => setSelectedDate(new Date(date))}
                  className={`
                    rounded-xl py-1.5 md:py-2 text-center transition-all border
                    ${isSelected
                      ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20'
                      : isDayToday
                        ? 'bg-card border-primary/40'
                        : 'bg-card border-border active:bg-accent'}
                  `}
                >
                  <div className={`text-[11px] md:text-xs font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                    {DAY_SHORT[idx]}
                  </div>
                  <div className={`text-sm md:text-base font-bold ${isSelected ? 'text-primary' : isDayToday ? 'text-primary' : 'text-foreground'}`}>
                    {date.getDate()}
                  </div>
                  {isDayToday && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-0.5" />}
                  {dayPlan.splitDay !== 'rest' && (
                    <div className={`text-[11px] md:text-[11px] mt-0.5 capitalize ${isSelected ? 'text-primary/70' : 'text-muted-foreground'}`}>
                      {dayPlan.splitDay}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={() => goWeek(1)} aria-label="Next week" className="flex h-11 w-9 items-center justify-center rounded-lg bg-card border border-border active:bg-accent flex-shrink-0">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Desktop day title */}
        <div className="hidden md:flex items-center gap-3 mt-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{DAYS[selectedDayIdx]}</h1>
          <span className="text-sm text-muted-foreground">
            {MONTH_SHORT[selectedDate.getMonth()]} {selectedDate.getDate()}, {selectedDate.getFullYear()}
          </span>
          {isToday && (
            <Badge variant="outline" className="text-[11px] border-primary/30 text-primary">TODAY</Badge>
          )}
          {!isToday && (
            <button onClick={goToday} className="text-xs text-primary hover:underline">Today</button>
          )}
          {currentPlan.splitDay !== 'rest' && (
            <Badge variant="outline" className={`capitalize text-xs ${SPLIT_COLORS[currentPlan.splitDay]}`}>
              <Dumbbell className="h-3 w-3 mr-1" />
              {currentPlan.splitDay} · {currentPlan.exercises.length} exercises
            </Badge>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => setShowTemplates(!showTemplates)}>
              <Repeat className="h-3.5 w-3.5" /> Routines
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-xs gap-1.5">
              <Link to="/gym?s=program"><Settings2 className="h-3.5 w-3.5" /> Edit split</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* MOBILE ACTION BAR */}
      <div className="flex gap-2 mb-2 md:hidden">
        <Button
          variant={showTemplates ? "default" : "outline"}
          className="flex-1 text-sm gap-1.5 h-10"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          <Repeat className="h-4 w-4" /> Routines
        </Button>
        {currentPlan.splitDay !== 'rest' ? (
          <Button className="flex-1 font-semibold h-10 text-sm capitalize gap-1.5" onClick={startWorkout}>
            <Dumbbell className="h-4 w-4" /> {currentPlan.splitDay} workout
          </Button>
        ) : (
          <Button asChild variant="outline" className="flex-1 h-10 text-sm text-muted-foreground">
            <Link to="/gym?s=program">Rest day · edit split</Link>
          </Button>
        )}
        <Button asChild variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground" aria-label="Settings">
          <Link to="/settings"><Settings className="h-5 w-5" /></Link>
        </Button>
      </div>

      {/* SETTINGS / TEMPLATES PANELS */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 overflow-hidden mb-2"
          >
            <div className="border border-border rounded-xl p-3 bg-card shadow-sm">
              <RepeatableBlockManager />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TODAY'S HABITS (from goals) */}
      {isToday && todaysHabits.length > 0 && (
        <div className="flex-shrink-0 mb-2">
          {habitsExpanded ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="border border-border rounded-xl px-2.5 py-2 bg-card shadow-sm">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-3.5 w-3.5 text-amber" />
                    <span className="text-xs font-medium text-foreground">
                      Habits {habitsCompleted}/{todaysHabits.length}
                    </span>
                    {habitsCompleted === todaysHabits.length && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    )}
                  </div>
                  <button onClick={() => setShowHabits(false)} className="p-0.5 rounded hover:bg-accent/50 text-muted-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Goal filter pills */}
                {habitGoalIds.length > 1 && (
                  <div className="flex gap-1 mb-1.5 overflow-x-auto no-scrollbar">
                    <button
                      onClick={() => setHabitGoalFilter('all')}
                      className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors ${
                        habitGoalFilter === 'all'
                          ? 'bg-amber/15 border-amber/40 text-amber font-medium'
                          : 'border-border text-muted-foreground hover:bg-accent/50'
                      }`}
                    >
                      All ({todaysHabits.length})
                    </button>
                    {habitGoalIds.map(gid => {
                      const goal = goals.find(g => g.id === gid);
                      const count = todaysHabits.filter(h => h.goalId === gid).length;
                      return (
                        <button
                          key={gid}
                          onClick={() => setHabitGoalFilter(gid)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap transition-colors truncate max-w-[140px] ${
                            habitGoalFilter === gid
                              ? 'bg-amber/15 border-amber/40 text-amber font-medium'
                              : 'border-border text-muted-foreground hover:bg-accent/50'
                          }`}
                        >
                          {goal?.title || 'Goal'} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-[30vh] divide-y divide-border/60 overflow-y-auto">
                  {filteredHabits.map(({ habit, completed, streak, goalTitle, taskTitle }) => (
                    <CheckRow
                      key={habit.id}
                      done={completed}
                      title={habit.target ? `${habit.title} · ${habit.target}` : habit.title}
                      context={`${goalTitle} · ${taskTitle}`}
                      right={<StreakBadge days={streak} />}
                      onToggle={() => toggleCheckIn(habit.id)}
                    />
                  ))}
                </div>
                {/* Long-press detail popover */}
                <AnimatePresence>
                  {longPressHabit && (() => {
                    const fh = todaysHabits.find(h => h.habit.id === longPressHabit);
                    if (!fh) return null;
                    return (
                      <motion.div
                        key="habit-detail"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="mt-2 border border-amber/30 rounded-lg bg-amber/5 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{fh.habit.title}</span>
                          <button onClick={() => setLongPressHabit(null)} className="text-muted-foreground">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                          <p><span className="font-medium text-foreground">Frequency:</span> {fh.habit.frequency}</p>
                          {fh.habit.target && <p><span className="font-medium text-foreground">Target:</span> {fh.habit.target}</p>}
                          {fh.habit.evolution && <p><span className="font-medium text-foreground">Evolution:</span> {fh.habit.evolution}</p>}
                          <p><span className="font-medium text-foreground">Goal:</span> {fh.goalTitle} · {fh.taskTitle}</p>
                          {fh.streak > 0 && <p><span className="font-medium text-foreground">Streak:</span> {fh.streak} days</p>}
                        </div>
                      </motion.div>
                    );
                  })()}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <button
              onClick={() => setShowHabits(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber/30 bg-amber/5 hover:bg-amber/10 transition-colors"
            >
              <Repeat className="h-3 w-3 text-amber" />
              <span className="text-xs font-medium text-amber">
                Habits {habitsCompleted}/{todaysHabits.length}
              </span>
              {habitsCompleted === todaysHabits.length && (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              )}
            </button>
          )}
        </div>
      )}

      {/* PLANNER */}
      <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <DailyTimeBlocks
          dayName={selectedDateKey}
          contacts={contacts}
          onToggleTodo={(todoId) => {
            const todo = allTodos.find(t => t.todoId === todoId);
            if (todo) handleToggleTodo(todo);
          }}
          backlogTodos={backlog.map(t => ({
            todoId: t.todoId, title: t.todoTitle, goalTitle: t.goalTitle,
            goalId: t.goalId, phaseTitle: t.phaseTitle, taskTitle: t.taskTitle,
            deadline: t.deadline, effort: t.effort,
          }))}
          deadlineTodos={deadlineTodosForDay}
          todoStates={todoStates}
        />
      </div>

      {/* Desktop workout button */}
      {currentPlan.splitDay !== 'rest' && (
        <div className="hidden md:block flex-shrink-0 pt-3">
          <Button className="w-full font-bold text-base py-4 capitalize" onClick={startWorkout}>
            Start {currentPlan.splitDay} workout
          </Button>
        </div>
      )}
    </div>
  );
}
