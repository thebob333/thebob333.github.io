import { describe, expect, it } from 'vitest';
import {
  addDays, dateKeyOf, dayOfWeek, daysBetween, daysUntil, isDateKey, parseDateKey,
  startOfWeekKey, toDateKey, todayKey, weekdayName,
} from './dates';
import { getDaysRemaining } from '@/types/goals';
import { withTimeZone } from '@/test/tz';

const ZONES = ['America/Los_Angeles', 'Pacific/Auckland', 'Asia/Kolkata', 'UTC'];

describe('dates', () => {
  it.each(ZONES)('todayKey is the LOCAL date late in the evening and just after midnight (%s)', tz => {
    withTimeZone(tz, () => {
      expect(todayKey(new Date(2026, 2, 14, 23, 30))).toBe('2026-03-14');
      expect(todayKey(new Date(2026, 2, 15, 0, 30))).toBe('2026-03-15');
    });
  });

  it('the old UTC bug: 8pm in Los Angeles is still today', () => {
    // 2026-03-14 20:00 PDT is 2026-03-15 03:00 UTC.
    const evening = new Date('2026-03-15T03:00:00Z');
    expect(evening.toISOString().slice(0, 10)).toBe('2026-03-15');
    expect(toDateKey(evening)).toBe('2026-03-14');
  });

  it.each(ZONES)('parseDateKey returns local midnight (%s)', tz => {
    withTimeZone(tz, () => {
      const d = parseDateKey('2026-07-04');
      expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 6, 4, 0]);
      expect(toDateKey(d)).toBe('2026-07-04');
    });
  });

  it('daysBetween is exact across US daylight-saving changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2); // spring forward 2026-03-08
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2); // fall back 2026-11-01
    expect(daysBetween('2026-03-09', '2026-03-07')).toBe(-2);
  });

  it('addDays crosses month, year and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('dayOfWeek / weekdayName / startOfWeekKey', () => {
    expect(dayOfWeek('2026-11-22')).toBe(0); // Sunday
    expect(weekdayName('2026-11-23')).toBe('Monday');
    expect(startOfWeekKey('2026-11-25', 0)).toBe('2026-11-22');
    expect(startOfWeekKey('2026-11-25', 1)).toBe('2026-11-23');
    expect(startOfWeekKey('2026-11-22', 1)).toBe('2026-11-16');
  });

  it('dateKeyOf passes keys through and converts timestamps to the local day', () => {
    expect(dateKeyOf('2026-05-01')).toBe('2026-05-01');
    expect(dateKeyOf('2026-05-02T02:00:00.000Z')).toBe('2026-05-01'); // 7pm PDT on May 1
    expect(isDateKey('2026-05-01')).toBe(true);
    expect(isDateKey('May 1')).toBe(false);
  });

  it('getDaysRemaining: a deadline of today is 0 at 8pm in Los Angeles (was -1/+1 before)', () => {
    expect(getDaysRemaining('2026-03-14', '2026-03-14')).toBe(0);
    expect(getDaysRemaining('2026-03-15', '2026-03-14')).toBe(1);
    expect(getDaysRemaining('2026-03-10', '2026-03-14')).toBe(-4);
    expect(getDaysRemaining(undefined)).toBeNull();
    expect(daysUntil('2026-03-20', '2026-03-14')).toBe(6);
  });
});
