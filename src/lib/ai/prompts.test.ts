import { describe, expect, it } from 'vitest';
import { weekFacts, pastePrompt } from './prompts';
import { CheckInPlan, schemaText } from './schemas';
import type { Goal } from '@/types/goals';

const goal: Goal = {
  id: 'g1', title: 'Run a 5K', description: '', endGoal: '', createdAt: '', shape: 'better', pushback: 'relentless', status: 'active', why: 'Feel fit',
  metric: { name: '5K time', unit: 'min', start: 31, target: 25, higherIsBetter: false },
  phases: [{ id: 'p', title: 'Base', description: '', order: 0, tasks: [{ id: 't', title: 'T', description: '', status: 'not_started', order: 0,
    todos: [{ id: 'x', title: 'Buy shoes', done: false, order: 0, deadline: '2026-11-28' }],
    habits: [{ id: 'h1', title: 'Run', frequency: '3x/week', perWeek: 3, maxPerWeek: 5, active: true, minimum: 'Walk 10 min', since: '2026-10-01' }] }] }],
};

describe('coach prompts', () => {
  it('gives the coach every id and fact it needs, and leaves paused goals as names only', () => {
    const paused: Goal = { ...goal, id: 'g2', title: 'Learn piano', status: 'paused' };
    const text = weekFacts([goal, paused], [{ habitId: 'h1', date: '2026-11-17', completed: true }], [{ id: 'm', goalId: 'g1', date: '2026-11-20', value: 29.5 }], [], '2026-11-25');
    expect(text).toContain('GOAL id=g1');
    expect(text).toContain('coach style: relentless');
    expect(text).toContain('PRACTICE id=h1 "Run" — now 3×/week, building to 5x/week; last week 1/3');
    expect(text).toContain('easy version: Walk 10 min');
    expect(text).toContain('2026-11-20=29.5');
    expect(text).toContain('"Buy shoes" due 2026-11-28');
    expect(text).not.toContain('GOAL id=g2');
    expect(text).toContain('Paused goals: "Learn piano"');
  });

  it('the copy-paste prompt carries the schema', () => {
    const p = pastePrompt('Do the check-in.', 'facts', schemaText(CheckInPlan));
    expect(p).toContain('Reply with ONLY a JSON object');
    expect(p).toContain('focusGoalIds');
  });
});
