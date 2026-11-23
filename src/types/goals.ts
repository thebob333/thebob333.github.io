import { dateKeyOf, daysBetween, todayKey, type DateKey } from '@/lib/dates';

export type Status = 'not_started' | 'in_progress' | 'complete';
export type GoalDomain = 'PHYSICAL' | 'CREATIVE' | 'PROFESSIONAL' | 'INTELLECTUAL' | 'LIFESTYLE';
export type EffortLevel = 'LOW' | 'MED' | 'HIGH';
export type HabitEvolution = 'NEW' | 'CARRY' | 'INCREASE' | 'REPLACE';

/**
 * The five goal shapes (docs/apex-blueprint.md §5). Each is planned and
 * measured differently.
 */
export type GoalShape = 'once' | 'better' | 'build' | 'keep' | 'become';
/** How hard the coach pushes back — on the path, never on the ambition. */
export type Pushback = 'gentle' | 'honest' | 'relentless';
export type GoalStatus = 'active' | 'paused' | 'achieved' | 'dropped';

/** What "get better" goals measure, e.g. 5K time (lower is better) or bench (higher). */
export interface GoalMetric {
  name: string;
  unit: string;
  start?: number;
  target?: number;
  higherIsBetter: boolean;
}

export interface MetricEntry {
  id: string;
  goalId: string;
  date: string; // local YYYY-MM-DD
  value: number;
  note?: string;
}

/** A practice's load — the thing the adaptation engine turns up and down. */
export interface PracticeLoad {
  perWeek: number;
  amount?: number;
}

export type AdjustmentKind = 'up' | 'ease' | 'restart' | 'flag';
export type AdjustmentStatus = 'applied' | 'pending' | 'undone' | 'declined' | 'info';

/** One change the engine made (or proposes), shown on Today with Undo / Accept. */
export interface Adjustment {
  id: string;
  goalId: string;
  habitId: string;
  title: string; // practice title, for display after renames/deletes
  kind: AdjustmentKind;
  /** Monday of the week this was about. */
  week: string;
  at: string; // ISO
  before: PracticeLoad;
  after: PracticeLoad;
  reason: string;
  status: AdjustmentStatus;
  seen: boolean;
}

export interface EngineState {
  /** Monday of the last week the engine evaluated. */
  lastWeek?: string;
}

export interface HabitLog {
  habitId: string;
  date: string; // local calendar day, YYYY-MM-DD
  completed: boolean;
  value?: number; // optional numeric tracking (e.g. grams of protein, minutes)
  at?: string; // ISO timestamp of the check-in (lets future fixes re-key dates exactly)
}

export interface ToDo {
  id: string;
  title: string;
  done: boolean;
  /** When it was checked off (ISO) — lets Today count what you finished today. */
  doneAt?: string;
  order: number;
  deadline?: string;
  effort?: EffortLevel;
  isBenchmark?: boolean;
  /** Rough minutes it takes (from the coach or you). */
  estimateMin?: number;
  /**
   * The deadline was set by the Path scheduler (not by you), so a plan rebuild
   * may move it. Deadlines you set yourself are never moved.
   */
  scheduled?: boolean;
}

/**
 * A recurring practice ("habit" in code). `perWeek` (+ optional `amount`) is the
 * load the adaptation engine adjusts; `frequency` is kept in step for display.
 */
export interface Habit {
  id: string;
  title: string;
  frequency: string; // "daily", "3x/week", "weekdays", "mon/wed/fri"…
  target?: string; // free text: "200g protein", "30 minutes"…
  active: boolean;
  evolution?: HabitEvolution;
  /** Sessions per week right now (1–7). Derived from `frequency` when missing. */
  perWeek?: number;
  /** The level you're building toward; the engine won't step past it. */
  maxPerWeek?: number;
  /** Optional measurable amount per session that can grow, e.g. 20 (minutes). */
  amount?: number;
  unit?: string;
  step?: number;
  maxAmount?: number;
  /** The easy version for bad weeks, e.g. "Walk 10 minutes". */
  minimum?: string;
  /** false = the engine proposes changes instead of making them. */
  auto?: boolean;
  /** Restart week: show the easy version until this day (inclusive). */
  restartUntil?: string;
  /** First day it counts (new practices aren't judged on weeks before they existed). */
  since?: string;
}

export interface TaskNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: Status;
  todos: ToDo[];
  habits: Habit[];
  notes?: TaskNote[];
  order: number;
  deadline?: string;
  /** Ids of tasks that must be finished before this one can start (The Path). */
  dependsOn?: string[];
  /** Hands-on hours the whole task takes. Estimated from its steps when missing. */
  effortHours?: number;
  /** Calendar days of waiting after it's done before what depends on it can start (e.g. replies, shipping). */
  waitDays?: number;
  /** A milestone on the Path. */
  milestone?: boolean;
  /** Where the Path scheduler placed it (local YYYY-MM-DD). */
  plannedStart?: string;
  plannedEnd?: string;
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  deadline?: string;
  tasks: Task[];
  order: number;
}

export interface AdaptationProtocol {
  ahead: string;
  behind: string;
  blocked: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  endGoal: string;
  deadline?: string;
  phases: Phase[];
  createdAt: string;
  archived?: boolean;
  domain?: GoalDomain;
  adaptationProtocol?: AdaptationProtocol;
  shape?: GoalShape;
  /** Why it matters — shown when things get hard. */
  why?: string;
  pushback?: Pushback;
  status?: GoalStatus;
  metric?: GoalMetric;
  /** If-then plans for likely obstacles ("If I miss a morning run, I'll go after work"). */
  ifThen?: string[];
  /** Hours a week you can give this goal; the Path schedules with it. */
  hoursPerWeek?: number;
  /** Set when Day Zero designed the goal: strategy, research, alternative routes, rebuild log. */
  architect?: Architecture;
}

/** A step in a route blueprint (kept for routes you haven't switched to). */
export interface BlueprintTask {
  key: string;
  title: string;
  description: string;
  effortHours: number;
  waitDays: number;
  dependsOn: string[]; // keys
  milestone: boolean;
  steps: { title: string; minutes: number | null }[];
  practices: {
    title: string; perWeek: number; buildToPerWeek: number; amount: number | null; unit: string | null;
    step: number | null; maxAmount: number | null; easyVersion: string; details: string | null;
  }[];
}

export interface BlueprintStage { title: string; description: string; tasks: BlueprintTask[] }

/** One way to get there. Day Zero designs 2–3 and you pick. */
export interface Route {
  id: string;
  name: string;
  summary: string;
  /** What you gain and give up compared with the others. */
  tradeoff: string;
  stages: BlueprintStage[];
}

export interface PlanRebuild {
  id: string;
  at: string; // ISO
  /** Plain sentence for the user. */
  note: string;
  /** Likely finish after the rebuild (YYYY-MM-DD). */
  finish?: string;
  seen: boolean;
  /** "auto" = the scheduler moved its own dates; "coach" = Day Zero redesigned the plan; "route" = you switched routes. */
  kind: 'auto' | 'coach' | 'route';
}

export interface Architecture {
  /** What you told Day Zero, in your words. */
  brief: string;
  strategy: string;
  /** What the research found, in a few sentences. */
  research?: string;
  sources?: { title: string; url: string }[];
  assumptions: string[];
  risks: { risk: string; mitigation: string }[];
  routes: Route[];
  activeRouteId: string;
  createdAt: string;
  /** Keep the schedule up to date automatically when you slip or get ahead. */
  autopilot: boolean;
  history: PlanRebuild[];
  /** Phases before the last automatic change, for Undo. */
  undo?: { at: string; phases: Phase[]; activeRouteId?: string };
}

export function calculateTaskProgress(task: Task): number {
  const todos = task.todos ?? [];
  if (todos.length === 0) return task.status === 'complete' ? 100 : 0;
  const done = todos.filter(t => t.done).length;
  return Math.round((done / todos.length) * 100);
}

export function calculatePhaseProgress(phase: Phase): number {
  const tasks = phase.tasks ?? [];
  if (tasks.length === 0) return 0;
  const total = tasks.reduce((sum, t) => sum + calculateTaskProgress(t), 0);
  return Math.round(total / tasks.length);
}

export function calculateGoalProgress(goal: Goal): number {
  const phases = goal.phases ?? [];
  if (phases.length === 0) return 0;
  const total = phases.reduce((sum, p) => sum + calculatePhaseProgress(p), 0);
  return Math.round(total / phases.length);
}

export function deriveTaskStatus(task: Task): Status {
  const todos = task.todos ?? [];
  if (todos.length === 0) return task.status;
  const allDone = todos.every(t => t.done);
  const anyDone = todos.some(t => t.done);
  if (allDone) return 'complete';
  if (anyDone) return 'in_progress';
  return 'not_started';
}

/** Calendar days until the deadline (0 = due today, negative = overdue). */
export function getDaysRemaining(deadline?: string, today: DateKey = todayKey()): number | null {
  if (!deadline) return null;
  return daysBetween(today, dateKeyOf(deadline));
}

export function getUrgencyClass(days: number | null): string {
  if (days === null) return '';
  if (days < 0) return 'urgency-overdue';
  if (days <= 7) return 'urgency-critical';
  if (days <= 30) return 'urgency-warning';
  return 'urgency-safe';
}

export function getUrgencyColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground';
  if (days < 0) return 'text-destructive';
  if (days <= 7) return 'text-destructive';
  if (days <= 30) return 'text-secondary';
  return 'text-primary';
}
