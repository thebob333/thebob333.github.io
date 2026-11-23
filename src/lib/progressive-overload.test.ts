import { describe, expect, it } from 'vitest';
import { applyDeload, effortE1RM, estimateE1RM, getPersonalRecords, getProgressionSuggestion, planNextSession, platesPerSide, prescribeWeight } from './progressive-overload';
import { rirOf, rpeFromRir } from '@/types/workout';
import type { ExerciseConfig, ExerciseLog, WorkoutSession } from '@/types/workout';

const cfg = (over: Partial<ExerciseConfig> = {}): ExerciseConfig => ({
  exercise: 'bench_press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 135, weightIncrement: 5, ...over,
});
const log = (date: string, sets: [number, number, number][]): ExerciseLog => ({
  exercise: 'bench_press', date, sets: sets.map(([weight, reps, rpe]) => ({ weight, reps, rpe })),
});

describe('getProgressionSuggestion', () => {
  it('increases weight when every set hits the top of the range with effort to spare', () => {
    const s = getProgressionSuggestion(cfg(), [log('2026-11-20T10:00:00Z', [[135, 8, 3], [135, 8, 3], [135, 8, 4]])]);
    expect(s.type).toBe('increase_weight');
    expect(s.suggestedWeight).toBe(140);
  });

  it('a stall suggests a ~10% deload (not 45% off)', () => {
    const s = getProgressionSuggestion(cfg(), [
      log('2026-11-20T10:00:00Z', [[135, 5, 4]]),
      log('2026-11-18T10:00:00Z', [[135, 4, 4]]),
    ]);
    expect(s.type).toBe('deload');
    expect(s.suggestedWeight).toBe(120); // 135 × 0.9 = 121.5 → nearest 5
  });

  it('after the app lowers the weight, it says so instead of "weight bumped"', () => {
    const config = applyDeload(cfg(), 120, new Date('2026-11-21T00:00:00Z'));
    const s = getProgressionSuggestion(config, [log('2026-11-20T10:00:00Z', [[135, 5, 4]])]);
    expect(s.type).toBe('hold');
    expect(s.message).toMatch(/Deloaded/);
  });

  it('lifting lighter than planned no longer pretends a bump happened', () => {
    const s = getProgressionSuggestion(cfg(), [log('2026-11-20T10:00:00Z', [[115, 7, 3], [115, 7, 3]])]);
    expect(s.message).not.toMatch(/bumped/i);
  });

  it('ignores logs with no sets (no NaN)', () => {
    const s = getProgressionSuggestion(cfg(), [log('2026-11-20T10:00:00Z', [])]);
    expect(s.message).not.toMatch(/NaN/);
  });

  it('bodyweight lifts progress by reps, not +5 lb', () => {
    const pull = cfg({ exercise: 'pull_up', currentWeight: 0, repRangeMin: 5, repRangeMax: 8 });
    const history = [log('2026-11-20T10:00:00Z', [[0, 8, 3], [0, 9, 3]])];
    const s = getProgressionSuggestion(pull, history, { bodyweight: true });
    expect(s.type).toBe('increase_reps');
    const plan = planNextSession(pull, history, { bodyweight: true });
    expect(plan?.config).toMatchObject({ currentWeight: 0, repRangeMin: 6, repRangeMax: 9 });
  });
});

describe('planNextSession', () => {
  it('applies earned weight increases and records the adjustment', () => {
    const plan = planNextSession(cfg(), [log('2026-11-20T10:00:00Z', [[135, 8, 3], [135, 8, 3]])], {}, new Date('2026-11-20T11:00:00Z'));
    expect(plan?.change).toBe('increase_weight');
    expect(plan?.config.currentWeight).toBe(140);
    expect(plan?.config.lastAdjustment).toEqual({ type: 'increase_weight', at: '2026-11-20T11:00:00.000Z', from: 135 });
  });

  it('never auto-applies a deload', () => {
    expect(planNextSession(cfg(), [log('2026-11-20T10:00:00Z', [[135, 4, 5]]), log('2026-11-18T10:00:00Z', [[135, 4, 5]])])).toBeNull();
  });
});

describe('getPersonalRecords', () => {
  const session = (sets: [number, number][], exercise = 'pull_up'): WorkoutSession => ({
    id: Math.random().toString(), date: '2026-11-20', splitDay: 'pull',
    exercises: [{ exercise, date: '2026-11-20', sets: sets.map(([weight, reps]) => ({ weight, reps, rpe: 3 })) }],
  });

  it('pull-up PR is max reps — a weighted set with fewer reps does not replace it', () => {
    const prs = getPersonalRecords([session([[0, 12]]), session([[10, 6]])]);
    expect(prs[0]).toMatchObject({ reps: 12, weight: 0 });
  });

  it('weighted lifts still use the heaviest weight', () => {
    const prs = getPersonalRecords([session([[135, 8], [155, 3]], 'bench_press')]);
    expect(prs[0]).toMatchObject({ weight: 155, reps: 3 });
  });
});

describe('reps-in-reserve progression', () => {
  const rlog = (date: string, sets: [number, number, number][]): ExerciseLog => ({
    exercise: 'bench_press', date, sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir, rpe: rpeFromRir(rir) })),
  });

  it('converts the old 1–5 effort to reps in reserve', () => {
    expect(rirOf({ rpe: 5 })).toBe(0);
    expect(rirOf({ rpe: 3 })).toBe(2);
    expect(rirOf({ rpe: 1 })).toBe(4);
    expect(rirOf({ rpe: 5, rir: 3 })).toBe(3);
    expect(rpeFromRir(0)).toBe(5);
    expect(rpeFromRir(2)).toBe(3);
  });

  it('effort-adjusted max: 8 reps with 2 left counts like a 10-rep max', () => {
    expect(effortE1RM(135, 8, 2)).toBe(estimateE1RM(135, 10));
    expect(prescribeWeight(180, 8, 2, 5)).toBe(135);
  });

  it('progresses only when the top of the range came with enough in the tank', () => {
    expect(getProgressionSuggestion(cfg(), [rlog('2026-11-20T10:00:00Z', [[135, 8, 1], [135, 8, 1]])]).type).toBe('increase_weight');
    // Ground out (0 left) → repeat the weight.
    expect(getProgressionSuggestion(cfg(), [rlog('2026-11-20T10:00:00Z', [[135, 8, 0], [135, 8, 0]])]).type).toBe('hold');
    // A tougher target (0 in reserve) progresses on the same session.
    expect(getProgressionSuggestion(cfg({ targetRir: 0 }), [rlog('2026-11-20T10:00:00Z', [[135, 8, 0], [135, 8, 0]])]).type).toBe('increase_weight');
  });

  it('jumps two steps when it was far too easy, capped by your estimated max', () => {
    const easy = getProgressionSuggestion(cfg(), [rlog('2026-11-20T10:00:00Z', [[135, 8, 4], [135, 8, 4]])]);
    expect(easy.suggestedWeight).toBe(145);
    // Same reps-in-reserve but a tiny increment and modest max: still capped sensibly.
    const capped = getProgressionSuggestion(cfg({ currentWeight: 135, weightIncrement: 25 }), [rlog('2026-11-20T10:00:00Z', [[135, 8, 4]])]);
    expect(capped.suggestedWeight).toBe(160);
  });

  it('linear style adds weight once every set hits the rep minimum', () => {
    const s = getProgressionSuggestion(cfg({ style: 'linear', repRangeMin: 5, repRangeMax: 5, currentWeight: 185 }), [rlog('2026-11-20T10:00:00Z', [[185, 5, 2], [185, 5, 1]])]);
    expect(s).toMatchObject({ type: 'increase_weight', suggestedWeight: 190 });
  });

  it('lighter-week size and stall sensitivity are adjustable', () => {
    const history = [rlog('2026-11-20T10:00:00Z', [[200, 4, 0]]), rlog('2026-11-18T10:00:00Z', [[200, 8, 1]])];
    expect(getProgressionSuggestion(cfg({ currentWeight: 200, stallSessions: 1, deloadPercent: 15 }), history)).toMatchObject({ type: 'deload', suggestedWeight: 170 });
    expect(getProgressionSuggestion(cfg({ currentWeight: 200 }), history).type).not.toBe('deload');
  });

  it('plate calculator', () => {
    expect(platesPerSide(225)).toEqual([45, 45]);
    expect(platesPerSide(185)).toEqual([45, 25]);
    expect(platesPerSide(137.5)).toBeNull(); // needs 1.25s, which the default set doesn't have
    expect(platesPerSide(140)).toEqual([45, 2.5]);
    expect(platesPerSide(30)).toBeNull();
  });
});
