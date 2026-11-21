import { Goal, Phase, Task, ToDo, Habit, TaskNote, GoalDomain } from '@/types/goals';
import { stores, generateId, GoalTemplate } from '@/lib/storage';
import { mapGoal, mapPhase, mapTask, moveById } from '@/lib/goal-tree';
import { useStore } from '@/hooks/useStore';
import { addDays, dateKeyOf, daysBetween, todayKey } from '@/lib/dates';

const G = stores.GOALS;
const T = stores.GOAL_TEMPLATES;

const DEFAULT_PHASES = [
  { title: 'Foundation', description: 'Research, planning, and initial setup — lay the groundwork.' },
  { title: 'Development', description: 'Build core skills, systems, and habits — do the main work.' },
  { title: 'Refinement', description: 'Optimize, iterate, and fix gaps — sharpen what you\'ve built.' },
  { title: 'Mastery', description: 'Sustain, teach, and push limits — own the outcome.' },
];

/**
 * Goal actions live at module level: they always operate on the latest stored
 * value (`update(prev => …)`), keep stable identities, and can be called from
 * anywhere — not just inside React.
 */
export const goalActions = {
  addGoal(title: string, description: string, endGoal: string, deadline?: string, domain?: GoalDomain): Goal {
    const phases: Phase[] = DEFAULT_PHASES.map((p, i) => ({
      id: generateId(), title: p.title, description: p.description, tasks: [], order: i,
    }));
    const newGoal: Goal = {
      id: generateId(), title, description, endGoal, deadline, domain, phases,
      createdAt: new Date().toISOString(),
    };
    G.update(goals => [...goals, newGoal]);
    return newGoal;
  },

  updateGoal(id: string, updates: Partial<Goal>) {
    G.update(goals => mapGoal(goals, id, g => ({ ...g, ...updates })));
  },

  /** Put a goal back exactly as it was (used by Undo). */
  restoreGoal(goal: Goal) {
    G.update(goals => (goals.some(g => g.id === goal.id) ? goals.map(g => (g.id === goal.id ? goal : g)) : [...goals, goal]));
  },

  deleteGoal(id: string) {
    G.update(goals => goals.filter(g => g.id !== id));
    stores.WEEKLY_FOCUS.update(f => (f.includes(id) ? f.filter(x => x !== id) : f));
  },

  addPhase(goalId: string, title: string, description: string, deadline?: string) {
    G.update(goals => mapGoal(goals, goalId, g => {
      const phase: Phase = { id: generateId(), title, description, deadline, tasks: [], order: g.phases.length };
      return { ...g, phases: [...g.phases, phase] };
    }));
  },

  updatePhase(goalId: string, phaseId: string, updates: Partial<Phase>) {
    G.update(goals => mapPhase(goals, goalId, phaseId, p => ({ ...p, ...updates })));
  },

  updateTask(goalId: string, phaseId: string, taskId: string, updates: Partial<Task>) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({ ...t, ...updates })));
  },

  updateToDo(goalId: string, phaseId: string, taskId: string, todoId: string, updates: Partial<ToDo>) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      todos: t.todos.map(td => (td.id === todoId ? { ...td, ...updates } : td)),
    })));
  },

  updateHabit(goalId: string, phaseId: string, taskId: string, habitId: string, updates: Partial<Habit>) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      habits: (t.habits ?? []).map(h => (h.id === habitId ? { ...h, ...updates } : h)),
    })));
  },

  addTask(goalId: string, phaseId: string, title: string, description: string, deadline?: string) {
    G.update(goals => mapPhase(goals, goalId, phaseId, p => {
      const task: Task = {
        id: generateId(), title, description, status: 'not_started',
        todos: [], habits: [], order: p.tasks.length, deadline,
      };
      return { ...p, tasks: [...p.tasks, task] };
    }));
  },

  addHabit(goalId: string, phaseId: string, taskId: string, title: string, frequency: string, target?: string) {
    const habit: Habit = { id: generateId(), title, frequency, target, active: true };
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({ ...t, habits: [...(t.habits ?? []), habit] })));
  },

  toggleHabit(goalId: string, phaseId: string, taskId: string, habitId: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      habits: (t.habits ?? []).map(h => (h.id === habitId ? { ...h, active: !h.active } : h)),
    })));
  },

  deleteHabit(goalId: string, phaseId: string, taskId: string, habitId: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      habits: (t.habits ?? []).filter(h => h.id !== habitId),
    })));
  },

  addToDo(goalId: string, phaseId: string, taskId: string, title: string, deadline?: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => {
      const todo: ToDo = { id: generateId(), title, done: false, order: t.todos.length, deadline };
      return { ...t, todos: [...t.todos, todo] };
    }));
  },

  toggleToDo(goalId: string, phaseId: string, taskId: string, todoId: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      todos: t.todos.map(td => (td.id === todoId ? { ...td, done: !td.done } : td)),
    })));
  },

  deletePhase(goalId: string, phaseId: string) {
    G.update(goals => mapGoal(goals, goalId, g => ({ ...g, phases: g.phases.filter(p => p.id !== phaseId) })));
  },

  deleteTask(goalId: string, phaseId: string, taskId: string) {
    G.update(goals => mapPhase(goals, goalId, phaseId, p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) })));
  },

  deleteToDo(goalId: string, phaseId: string, taskId: string, todoId: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({ ...t, todos: t.todos.filter(td => td.id !== todoId) })));
  },

  addNote(goalId: string, phaseId: string, taskId: string, text: string) {
    const note: TaskNote = { id: generateId(), text, createdAt: new Date().toISOString() };
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({ ...t, notes: [...(t.notes ?? []), note] })));
  },

  deleteNote(goalId: string, phaseId: string, taskId: string, noteId: string) {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => ({
      ...t,
      notes: (t.notes ?? []).filter(n => n.id !== noteId),
    })));
  },

  reorderPhases(goalId: string, phaseId: string, direction: 'up' | 'down') {
    G.update(goals => mapGoal(goals, goalId, g => {
      const phases = moveById(g.phases, phaseId, direction);
      return phases === g.phases ? g : { ...g, phases };
    }));
  },

  reorderTasks(goalId: string, phaseId: string, taskId: string, direction: 'up' | 'down') {
    G.update(goals => mapPhase(goals, goalId, phaseId, p => {
      const tasks = moveById(p.tasks, taskId, direction);
      return tasks === p.tasks ? p : { ...p, tasks };
    }));
  },

  reorderTodos(goalId: string, phaseId: string, taskId: string, todoId: string, direction: 'up' | 'down') {
    G.update(goals => mapTask(goals, goalId, phaseId, taskId, t => {
      const todos = moveById(t.todos, todoId, direction);
      return todos === t.todos ? t : { ...t, todos };
    }));
  },

  archiveGoal(id: string) {
    G.update(goals => mapGoal(goals, id, g => ({ ...g, archived: !g.archived })));
  },

  cloneGoal(goalId: string): Goal | undefined {
    const source = G.get().find(g => g.id === goalId);
    if (!source) return;
    const cloned: Goal = {
      ...source,
      id: generateId(),
      title: `${source.title} (Copy)`,
      createdAt: new Date().toISOString(),
      phases: source.phases.map(p => ({
        ...p,
        id: generateId(),
        tasks: p.tasks.map(t => ({
          ...t,
          id: generateId(),
          status: 'not_started' as const,
          notes: [],
          todos: (t.todos ?? []).map(td => ({ ...td, id: generateId(), done: false })),
          habits: (t.habits ?? []).map(h => ({ ...h, id: generateId() })),
        })),
      })),
    };
    G.update(goals => [...goals, cloned]);
    return cloned;
  },

  saveAsTemplate(goalId: string): GoalTemplate | undefined {
    const source = G.get().find(g => g.id === goalId);
    if (!source) return;
    const start = dateKeyOf(source.createdAt);
    const offset = (d?: string) => (d ? Math.max(0, daysBetween(start, dateKeyOf(d))) : undefined);
    const template: GoalTemplate = {
      id: generateId(),
      name: source.title,
      description: source.description,
      endGoal: source.endGoal,
      domain: source.domain,
      durationDays: offset(source.deadline),
      phases: source.phases.map(p => ({
        title: p.title,
        description: p.description,
        offsetDays: offset(p.deadline),
        tasks: p.tasks.map(t => ({
          title: t.title,
          description: t.description,
          offsetDays: offset(t.deadline),
          todos: (t.todos ?? []).map(td => ({ title: td.title, effort: td.effort, isBenchmark: td.isBenchmark, offsetDays: offset(td.deadline) })),
          habits: (t.habits ?? []).map(h => ({ title: h.title, frequency: h.frequency, target: h.target, evolution: h.evolution })),
        })),
      })),
      createdAt: new Date().toISOString(),
    };
    T.update(templates => [...templates, template]);
    return template;
  },

  deleteTemplate(id: string) {
    T.update(templates => templates.filter(t => t.id !== id));
  },

  /** Start a new goal from a blueprint; relative deadlines are counted from today. */
  createFromTemplate(template: GoalTemplate, deadline?: string): Goal {
    const today = todayKey();
    const at = (n?: number) => (typeof n === 'number' ? addDays(today, n) : undefined);
    const newGoal: Goal = {
      id: generateId(),
      title: template.name,
      description: template.description,
      endGoal: template.endGoal,
      domain: template.domain as GoalDomain | undefined,
      deadline: deadline ?? at(template.durationDays),
      createdAt: new Date().toISOString(),
      phases: (template.phases ?? []).map((p, pi) => ({
        id: generateId(),
        title: p.title,
        description: p.description,
        deadline: at(p.offsetDays),
        order: pi,
        tasks: (p.tasks ?? []).map((t, ti) => ({
          id: generateId(),
          title: t.title,
          description: t.description,
          deadline: at(t.offsetDays),
          status: 'not_started' as const,
          order: ti,
          todos: (t.todos ?? []).map((td, tdi) => {
            const o = typeof td === 'string' ? { title: td } : td;
            return { id: generateId(), title: o.title, done: false, order: tdi, effort: o.effort, isBenchmark: o.isBenchmark, deadline: at(o.offsetDays) };
          }),
          habits: (t.habits ?? []).map(h => ({
            id: generateId(), title: h.title, frequency: h.frequency, target: h.target, evolution: h.evolution, active: true,
          })),
        })),
      })),
    };
    G.update(goals => [...goals, newGoal]);
    return newGoal;
  },
};

export function useGoals() {
  const goals = useStore(G);
  const templates = useStore(T);
  return { goals, templates, ...goalActions };
}
