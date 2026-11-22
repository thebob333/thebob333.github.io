import { describe, expect, it } from 'vitest';
import { DAY_END_MIN, clampStart, formatClock, fromTimeInput, plannerDayKey, plannerNowMinutes, toTimeInput } from './plan-time';

describe('plan time', () => {
  it('formats times past midnight as the next morning', () => {
    expect(formatClock(19 * 60)).toBe('7 PM');
    expect(formatClock(24 * 60)).toBe('12 AM');
    expect(formatClock(25 * 60 + 5)).toBe('1:05 AM');
    expect(formatClock(9 * 60 + 7)).toBe('9:07 AM');
  });

  it('round-trips time inputs, treating early-morning times as after midnight', () => {
    expect(fromTimeInput('19:42')).toBe(19 * 60 + 42);
    expect(fromTimeInput('01:30')).toBe(25 * 60 + 30);
    expect(fromTimeInput('05:00')).toBe(5 * 60);
    expect(fromTimeInput('')).toBeNull();
    expect(toTimeInput(25 * 60 + 30)).toBe('01:30');
    expect(toTimeInput(7 * 60 + 3)).toBe('07:03');
  });

  it('keeps blocks inside 5 AM – 3 AM', () => {
    expect(clampStart(4 * 60, 30)).toBe(5 * 60);
    expect(clampStart(26 * 60 + 50, 30)).toBe(DAY_END_MIN - 30);
    expect(clampStart(22 * 60 + 13, 60)).toBe(22 * 60 + 13);
  });

  it('counts the hours after midnight as the previous planner day', () => {
    expect(plannerDayKey(new Date(2026, 10, 22, 1, 30))).toBe('2026-11-21');
    expect(plannerDayKey(new Date(2026, 10, 22, 5, 0))).toBe('2026-11-22');
    expect(plannerNowMinutes(new Date(2026, 10, 22, 1, 30))).toBe(25 * 60 + 30);
    expect(plannerNowMinutes(new Date(2026, 10, 22, 13, 0))).toBe(13 * 60);
  });
});
