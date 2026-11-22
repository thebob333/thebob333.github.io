import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useGoals } from '@/hooks/useGoals';
import { useWorkouts, useActiveWorkout, activeWorkoutActions } from '@/hooks/useWorkouts';
import { useHabits } from '@/hooks/useHabits';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { useSettings } from '@/hooks/useSettings';
import { getExerciseLabel } from '@/types/workout';
import { getDaysRemaining } from '@/types/goals';
import { checkAchievements } from '@/lib/achievements';
import { getTodaysHabits } from '@/lib/habits';
import { flattenTodos } from '@/lib/goal-tree';
import { stores } from '@/lib/storage';
import { dateKeyOf, dayOfWeek, parseDateKey } from '@/lib/dates';
import { quoteOfTheDay } from '@/lib/quotes';
import { PageHeader } from '@/components/app/PageHeader';
import { UpNext, type UpNextItem } from '@/components/today/UpNext';
import { NowCard } from '@/components/today/NowCard';
import { AdjustmentNotices } from '@/components/today/AdjustmentNotices';
import { SmartNudges } from '@/components/today/SmartNudges';
import { WeeklyReview, isReviewDue } from '@/components/today/WeeklyReview';
import { QuickAdd } from '@/components/today/QuickAdd';
import { Onboarding, useShowOnboarding } from '@/components/app/Onboarding';
import { SampleDataBanner } from '@/components/app/SampleDataBanner';
import { Button } from '@/components/ui/button';

// Loaded on first open, so the AI SDK isn't part of Today's instant load.
const CheckInSheet = lazy(() => import('@/components/today/CheckInSheet').then(m => ({ default: m.CheckInSheet })));

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Staggered CSS entrance (time-based, so it never leaves content hidden). */
const enter = (i: number) => ({ className: 'rise-in', style: { animationDelay: `${i * 35}ms` } });

export default function Index() {
  const { goals, toggleToDo } = useGoals();
  const { sessions } = useWorkouts();
  const { logs: habitLogs, toggleCheckIn } = useHabits();
  const [skipped, setSkipped] = useState<string[]>([]);
  const { settings } = useSettings();
  const today = useTodayKey();
  const navigate = useNavigate();
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const activeWorkout = useActiveWorkout();
  const hasActiveWorkout = !!activeWorkout && activeWorkout.exercises.length > 0;

  // Achievements are saved once earned so their unlock dates are real.
  const unlockedAchievements = useStore(stores.ACHIEVEMENTS);
  const { newlyUnlocked } = useMemo(() => checkAchievements(sessions, unlockedAchievements), [sessions, unlockedAchievements]);
  useEffect(() => {
    if (newlyUnlocked.length === 0) return;
    const at = new Date().toISOString();
    stores.ACHIEVEMENTS.update(prev => {
      const have = new Set(prev.map(a => a.id));
      const add = newlyUnlocked.filter(a => !have.has(a.id)).map(a => ({ id: a.id, unlockedAt: at }));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [newlyUnlocked]);

  // ─── Today's plan ───
  const { days: planDays } = useWeeklyPlan();
  const hasPlan = useStore(stores.WEEKLY_PLAN) !== null;
  const todayPlan = hasPlan ? planDays[(dayOfWeek(today) + 6) % 7] : null;
  const trainedToday = sessions.some(s => dateKeyOf(s.date) === today);
  const todaysHabits = useMemo(() => getTodaysHabits(goals, habitLogs, today), [goals, habitLogs, today]);

  const startWorkout = () => {
    if (!hasActiveWorkout) {
      activeWorkoutActions.load(todayPlan?.splitDay ?? 'push', []);
      (todayPlan?.exercises ?? []).forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
    }
    navigate('/gym');
  };

  // ─── One list for everything due today ───
  const { items, later } = useMemo(() => {
    const items: UpNextItem[] = [];
    const later: UpNextItem[] = [];

    if (hasActiveWorkout || (todayPlan && todayPlan.splitDay !== 'rest') || trainedToday) {
      const exercises = hasActiveWorkout ? activeWorkout!.exercises.map(e => e.exercise) : todayPlan?.exercises ?? [];
      items.push({
        kind: 'workout', id: 'today',
        title: hasActiveWorkout ? 'Workout in progress' : trainedToday ? 'Workout logged' : `${(todayPlan?.splitDay ?? 'Workout').replace(/^\w/, c => c.toUpperCase())} day`,
        subtitle: exercises.map(e => getExerciseLabel(e, customExercises)).join(' · ') || undefined,
        done: trainedToday && !hasActiveWorkout,
        resume: hasActiveWorkout,
        onStart: startWorkout,
      });
    }

    for (const { todo, goal, phase, task } of flattenTodos(goals)) {
      const days = getDaysRemaining(todo.deadline, today);
      const toggle = () => {
        toggleToDo(goal.id, phase.id, task.id, todo.id);
        if (!todo.done) toast.success(`Done: ${todo.title}`, { action: { label: 'Undo', onClick: () => toggleToDo(goal.id, phase.id, task.id, todo.id) } });
      };
      const base = { kind: 'todo' as const, id: todo.id, title: todo.title, subtitle: goal.title, days, onToggle: toggle };
      if (todo.done) {
        if (todo.doneAt && dateKeyOf(todo.doneAt) === today) items.push({ ...base, done: true });
      } else if (days !== null && days <= 0) {
        items.push({ ...base, done: false });
      } else if (days !== null && days <= 7) {
        later.push({ ...base, done: false });
      }
    }

    for (const h of todaysHabits) {
      const amount = h.habit.amount !== undefined ? `${h.habit.amount} ${h.habit.unit ?? ''}`.trim() : h.habit.target;
      items.push({
        kind: 'habit', id: h.habit.id,
        title: amount ? `${h.habit.title} · ${amount}` : h.habit.title,
        subtitle: h.goalTitle,
        week: h.perWeek < 7 ? `${h.weekDone} of ${h.perWeek}` : undefined,
        minimum: h.restart ? (h.habit.minimum || 'Just a few minutes of it') : undefined,
        done: h.completed,
        onToggle: () => toggleCheckIn(h.habit.id),
      });
    }

    // Workout first, then late to-dos, practices, then today's to-dos.
    const rank = (i: UpNextItem) => (i.kind === 'workout' ? 0 : i.kind === 'todo' ? (i.days !== null && i.days < 0 ? 1 : 3) : 2);
    items.sort((a, b) => rank(a) - rank(b));
    later.sort((a, b) => ((a as { days: number }).days ?? 0) - ((b as { days: number }).days ?? 0));
    return { items, later };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable store actions
  }, [goals, todaysHabits, today, todayPlan, trainedToday, hasActiveWorkout, activeWorkout, customExercises]);

  // The one thing to do next (skipping ones you've set aside for now).
  const open = items.filter(i => !i.done);
  const hero = open.find(i => !skipped.includes(i.kind + i.id)) ?? open[0] ?? null;
  const rest = items.filter(i => i !== hero);
  const doneCount = items.filter(i => i.done).length;
  const skip = hero && open.length > 1 ? () => setSkipped(s => {
    const key = hero.kind + hero.id;
    const next = [...s.filter(k => k !== key), key];
    // Once everything has been skipped, start over.
    return open.every(i => next.includes(i.kind + i.id)) ? [key] : next;
  }) : undefined;

  const isNew = goals.length === 0 && sessions.length === 0;
  const [reviewOpen, setReviewOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const reviewDue = !isNew && isReviewDue(today, settings.lastReviewWeek);
  const showOnboarding = useShowOnboarding(isNew);
  const dateLabel = parseDateKey(today).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <PageHeader eyebrow={dateLabel} title={greeting()} />

      <SampleDataBanner />

      {isNew ? (
        <div {...enter(1)} className="rise-in surface p-6 text-center">
          <p className="text-title">Let's set you up</p>
          <p className="mx-auto mt-1 max-w-xs text-body text-muted-foreground">Create a goal and TELOS turns it into daily habits and to-dos you check off right here.</p>
          <div className="mt-5 flex flex-col gap-2">
            <Button asChild className="h-12 rounded-xl text-body font-semibold"><Link to="/goals?new=1">Create a goal</Link></Button>
            <Button asChild variant="secondary" className="h-12 rounded-xl text-body"><Link to="/gym?s=program">Set up training</Link></Button>
          </div>
        </div>
      ) : (
        <>
          {reviewDue && (
            <div {...enter(1)}>
              <button type="button" onClick={() => setCheckInOpen(true)} className="surface pressable flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarCheck className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">Weekly check-in</span>
                  <span className="block text-footnote text-muted-foreground">Two minutes with your coach: what happened, what to change.</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          <div {...enter(2)}>
            <NowCard
              item={hero}
              done={doneCount}
              total={items.length}
              onSkip={skip}
              quote={settings.quotesEnabled ? quoteOfTheDay(settings.customQuotes, today) : undefined}
            />
          </div>
          <div {...enter(3)}><AdjustmentNotices /></div>
          <div {...enter(4)}><UpNext items={rest} later={later} /></div>
          <div {...enter(5)}><SmartNudges today={today} kinds={['backup']} /></div>
        </>
      )}


      <WeeklyReview open={reviewOpen} onClose={() => setReviewOpen(false)} today={today} onCheckIn={() => { setReviewOpen(false); setCheckInOpen(true); }} />
      {checkInOpen && <Suspense fallback={null}><CheckInSheet open={checkInOpen} onClose={() => setCheckInOpen(false)} /></Suspense>}
      {!isNew && <QuickAdd onStartWorkout={startWorkout} onReview={() => setReviewOpen(true)} onCheckIn={() => setCheckInOpen(true)} />}
      {showOnboarding && <Onboarding />}
    </div>
  );
}
