import type { Goal, Phase, Task, ToDo } from '@/types/goals';

/** Immutable helpers for editing one node deep inside the goal tree. */

export function mapGoal(goals: Goal[], goalId: string, fn: (g: Goal) => Goal): Goal[] {
  return goals.map(g => (g.id === goalId ? fn(g) : g));
}

export function mapPhase(goals: Goal[], goalId: string, phaseId: string, fn: (p: Phase) => Phase): Goal[] {
  return mapGoal(goals, goalId, g => ({
    ...g,
    phases: g.phases.map(p => (p.id === phaseId ? fn(p) : p)),
  }));
}

export function mapTask(goals: Goal[], goalId: string, phaseId: string, taskId: string, fn: (t: Task) => Task): Goal[] {
  return mapPhase(goals, goalId, phaseId, p => ({
    ...p,
    tasks: p.tasks.map(t => (t.id === taskId ? fn(t) : t)),
  }));
}

/** Swap an item with its neighbour and renumber `order`. Returns the same array if the move is impossible. */
export function moveById<T extends { id: string; order: number }>(items: T[], id: string, direction: 'up' | 'down'): T[] {
  const idx = items.findIndex(x => x.id === id);
  if (idx < 0) return items;
  const swap = direction === 'up' ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= items.length) return items;
  const next = [...items];
  [next[idx], next[swap]] = [next[swap], next[idx]];
  return next.map((x, i) => ({ ...x, order: i }));
}

export interface FlatTodo {
  todo: ToDo;
  goal: Goal;
  phase: Phase;
  task: Task;
}

export function flattenTodos(goals: Goal[], opts: { includeArchived?: boolean } = {}): FlatTodo[] {
  const out: FlatTodo[] = [];
  for (const goal of goals) {
    if (goal.archived && !opts.includeArchived) continue;
    for (const phase of goal.phases ?? []) {
      for (const task of phase.tasks ?? []) {
        for (const todo of task.todos ?? []) out.push({ todo, goal, phase, task });
      }
    }
  }
  return out;
}

const EFFORT_WEIGHT = { LOW: 1, MED: 2, HIGH: 3 } as const;

/** How much work a phase holds: to-dos weighted by effort; empty tasks count as medium. */
export function phaseWeight(phase: Phase): number {
  const tasks = phase.tasks ?? [];
  if (tasks.length === 0) return 1;
  return tasks.reduce((sum, t) => {
    const todos = t.todos ?? [];
    if (todos.length === 0) return sum + 2;
    return sum + todos.reduce((s, td) => s + (td.effort ? EFFORT_WEIGHT[td.effort] : 2), 0);
  }, 0);
}

/**
 * Give each phase a deadline between today and the goal's deadline, in
 * proportion to how much work it holds (so a heavy phase gets more time).
 */
export function spreadPhaseDeadlines(phases: Phase[], today: string, goalDeadline: string, addDays: (k: string, n: number) => string, daysBetween: (a: string, b: string) => number): Phase[] | null {
  const totalDays = daysBetween(today, goalDeadline);
  if (totalDays <= 0 || phases.length === 0) return null;
  const weights = phases.map(phaseWeight);
  const total = weights.reduce((a, b) => a + b, 0);
  let acc = 0;
  return phases.map((p, i) => {
    acc += weights[i];
    const offset = i === phases.length - 1 ? totalDays : Math.max(1, Math.round((totalDays * acc) / total));
    return { ...p, deadline: addDays(today, offset) };
  });
}
