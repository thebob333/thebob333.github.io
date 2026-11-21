/** Shared People constants, so every screen shows the same labels, colors and emoji. */
import type { CircleRing, InfluenceTag, InteractionType, RelationshipTag } from '@/lib/storage';

export const ENERGY_LEVELS = [
  { value: 1 as const, label: 'Drained', emoji: '😮‍💨' },
  { value: 2 as const, label: 'Low', emoji: '😐' },
  { value: 3 as const, label: 'Neutral', emoji: '🙂' },
  { value: 4 as const, label: 'Good', emoji: '😊' },
  { value: 5 as const, label: 'Energized', emoji: '🔥' },
];

export function energyEmoji(value?: number): string {
  return ENERGY_LEVELS.find(e => e.value === value)?.emoji ?? '';
}

export const RELATIONSHIPS: { value: RelationshipTag; label: string }[] = [
  { value: 'family', label: 'Family' },
  { value: 'partner', label: 'Partner' },
  { value: 'friend', label: 'Friend' },
  { value: 'coworker', label: 'Coworker' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'mentee', label: 'Mentee' },
  { value: 'acquaintance', label: 'Acquaintance' },
  { value: 'other', label: 'Other' },
];

export const RINGS: { value: CircleRing; label: string; hint: string; color: string }[] = [
  { value: 'core', label: 'Core', hint: 'Closest few', color: 'hsl(350 88% 58%)' },
  { value: 'close', label: 'Close', hint: 'Talk often', color: 'hsl(26 96% 55%)' },
  { value: 'extended', label: 'Extended', hint: 'Stay in touch', color: 'hsl(192 90% 42%)' },
  { value: 'distant', label: 'Distant', hint: 'Now and then', color: 'hsl(240 6% 58%)' },
];

export const INFLUENCES: { value: InfluenceTag; label: string; hint: string }[] = [
  { value: 'energizer', label: 'Energizer', hint: 'Leaves you lifted' },
  { value: 'supporter', label: 'Supporter', hint: 'Has your back' },
  { value: 'challenger', label: 'Challenger', hint: 'Pushes you to grow' },
  { value: 'neutral', label: 'Neutral', hint: '' },
  { value: 'drainer', label: 'Drainer', hint: 'Leaves you tired' },
];

export const INTERACTION_LABELS: Record<InteractionType, string> = {
  text: 'Text', call: 'Call', hangout: 'Hangout', meeting: 'Meeting',
};

export const CHECK_IN_OPTIONS = [
  { days: 0, label: 'No goal' },
  { days: 7, label: 'Weekly' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Quarterly' },
];

export function ringInfo(ring: CircleRing) {
  return RINGS.find(r => r.value === ring) ?? RINGS[RINGS.length - 1];
}

export function relationshipLabel(tag: RelationshipTag) {
  return RELATIONSHIPS.find(r => r.value === tag)?.label ?? 'Other';
}

export function lastSeenText(days: number | null): string {
  if (days === null) return 'Not in touch yet';
  if (days === 0) return 'Talked today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'} ago`;
  return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'} ago`;
}

export function checkInLabel(days?: number): string | null {
  if (!days) return null;
  if (days === 1) return 'daily';
  const opt = CHECK_IN_OPTIONS.find(o => o.days === days);
  return opt ? opt.label.toLowerCase() : `every ${days} days`;
}
