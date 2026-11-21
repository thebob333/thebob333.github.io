import { dateKeyOf, daysBetween, todayKey, type DateKey } from '@/lib/dates';

export type Status = 'not_started' | 'in_progress' | 'complete';
export type GoalDomain = 'PHYSICAL' | 'CREATIVE' | 'PROFESSIONAL' | 'INTELLECTUAL' | 'LIFESTYLE';
export type EffortLevel = 'LOW' | 'MED' | 'HIGH';
export type HabitEvolution = 'NEW' | 'CARRY' | 'INCREASE' | 'REPLACE';

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
  order: number;
  deadline?: string;
  effort?: EffortLevel;
  isBenchmark?: boolean;
}

export interface Habit {
  id: string;
  title: string;
  frequency: string; // "daily", "3x/week", "weekdays", etc.
  target?: string; // "200g protein", "30 minutes", etc.
  active: boolean;
  evolution?: HabitEvolution;
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
