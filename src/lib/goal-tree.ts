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
