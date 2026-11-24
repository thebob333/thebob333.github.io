import { Goal, HabitLog, type Adjustment, type EngineState, type MetricEntry } from '@/types/goals';
import { WorkoutSession, ExerciseConfig, WeeklyPlan, CustomExercise, type CardioEntry } from '@/types/workout';
import { DEFAULT_CONFIGS } from '@/types/workout';
import type { UnlockedAchievement } from '@/lib/achievements';
import { createStore, type Store } from '@/lib/store';
import type { AreteState } from '@/types/arete';

/**
 * Every user-data key. Backups, migrations and the recovery screen iterate this
 * map, so adding a key here (plus its store below) is all that's needed for it
 * to be backed up and restored.
 */
export const KEYS = {
  GOALS: 'telos_goals',
  SESSIONS: 'telos_sessions',
  EXERCISE_CONFIGS: 'telos_exercise_configs',
  WEEKLY_PLAN: 'telos_weekly_plan',
  SETTINGS: 'telos_settings',
  ACHIEVEMENTS: 'telos_achievements',
  TEMPLATES: 'telos_templates',
  WEEKLY_SCHEDULE: 'telos_weekly_schedule',
  WEEKLY_FOCUS: 'telos_weekly_focus',
  TIME_BLOCKS: 'telos_time_blocks',
  BLOCK_CATEGORIES: 'telos_block_categories',
  REPEATABLE_BLOCKS: 'telos_repeatable_blocks',
  CUSTOM_EXERCISES: 'telos_custom_exercises',
  HABIT_LOGS: 'telos_habit_logs',
  GOAL_TEMPLATES: 'telos_goal_templates',
  ACTIVE_WORKOUT: 'telos_active_workout',
  PLAN_DISMISSED: 'telos_plan_dismissed',
  ADJUSTMENTS: 'telos_adjustments',
  ENGINE: 'telos_engine',
  METRICS: 'telos_metrics',
  CARDIO: 'telos_cardio',
  ARETE: 'telos_arete',
} as const;

/** Keys from removed features (People). Cleaned out by migration v6. */
export const RETIRED_KEYS = ['telos_contacts', 'telos_interactions', 'telos_commitments', 'telos_relationship_goals'] as const;

export type StoreName = keyof typeof KEYS;
export type StorageKey = (typeof KEYS)[StoreName];

/** App bookkeeping keys — deliberately NOT part of backups. */
export const META_KEYS = {
  SCHEMA_VERSION: 'telos_schema_version',
  LAST_EXPORT: 'telos_last_export_at',
} as const;

// Repeatable Block Template
export type RepeatPattern = 'daily' | 'weekdays' | 'weekends' | 'custom';
export interface RepeatableBlock {
  id: string;
  title: string;
  categoryId: string;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
  repeatPattern: RepeatPattern;
  customDays?: string[]; // e.g. ['Monday', 'Wednesday', 'Friday']
  enabled: boolean;
}

// Time Block Types
export interface BlockCategory {
  id: string;
  name: string;
  color: string; // HSL string like "130 100% 40%"
}

export interface TimeBlock {
  id: string;
  /** Local date key (YYYY-MM-DD) the block belongs to. Legacy data may hold a weekday name. */
  dayName: string;
  categoryId: string;
  title: string;
  startHour: number; // 5-26: Plan's day runs 5 AM–3 AM, so 24+ means after midnight (see lib/plan-time)
  startMinute: number; // 0-59
  durationMinutes: number; // any whole number of minutes
  todoId?: string; // optional link to a goal todo
  sourceTemplateId?: string; // created from a repeatable routine
  habitId?: string; // optional link to a goal habit
  done?: boolean;
}

export const DEFAULT_CATEGORIES: BlockCategory[] = [
  { id: 'workout', name: 'Workout', color: '130 100% 40%' },
  { id: 'meals', name: 'Meals', color: '42 100% 50%' },
  { id: 'goals', name: 'Goals', color: '280 80% 55%' },
  { id: 'work', name: 'Work', color: '210 80% 50%' },
  { id: 'study', name: 'Study', color: '170 70% 40%' },
  { id: 'personal', name: 'Personal', color: '350 80% 55%' },
  { id: 'rest', name: 'Rest / Recovery', color: '60 20% 40%' },
];

export interface AppSettings {
  quotesEnabled: boolean;
  customQuotes: string[];
  bodyweight: number;
  ambientSoundEnabled: boolean;
  goldTargets: Record<string, number>; // exercise ID → custom target (weight in lbs, or reps for pull_up)
  /** Monday (YYYY-MM-DD) of the last week you reviewed. */
  lastReviewWeek?: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  quotesEnabled: true,
  customQuotes: [],
  bodyweight: 180,
  ambientSoundEnabled: false,
  goldTargets: {},
};

export interface WorkoutTemplate {
  id: string;
  name: string;
  splitDay: string;
  exercises: { exercise: string; sets: number; weight: number; reps: number }[];
}

// Weekly Schedule (day → todo IDs)
export type WeeklySchedule = Record<string, string[]>;

/** The workout being logged right now — survives navigation and the app being closed. */
export interface ActiveWorkout {
  splitDay: string;
  exercises: { id: string; exercise: string; sets: { reps: number; weight: number; rpe: number; rir?: number }[] }[];
  notes: string;
  startedAt: string;
}

/** Per day (YYYY-MM-DD): auto-created Plan blocks you removed, so they aren't re-created. */
export type PlanDismissed = Record<string, string[]>;

// Goal Templates ("Blueprints")
/** Deadlines are stored as days after the goal starts, so a blueprint can be reused any time. */
export interface BlueprintTodo { title: string; effort?: 'LOW' | 'MED' | 'HIGH'; isBenchmark?: boolean; offsetDays?: number }
export interface BlueprintHabit { title: string; frequency: string; target?: string; evolution?: 'NEW' | 'CARRY' | 'INCREASE' | 'REPLACE' }
export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  endGoal: string;
  domain?: string;
  /** Goal length in days (from start to deadline), if the original had a deadline. */
  durationDays?: number;
  phases: {
    title: string;
    description: string;
    offsetDays?: number;
    tasks: { title: string; description: string; offsetDays?: number; todos: (string | BlueprintTodo)[]; habits: BlueprintHabit[] }[];
  }[];
  createdAt: string;
}

// ─── Shared stores (one per key) ────────────────────────────────────────────

const arrayStore = <T,>(key: StorageKey, label: string, fallback: () => T[] = () => []) =>
  createStore<T[]>({ key, label, kind: 'array', fallback });

function normalizeSettings(s: AppSettings): AppSettings {
  const merged = { ...DEFAULT_SETTINGS, ...s };
  if (!merged.goldTargets || typeof merged.goldTargets !== 'object' || Array.isArray(merged.goldTargets)) {
    merged.goldTargets = {};
  }
  if (!Array.isArray(merged.customQuotes)) merged.customQuotes = [];
  return merged;
}

/** Keep the Arete state whole even if a field is missing or mangled. */
export function normalizeArete(v: Partial<AreteState>): AreteState {
  const obj = (x: unknown) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  return {
    ...v,
    claims: obj(v.claims) as AreteState['claims'],
    pinned: Array.isArray(v.pinned) ? v.pinned.filter(x => typeof x === 'string') : [],
    grown: Array.isArray(v.grown) ? v.grown.filter(n => n && typeof n.id === 'string' && typeof n.title === 'string' && Array.isArray(n.requires)) : [],
    goalLinks: obj(v.goalLinks) as AreteState['goalLinks'],
  };
}

export const stores = {
  GOALS: arrayStore<Goal>(KEYS.GOALS, 'Goals'),
  SESSIONS: arrayStore<WorkoutSession>(KEYS.SESSIONS, 'Workout sessions'),
  EXERCISE_CONFIGS: arrayStore<ExerciseConfig>(KEYS.EXERCISE_CONFIGS, 'Exercise settings', () => DEFAULT_CONFIGS.map(c => ({ ...c }))),
  WEEKLY_PLAN: createStore<WeeklyPlan | null>({ key: KEYS.WEEKLY_PLAN, label: 'Weekly training split', kind: 'nullable', fallback: () => null }),
  SETTINGS: createStore<AppSettings>({
    key: KEYS.SETTINGS, label: 'Settings', kind: 'object',
    fallback: () => ({ ...DEFAULT_SETTINGS, goldTargets: {}, customQuotes: [] }),
    normalize: normalizeSettings,
  }),
  ACHIEVEMENTS: arrayStore<UnlockedAchievement>(KEYS.ACHIEVEMENTS, 'Achievements'),
  TEMPLATES: arrayStore<WorkoutTemplate>(KEYS.TEMPLATES, 'Saved workouts'),
  WEEKLY_SCHEDULE: createStore<WeeklySchedule>({ key: KEYS.WEEKLY_SCHEDULE, label: 'Weekly schedule', kind: 'object', fallback: () => ({}) }),
  WEEKLY_FOCUS: arrayStore<string>(KEYS.WEEKLY_FOCUS, 'Weekly focus'),
  TIME_BLOCKS: arrayStore<TimeBlock>(KEYS.TIME_BLOCKS, 'Plan time blocks'),
  BLOCK_CATEGORIES: arrayStore<BlockCategory>(KEYS.BLOCK_CATEGORIES, 'Block categories', () => DEFAULT_CATEGORIES.map(c => ({ ...c }))),
  REPEATABLE_BLOCKS: arrayStore<RepeatableBlock>(KEYS.REPEATABLE_BLOCKS, 'Routines'),
  CUSTOM_EXERCISES: arrayStore<CustomExercise>(KEYS.CUSTOM_EXERCISES, 'Custom exercises'),
  HABIT_LOGS: arrayStore<HabitLog>(KEYS.HABIT_LOGS, 'Habit check-ins'),
  GOAL_TEMPLATES: arrayStore<GoalTemplate>(KEYS.GOAL_TEMPLATES, 'Goal blueprints'),
  ACTIVE_WORKOUT: createStore<ActiveWorkout | null>({ key: KEYS.ACTIVE_WORKOUT, label: 'Workout in progress', kind: 'nullable', fallback: () => null }),
  PLAN_DISMISSED: createStore<PlanDismissed>({ key: KEYS.PLAN_DISMISSED, label: 'Removed plan blocks', kind: 'object', fallback: () => ({}) }),
  ADJUSTMENTS: arrayStore<Adjustment>(KEYS.ADJUSTMENTS, 'Plan adjustments'),
  ENGINE: createStore<EngineState>({ key: KEYS.ENGINE, label: 'Adaptation engine', kind: 'object', fallback: () => ({}) }),
  METRICS: arrayStore<MetricEntry>(KEYS.METRICS, 'Progress measurements'),
  CARDIO: arrayStore<CardioEntry>(KEYS.CARDIO, 'Cardio'),
  ARETE: createStore<AreteState>({ key: KEYS.ARETE, label: 'Arete skill tree', kind: 'object', fallback: () => normalizeArete({}), normalize: normalizeArete }),
} satisfies { [K in StoreName]: Store<unknown> };

// ─── Legacy load/save helpers ───────────────────────────────────────────────
// These now go through the shared stores (so they can never hold a stale copy).
// Prefer `useStore(stores.X)` in components and `stores.X.update(...)` for writes.

/** @deprecated use stores.GOALS */
export const loadGoals = (): Goal[] => stores.GOALS.get();
/** @deprecated use stores.GOALS */
export const saveGoals = (goals: Goal[]) => stores.GOALS.set(goals);
/** @deprecated use stores.SESSIONS */
export const loadSessions = (): WorkoutSession[] => stores.SESSIONS.get();
/** @deprecated use stores.SESSIONS */
export const saveSessions = (sessions: WorkoutSession[]) => stores.SESSIONS.set(sessions);
/** @deprecated use stores.EXERCISE_CONFIGS */
export const loadExerciseConfigs = (): ExerciseConfig[] => stores.EXERCISE_CONFIGS.get();
/** @deprecated use stores.EXERCISE_CONFIGS */
export const saveExerciseConfigs = (configs: ExerciseConfig[]) => stores.EXERCISE_CONFIGS.set(configs);
/** @deprecated use stores.WEEKLY_PLAN */
export const loadWeeklyPlan = (): WeeklyPlan | null => stores.WEEKLY_PLAN.get();
/** @deprecated use stores.WEEKLY_PLAN */
export const saveWeeklyPlan = (plan: WeeklyPlan) => stores.WEEKLY_PLAN.set(plan);
/** @deprecated use stores.SETTINGS */
export const loadSettings = (): AppSettings => stores.SETTINGS.get();
/** @deprecated use stores.SETTINGS */
export const saveSettings = (settings: AppSettings) => stores.SETTINGS.set(settings);
/** @deprecated use stores.ACHIEVEMENTS */
export const loadAchievements = (): UnlockedAchievement[] => stores.ACHIEVEMENTS.get();
/** @deprecated use stores.ACHIEVEMENTS */
export const saveAchievements = (a: UnlockedAchievement[]) => stores.ACHIEVEMENTS.set(a);
/** @deprecated use stores.TEMPLATES */
export const loadTemplates = (): WorkoutTemplate[] => stores.TEMPLATES.get();
/** @deprecated use stores.TEMPLATES */
export const saveTemplates = (t: WorkoutTemplate[]) => stores.TEMPLATES.set(t);
/** @deprecated use stores.WEEKLY_SCHEDULE */
export const loadWeeklySchedule = (): WeeklySchedule => stores.WEEKLY_SCHEDULE.get();
/** @deprecated use stores.WEEKLY_SCHEDULE */
export const saveWeeklySchedule = (s: WeeklySchedule) => stores.WEEKLY_SCHEDULE.set(s);
/** @deprecated use stores.WEEKLY_FOCUS */
export const loadWeeklyFocus = (): string[] => stores.WEEKLY_FOCUS.get();
/** @deprecated use stores.WEEKLY_FOCUS */
export const saveWeeklyFocus = (f: string[]) => stores.WEEKLY_FOCUS.set(f);
/** @deprecated use stores.TIME_BLOCKS */
export const loadTimeBlocks = (): TimeBlock[] => stores.TIME_BLOCKS.get();
/** @deprecated use stores.TIME_BLOCKS */
export const saveTimeBlocks = (b: TimeBlock[]) => stores.TIME_BLOCKS.set(b);
/** @deprecated use stores.BLOCK_CATEGORIES */
export const loadBlockCategories = (): BlockCategory[] => stores.BLOCK_CATEGORIES.get();
/** @deprecated use stores.BLOCK_CATEGORIES */
export const saveBlockCategories = (c: BlockCategory[]) => stores.BLOCK_CATEGORIES.set(c);
/** @deprecated use stores.REPEATABLE_BLOCKS */
export const loadRepeatableBlocks = (): RepeatableBlock[] => stores.REPEATABLE_BLOCKS.get();
/** @deprecated use stores.REPEATABLE_BLOCKS */
export const saveRepeatableBlocks = (b: RepeatableBlock[]) => stores.REPEATABLE_BLOCKS.set(b);
/** @deprecated use stores.CUSTOM_EXERCISES */
export const loadCustomExercises = (): CustomExercise[] => stores.CUSTOM_EXERCISES.get();
/** @deprecated use stores.CUSTOM_EXERCISES */
export const saveCustomExercises = (e: CustomExercise[]) => stores.CUSTOM_EXERCISES.set(e);
/** @deprecated use stores.HABIT_LOGS */
export const loadHabitLogs = (): HabitLog[] => stores.HABIT_LOGS.get();
/** @deprecated use stores.HABIT_LOGS */
export const saveHabitLogs = (l: HabitLog[]) => stores.HABIT_LOGS.set(l);
/** @deprecated use stores.GOAL_TEMPLATES */
export const loadGoalTemplates = (): GoalTemplate[] => stores.GOAL_TEMPLATES.get();
/** @deprecated use stores.GOAL_TEMPLATES */
export const saveGoalTemplates = (t: GoalTemplate[]) => stores.GOAL_TEMPLATES.set(t);

export function generateId(): string {
  return crypto.randomUUID();
}
