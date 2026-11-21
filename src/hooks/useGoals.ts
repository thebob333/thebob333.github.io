import { Goal, Phase, Task, ToDo, Habit, TaskNote, GoalDomain } from '@/types/goals';
import { stores, generateId, GoalTemplate } from '@/lib/storage';
import { mapGoal, mapPhase, mapTask, moveById } from '@/lib/goal-tree';
import { useStore } from '@/hooks/useStore';

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
    const template: GoalTemplate = {
      id: generateId(),
      name: source.title,
      description: source.description,
      endGoal: source.endGoal,
      phases: source.phases.map(p => ({
        title: p.title,
        description: p.description,
        tasks: p.tasks.map(t => ({
          title: t.title,
          description: t.description,
          todos: (t.todos ?? []).map(td => td.title),
          habits: (t.habits ?? []).map(h => ({ title: h.title, frequency: h.frequency, target: h.target })),
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

  createFromTemplate(template: GoalTemplate, deadline?: string): Goal {
    const newGoal: Goal = {
      id: generateId(),
      title: template.name,
      description: template.description,
      endGoal: template.endGoal,
      deadline,
      createdAt: new Date().toISOString(),
      phases: (template.phases ?? []).map((p, pi) => ({
        id: generateId(),
        title: p.title,
        description: p.description,
        order: pi,
        tasks: (p.tasks ?? []).map((t, ti) => ({
          id: generateId(),
          title: t.title,
          description: t.description,
          status: 'not_started' as const,
          order: ti,
          todos: (t.todos ?? []).map((td, tdi) => ({ id: generateId(), title: td, done: false, order: tdi })),
          habits: (t.habits ?? []).map(h => ({
            id: generateId(), title: h.title, frequency: h.frequency, target: h.target, active: true,
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
