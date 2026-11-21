import { describe, expect, it } from 'vitest';
import { shouldShowOnDay } from './routines';
import type { RepeatableBlock } from '@/lib/storage';

const r = (p: Partial<RepeatableBlock>): RepeatableBlock => ({
  id: 'r', title: 'Gym', categoryId: 'workout', startHour: 7, startMinute: 0, durationMinutes: 60,
  repeatPattern: 'daily', customDays: [], enabled: true, ...p,
});

describe('shouldShowOnDay', () => {
  it('follows the repeat pattern for date keys', () => {
    expect(shouldShowOnDay(r({ repeatPattern: 'weekdays' }), '2026-11-23')).toBe(true); // Monday
    expect(shouldShowOnDay(r({ repeatPattern: 'weekdays' }), '2026-11-22')).toBe(false); // Sunday
    expect(shouldShowOnDay(r({ repeatPattern: 'weekends' }), '2026-11-21')).toBe(true); // Saturday
    expect(shouldShowOnDay(r({ repeatPattern: 'custom', customDays: ['Tuesday'] }), '2026-11-24')).toBe(true);
  });

  it('never shows a paused routine', () => {
    expect(shouldShowOnDay(r({ enabled: false }), '2026-11-23')).toBe(false);
  });
});
