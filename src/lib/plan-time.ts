/**
 * Plan's day runs from 5 AM to 3 AM the next morning, so late nights belong to
 * the day they started. Times are minutes from that day's midnight: 1 AM after
 * the day is 25 * 60. Blocks store `startHour` 5–26 accordingly.
 */
import { addDays, todayKey, type DateKey } from '@/lib/dates';

export const DAY_START_MIN = 5 * 60;
export const DAY_END_MIN = 27 * 60; // 3 AM the next morning

/** 25 * 60 + 5 → "1:05 AM"; whole hours drop the minutes ("7 PM"). */
export function formatClock(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return min === 0 ? `${display} ${period}` : `${display}:${String(min).padStart(2, '0')} ${period}`;
}

/** Minutes → the "HH:MM" an <input type="time"> expects (wraps past midnight). */
export function toTimeInput(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "01:30" → 25.5 h in minutes: times before 5 AM count as after midnight. Null if invalid. */
export function fromTimeInput(value: string): number | null {
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const mins = h * 60 + m;
  return mins < DAY_START_MIN ? mins + 1440 : mins;
}

/** Keep a block of `duration` minutes inside the planner day. */
export function clampStart(start: number, duration: number): number {
  return Math.max(DAY_START_MIN, Math.min(start, DAY_END_MIN - Math.max(1, duration)));
}

/** The planner day it is right now: before 5 AM you're still in last night. */
export function plannerDayKey(now: Date = new Date()): DateKey {
  const today = todayKey(now);
  return now.getHours() * 60 + now.getMinutes() < DAY_START_MIN ? addDays(today, -1) : today;
}

/** Minutes into the current planner day (e.g. 1:30 AM → 25.5 h). */
export function plannerNowMinutes(now: Date = new Date()): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return m < DAY_START_MIN ? m + 1440 : m;
}
