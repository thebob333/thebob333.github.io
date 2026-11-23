/** Training stats: sets per muscle, estimated max trends, and the post-workout summary. */
import type { CompoundExercise, CustomExercise, ExerciseConfig, WorkoutSession } from '@/types/workout';
import { getExerciseLabel, isBuiltInExercise } from '@/types/workout';
import { calculateVolumeLoad, estimateE1RM } from '@/lib/progressive-overload';
import { newRecordsIn } from '@/lib/insights';
import { addDays, dateKeyOf, type DateKey } from '@/lib/dates';

// Our app muscle groups → which compound exercises work them, with weight (1.0 = primary, 0.3 = secondary)
export const APP_MUSCLE_EXERCISES: Record<string, { exercise: CompoundExercise; weight: number }[]> = {
  chest: [{ exercise: 'bench_press', weight: 1.0 }],
  back: [{ exercise: 'pull_up', weight: 1.0 }, { exercise: 'barbell_row', weight: 1.0 }, { exercise: 'deadlift', weight: 0.3 }],
  shoulders: [{ exercise: 'overhead_press', weight: 1.0 }, { exercise: 'bench_press', weight: 0.3 }],
  biceps: [{ exercise: 'barbell_row', weight: 0.5 }, { exercise: 'pull_up', weight: 0.5 }],
  triceps: [{ exercise: 'bench_press', weight: 0.5 }, { exercise: 'overhead_press', weight: 0.5 }],
  quads: [{ exercise: 'squat', weight: 1.0 }],
  hamstrings: [{ exercise: 'deadlift', weight: 1.0 }, { exercise: 'squat', weight: 0.2 }],
  glutes: [{ exercise: 'squat', weight: 0.7 }, { exercise: 'deadlift', weight: 0.7 }],
  calves: [{ exercise: 'squat', weight: 0.2 }],
  core: [{ exercise: 'squat', weight: 0.3 }, { exercise: 'deadlift', weight: 0.3 }, { exercise: 'overhead_press', weight: 0.3 }],
  forearms: [{ exercise: 'deadlift', weight: 0.3 }, { exercise: 'barbell_row', weight: 0.3 }, { exercise: 'pull_up', weight: 0.3 }],
  traps: [{ exercise: 'deadlift', weight: 0.5 }, { exercise: 'barbell_row', weight: 0.5 }],
  neck: [], // Only shows progress from neck-specific custom exercises
};
/** Muscles an exercise mainly trains (built-in: primary + strong secondary; custom: what you picked). */
export function musclesFor(exercise: string, custom: CustomExercise[] = []): string[] {
  if (isBuiltInExercise(exercise)) {
    return Object.entries(APP_MUSCLE_EXERCISES).filter(([, list]) => list.some(x => x.exercise === exercise && x.weight >= 0.5)).map(([m]) => m);
  }
  return custom.find(c => c.id === exercise)?.muscleGroups ?? [];
}

/** Working sets per muscle in the 7 days starting `from`. */
export function muscleSets(sessions: WorkoutSession[], custom: CustomExercise[], from: DateKey): Record<string, number> {
  const to = addDays(from, 6);
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const d = dateKeyOf(s.date);
    if (d < from || d > to) continue;
    for (const e of s.exercises) for (const m of musclesFor(e.exercise, custom)) out[m] = (out[m] ?? 0) + e.sets.length;
  }
  return out;
}

/** Best estimated one-rep max per session for a lift (bodyweight lifts: best reps). */
export function e1rmSeries(sessions: WorkoutSession[], exercise: string, bodyweight: boolean): { date: string; value: number }[] {
  return [...sessions].sort((a, b) => a.date.localeCompare(b.date)).flatMap(s => {
    const sets = s.exercises.filter(e => e.exercise === exercise).flatMap(e => e.sets);
    if (!sets.length) return [];
    const value = bodyweight ? Math.max(...sets.map(x => x.reps)) : Math.max(...sets.map(x => estimateE1RM(x.weight, x.reps)));
    return [{ date: s.date, value }];
  });
}

export interface SessionSummary {
  sessionId: string;
  minutes: number | null;
  sets: number;
  volume: number;
  /** Change in volume vs the last session of the same split (percent), if any. */
  vsLast: number | null;
  records: { label: string; value: string }[];
  /** Planned for next time: increases earned and lighter weeks applied. */
  next: { exercise: string; label: string; from: number; to: number; kind: 'up' | 'reps' | 'lighter'; unit: string }[];
}

export function buildSummary(session: WorkoutSession, before: WorkoutSession[], configsBefore: ExerciseConfig[], configsAfter: ExerciseConfig[], custom: CustomExercise[], startedAt?: string): SessionSummary {
  const volume = session.exercises.reduce((n, e) => n + calculateVolumeLoad(e.sets), 0);
  const last = [...before].filter(s => s.splitDay === session.splitDay).sort((a, b) => b.date.localeCompare(a.date))[0];
  const lastVolume = last ? last.exercises.reduce((n, e) => n + calculateVolumeLoad(e.sets), 0) : 0;
  const next: SessionSummary['next'] = [];
  for (const e of session.exercises) {
    const a = configsBefore.find(c => c.exercise === e.exercise);
    const b = configsAfter.find(c => c.exercise === e.exercise);
    if (!a || !b) continue;
    const label = getExerciseLabel(e.exercise, custom);
    if (b.currentWeight > a.currentWeight) next.push({ exercise: e.exercise, label, from: a.currentWeight, to: b.currentWeight, kind: 'up', unit: 'lb' });
    else if (b.currentWeight < a.currentWeight) next.push({ exercise: e.exercise, label, from: a.currentWeight, to: b.currentWeight, kind: 'lighter', unit: 'lb' });
    else if (b.repRangeMax > a.repRangeMax) next.push({ exercise: e.exercise, label, from: a.repRangeMax, to: b.repRangeMax, kind: 'reps', unit: 'reps' });
  }
  const minutes = startedAt ? Math.max(1, Math.round((new Date(session.date).getTime() - new Date(startedAt).getTime()) / 60000)) : null;
  return {
    sessionId: session.id,
    minutes: minutes && minutes < 600 ? minutes : null,
    sets: session.exercises.reduce((n, e) => n + e.sets.length, 0),
    volume,
    vsLast: last && lastVolume > 0 ? Math.round(((volume - lastVolume) / lastVolume) * 100) : null,
    records: newRecordsIn(session, before, custom),
    next,
  };
}

