import { describe, expect, it } from 'vitest';
import {
  getAllActiveHabits, getCurrentStreak, getHabitStats, getLongestStreak, getTodaysHabits,
  getWeeklyCompletionRate, isHabitDueToday,
} from './habits';
import type { Goal, Habit, HabitLog } from '@/types/goals';

const log = (date: string, habitId = 'h', completed = true): HabitLog => ({ habitId, date, completed });
const habit = (frequency: string, active = true): Habit => ({ id: 'h', title: 'H', frequency, active });

describe('habit streaks', () => {
  const today = '2026-11-21';

  it('counts today and back', () => {
    expect(getCurrentStreak('h', [log('2026-11-21'), log('2026-11-20'), log('2026-11-19')], today)).toBe(3);
  });

  it('still counts if only yesterday is done (today not checked yet)', () => {
    expect(getCurrentStreak('h', [log('2026-11-20'), log('2026-11-19')], today)).toBe(2);
  });

  it('a gap ends the streak; duplicates and undone logs are ignored', () => {
    const logs = [log('2026-11-21'), log('2026-11-21'), log('2026-11-19'), log('2026-11-20', 'h', false)];
    expect(getCurrentStreak('h', logs, today)).toBe(1);
  });

  it('works across daylight-saving changes', () => {
    const logs = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map(d => log(d));
    expect(getCurrentStreak('h', logs, '2026-11-02')).toBe(4);
    expect(getLongestStreak('h', logs)).toBe(4);
  });

  it('longest streak across separate runs', () => {
    const logs = ['2026-01-01', '2026-01-02', '2026-01-05', '2026-01-06', '2026-01-07'].map(d => log(d));
    expect(getLongestStreak('h', logs)).toBe(3);
  });

  it('weekly completion rate respects the frequency', () => {
    const logs = ['2026-11-16', '2026-11-17', '2026-11-18'].map(d => log(d)); // Mon–Wed, week starts Sun 11-15
    expect(getWeeklyCompletionRate('h', logs, '3x/week', '2026-11-18')).toBe(1);
    expect(getWeeklyCompletionRate('h', logs, 'weekdays', '2026-11-18')).toBeCloseTo(0.6);
    expect(getWeeklyCompletionRate('h', logs, 'daily', '2026-11-18')).toBeCloseTo(3 / 7);
  });

  it('getHabitStats passes arguments correctly (used to crash)', () => {
    const stats = getHabitStats('h', 'daily', [log('2026-11-21')]);
    expect(stats.totalCompletions).toBe(1);
    expect(stats.weeklyRate).toBeGreaterThanOrEqual(0);
  });
});

describe('isHabitDueToday', () => {
  it('daily / weekdays / weekends', () => {
    expect(isHabitDueToday(habit('daily'), '2026-11-22')).toBe(true);
    expect(isHabitDueToday(habit('weekdays'), '2026-11-22')).toBe(false); // Sunday
    expect(isHabitDueToday(habit('weekdays'), '2026-11-23')).toBe(true);
    expect(isHabitDueToday(habit('weekends'), '2026-11-22')).toBe(true);
    expect(isHabitDueToday(habit('daily', false), '2026-11-22')).toBe(false);
  });

  it('named days match whole words — "monthly" is not Monday', () => {
    expect(isHabitDueToday(habit('mon/wed/fri'), '2026-11-23')).toBe(true);
    expect(isHabitDueToday(habit('mon/wed/fri'), '2026-11-24')).toBe(false);
    expect(isHabitDueToday(habit('Tuesday, Thursday'), '2026-11-24')).toBe(true);
    expect(isHabitDueToday(habit('tues & thurs'), '2026-11-26')).toBe(true);
    expect(isHabitDueToday(habit('monthly'), '2026-11-24')).toBe(true); // shown, not Monday-only
  });
});

describe('active habits', () => {
  it("doesn't crash on old tasks without a habits array", () => {
    const goals = [{
      id: 'g', title: 'G', description: '', endGoal: '', createdAt: '', phases: [
        { id: 'p', title: 'P', description: '', order: 0, tasks: [{ id: 't', title: 'T', description: '', status: 'not_started', order: 0, todos: [] }] },
      ],
    }] as unknown as Goal[];
    expect(() => getAllActiveHabits(goals)).not.toThrow();
    expect(getTodaysHabits(goals, [], '2026-11-21')).toEqual([]);
  });

  it("returns habits from the current phase only, with goal context", () => {
    const goals = [{
      id: 'g', title: 'Ironman', description: '', endGoal: '', createdAt: '', phases: [
        { id: 'p1', title: 'Base', description: '', order: 0, tasks: [
          { id: 't1', title: 'Swim', description: '', status: 'not_started', order: 0, todos: [], habits: [habit('daily')] },
        ] },
        { id: 'p2', title: 'Build', description: '', order: 1, tasks: [
          { id: 't2', title: 'Bike', description: '', status: 'not_started', order: 0, todos: [], habits: [{ ...habit('daily'), id: 'later' }] },
        ] },
      ],
    }] as unknown as Goal[];
    const today = getTodaysHabits(goals, [log('2026-11-21')], '2026-11-21');
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ goalTitle: 'Ironman', taskTitle: 'Swim', completed: true, streak: 1 });
  });
});
