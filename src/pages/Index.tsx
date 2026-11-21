import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarCheck, ChevronRight, Star } from 'lucide-react';
import { toast } from 'sonner';
import { useGoals } from '@/hooks/useGoals';
import { useWorkouts, useActiveWorkout, activeWorkoutActions } from '@/hooks/useWorkouts';
import { useHabits } from '@/hooks/useHabits';
import { useContacts } from '@/hooks/useContacts';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { useSettings } from '@/hooks/useSettings';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { getExerciseLabel } from '@/types/workout';
import { calculateGoalProgress, getDaysRemaining } from '@/types/goals';
import { checkAchievements } from '@/lib/achievements';
import { getTodaysHabits } from '@/lib/habits';
import { flattenTodos } from '@/lib/goal-tree';
import { stores } from '@/lib/storage';
import { dateKeyOf, dayOfWeek, daysBetween, parseDateKey } from '@/lib/dates';
import { computeRings } from '@/lib/today';
import { quoteOfTheDay } from '@/lib/quotes';
import { PageHeader } from '@/components/app/PageHeader';
import { ListRow } from '@/components/app/ListRow';
import { ProgressRing } from '@/components/ProgressRing';
import { LifeRings } from '@/components/today/LifeRings';
import { UpNext, type UpNextItem } from '@/components/today/UpNext';
import { PeopleNudges } from '@/components/today/PeopleNudges';
import { SmartNudges } from '@/components/today/SmartNudges';
import { WeeklyReview, isReviewDue } from '@/components/today/WeeklyReview';
import { QuickAdd } from '@/components/today/QuickAdd';
import { Onboarding, useShowOnboarding } from '@/components/app/Onboarding';
import { SampleDataBanner } from '@/components/app/SampleDataBanner';
import { Button } from '@/components/ui/button';

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
  const { contacts, interactions, commitments, getStreakStatus, completeCommitment, uncompleteCommitment } = useContacts();
  const { settings } = useSettings();
  const { focusIds } = useWeeklyFocus();
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

  const rings = useMemo(() => computeRings({
    today, goals, habits: todaysHabits, plan: todayPlan, sessions, contacts, interactions, commitments, streakStatus: getStreakStatus,
  }), [today, goals, todaysHabits, todayPlan, sessions, contacts, interactions, commitments, getStreakStatus]);

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

    const nameOf = (id: string) => contacts.find(c => c.id === id)?.name ?? 'someone';
    for (const k of commitments) {
      const days = k.dueDate ? daysBetween(today, dateKeyOf(k.dueDate)) : null;
      const doneToday = !!k.completedAt && dateKeyOf(k.completedAt) === today;
      if (!(doneToday || (!k.completedAt && days !== null && days <= 0))) continue;
      items.push({
        kind: 'commitment', id: k.id, title: k.text, subtitle: `Promised to ${nameOf(k.contactId)}`, days, done: doneToday,
        onToggle: () => {
          if (k.completedAt) { uncompleteCommitment(k.id); return; }
          const next = completeCommitment(k.id);
          toast.success(next ? 'Done — next one scheduled' : 'Promise kept', { action: { label: 'Undo', onClick: () => uncompleteCommitment(k.id) } });
        },
      });
    }

    for (const h of todaysHabits) {
      items.push({
        kind: 'habit', id: h.habit.id,
        title: h.habit.target ? `${h.habit.title} · ${h.habit.target}` : h.habit.title,
        subtitle: h.goalTitle, streak: h.streak, done: h.completed,
        onToggle: () => toggleCheckIn(h.habit.id),
      });
    }

    // Workout first, then late to-dos, today's to-dos, promises, habits.
    const rank = (i: UpNextItem) => (i.kind === 'workout' ? 0 : i.kind === 'todo' ? (i.days !== null && i.days < 0 ? 1 : 2) : i.kind === 'commitment' ? 3 : 4);
    items.sort((a, b) => rank(a) - rank(b));
    later.sort((a, b) => ((a as { days: number }).days ?? 0) - ((b as { days: number }).days ?? 0));
    return { items, later };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers are stable store actions
  }, [goals, todaysHabits, commitments, contacts, today, todayPlan, trainedToday, hasActiveWorkout, activeWorkout, customExercises]);

  const focusGoals = focusIds.map(id => goals.find(g => g.id === id)).filter(g => g && !g.archived);
  const isNew = goals.length === 0 && sessions.length === 0;
  const [reviewOpen, setReviewOpen] = useState(false);
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
            <Button asChild variant="secondary" className="h-12 rounded-xl text-body"><Link to="/gym">Set up training</Link></Button>
          </div>
        </div>
      ) : (
        <>
          {reviewDue && (
            <div {...enter(1)}>
              <button type="button" onClick={() => setReviewOpen(true)} className="surface pressable flex w-full items-center gap-3 p-4 text-left">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarCheck className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">Your week in review</span>
                  <span className="block text-footnote text-muted-foreground">Two minutes to look back and set your focus.</span>
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}

          <div {...enter(2)}><LifeRings rings={rings} /></div>
          <div {...enter(3)}><SmartNudges today={today} /></div>
          <div {...enter(4)}><UpNext items={items} later={later} /></div>
          <div {...enter(5)}><PeopleNudges /></div>

          <section {...enter(6)} aria-label="Focus" className="rise-in space-y-2">
            <h2 className="section-label">Focus</h2>
            <div className="list-group">
              {focusGoals.length > 0 ? focusGoals.map(g => {
                const p = calculateGoalProgress(g!);
                return (
                  <ListRow key={g!.id} onClick={() => navigate('/goals')} chevron
                    leading={<ProgressRing value={p} size={34} strokeWidth={3.5} showPercent={false} />}
                    title={g!.title}
                    subtitle={`${p}% complete`}
                  />
                );
              }) : (
                <ListRow onClick={() => navigate('/goals')} chevron
                  leading={<span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-secondary text-muted-foreground"><Star className="h-4 w-4" /></span>}
                  title="Choose up to 3 focus goals"
                  subtitle="Star them in Goals to keep them here"
                />
              )}
            </div>
          </section>
        </>
      )}

      {settings.quotesEnabled && !isNew && (
        <p className="px-1 text-center text-footnote italic text-muted-foreground">“{quoteOfTheDay(settings.customQuotes, today)}”</p>
      )}

      <WeeklyReview open={reviewOpen} onClose={() => setReviewOpen(false)} today={today} />
      {!isNew && <QuickAdd onStartWorkout={startWorkout} onReview={() => setReviewOpen(true)} />}
      {showOnboarding && <Onboarding />}
    </div>
  );
}
