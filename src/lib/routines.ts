import type { RepeatableBlock } from '@/lib/storage';
import { isDateKey, weekdayName } from '@/lib/dates';

/** Does this routine appear on the given day? Accepts a date key or a weekday name. */
export function shouldShowOnDay(block: RepeatableBlock, dayNameOrDate: string): boolean {
  if (!block.enabled) return false;
  const dayName = isDateKey(dayNameOrDate) ? weekdayName(dayNameOrDate) : dayNameOrDate;
  switch (block.repeatPattern) {
    case 'daily': return true;
    case 'weekdays': return !['Saturday', 'Sunday'].includes(dayName);
    case 'weekends': return ['Saturday', 'Sunday'].includes(dayName);
    case 'custom': return block.customDays?.includes(dayName) ?? false;
  }
}
