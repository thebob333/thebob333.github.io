import { describe, expect, it } from 'vitest';
import { applyPlan, applyProposal } from './apply';
import { CheckInPlan, GoalPlan, extractJson, parsePasted } from './schemas';
import type { Goal } from '@/types/goals';

let n = 0;
const id = () => `id${++n}`;
const TODAY = '2026-11-25';

const emptyGoal = (): Goal => ({
  id: 'g', title: 'Run a 5K', description: '', endGoal: '', createdAt: '', shape: 'better',
  phases: [{ id: 'p0', title: 'Base', description: '', order: 0, tasks: [{ id: 't0', title: 'Training', description: '', status: 'not_started', order: 0, todos: [], habits: [] }] }],
});

const plan: GoalPlan = {
  summary: 'Build up gently.', shape: 'better', why: 'Feel fit', targetDateDays: 56,
  metric: { name: '5K time', unit: 'min', start: 32, target: 25, higherIsBetter: false },
  stages: [
    { title: 'Base', description: 'Get going', weeks: 3, steps: [{ title: 'Buy shoes', estimateMinutes: 60, dueInDays: 3 }], practices: [
      { title: 'Run', perWeek: 9, buildToPerWeek: 2, amount: 20, unit: 'min', step: 5, maxAmount: 40, easyVersion: 'Walk 10 min', details: null },
    ] },
    { title: 'Build', description: 'More', weeks: 4, steps: [], practices: [] },
  ],
  ifThen: ['If it rains, then I will run on the treadmill'],
  firstStep: 'Lay out your running clothes',
};

describe('applyPlan', () => {
  it('replaces empty starter stages and fills in goal fields', () => {
    const g = applyPlan(emptyGoal(), plan, TODAY, id);
    expect(g.phases.map(p => p.title)).toEqual(['Base', 'Build']);
    expect(g.phases[0].deadline).toBe('2026-12-16');
    expect(g.phases[1].deadline).toBe('2027-01-13');
    const todos = g.phases[0].tasks[0].todos;
    expect(todos.map(t => t.title)).toEqual(['Lay out your running clothes', 'Buy shoes']);
    expect(todos[1]).toMatchObject({ deadline: '2026-11-28', estimateMin: 60 });
    const h = g.phases[0].tasks[0].habits[0];
    expect(h).toMatchObject({ perWeek: 7, maxPerWeek: 7, frequency: 'daily', amount: 20, step: 5, maxAmount: 40, minimum: 'Walk 10 min', since: TODAY, auto: true });
    expect(g.metric).toMatchObject({ name: '5K time', target: 25, higherIsBetter: false });
    expect(g.deadline).toBe('2027-01-20');
    expect(g.why).toBe('Feel fit');
    expect(g.ifThen).toEqual(['If it rains, then I will run on the treadmill']);
  });

  it('adds after your stages when the goal already has content, and keeps your fields', () => {
    const base = emptyGoal();
    base.why = 'Mine';
    base.phases[0].tasks[0].todos = [{ id: 'x', title: 'Existing', done: false, order: 0 }];
    const g = applyPlan(base, plan, TODAY, id);
    expect(g.phases.map(p => p.title)).toEqual(['Base', 'Base', 'Build']);
    expect(g.phases.map(p => p.order)).toEqual([0, 1, 2]);
    expect(g.why).toBe('Mine');
  });
});

describe('applyProposal', () => {
  const goals = () => [applyPlan(emptyGoal(), plan, TODAY, id)];
  const habitId = () => goals()[0].phases[0].tasks[0].habits[0].id;

  it('changes a practice', () => {
    const gs = goals();
    const hid = gs[0].phases[0].tasks[0].habits[0].id;
    const r = applyProposal(gs, { kind: 'practice', goalId: 'g', habitId: hid, perWeek: 3, amount: null, deadline: null, title: null, reason: '' }, TODAY, id)!;
    expect(r.goals[0].phases[0].tasks[0].habits[0]).toMatchObject({ perWeek: 3, frequency: '3x/week', amount: 20 });
  });

  it('rejects unknown ids, past deadlines and empty steps', () => {
    expect(applyProposal(goals(), { kind: 'practice', goalId: 'g', habitId: 'nope', perWeek: 3, amount: null, deadline: null, title: null, reason: '' }, TODAY)).toBeNull();
    expect(applyProposal(goals(), { kind: 'pause', goalId: 'missing', habitId: null, perWeek: null, amount: null, deadline: null, title: null, reason: '' }, TODAY)).toBeNull();
    expect(applyProposal(goals(), { kind: 'deadline', goalId: 'g', habitId: null, perWeek: null, amount: null, deadline: '2020-01-01', title: null, reason: '' }, TODAY)).toBeNull();
    expect(applyProposal(goals(), { kind: 'step', goalId: 'g', habitId: null, perWeek: null, amount: null, deadline: null, title: '  ', reason: '' }, TODAY)).toBeNull();
    expect(habitId()).toBeTruthy();
  });

  it('moves deadlines, pauses, adds steps and if-then plans', () => {
    const base = { goalId: 'g', habitId: null, perWeek: null, amount: null, deadline: null, title: null, reason: '' };
    expect(applyProposal(goals(), { ...base, kind: 'deadline', deadline: '2027-03-01' }, TODAY)!.goals[0].deadline).toBe('2027-03-01');
    expect(applyProposal(goals(), { ...base, kind: 'pause' }, TODAY)!.goals[0].status).toBe('paused');
    const step = applyProposal(goals(), { ...base, kind: 'step', title: 'Book a gait analysis' }, TODAY, id)!;
    expect(step.goals[0].phases[0].tasks[0].todos.at(-1)).toMatchObject({ title: 'Book a gait analysis', deadline: '2026-11-27' });
    expect(applyProposal(goals(), { ...base, kind: 'ifThen', title: 'If tired, then walk' }, TODAY)!.goals[0].ifThen).toContain('If tired, then walk');
  });
});

describe('pasted replies', () => {
  it('finds JSON inside chatter or code fences and validates it', () => {
    expect(extractJson('Sure!\n```json\n{"a": 1}\n```\nGood luck')).toEqual({ a: 1 });
    const reply = JSON.stringify({ message: 'Nice week.', proposals: [], focusGoalIds: ['g'], nextStep: 'Run tomorrow' });
    expect(parsePasted(CheckInPlan, `Here you go: ${reply}`).nextStep).toBe('Run tomorrow');
    expect(() => parsePasted(CheckInPlan, '{"message": 1}')).toThrow(/expected format/);
    expect(() => parsePasted(GoalPlan, 'no json here')).toThrow();
  });
});
