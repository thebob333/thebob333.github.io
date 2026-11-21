// ─── Built-in compound exercises (used by strength standards, radar, body diagram) ───
export type CompoundExercise =
  | 'squat' | 'deadlift' | 'bench_press'
  | 'overhead_press' | 'barbell_row' | 'pull_up';

export const BUILT_IN_EXERCISE_IDS: CompoundExercise[] = [
  'squat', 'deadlift', 'bench_press', 'overhead_press', 'barbell_row', 'pull_up',
];

export function isBuiltInExercise(id: string): id is CompoundExercise {
  return BUILT_IN_EXERCISE_IDS.includes(id as CompoundExercise);
}

// ─── Custom exercise support ───
export type EquipmentType = 'barbell' | 'dumbbell' | 'cable' | 'machine' | 'bodyweight' | 'other';

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core' | 'forearms' | 'traps' | 'neck';

export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'forearms', 'traps', 'neck',
];

export interface CustomExercise {
  id: string;
  name: string;
  equipment: EquipmentType;
  muscleGroups: MuscleGroup[];
  notes?: string;
  /** Removed from pickers but kept so old sessions still show its name. */
  archived?: boolean;
}

/** Bodyweight movements progress by reps, and their PRs are max reps. */
export function isBodyweightExercise(id: string, customExercises: CustomExercise[] = []): boolean {
  if (id === 'pull_up') return true;
  return customExercises.find(e => e.id === id)?.equipment === 'bodyweight';
}

// ─── Labels ───
export const EXERCISE_LABELS: Record<CompoundExercise, string> = {
  squat: 'Squat',
  deadlift: 'Deadlift',
  bench_press: 'Bench Press',
  overhead_press: 'Overhead Press',
  barbell_row: 'Barbell Row',
  pull_up: 'Pull-Up',
};

export function getExerciseLabel(id: string, customExercises: CustomExercise[] = []): string {
  if (isBuiltInExercise(id)) return EXERCISE_LABELS[id];
  const custom = customExercises.find(e => e.id === id);
  return custom?.name || id;
}

// ─── Core data types (exercise field is string to support both built-in and custom) ───
export type SplitDay = 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'rest';

export interface SetLog {
  reps: number;
  weight: number;
  rpe: number; // 1-5
}

export interface ExerciseLog {
  exercise: string;
  sets: SetLog[];
  date: string;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  date: string;
  splitDay: SplitDay;
  exercises: ExerciseLog[];
  notes?: string;
}

export interface ExerciseConfig {
  exercise: string;
  targetSets: number;
  repRangeMin: number;
  repRangeMax: number;
  currentWeight: number;
  weightIncrement: number; // lbs/kg to jump
  /** Set when the app (or you) changed the plan after a session, so the next suggestion knows. */
  lastAdjustment?: { type: 'increase_weight' | 'increase_reps' | 'deload'; at: string; from: number };
}

export function defaultConfigFor(exercise: string, bodyweight = false): ExerciseConfig {
  return bodyweight
    ? { exercise, targetSets: 3, repRangeMin: 6, repRangeMax: 10, currentWeight: 0, weightIncrement: 5 }
    : { exercise, targetSets: 3, repRangeMin: 8, repRangeMax: 12, currentWeight: 45, weightIncrement: 5 };
}

/** Keep configs sane: at least 1 set, rep min ≤ rep max, no negative weights. */
export function sanitizeConfig(c: ExerciseConfig): ExerciseConfig {
  const targetSets = Math.min(10, Math.max(1, Math.round(c.targetSets || 1)));
  const repRangeMin = Math.max(1, Math.round(c.repRangeMin || 1));
  const repRangeMax = Math.max(repRangeMin, Math.round(c.repRangeMax || repRangeMin));
  return {
    ...c,
    targetSets,
    repRangeMin,
    repRangeMax,
    currentWeight: Math.max(0, Number(c.currentWeight) || 0),
    weightIncrement: Math.max(0, Number(c.weightIncrement) || 0),
  };
}

export interface WeeklyPlan {
  id: string;
  name: string;
  days: { day: string; splitDay: SplitDay; exercises: string[] }[];
}

export interface PersonalRecord {
  exercise: string;
  weight: number;
  reps: number;
  date: string;
  volumeLoad: number;
}

export const DEFAULT_CONFIGS: ExerciseConfig[] = [
  { exercise: 'squat', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 135, weightIncrement: 5 },
  { exercise: 'deadlift', targetSets: 3, repRangeMin: 5, repRangeMax: 7, currentWeight: 185, weightIncrement: 10 },
  { exercise: 'bench_press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 135, weightIncrement: 5 },
  { exercise: 'overhead_press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 85, weightIncrement: 2.5 },
  { exercise: 'barbell_row', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 115, weightIncrement: 5 },
  { exercise: 'pull_up', targetSets: 3, repRangeMin: 5, repRangeMax: 8, currentWeight: 0, weightIncrement: 5 },
];
