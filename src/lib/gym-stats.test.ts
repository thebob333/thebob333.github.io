import { describe, expect, it } from 'vitest';
import { buildSummary, e1rmSeries, primaryMuscle, muscleSets, musclesFor } from './gym-stats';
import type { ExerciseConfig, WorkoutSession } from '@/types/workout';

const s = (id: string, date: string, exercise: string, sets: [number, number][], splitDay = 'push'): WorkoutSession => ({
  id, date, splitDay: splitDay as WorkoutSession['splitDay'], exercises: [{ exercise, date, sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: 3 })) }],
});
const cfg = (weight: number, repMax = 8): ExerciseConfig => ({ exercise: 'bench_press', targetSets: 3, repRangeMin: 6, repRangeMax: repMax, currentWeight: weight, weightIncrement: 5 });

describe('gym stats', () => {
  it('maps exercises to the muscles they mainly train', () => {
    expect(musclesFor('bench_press')).toEqual(['chest', 'triceps']);
    expect(musclesFor('custom_x', [{ id: 'custom_x', name: 'Curl', equipment: 'dumbbell', muscleGroups: ['biceps'] }])).toEqual(['biceps']);
  });

  it('counts weekly sets per muscle', () => {
    const sets = muscleSets([s('a', '2026-11-23T10:00:00', 'bench_press', [[135, 8], [135, 8]]), s('b', '2026-11-10T10:00:00', 'squat', [[185, 5]])], [], '2026-11-23');
    expect(sets).toEqual({ chest: 2, triceps: 2 });
  });

  it('estimated max per session', () => {
    expect(e1rmSeries([s('a', '2026-11-20', 'bench_press', [[135, 8], [145, 3]])], 'bench_press', false)).toEqual([{ date: '2026-11-20', value: 183 }]); // 8 reps + 2 left ≈ a 10-rep max
    // Bodyweight moves: reps without a bodyweight; total load with one.
    expect(e1rmSeries([s('b', '2026-11-20', 'pull_up', [[0, 10]])], 'pull_up', true)).toEqual([{ date: '2026-11-20', value: 10 }]);
    expect(e1rmSeries([s('b', '2026-11-20', 'pull_up', [[0, 10]])], 'pull_up', true, { bodyFraction: 0.95, bodyweightLb: 180 })[0].value).toBe(Math.round(171 / 0.68));
  });

  it('primary muscle', () => {
    expect(primaryMuscle('bench_press')).toBe('chest');
    expect(primaryMuscle('squat')).toBe('quads');
    expect(primaryMuscle('x', [{ id: 'x', name: 'Curl', equipment: 'dumbbell', muscleGroups: ['biceps'] }])).toBe('biceps');
  });

  it('summary: volume vs last same split, records, and what changes next time', () => {
    const prev = s('p', '2026-11-18T10:00:00', 'bench_press', [[135, 8], [135, 8]]);
    const now = s('n', '2026-11-25T11:00:00', 'bench_press', [[140, 8], [140, 8]]);
    const sum = buildSummary(now, [prev], [cfg(140)], [cfg(145)], [], '2026-11-25T10:15:00');
    expect(sum).toMatchObject({ minutes: 45, sets: 2, volume: 2240, vsLast: 4 });
    expect(sum.records).toEqual([{ label: 'Bench Press', value: '140 lbs' }]);
    expect(sum.next).toEqual([{ exercise: 'bench_press', label: 'Bench Press', from: 140, to: 145, kind: 'up', unit: 'lb' }]);
    expect(buildSummary(now, [prev], [cfg(140)], [cfg(125)], []).next[0].kind).toBe('lighter');
  });
});
