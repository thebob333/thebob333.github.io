/** Shared People constants, so every screen shows the same labels and emoji. */
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
