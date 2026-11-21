/**
 * Local-calendar date helpers.
 *
 * A DateKey is a 'YYYY-MM-DD' string for a day on the user's LOCAL calendar.
 * Never derive a DateKey from `toISOString()` — that gives the UTC date, which
 * is "tomorrow" for US users every evening.
 */

export type DateKey = string;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export function isDateKey(s: unknown): s is DateKey {
  return typeof s === 'string' && DATE_KEY_RE.test(s);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date of `d` (defaults to now). */
export function toDateKey(d: Date = new Date()): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): DateKey {
  return toDateKey(now);
}

function parts(k: DateKey): [number, number, number] {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return [y, m, d];
}

/** Local midnight of the given key. */
export function parseDateKey(k: DateKey): Date {
  const [y, m, d] = parts(k);
  return new Date(y, m - 1, d);
}

/**
 * Normalize a stored date to a DateKey.
 * - A bare 'YYYY-MM-DD' passes through unchanged (it is already a calendar day).
 * - A full ISO timestamp becomes the local calendar day of that instant.
 */
export function dateKeyOf(isoOrKey: string): DateKey {
  if (DATE_KEY_RE.test(isoOrKey)) return isoOrKey;
  const d = new Date(isoOrKey);
  if (isNaN(d.getTime())) return isoOrKey.slice(0, 10);
  return toDateKey(d);
}

export function addDays(k: DateKey, n: number): DateKey {
  const [y, m, d] = parts(k);
  return toDateKey(new Date(y, m - 1, d + n));
}

/** Whole calendar days from a to b (positive when b is later). DST-safe. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / MS_PER_DAY);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(k: DateKey): number {
  const [y, m, d] = parts(k);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeekKey(k: DateKey, weekStartsOn: 0 | 1 = 0): DateKey {
  const dow = dayOfWeek(k);
  const diff = (dow - weekStartsOn + 7) % 7;
  return addDays(k, -diff);
}

/** Days from today until the given date/ISO string (negative when past). */
export function daysUntil(dateOrIso: string, today: DateKey = todayKey()): number {
  return daysBetween(today, dateKeyOf(dateOrIso));
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function weekdayName(k: DateKey): string {
  return WEEKDAY_NAMES[dayOfWeek(k)];
}
