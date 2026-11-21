import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Target, Dumbbell, Trophy, TrendingUp, Moon, ChevronRight, Play } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { useWorkouts, useActiveWorkout, activeWorkoutActions } from '@/hooks/useWorkouts';
import { useHabits } from '@/hooks/useHabits';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { useSettings } from '@/hooks/useSettings';
import { getPersonalRecords, getWeeklyVolume } from '@/lib/progressive-overload';
import { getExerciseLabel, isBodyweightExercise } from '@/types/workout';
import { calculateGoalProgress, getDaysRemaining } from '@/types/goals';
import { checkAchievements } from '@/lib/achievements';
import { getTodaysHabits } from '@/lib/habits';
import { flattenTodos } from '@/lib/goal-tree';
import { stores } from '@/lib/storage';
import { dayOfWeek, parseDateKey, startOfWeekKey } from '@/lib/dates';
import { BodyDiagram } from '@/components/BodyDiagram';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { HabitHeatmap } from '@/components/HabitHeatmap';
import { WeeklyFocus } from '@/components/WeeklyFocus';
import { AmbientSound } from '@/components/AmbientSound';
import { PageHeader } from '@/components/app/PageHeader';
import { TodayChecklist, type ChecklistTodo } from '@/components/today/TodayChecklist';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Up late';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

const fade = (delay: number) => ({ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.25 } });

export default function Index() {
  const { goals, toggleToDo } = useGoals();
  const { sessions } = useWorkouts();
  const { logs: habitLogs, toggleCheckIn } = useHabits();
  const { settings } = useSettings();
  const today = useTodayKey();
  const navigate = useNavigate();
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const activeWorkout = useActiveWorkout();
  const hasActiveWorkout = !!activeWorkout && activeWorkout.exercises.length > 0;

  // ─── Achievements (persisted once earned, so unlock dates are real) ───
  const unlockedAchievements = useStore(stores.ACHIEVEMENTS);
  const { all: achievements, newlyUnlocked } = useMemo(
    () => checkAchievements(sessions, unlockedAchievements),
    [sessions, unlockedAchievements],
  );
  useEffect(() => {
    if (newlyUnlocked.length === 0) return;
    const at = new Date().toISOString();
    stores.ACHIEVEMENTS.update(prev => {
      const have = new Set(prev.map(a => a.id));
      const add = newlyUnlocked.filter(a => !have.has(a.id)).map(a => ({ id: a.id, unlockedAt: at }));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [newlyUnlocked]);

  // ─── Today's checklist ───
  const todaysHabits = useMemo(() => getTodaysHabits(goals, habitLogs, today), [goals, habitLogs, today]);
  const checklistTodos = useMemo<ChecklistTodo[]>(() =>
    flattenTodos(goals)
      .filter(({ todo }) => !todo.done)
      .map(({ todo, goal, phase, task }) => ({
        todoId: todo.id, title: todo.title, goalId: goal.id, goalTitle: goal.title,
        phaseId: phase.id, taskId: task.id, taskTitle: task.title,
        days: getDaysRemaining(todo.deadline, today),
      }))
      .filter(t => t.days !== null && t.days <= 7)
      .sort((a, b) => a.days - b.days),
  [goals, today]);

  // ─── Workout ───
  const { days: planDays } = useWeeklyPlan();
  const hasPlan = useStore(stores.WEEKLY_PLAN) !== null;
  const todayIdx = (dayOfWeek(today) + 6) % 7;
  const todayPlan = hasPlan ? planDays[todayIdx] : null;
  const startTodaysWorkout = () => {
    if (!hasActiveWorkout) {
      activeWorkoutActions.load(todayPlan?.splitDay ?? 'push', []);
      (todayPlan?.exercises ?? []).forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
    }
    navigate('/gym');
  };

  // ─── Stats ───
  const prs = useMemo(
    () => getPersonalRecords(sessions, id => isBodyweightExercise(id, customExercises)),
    [sessions, customExercises],
  );
  const weeklyVolume = useMemo(() => getWeeklyVolume(sessions), [sessions]);
  const thisWeek = startOfWeekKey(today, 0);
  const volumeThisWeek = weeklyVolume.find(w => w.week === thisWeek)?.volume ?? 0;
  const activeGoals = goals.filter(g => !g.archived);
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const stats = [
    { icon: Target, value: activeGoals.length, label: 'Goals', to: '/goals' },
    { icon: Dumbbell, value: sessions.length, label: 'Sessions', to: '/gym' },
    { icon: Trophy, value: `${unlockedCount}/${achievements.length}`, label: 'Badges', to: '/gym' },
    { icon: TrendingUp, value: volumeThisWeek >= 10000 ? `${Math.round(volumeThisWeek / 1000)}k` : volumeThisWeek.toLocaleString(), label: 'Lbs this wk', to: '/gym' },
  ];

  const dateLabel = parseDateKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const isNew = goals.length === 0 && sessions.length === 0;

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-8">
      <PageHeader
        eyebrow={dateLabel}
        title={getGreeting()}
        actions={settings.ambientSoundEnabled ? <span className="md:hidden"><AmbientSound enabled /></span> : undefined}
      />

      {/* First run */}
      {isNew && (
        <motion.div {...fade(0.03)} className="rounded-2xl border bg-card p-5 text-center shadow-sm">
          <Target className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-2 text-lg font-semibold">Welcome to TELOS</h2>
          <p className="mt-1 text-sm text-muted-foreground">Set a goal and TELOS turns it into daily habits and to-dos you can check off right here.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild className="h-11 font-semibold"><Link to="/goals">Create a goal</Link></Button>
            <Button asChild variant="outline" className="h-11"><Link to="/gym">Set up training</Link></Button>
          </div>
        </motion.div>
      )}

      {/* Workout in progress */}
      {hasActiveWorkout && (
        <motion.div {...fade(0.03)}>
          <Link to="/gym" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 shadow-sm">
            <Dumbbell className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Workout in progress</p>
              <p className="truncate text-xs text-muted-foreground">
                {activeWorkout.exercises.map(e => getExerciseLabel(e.exercise, customExercises)).join(' · ')}
              </p>
            </div>
            <span className="text-sm font-semibold text-primary">Resume</span>
          </Link>
        </motion.div>
      )}

      {/* One checklist for everything due today */}
      <motion.div {...fade(0.06)}>
        <TodayChecklist
          habits={todaysHabits}
          todos={checklistTodos}
          onToggleHabit={id => toggleCheckIn(id)}
          onToggleTodo={t => toggleToDo(t.goalId, t.phaseId, t.taskId, t.todoId)}
        />
      </motion.div>

      {/* Today's workout */}
      {!hasActiveWorkout && (
        <motion.div {...fade(0.09)}>
          {todayPlan && todayPlan.splitDay !== 'rest' ? (
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Training · {DAYS[todayIdx]}</p>
                  <p className="mt-0.5 text-lg font-semibold capitalize">{todayPlan.splitDay} day</p>
                </div>
                <Button className="h-11 px-5 font-semibold" onClick={startTodaysWorkout}>
                  <Play className="mr-1.5 h-4 w-4" /> Start
                </Button>
              </div>
              {todayPlan.exercises.length > 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {todayPlan.exercises.map(ex => getExerciseLabel(ex, customExercises)).join(' · ')}
                </p>
              )}
            </div>
          ) : todayPlan?.splitDay === 'rest' ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
              <Moon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Rest day</p>
                <p className="text-xs text-muted-foreground">Recovery is part of the process.</p>
              </div>
            </div>
          ) : !isNew ? (
            <Link to="/gym" className="block rounded-2xl border border-dashed p-4 text-center">
              <p className="text-sm text-muted-foreground">No training split yet</p>
              <p className="mt-1 text-xs font-medium text-primary">Set up your week in Gym →</p>
            </Link>
          ) : null}
        </motion.div>
      )}

      {/* Weekly focus */}
      <motion.div {...fade(0.12)}>
        <WeeklyFocus goals={goals} />
      </motion.div>

      {/* Goals */}
      {activeGoals.length > 0 && (
        <motion.div {...fade(0.15)}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Goals</p>
            <Link to="/goals" className="flex h-8 items-center gap-0.5 text-xs font-medium text-primary">
              View all <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeGoals.slice(0, 4).map(goal => {
              const progress = calculateGoalProgress(goal);
              return (
                <Link key={goal.id} to="/goals" className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-colors active:bg-accent/40">
                  <ProgressRing value={progress} size={36} strokeWidth={3} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.phases.length} phase{goal.phases.length !== 1 ? 's' : ''} · {progress}%
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Stats */}
      {!isNew && (
        <motion.div {...fade(0.18)} className="grid grid-cols-4 gap-2">
          {stats.map(stat => (
            <Link key={stat.label} to={stat.to} className="flex flex-col items-center gap-1 rounded-xl border bg-card px-1 py-3 shadow-sm">
              <stat.icon className="h-4 w-4 text-primary" />
              <span className="text-lg font-bold leading-none">{stat.value}</span>
              <span className="text-center text-[11px] leading-tight text-muted-foreground">{stat.label}</span>
            </Link>
          ))}
        </motion.div>
      )}

      {/* Habit history */}
      {todaysHabits.length > 0 && (
        <motion.div {...fade(0.2)}>
          <HabitHeatmap goals={goals} logs={habitLogs} />
        </motion.div>
      )}

      {/* Strength map */}
      {sessions.length > 0 ? (
        <motion.div {...fade(0.22)}>
          <BodyDiagram prs={prs} customExercises={customExercises} bodyweight={settings.bodyweight} goldTargets={settings.goldTargets} />
        </motion.div>
      ) : !isNew ? (
        <Link to="/gym" className="block rounded-2xl border border-dashed p-4 text-center">
          <p className="text-sm text-muted-foreground">Your strength map fills in as you log workouts</p>
          <p className="mt-1 text-xs font-medium text-primary">Log your first session →</p>
        </Link>
      ) : null}
    </div>
  );
}
