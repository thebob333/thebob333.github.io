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
  /** Old 1–5 effort scale (5 = all-out). Kept in step with `rir` for older code and data. */
  rpe: number;
  /** Reps in reserve: how many more reps you could have done (0 = none left). */
  rir?: number;
}

/** Reps in reserve for a set — from `rir`, or converted from the old 1–5 effort (5 → 0 … 1 → 4). */
export const rirOf = (s: Pick<SetLog, 'rir' | 'rpe'>): number => (typeof s.rir === 'number' ? s.rir : Math.max(0, Math.min(4, 5 - (s.rpe || 3))));
/** The old 1–5 effort value for a reps-in-reserve number. */
export const rpeFromRir = (rir: number): number => Math.max(1, Math.min(5, 5 - Math.round(rir)));

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
  weightIncrement: number; // lbs/kg to jump (also the rounding step: your smallest plate pair / dumbbell jump)
  /**
   * How it progresses. "double": hit the top of the rep range on every set, then add weight
   * (best for most lifters). "linear": hit the bottom of the range on every set, add weight
   * every session (fast beginner gains).
   */
  style?: 'double' | 'linear';
  /** Reps to leave in the tank on working sets (0–3). Default 2. */
  targetRir?: number;
  /** How much a lighter week takes off, in percent. Default 10. */
  deloadPercent?: number;
  /** Tough sessions (missed the rep minimum) out of the last 3 before a lighter week. Default 2. */
  stallSessions?: number;
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

// ─── Cardio ─────────────────────────────────────────────────────────────────

export type CardioKind = 'run' | 'walk' | 'bike' | 'swim' | 'row' | 'other';
export type DistanceUnit = 'mi' | 'km';

export interface CardioEntry {
  id: string;
  date: string; // ISO
  kind: CardioKind;
  /** Distance in `unit`; optional for e.g. a timed bike class. */
  distance?: number;
  unit: DistanceUnit;
  /** Total time in seconds. */
  seconds: number;
  note?: string;
}

export const CARDIO_LABELS: Record<CardioKind, string> = { run: 'Run', walk: 'Walk', bike: 'Bike', swim: 'Swim', row: 'Row', other: 'Other' };

/** "8:42 /mi" for runs and walks; null without a distance. */
export function paceText(e: Pick<CardioEntry, 'distance' | 'seconds' | 'unit'>): string | null {
  if (!e.distance || e.distance <= 0 || !e.seconds) return null;
  const per = Math.round(e.seconds / e.distance);
  return `${Math.floor(per / 60)}:${String(per % 60).padStart(2, '0')} /${e.unit}`;
}

export function durationText(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** Barbell lifts get a plate calculator. */
export function usesBarbell(id: string, custom: CustomExercise[] = []): boolean {
  if (isBuiltInExercise(id)) return id !== 'pull_up';
  return custom.find(c => c.id === id)?.equipment === 'barbell';
}
