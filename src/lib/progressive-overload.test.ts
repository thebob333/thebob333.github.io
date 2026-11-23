import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyDeload, effortE1RM, estimateE1RM, getPersonalRecords, getProgressionSuggestion, planNextSession, plannedWeights, platesPerSide, prescribeWeight, progressionOptions, volumeAdvice } from './progressive-overload';
import { calibrate, jumpSize, pctOfMax, sessionMax, strengthTrend } from './strength-model';
import { rirOf, rpeFromRir } from '@/types/workout';
import type { ExerciseConfig, ExerciseLog, WorkoutSession } from '@/types/workout';

const cfg = (over: Partial<ExerciseConfig> = {}): ExerciseConfig => ({
  exercise: 'bench_press', targetSets: 3, repRangeMin: 6, repRangeMax: 8, currentWeight: 135, weightIncrement: 5, ...over,
});
const log = (date: string, sets: [number, number, number][]): ExerciseLog => ({
  exercise: 'bench_press', date, sets: sets.map(([weight, reps, rpe]) => ({ weight, reps, rpe })),
});

// Pin "now" so the time-off rule doesn't kick in as the fixtures age.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-21T12:00:00Z') }); });
afterEach(() => { vi.useRealTimers(); });

describe('getProgressionSuggestion', () => {
  it('increases weight when every set hits the top of the range with effort to spare', () => {
    const s = getProgressionSuggestion(cfg(), [log('2026-11-20T10:00:00Z', [[135, 8, 3], [135, 8, 3], [135, 8, 4]])]);
    expect(s.type).toBe('increase_weight');
    expect(s.suggestedWeight).toBe(140);
  });

  it('a stall suggests a ~10% deload (not 45% off)', () => {
    const s = getProgressionSuggestion(cfg(), [
      log('2026-11-20T10:00:00Z', [[135, 4, 4]]),
      log('2026-11-18T10:00:00Z', [[135, 5, 4]]),
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
    // A double step that would pass what your estimated max allows is cut to one.
    const capped = getProgressionSuggestion(cfg({ currentWeight: 135, weightIncrement: 12.5 }), [rlog('2026-11-20T10:00:00Z', [[135, 8, 4]])]);
    expect(capped.suggestedWeight).toBe(147.5);
  });

  it('linear style adds weight once every set hits the rep minimum', () => {
    const s = getProgressionSuggestion(cfg({ style: 'linear', repRangeMin: 5, repRangeMax: 5, currentWeight: 185 }), [rlog('2026-11-20T10:00:00Z', [[185, 5, 2], [185, 5, 1]])]);
    // New to the lift → jumps are ~5% of the load (9 lb → rounded to 10).
    expect(s).toMatchObject({ type: 'increase_weight', suggestedWeight: 195 });
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

describe('strength model', () => {
  const rlog = (date: string, sets: [number, number, number][], exercise = 'bench_press'): ExerciseLog => ({
    exercise, date, sets: sets.map(([weight, reps, rir]) => ({ weight, reps, rir, rpe: rpeFromRir(rir) })),
  });

  it('uses the reps-to-%-of-max chart, not one formula', () => {
    expect(pctOfMax(1)).toBe(1);
    expect(pctOfMax(5)).toBeCloseTo(0.863);
    expect(pctOfMax(10)).toBeCloseTo(0.739);
    expect(pctOfMax(15)).toBeLessThan(pctOfMax(12));
    expect(estimateE1RM(200, 5)).toBe(232);
    // A personal factor below 1 (more reps than average) means each rep counts for less.
    expect(pctOfMax(10, 0.8)).toBeGreaterThan(pctOfMax(10));
  });

  it('learns a personal factor from your own sets', () => {
    // True max 200, but this lifter gets more reps than the chart predicts at lighter loads.
    const history = [
      rlog('2026-11-20T10:00:00Z', [[175, 3, 0], [175, 3, 0], [150, 12, 0], [150, 12, 0]]),
      rlog('2026-11-17T10:00:00Z', [[175, 3, 0], [150, 12, 0], [150, 12, 0]]),
    ];
    const { factor } = calibrate(history);
    expect(factor).toBeLessThan(0.95);
    // Without both kinds of sets, it stays at average.
    expect(calibrate([rlog('2026-11-20T10:00:00Z', [[150, 10, 1]])]).factor).toBe(1);
  });

  it('ignores very high-rep sets for the max when better sets exist', () => {
    const s = rlog('2026-11-20T10:00:00Z', [[200, 5, 0], [60, 40, 0]]);
    expect(Math.round(sessionMax(s))).toBe(232);
  });

  it('smooths the trend and spots a plateau', () => {
    const flat = [0, 4, 8, 12, 16, 20, 24].map(d => rlog(new Date(Date.UTC(2026, 10, 20 - d, 10)).toISOString(), [[135, 7, 1], [135, 7, 1]]));
    const t = strengthTrend(flat);
    expect(t.plateau).toBe(true);
    expect(Math.abs(t.perWeek!)).toBeLessThan(0.005);
    const s = getProgressionSuggestion(cfg(), flat);
    expect(s.type).toBe('plateau');
  });

  it('one bad session after progress does not trigger a lighter week if the trend is rising', () => {
    const history = [
      rlog('2026-11-20T10:00:00Z', [[140, 6, 1], [140, 5, 0]]),
      rlog('2026-11-17T10:00:00Z', [[140, 5, 1], [140, 4, 0]]),
      rlog('2026-11-14T10:00:00Z', [[135, 5, 1], [135, 4, 0]]),
    ];
    const s = getProgressionSuggestion(cfg({ currentWeight: 140 }), history);
    expect(s.type).toBe('hold');
    expect(s.message).toMatch(/still climbing/);
  });

  it('jumps shrink as you get stronger', () => {
    expect(jumpSize({ load: 300, step: 5, exercise: 'squat', sessions: 3 }).jump).toBe(15);
    expect(jumpSize({ load: 300, step: 5, exercise: 'squat', max: 380, bodyweightLb: 180 }).jump).toBe(10); // advanced-ish → smaller
    expect(jumpSize({ load: 100, step: 5, exercise: 'custom_x', sessions: 60 }).jump).toBe(5); // never below your smallest jump
  });

  it('light dumbbells: earn a big jump with extra reps first', () => {
    const c = cfg({ exercise: 'custom_curl', currentWeight: 25, weightIncrement: 5, repRangeMin: 10, repRangeMax: 12 });
    const s = getProgressionSuggestion(c, [rlog('2026-11-20T10:00:00Z', [[25, 12, 2], [25, 12, 2]], 'custom_curl')]);
    expect(s.type).toBe('increase_reps');
    expect(s.message).toMatch(/14/);
    const later = getProgressionSuggestion(c, [rlog('2026-11-20T10:00:00Z', [[25, 14, 2], [25, 14, 2]], 'custom_curl')]);
    expect(later).toMatchObject({ type: 'increase_weight', suggestedWeight: 30 });
  });

  it('bodyweight lifts count your bodyweight', () => {
    const custom = [{ id: 'custom_dip', name: 'Dips', equipment: 'bodyweight' as const, muscleGroups: [] }];
    const o = progressionOptions('custom_dip', custom, 180);
    expect(o).toMatchObject({ bodyweight: true, bodyFraction: 0.95 });
    const s = rlog('2026-11-20T10:00:00Z', [[0, 10, 0]], 'custom_dip');
    expect(Math.round(sessionMax(s, 1, o))).toBe(Math.round(171 / 0.739));
    // 12+ reps at bodyweight → prescribe added weight.
    const pull = cfg({ exercise: 'pull_up', currentWeight: 0, repRangeMin: 8, repRangeMax: 12 });
    const sug = getProgressionSuggestion(pull, [rlog('2026-11-20T10:00:00Z', [[0, 12, 1], [0, 12, 1]], 'pull_up')], progressionOptions('pull_up', [], 180));
    expect(sug.type).toBe('increase_weight');
    expect(sug.suggestedWeight).toBeGreaterThan(0);
  });

  it('coming back after time off starts lighter', () => {
    const s = getProgressionSuggestion(cfg(), [rlog('2026-11-01T10:00:00Z', [[135, 8, 2]])]);
    expect(s).toMatchObject({ type: 'comeback', suggestedWeight: 120 }); // 20 days → 90%
    const long = getProgressionSuggestion(cfg(), [rlog('2026-09-01T10:00:00Z', [[135, 8, 2]])]);
    expect(long.suggestedWeight).toBe(110); // 11+ weeks → 80%
  });

  it('top set + back-offs: judged on the top set only', () => {
    const c = cfg({ scheme: 'topset', backoffPercent: 10 });
    expect(plannedWeights(c, 3)).toEqual([135, 120, 120]);
    // Back-offs short of the range don't block progress; the top set hit 8.
    const s = getProgressionSuggestion(c, [rlog('2026-11-20T10:00:00Z', [[135, 8, 1], [120, 6, 1], [120, 5, 1]])]);
    expect(s.type).toBe('increase_weight');
    expect(plannedWeights(cfg(), 3)).toEqual([135, 135, 135]);
  });

  it('weekly sets: add one when below 10 and recovering, drop one above 20 when slipping', () => {
    const good = [rlog('2026-11-20T10:00:00Z', [[135, 7, 2], [135, 7, 2]]), rlog('2026-11-17T10:00:00Z', [[135, 6, 2], [135, 6, 2]])];
    expect(volumeAdvice(cfg(), good, 6, 'chest')).toMatchObject({ type: 'add_set', targetSets: 4 });
    expect(volumeAdvice(cfg(), good, 14, 'chest')).toBeNull();
    const bad = [rlog('2026-11-20T10:00:00Z', [[135, 4, 0]]), rlog('2026-11-17T10:00:00Z', [[135, 5, 0]])];
    expect(volumeAdvice(cfg({ targetSets: 5 }), bad, 24, 'chest')).toMatchObject({ type: 'drop_set', targetSets: 4 });
  });
});
