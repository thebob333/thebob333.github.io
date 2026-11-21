import { describe, expect, it } from 'vitest';
import { mergePlanIntoPhases, parseGoalPlan } from './goal-plan-parser';
import type { Phase } from '@/types/goals';

let n = 0;
const id = () => `id${++n}`;

const PLAN = `
Here's your plan!

PHASE: Foundation | Learn the basics | 2026-12-31
TASK: Gear up | Get equipment | 2026-12-10
TODO: Buy shoes | 2026-12-01 | [LOW]
TODO: Benchmark — run 5k | 2026-12-08 | [HIGH]
HABIT: Run | 3x/week | 30 minutes | [NEW]
HABIT: Evolved habit | daily | 45 minutes | [INCREASE from 30 min]

ADAPTATION PROTOCOL:
IF AHEAD: add a long run
IF BEHIND: cut volume
IF BLOCKED: walk instead
`;

describe('parseGoalPlan', () => {
  it('parses the standard format', () => {
    const r = parseGoalPlan(PLAN);
    expect(r.warnings).toEqual([]);
    expect(r.phases).toHaveLength(1);
    const task = r.phases[0].tasks[0];
    expect(task.todos).toEqual([
      { title: 'Buy shoes', deadline: '2026-12-01', effort: 'LOW', isBenchmark: undefined },
      { title: 'Benchmark — run 5k', deadline: '2026-12-08', effort: 'HIGH', isBenchmark: true },
    ]);
    expect(task.habits[0]).toEqual({ title: 'Run', frequency: '3x/week', target: '30 minutes', evolution: 'NEW' });
    expect(r.adaptationProtocol).toEqual({ ahead: 'add a long run', behind: 'cut volume', blocked: 'walk instead' });
  });

  it('accepts evolution tags with notes, e.g. [INCREASE from 30 min] (used to leak into the target)', () => {
    const habit = parseGoalPlan(PLAN).phases[0].tasks[0].habits[1];
    expect(habit).toEqual({ title: 'Evolved habit', frequency: 'daily', target: '45 minutes', evolution: 'INCREASE' });
  });

  it('tolerates markdown bullets, bold, numbering and missing dates', () => {
    const r = parseGoalPlan(['**PHASE 1: Base**', '- TASK: Plan route', '  * TODO: Map it', '1. HABIT: Stretch | daily'].join('\n'));
    expect(r.phases[0].title).toBe('Base');
    expect(r.phases[0].tasks[0].title).toBe('Plan route');
    expect(r.phases[0].tasks[0].todos[0]).toMatchObject({ title: 'Map it', deadline: '' });
    expect(r.phases[0].tasks[0].habits[0]).toMatchObject({ title: 'Stretch', frequency: 'daily' });
  });

  it('keeps parsing after the adaptation protocol', () => {
    const r = parseGoalPlan('IF AHEAD: x\nPHASE: Later | d | 2027-01-01');
    expect(r.phases).toHaveLength(1);
  });

  it('reports lines it had to skip instead of silently dropping them', () => {
    const r = parseGoalPlan('TODO: orphan\nTASK: lonely task');
    expect(r.warnings.join(' ')).toMatch(/TODO before any TASK/);
    expect(r.warnings.join(' ')).toMatch(/TASK before any PHASE/);
    expect(r.phases[0].tasks[0].title).toBe('lonely task'); // kept in a "Plan" phase
  });
});

describe('mergePlanIntoPhases', () => {
  it('importing the same plan twice adds nothing the second time', () => {
    const plan = parseGoalPlan(PLAN).phases;
    const first = mergePlanIntoPhases([], plan, id);
    const second = mergePlanIntoPhases(first.phases, plan, id);
    expect(second.stats).toMatchObject({ phases: 0, tasks: 0, todos: 0, habits: 0 });
    expect(second.stats.skipped).toBe(4);
    expect(second.phases[0].tasks[0].todos).toHaveLength(2);
  });

  it('merges new to-dos into an existing same-named task', () => {
    const existing: Phase[] = [{
      id: 'p', title: 'foundation', description: '', order: 0,
      tasks: [{ id: 't', title: 'GEAR UP', description: '', status: 'in_progress', order: 0, todos: [{ id: 'x', title: 'Buy shoes', done: true, order: 0 }], habits: [] }],
    }];
    const { phases, stats } = mergePlanIntoPhases(existing, parseGoalPlan(PLAN).phases, id);
    expect(phases).toHaveLength(1);
    expect(phases[0].tasks).toHaveLength(1);
    expect(phases[0].tasks[0].todos.map(t => t.title)).toEqual(['Buy shoes', 'Benchmark — run 5k']);
    expect(phases[0].tasks[0].todos[0].done).toBe(true); // existing progress untouched
    expect(stats.todos).toBe(1);
  });
});
