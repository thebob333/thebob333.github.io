/**
 * Pure "what happened / what to do" calculations behind the Weekly Review,
 * smart nudges and celebrations.
 */
import type { Goal, HabitLog } from '@/types/goals';
import type { WorkoutSession, ExerciseConfig, CustomExercise } from '@/types/workout';
import { isBodyweightExercise, getExerciseLabel } from '@/types/workout';
import { addDays, dateKeyOf, type DateKey } from '@/lib/dates';
import { getAllActiveHabits, isHabitDueToday } from '@/lib/habits';
import { doneBetween, perWeekOf } from '@/lib/practice';
import { calculateGoalProgress } from '@/types/goals';
import { getExerciseHistory, getPersonalRecords, getProgressionSuggestion, calculateVolumeLoad } from '@/lib/progressive-overload';

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 200, 365];

export function isStreakMilestone(days: number): boolean {
  return STREAK_MILESTONES.includes(days);
}

export interface WeekSummary {
  start: DateKey;
  end: DateKey;
  habitsDone: number;
  habitsDue: number;
  perfectDays: number;
  workouts: number;
  volume: number;
  newPRs: { exercise: string; label: string; value: string }[];
  /** Practices that hit their weekly target, out of all active ones. */
  practicesOnTarget: number;
  practices: number;
  goals: { id: string; title: string; progress: number }[];
}

/** A summary of the 7 days starting at `start`. */
export function summarizeWeek(
  start: DateKey,
  goals: Goal[],
  logs: HabitLog[],
  sessions: WorkoutSession[],
  customExercises: CustomExercise[] = [],
): WeekSummary {
  const end = addDays(start, 6);
  const inWeek = (d: string) => { const k = dateKeyOf(d); return k >= start && k <= end; };
  const habits = getAllActiveHabits(goals);
  const done = new Set(logs.filter(l => l.completed && inWeek(l.date)).map(l => `${l.habitId}|${l.date}`));

  let habitsDue = 0;
  let habitsDone = 0;
  let perfectDays = 0;
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const due = habits.filter(h => isHabitDueToday(h.habit, day));
    const doneToday = due.filter(h => done.has(`${h.habit.id}|${day}`)).length;
    habitsDue += due.length;
    habitsDone += doneToday;
    if (due.length > 0 && doneToday === due.length) perfectDays++;
  }

  const weekSessions = sessions.filter(s => inWeek(s.date));
  const before = sessions.filter(s => dateKeyOf(s.date) < start);
  const isBw = (id: string) => isBodyweightExercise(id, customExercises);
  const prevPRs = new Map(getPersonalRecords(before, isBw).map(p => [p.exercise, p]));
  const newPRs = getPersonalRecords([...before, ...weekSessions], isBw)
    .filter(pr => inWeek(pr.date))
    .filter(pr => {
      const prev = prevPRs.get(pr.exercise);
      if (!prev) return false; // first time isn't a record, it's a start
      return isBw(pr.exercise) ? pr.reps > prev.reps : pr.weight > prev.weight;
    })
    .map(pr => ({
      exercise: pr.exercise,
      label: getExerciseLabel(pr.exercise, customExercises),
      value: isBw(pr.exercise) ? `${pr.reps} reps` : `${pr.weight} lbs × ${pr.reps}`,
    }));

  const practicesOnTarget = habits.filter(h => doneBetween(h.habit.id, logs, start, end) >= perWeekOf(h.habit)).length;

  return {
    start,
    end,
    habitsDone,
    habitsDue,
    perfectDays,
    workouts: weekSessions.length,
    volume: weekSessions.reduce((sum, s) => sum + s.exercises.reduce((a, e) => a + calculateVolumeLoad(e.sets), 0), 0),
    newPRs,
    practicesOnTarget,
    practices: habits.length,
    goals: goals.filter(g => !g.archived).map(g => ({ id: g.id, title: g.title, progress: calculateGoalProgress(g) })),
  };
}

/** Records beaten by a newly logged session (compared with everything before it). */
export function newRecordsIn(session: WorkoutSession, previous: WorkoutSession[], customExercises: CustomExercise[] = []) {
  const isBw = (id: string) => isBodyweightExercise(id, customExercises);
  const prev = new Map(getPersonalRecords(previous, isBw).map(p => [p.exercise, p]));
  const now = getPersonalRecords([session], isBw);
  return now
    .filter(pr => {
      const old = prev.get(pr.exercise);
      if (!old) return false; // first time isn't a "record", it's a start
      return isBw(pr.exercise) ? pr.reps > old.reps : pr.weight > old.weight;
    })
    .map(pr => ({
      label: getExerciseLabel(pr.exercise, customExercises),
      value: isBw(pr.exercise) ? `${pr.reps} reps` : `${pr.weight} lbs`,
    }));
}

export interface Nudge {
  id: string;
  kind: 'deload' | 'fatigue' | 'backup';
  title: string;
  detail: string;
}

/** Lifts that have stalled or show building fatigue. */
export function trainingNudges(sessions: WorkoutSession[], configs: ExerciseConfig[], customExercises: CustomExercise[] = []): Nudge[] {
  const out: Nudge[] = [];
  for (const c of configs) {
    if (customExercises.find(e => e.id === c.exercise)?.archived) continue;
    const history = getExerciseHistory(sessions, c.exercise);
    if (history.length < 2) continue;
    const s = getProgressionSuggestion(c, history, { bodyweight: isBodyweightExercise(c.exercise, customExercises) });
    if (s.type === 'deload' || s.type === 'fatigue_warning') {
      out.push({
        id: `${s.type}:${c.exercise}`,
        kind: s.type === 'deload' ? 'deload' : 'fatigue',
        title: `${getExerciseLabel(c.exercise, customExercises)} ${s.type === 'deload' ? 'has stalled' : 'is getting harder'}`,
        detail: s.message,
      });
    }
  }
  return out;
}
