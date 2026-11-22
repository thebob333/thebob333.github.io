import { describe, expect, it } from 'vitest';
import { runEngine, undoAdjustment, acceptAdjustment, FLAG_AFTER_EASES } from './adapt';
import { isPracticeDue, perWeekOf, derivePerWeek } from './practice';
import type { Adjustment, Goal, Habit, HabitLog } from '@/types/goals';

// Wednesday. Last week = Mon 2026-11-16 … Sun 2026-11-22.
const TODAY = '2026-11-25';
let n = 0;
const id = () => `id${++n}`;

function goalWith(habit: Partial<Habit>, goal: Partial<Goal> = {}): Goal {
  return {
    id: 'g', title: 'Run a 5K', description: '', endGoal: '', createdAt: '2026-10-01T00:00:00Z',
    phases: [{
      id: 'p', title: 'Base', description: '', order: 0,
      tasks: [{
        id: 't', title: 'Run', description: '', status: 'in_progress', order: 0, todos: [],
        habits: [{ id: 'h', title: 'Run', frequency: '3x/week', active: true, perWeek: 3, maxPerWeek: 5, since: '2026-10-01', ...habit }],
      }],
    }],
    ...goal,
  };
}
const habitOf = (goals: Goal[]) => goals[0].phases[0].tasks[0].habits[0];
const logs = (...dates: string[]): HabitLog[] => dates.map(date => ({ habitId: 'h', date, completed: true }));
const run = (goals: Goal[], l: HabitLog[], extra: Partial<Parameters<typeof runEngine>[0]> = {}) =>
  runEngine({ goals, logs: l, adjustments: [], state: { lastWeek: '2026-11-09' }, today: TODAY, newId: id, now: new Date('2026-11-25T12:00:00Z'), lastActivity: '2026-11-24', ...extra });

describe('practice helpers', () => {
  it('derives sessions per week from frequency text', () => {
    expect(derivePerWeek('daily')).toBe(7);
    expect(derivePerWeek('weekdays')).toBe(5);
    expect(derivePerWeek('3x/week')).toBe(3);
    expect(derivePerWeek('mon/wed/fri')).toBe(3);
    expect(derivePerWeek('weekly')).toBe(1);
  });

  it('a 3×/week practice rests once the week is done', () => {
    const h = habitOf([goalWith({})]);
    expect(isPracticeDue(h, logs('2026-11-23', '2026-11-24'), TODAY)).toBe(true);
    const dupes = logs('2026-11-23', '2026-11-24', '2026-11-24');
    expect(isPracticeDue(h, dupes, TODAY)).toBe(true); // two logs on one day count once
    const done = logs('2026-11-23', '2026-11-24').concat({ habitId: 'h', date: '2026-11-25', completed: true });
    expect(isPracticeDue(h, done, TODAY)).toBe(true); // done today stays visible
    const rested = { ...h, perWeek: 2 };
    expect(isPracticeDue(rested, logs('2026-11-23', '2026-11-24'), TODAY)).toBe(false);
  });
});

describe('weekly review', () => {
  it('steps up after hitting the plan', () => {
    const r = run([goalWith({})], logs('2026-11-16', '2026-11-18', '2026-11-20'));
    expect(perWeekOf(habitOf(r.goals))).toBe(4);
    expect(r.added[0]).toMatchObject({ kind: 'up', status: 'applied', before: { perWeek: 3 }, after: { perWeek: 4 } });
    expect(r.state.lastWeek).toBe('2026-11-16');
  });

  it('holds steady in the middle', () => {
    const r = run([goalWith({})], logs('2026-11-16', '2026-11-18'));
    expect(perWeekOf(habitOf(r.goals))).toBe(3);
    expect(r.added).toHaveLength(0);
  });

  it('eases off after a rough week, never below 1×/week', () => {
    const r = run([goalWith({})], logs('2026-11-17'));
    expect(perWeekOf(habitOf(r.goals))).toBe(2);
    expect(r.added[0]).toMatchObject({ kind: 'ease', after: { perWeek: 2 } });
    const floor = run([goalWith({ perWeek: 1, frequency: '1x/week' })], []);
    expect(perWeekOf(habitOf(floor.goals))).toBe(1);
    expect(floor.added[0]).toMatchObject({ status: 'info', seen: true });
  });

  it('grows the amount once at the target frequency', () => {
    const r = run([goalWith({ perWeek: 3, maxPerWeek: 3, amount: 20, unit: 'min', step: 5, maxAmount: 30 })], logs('2026-11-16', '2026-11-18', '2026-11-20'));
    expect(habitOf(r.goals).amount).toBe(25);
  });

  it('runs once per week', () => {
    const first = run([goalWith({})], logs('2026-11-16', '2026-11-18', '2026-11-20'));
    const second = run(first.goals, logs('2026-11-16', '2026-11-18', '2026-11-20'), { state: first.state, adjustments: first.added });
    expect(second.added).toHaveLength(0);
    expect(perWeekOf(habitOf(second.goals))).toBe(4);
  });

  it('does not judge a practice on a week before it existed', () => {
    const r = run([goalWith({ since: '2026-11-19' })], []);
    expect(r.added).toHaveLength(0);
  });

  it('proposes instead of changing when set to ask first', () => {
    const r = run([goalWith({ auto: false })], logs('2026-11-16', '2026-11-18', '2026-11-20'));
    expect(perWeekOf(habitOf(r.goals))).toBe(3);
    expect(r.added[0]).toMatchObject({ kind: 'up', status: 'pending' });
    expect(perWeekOf(habitOf(acceptAdjustment(r.goals, r.added[0])))).toBe(4);
  });

  it(`flags a practice eased ${FLAG_AFTER_EASES} weeks running`, () => {
    const past: Adjustment[] = ['2026-11-02', '2026-11-09'].map(week => ({
      id: id(), goalId: 'g', habitId: 'h', title: 'Run', kind: 'ease', week, at: `${week}T12:00:00Z`,
      before: { perWeek: 4 }, after: { perWeek: 3 }, reason: '', status: 'applied', seen: true,
    }));
    const r = run([goalWith({})], [], { adjustments: past });
    expect(r.added.map(a => a.kind)).toEqual(['ease', 'flag']);
  });

  it('skips paused and archived goals', () => {
    expect(run([goalWith({}, { status: 'paused' })], []).added).toHaveLength(0);
    expect(run([goalWith({}, { archived: true })], []).added).toHaveLength(0);
  });
});

describe('slips and restarts', () => {
  it('eases right away after two missed due days in a row (daily)', () => {
    const r = run([goalWith({ frequency: 'daily', perWeek: 7, maxPerWeek: 7 })], logs('2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'), { state: { lastWeek: '2026-11-16' } });
    // Missed Mon 23? No — done. Missed Tue 24 only → no slip yet.
    expect(r.added).toHaveLength(0);
    const slip = run([goalWith({ frequency: 'daily', perWeek: 7, maxPerWeek: 7 })], logs('2026-11-22'), { state: { lastWeek: '2026-11-16' } });
    expect(slip.added[0]).toMatchObject({ kind: 'ease', week: '2026-11-23', after: { perWeek: 6 } });
    // Only once per week.
    const again = run(slip.goals, logs('2026-11-22'), { state: slip.state, adjustments: slip.added });
    expect(again.added).toHaveLength(0);
  });

  it('starts a restart week after 7+ days away, then leaves it alone', () => {
    const r = run([goalWith({ perWeek: 4 })], [], { lastActivity: '2026-11-15' });
    const h = habitOf(r.goals);
    expect(h.restartUntil).toBe('2026-12-01');
    expect(perWeekOf(h)).toBe(3);
    expect(r.added.filter(a => a.kind === 'restart')).toHaveLength(1);
    // The weekly review doesn't pile a second change on top.
    expect(r.added).toHaveLength(1);
    const again = run(r.goals, [], { lastActivity: '2026-11-15', state: r.state, adjustments: r.added });
    expect(again.added).toHaveLength(0);
  });

  it('undo restores the previous load and ends a restart week', () => {
    const r = run([goalWith({ perWeek: 4 })], [], { lastActivity: '2026-11-15' });
    const undone = habitOf(undoAdjustment(r.goals, r.added[0]));
    expect(perWeekOf(undone)).toBe(4);
    expect(undone.restartUntil).toBeUndefined();
  });

  it('no restart for someone who never logged anything', () => {
    expect(run([goalWith({})], [], { lastActivity: undefined, state: { lastWeek: '2026-11-16' } }).added).toHaveLength(0);
  });
});
