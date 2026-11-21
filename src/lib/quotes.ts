import { daysBetween, type DateKey } from '@/lib/dates';

export const DEFAULT_QUOTES = [
  'Discipline is the bridge between goals and accomplishment.',
  'The only bad workout is the one that didn’t happen.',
  'Small steps every day add up to big results.',
  'You don’t rise to the level of your goals; you fall to the level of your systems.',
  'Every rep is a vote for the person you want to become.',
  'Progress, not perfection.',
  'What you do every day matters more than what you do once in a while.',
  'Show up for the people who matter — and for yourself.',
];

/** Same quote all day, a new one tomorrow. Uses your own quotes when you've added some. */
export function quoteOfTheDay(custom: string[], today: DateKey): string {
  const list = custom.filter(q => q.trim()).length > 0 ? custom.filter(q => q.trim()) : DEFAULT_QUOTES;
  const idx = ((daysBetween('2024-01-01', today) % list.length) + list.length) % list.length;
  return list[idx];
}
