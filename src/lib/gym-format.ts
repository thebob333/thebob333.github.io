import { calculateVolumeLoad } from '@/lib/progressive-overload';
import type { WorkoutSession } from '@/types/workout';

/** "push" → "Push". */
export const splitLabel = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Workout');
/** Total weight × reps in a session, in lb. */
export const sessionVolume = (s: WorkoutSession) => s.exercises.reduce((sum, e) => sum + calculateVolumeLoad(e.sets), 0);
/** 12,500 → "12.5k"; small numbers keep separators. */
export const fmtLb = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}k` : n.toLocaleString());
/** 1 → "1 exercise", 3 → "3 exercises". */
export const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
