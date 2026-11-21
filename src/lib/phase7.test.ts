import { describe, expect, it } from 'vitest';
import { nextDueDate, contactActions } from '@/hooks/useContacts';
import { goalActions } from '@/hooks/useGoals';
import { spreadPhaseDeadlines, phaseWeight } from '@/lib/goal-tree';
import { suggestedCustomTarget } from '@/lib/strength-standards';
import { addDays, daysBetween, todayKey } from '@/lib/dates';
import { stores } from '@/lib/storage';
import type { Phase } from '@/types/goals';

describe('recurring commitments', () => {
  it('next due date steps forward and never lands in the past', () => {
    expect(nextDueDate('2026-11-20', 'weekly', '2026-11-21')).toBe('2026-11-27');
    expect(nextDueDate('2026-11-01', 'weekly', '2026-11-21')).toBe('2026-11-22');
    expect(nextDueDate('2026-11-21', 'biweekly', '2026-11-21')).toBe('2026-12-05');
    expect(nextDueDate('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28');
    expect(nextDueDate('2026-12-15', 'monthly', '2026-12-15')).toBe('2027-01-15');
    expect(nextDueDate(undefined, 'weekly', '2026-11-21')).toBe('2026-11-28');
  });

  it('completing schedules the next one; undo removes it again', () => {
    const c = contactActions.addCommitment({ contactId: 'p', text: 'Call mom', dueDate: todayKey(), recurring: 'weekly' });
    const next = contactActions.completeCommitment(c.id);
    expect(next?.dueDate).toBe(addDays(todayKey(), 7));
    expect(stores.COMMITMENTS.get()).toHaveLength(2);
    contactActions.uncompleteCommitment(c.id);
    expect(stores.COMMITMENTS.get()).toHaveLength(1);
    expect(stores.COMMITMENTS.get()[0].completedAt).toBeUndefined();
  });
});

describe('spread deadlines by workload', () => {
  const phase = (todos: ('LOW' | 'MED' | 'HIGH' | undefined)[]): Phase => ({
    id: Math.random().toString(), title: 'p', description: '', order: 0,
    tasks: [{ id: 't', title: 't', description: '', status: 'not_started', order: 0, habits: [], todos: todos.map((effort, i) => ({ id: `${i}`, title: 'x', done: false, order: i, effort })) }],
  });

  it('heavier phases get more time and the last phase ends on the goal deadline', () => {
    const phases = [phase(['LOW']), phase(['HIGH', 'HIGH', 'HIGH'])]; // weights 1 and 9
    expect(phaseWeight(phases[1])).toBe(9);
    const out = spreadPhaseDeadlines(phases, '2026-01-01', '2026-01-31', addDays, daysBetween)!;
    expect(out[0].deadline).toBe('2026-01-04'); // 30 days × 1/10 = 3
    expect(out[1].deadline).toBe('2026-01-31');
  });

  it('refuses a deadline in the past', () => {
    expect(spreadPhaseDeadlines([phase([])], '2026-02-01', '2026-01-01', addDays, daysBetween)).toBeNull();
  });
});

describe('blueprints', () => {
  it('keep effort, benchmarks, habit evolution and relative deadlines', () => {
    const goal = goalActions.addGoal('Marathon', 'd', 'finish', addDays(todayKey(), 90));
    const phaseId = stores.GOALS.get()[0].phases[0].id;
    goalActions.addTask(goal.id, phaseId, 'Train', '', addDays(todayKey(), 30));
    const taskId = stores.GOALS.get()[0].phases[0].tasks[0].id;
    goalActions.addToDo(goal.id, phaseId, taskId, 'Run 10k', addDays(todayKey(), 14));
    const todoId = stores.GOALS.get()[0].phases[0].tasks[0].todos[0].id;
    goalActions.updateToDo(goal.id, phaseId, taskId, todoId, { effort: 'HIGH', isBenchmark: true });
    goalActions.addHabit(goal.id, phaseId, taskId, 'Stretch', 'daily');
    const tpl = goalActions.saveAsTemplate(goal.id)!;
    const copy = goalActions.createFromTemplate(tpl);
    const todo = copy.phases[0].tasks[0].todos[0];
    expect(todo).toMatchObject({ title: 'Run 10k', effort: 'HIGH', isBenchmark: true, deadline: addDays(todayKey(), 14) });
    expect(copy.deadline).toBe(addDays(todayKey(), 90));
    expect(copy.phases[0].tasks[0].deadline).toBe(addDays(todayKey(), 30));
  });

  it('still open old blueprints whose to-dos are plain strings', () => {
    const g = goalActions.createFromTemplate({ id: 'x', name: 'Old', description: '', endGoal: '', createdAt: '', phases: [{ title: 'P', description: '', tasks: [{ title: 'T', description: '', todos: ['a', 'b'], habits: [] }] }] });
    expect(g.phases[0].tasks[0].todos.map(t => t.title)).toEqual(['a', 'b']);
  });
});

describe('suggested custom targets', () => {
  it('uses reps for bodyweight and a bodyweight multiple otherwise', () => {
    expect(suggestedCustomTarget('bodyweight', 180)).toBe(20);
    expect(suggestedCustomTarget('barbell', 180)).toBe(180);
    expect(suggestedCustomTarget('dumbbell', 180)).toBe(70);
  });
});
