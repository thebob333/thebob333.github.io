import { describe, expect, it } from 'vitest';
import { architect, carryOver, compareRoutes, goalStateText, materialize, switchRoute, toRoute, undoLastChange } from './day-zero';
import type { DayZeroPlan, ArchRoute } from '@/lib/ai/schemas';

const TODAY = '2026-11-23';
const NOW = new Date(`${TODAY}T10:00:00Z`);
const ids = () => { let n = 0; return () => `id${++n}`; };

const task = (key: string, over: Partial<ArchRoute['stages'][number]['tasks'][number]> = {}) => ({
  key, title: `Task ${key}`, description: '', effortHours: 4, waitDays: 0, dependsOn: [] as string[], milestone: false,
  steps: [`Do ${key}`], ...over,
});
const route = (name: string, keys: string[]): ArchRoute => ({
  name, summary: '', tradeoff: '',
  stages: [
    { title: 'Write', description: '', tasks: [task(keys[0]), task(keys[1], { dependsOn: [keys[0]], waitDays: 7 })], practices: [] },
    { title: 'Shoot', description: '', tasks: [task(keys[2], { dependsOn: [keys[1], 'ghost', keys[2]], milestone: true })], practices: [{ title: 'Watch a short', perWeek: 2, buildToPerWeek: 3, minutes: 0, easyVersion: 'Watch 5 min' }] },
  ],
});
const plan = (over: Partial<DayZeroPlan> = {}): DayZeroPlan => ({
  title: 'Make an award-winning short film', shape: 'build', why: 'To prove I can', metricName: '', metricUnit: '', metricTarget: 0, metricHigherIsBetter: true,
  strategy: 'Small crew, festival deadlines.', research: 'Sundance deadline is in August.', assumptions: ['Has a phone camera'],
  risks: [{ risk: 'Script stalls', mitigation: 'Table read' }],
  routes: [route('Scrappy solo', ['a', 'b', 'c']), route('Build a crew', ['x', 'b', 'y'])],
  recommendedRoute: 0, suggestedHoursPerWeek: 6, targetDateDays: 200,
  ifThen: ['If I miss a week, then I will do one 20-minute session.'], firstStep: 'Write a one-line logline',
  ...over,
});

describe('day zero', () => {
  it('turns a route into linked tasks; bad links are dropped', () => {
    const r = toRoute(route('R', ['a', 'b', 'c']), ids());
    const phases = materialize(r, TODAY, ids());
    const [a, b] = phases[0].tasks;
    const c = phases[1].tasks[0];
    expect(b.dependsOn).toEqual([a.id]);
    expect(c.dependsOn).toEqual([b.id]); // ghost and self removed
    expect(b.waitDays).toBe(7);
    expect(c.milestone).toBe(true);
    expect(phases[1].tasks[0].habits[0]).toMatchObject({ title: 'Watch a short', perWeek: 2, maxPerWeek: 3, minimum: 'Watch 5 min' });
  });

  it('creates a scheduled goal with strategy, routes and the first step', () => {
    const g = architect(plan(), { brief: 'Make an award-winning short film', hoursPerWeek: 6, today: TODAY, now: NOW, newId: ids() });
    expect(g.title).toBe('Make an award-winning short film');
    expect(g.architect!.routes).toHaveLength(2);
    expect(g.architect!.activeRouteId).toBe(g.architect!.routes[0].id);
    expect(g.hoursPerWeek).toBe(6);
    expect(g.deadline).toBe('2027-06-11');
    const first = g.phases[0].tasks[0].todos[0];
    expect(first.title).toBe('Write a one-line logline');
    expect(first.scheduled).toBe(true);
    expect(g.phases.flatMap(p => p.tasks).every(t => t.plannedStart && t.plannedEnd)).toBe(true);
    expect(g.architect!.history.at(-1)!.note).toMatch(/Scrappy solo/);
  });

  it('switching routes keeps finished work and matching tasks', () => {
    let g = architect(plan(), { brief: 'film', hoursPerWeek: 6, today: TODAY, now: NOW, newId: ids() });
    // Finish task A's steps and part of B.
    g = { ...g, phases: g.phases.map((p, i) => i ? p : { ...p, tasks: p.tasks.map(t => ({ ...t, todos: t.todos.map(td => ({ ...td, done: true, doneAt: NOW.toISOString() })) })) }) };
    const bId = g.phases[0].tasks[1].id;
    const crew = g.architect!.routes[1];
    const next = switchRoute(g, crew.id, TODAY, NOW, ids());
    expect(next.architect!.activeRouteId).toBe(crew.id);
    const all = next.phases.flatMap(p => p.tasks);
    // "Task b" exists in both routes → same id, done steps kept.
    const b = all.find(t => t.title === 'Task b')!;
    expect(b.id).toBe(bId);
    expect(b.todos.some(td => td.done)).toBe(true);
    // "Task a" isn't in the crew route → kept under "Done so far".
    expect(next.phases[0].title).toBe('Done so far');
    expect(next.phases[0].tasks.some(t => t.title === 'Task a')).toBe(true);
    // Undo puts it back.
    const back = undoLastChange(next, NOW, ids());
    expect(back.phases).toBe(g.phases);
    expect(back.architect!.activeRouteId).toBe(g.architect!.activeRouteId);
  });

  it('carry-over keeps practice ids (so check-ins stay linked)', () => {
    const g = architect(plan(), { brief: 'film', hoursPerWeek: 6, today: TODAY, now: NOW, newId: ids() });
    const habitId = g.phases[1].tasks[0].habits[0].id;
    const fresh = materialize(toRoute(route('Again', ['p', 'q', 'r']), ids()), TODAY, () => `n${Math.random()}`);
    const merged = carryOver(g.phases, fresh, ids());
    expect(merged.flatMap(p => p.tasks).flatMap(t => t.habits).find(h => h.title === 'Watch a short')!.id).toBe(habitId);
  });

  it('redesigning an existing goal keeps its title, deadline and done work', () => {
    const g = architect(plan(), { brief: 'film', hoursPerWeek: 6, today: TODAY, now: NOW, newId: ids() });
    const done = { ...g, deadline: '2027-03-01', phases: g.phases.map((p, i) => i ? p : { ...p, tasks: p.tasks.map((t, j) => j ? t : { ...t, todos: t.todos.map(td => ({ ...td, done: true })) }) }) };
    const re = architect(plan({ title: 'Something else', routes: [route('Leaner', ['m', 'n', 'o'])] }), { brief: 'film', hoursPerWeek: 4, today: TODAY, now: NOW, newId: ids() }, done);
    expect(re.title).toBe(g.title);
    expect(re.deadline).toBe('2027-03-01');
    expect(re.hoursPerWeek).toBe(4);
    expect(re.phases[0].title).toBe('Done so far');
    expect(re.architect!.history.at(-1)!.kind).toBe('coach');
    expect(re.architect!.undo!.phases).toBe(done.phases);
  });

  it('compares routes on equal terms and describes the state for a redesign', () => {
    const g = architect(plan(), { brief: 'film', hoursPerWeek: 6, today: TODAY, now: NOW, newId: ids() });
    const cmp = compareRoutes(g, TODAY);
    expect(cmp).toHaveLength(2);
    expect(cmp[0].active).toBe(true);
    expect(cmp.every(c => c.plan.finish)).toBe(true);
    expect(goalStateText(g, TODAY)).toMatch(/\[ready\] Task a/);
  });
});
