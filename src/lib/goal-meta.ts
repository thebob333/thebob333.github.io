import type { Goal, GoalDomain, Phase, Task, ToDo } from '@/types/goals';
import { calculateGoalProgress, calculateTaskProgress, getDaysRemaining } from '@/types/goals';

/** Vivid gradient + solid color per area of life. */
export const DOMAIN_STYLE: Record<GoalDomain | 'DEFAULT', { label: string; gradient: string; color: string }> = {
  PHYSICAL: { label: 'Physical', gradient: 'linear-gradient(135deg, hsl(16 100% 57%), hsl(350 90% 58%))', color: 'hsl(10 95% 56%)' },
  CREATIVE: { label: 'Creative', gradient: 'linear-gradient(135deg, hsl(320 85% 60%), hsl(268 82% 60%))', color: 'hsl(300 75% 56%)' },
  PROFESSIONAL: { label: 'Professional', gradient: 'linear-gradient(135deg, hsl(228 92% 60%), hsl(205 95% 52%))', color: 'hsl(222 90% 58%)' },
  INTELLECTUAL: { label: 'Intellectual', gradient: 'linear-gradient(135deg, hsl(176 80% 40%), hsl(196 92% 46%))', color: 'hsl(185 85% 40%)' },
  LIFESTYLE: { label: 'Lifestyle', gradient: 'linear-gradient(135deg, hsl(40 98% 52%), hsl(20 100% 56%))', color: 'hsl(32 98% 50%)' },
  DEFAULT: { label: 'Goal', gradient: 'linear-gradient(135deg, hsl(240 90% 62%), hsl(276 86% 60%))', color: 'hsl(250 88% 62%)' },
};

export const DOMAINS = ['PHYSICAL', 'CREATIVE', 'PROFESSIONAL', 'INTELLECTUAL', 'LIFESTYLE'] as const;

export function domainStyle(domain?: GoalDomain) {
  return DOMAIN_STYLE[domain ?? 'DEFAULT'] ?? DOMAIN_STYLE.DEFAULT;
}

export function isTaskComplete(t: Task): boolean {
  const todos = t.todos ?? [];
  return todos.length > 0 ? todos.every(td => td.done) : t.status === 'complete';
}

/** The phase you're in: the first one with unfinished work. */
export function currentPhase(goal: Goal): Phase | undefined {
  return goal.phases.find(p => p.tasks.some(t => !isTaskComplete(t))) ?? goal.phases[goal.phases.length - 1];
}

export interface NextTodo { todo: ToDo; phase: Phase; task: Task }

/** The next to-do to work on: earliest deadline in the current phase, else first in order. */
export function nextTodo(goal: Goal): NextTodo | null {
  for (const phase of goal.phases) {
    const candidates: NextTodo[] = [];
    for (const task of phase.tasks) for (const todo of task.todos ?? []) if (!todo.done) candidates.push({ todo, phase, task });
    if (candidates.length) {
      return candidates.sort((a, b) => (a.todo.deadline ?? '9999').localeCompare(b.todo.deadline ?? '9999'))[0];
    }
  }
  return null;
}

export function goalSummary(goal: Goal) {
  let todosDone = 0;
  let todosTotal = 0;
  let habits = 0;
  for (const p of goal.phases) for (const t of p.tasks) {
    todosTotal += (t.todos ?? []).length;
    todosDone += (t.todos ?? []).filter(x => x.done).length;
    habits += (t.habits ?? []).filter(h => h.active).length;
  }
  return {
    progress: calculateGoalProgress(goal),
    todosDone,
    todosTotal,
    habits,
    next: nextTodo(goal),
    daysLeft: getDaysRemaining(goal.deadline),
  };
}

export function taskSummary(task: Task): string {
  const todos = task.todos ?? [];
  const parts: string[] = [];
  if (todos.length) parts.push(`${todos.filter(t => t.done).length} of ${todos.length} step${todos.length === 1 ? '' : 's'}`);
  const habits = (task.habits ?? []).filter(h => h.active).length;
  if (habits) parts.push(`${habits} practice${habits > 1 ? 's' : ''}`);
  if (!todos.length && !habits) parts.push(task.status === 'complete' ? 'Done' : 'Nothing added yet');
  return parts.join(' · ');
}

export { calculateTaskProgress };

/** "Due today", "3d late", "in 12d", "Dec 4". */
export function dueText(deadline?: string): string | null {
  const d = getDaysRemaining(deadline);
  if (d === null) return null;
  if (d < 0) return `${-d}d late`;
  if (d === 0) return 'Due today';
  if (d === 1) return 'Due tomorrow';
  if (d <= 14) return `in ${d}d`;
  const [y, m, day] = deadline!.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
