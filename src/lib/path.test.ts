import { describe, expect, it } from 'vitest';
import { applySchedule, autopilot, buildPath, effortOf, learnPace, progressOf, slippedSteps } from './path';
import type { Architecture, Goal, Task, ToDo } from '@/types/goals';

const TODAY = '2026-11-23'; // a Monday

const todo = (id: string, over: Partial<ToDo> = {}): ToDo => ({ id, title: id, done: false, order: 0, ...over });
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id, title: id.toUpperCase(), description: '', status: 'not_started', todos: [todo(`${id}1`)], habits: [], order: 0, ...over,
});
const goal = (tasks: Task[][], over: Partial<Goal> = {}): Goal => ({
  id: 'g', title: 'Film', description: '', endGoal: '', createdAt: `${TODAY}T09:00:00Z`, shape: 'once', status: 'active',
  phases: tasks.map((ts, i) => ({ id: `p${i}`, title: `Stage ${i + 1}`, description: '', order: i, tasks: ts })),
  ...over,
});

describe('effort and progress', () => {
  it('uses the set hours, else the steps (unestimated steps ≈ 45 min)', () => {
    expect(effortOf(task('a', { effortHours: 6 }))).toBe(6);
    expect(effortOf(task('a', { todos: [todo('x', { estimateMin: 60 }), todo('y', { estimateMin: 30 })] }))).toBe(1.5);
    expect(effortOf(task('a', { todos: [todo('x'), todo('y')] }))).toBe(1.5);
  });

  it('progress is weighted by step size', () => {
    const t = task('a', { todos: [todo('x', { estimateMin: 90, done: true }), todo('y', { estimateMin: 30 })] });
    expect(progressOf(t)).toBe(0.75);
    expect(progressOf({ ...t, status: 'complete' })).toBe(1);
  });
});

describe('buildPath', () => {
  it('one person, 7 h/week: 14 hours of work takes about two weeks (plus the planning-fallacy margin)', () => {
    const g = goal([[task('a', { effortHours: 7 }), task('b', { effortHours: 7 })]], { hoursPerWeek: 7 });
    const p = buildPath(g, TODAY);
    expect(p.remainingHours).toBe(14);
    // 14 h × 1.15 = 16.1 h at 1 h/day → day 17.
    expect(p.finish).toBe('2026-12-09');
    expect(p.early! < p.finish!).toBe(true);
    expect(p.late! > p.finish!).toBe(true);
  });

  it('stages run in order when there are no explicit links', () => {
    const g = goal([[task('a', { effortHours: 7 })], [task('b', { effortHours: 7 })]], { hoursPerWeek: 7 });
    const p = buildPath(g, TODAY);
    expect(p.implicit).toBe(true);
    const [a, b] = p.nodes;
    expect(b.deps).toEqual(['a']);
    expect(b.state).toBe('blocked');
    expect(a.state).toBe('ready');
    expect(b.start >= a.end).toBe(true);
  });

  it('waiting time sits between tasks and the critical chain is found', () => {
    // a (submit, then wait 30 days) → c; b is independent busywork.
    const g = goal([[
      task('a', { effortHours: 2, waitDays: 30, dependsOn: [] }),
      task('b', { effortHours: 4, dependsOn: [] }),
      task('c', { effortHours: 2, dependsOn: ['a'] }),
    ]], { hoursPerWeek: 7 });
    const p = buildPath(g, TODAY);
    const byId = Object.fromEntries(p.nodes.map(n => [n.id, n]));
    expect(byId.a.critical).toBe(true);
    expect(byId.c.critical).toBe(true);
    expect(byId.b.critical).toBe(false);
    // The longest chain goes first, so the wait overlaps with b.
    expect(byId.a.start).toBe(TODAY);
    expect(byId.c.start >= '2026-12-25').toBe(true);
    expect(p.bottleneck?.id).toBe('a');
    expect(p.bottleneck?.downstream).toBe(1);
  });

  it('a trailing wait with nothing after it does not hide the critical chain', () => {
    const g = goal([[
      task('a', { effortHours: 4, dependsOn: [] }),
      task('b', { effortHours: 4, dependsOn: ['a'], waitDays: 60 }),
    ]], { hoursPerWeek: 7 });
    expect(buildPath(g, TODAY).nodes.every(n => n.critical)).toBe(true);
  });

  it('loops in links do not hang it', () => {
    const g = goal([[task('a', { dependsOn: ['b'] }), task('b', { dependsOn: ['a'] })]]);
    const p = buildPath(g, TODAY);
    expect(p.nodes).toHaveLength(2);
    expect(p.finish).not.toBeNull();
  });

  it('compares with the deadline and says what hours would make it', () => {
    const g = goal([[task('a', { effortHours: 40 })]], { hoursPerWeek: 4, deadline: '2027-01-15' });
    const p = buildPath(g, TODAY);
    expect(p.vsDeadline).toBe('behind');
    expect(p.neededHours).toBeGreaterThan(4);
    expect(buildPath(g, TODAY, { hoursPerWeek: p.neededHours! }).finish! <= '2027-01-15').toBe(true);
    expect(buildPath({ ...g, deadline: '2028-01-01' }, TODAY).vsDeadline).toBe('ahead');
  });

  it('practice-only tasks are not steps on the Path', () => {
    const practice = task('h', { todos: [], habits: [{ id: 'x', title: 'Run', frequency: '3x/week', active: true }] });
    expect(buildPath(goal([[task('a'), practice]]), TODAY).nodes.map(n => n.id)).toEqual(['a']);
  });

  it('everything done → no finish date', () => {
    const p = buildPath(goal([[task('a', { todos: [todo('x', { done: true, doneAt: `${TODAY}T10:00:00Z` })] })]]), TODAY);
    expect(p.finish).toBeNull();
    expect(p.nodes[0].state).toBe('done');
  });
});

describe('pace', () => {
  it('learns your real pace after three weeks', () => {
    const created = '2026-09-01T09:00:00Z';
    const done = (id: string, day: string) => todo(id, { done: true, doneAt: `${day}T10:00:00Z`, estimateMin: 60 });
    const g = goal([[task('a', { todos: [done('x', '2026-11-10'), done('y', '2026-11-12'), todo('z', { estimateMin: 600 })] })]], { createdAt: created, hoursPerWeek: 4 });
    const { pace, known } = learnPace(g, 4, TODAY);
    expect(known).toBe(true);
    expect(pace).toBeLessThan(0.5); // 2 h done vs 16 h planned
    expect(learnPace({ ...g, createdAt: `${TODAY}T00:00:00Z` }, 4, TODAY)).toEqual({ pace: 1, known: false });
  });
});

describe('applying the schedule', () => {
  it('dates open steps across each task, never moving your own dates', () => {
    const g = goal([[task('a', { effortHours: 7, todos: [todo('a1', { estimateMin: 60 }), todo('a2', { estimateMin: 60, deadline: '2026-12-31' })] })]], { hoursPerWeek: 7 });
    const { goal: next } = applySchedule(g, buildPath(g, TODAY));
    const [a1, a2] = next.phases[0].tasks[0].todos;
    expect(a1.scheduled).toBe(true);
    expect(a1.deadline! >= TODAY).toBe(true);
    expect(a2).toEqual(g.phases[0].tasks[0].todos[1]);
    expect(next.phases[0].tasks[0].plannedEnd).toBeTruthy();
    // Applying again changes nothing (same object back).
    expect(applySchedule(next, buildPath(next, TODAY)).goal).toBe(next);
  });
});

describe('autopilot', () => {
  const arch = (over: Partial<Architecture> = {}): Architecture => ({
    brief: 'Make a short film', strategy: '', assumptions: [], risks: [], routes: [], activeRouteId: '',
    createdAt: `${TODAY}T09:00:00Z`, autopilot: true, history: [], ...over,
  });

  it('rebuilds around a slip, says so, and keeps an undo copy', () => {
    const g = goal([[task('a', { effortHours: 4, plannedStart: '2026-11-01', plannedEnd: '2026-11-10', todos: [todo('a1', { deadline: '2026-11-10', scheduled: true })] })]],
      { hoursPerWeek: 7, architect: arch({ history: [{ id: 'h0', at: '2026-11-20T09:00:00Z', note: 'x', finish: '2026-11-10', seen: true, kind: 'auto' }] }) });
    expect(slippedSteps(g, TODAY)).toBe(1);
    const next = autopilot(g, TODAY, new Date(`${TODAY}T08:00:00Z`), () => 'h1');
    expect(next).not.toBe(g);
    expect(next.phases[0].tasks[0].todos[0].deadline! >= TODAY).toBe(true);
    const h = next.architect!.history.at(-1)!;
    expect(h.note).toMatch(/slipped/);
    expect(h.seen).toBe(false);
    expect(next.architect!.undo!.phases).toBe(g.phases);
    // Nothing more to do the same day.
    expect(autopilot(next, TODAY, new Date(`${TODAY}T09:00:00Z`))).toBe(next);
  });

  it('leaves goals without Day Zero, paused goals, or autopilot off alone', () => {
    const g = goal([[task('a')]]);
    expect(autopilot(g, TODAY)).toBe(g);
    const off = { ...g, architect: arch({ autopilot: false }) };
    expect(autopilot(off, TODAY)).toBe(off);
    const paused = { ...g, status: 'paused' as const, architect: arch() };
    expect(autopilot(paused, TODAY)).toBe(paused);
  });
});
