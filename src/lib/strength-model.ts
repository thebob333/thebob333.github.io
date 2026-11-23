/**
 * The strength model behind progression: estimated max, personal calibration,
 * strength trends, bodyweight loads and jump sizes. Pure functions, no storage.
 *
 * Estimated max uses the reps-to-failure → %-of-max chart coaches use with
 * reps in reserve (a set of 8 with 2 left ≈ a 10-rep max), instead of a single
 * formula. People differ in how many reps they get at a given % of their max,
 * so `calibrate` learns a personal factor from your own sets: if your high-rep
 * sets keep implying a bigger max than your low-rep sets, you're more
 * "enduring" than average and each rep counts for less.
 *
 * These are well-grounded coaching heuristics, not lab measurements.
 */
import { isBuiltInExercise, rirOf, type CompoundExercise, type CustomExercise, type ExerciseLog, type SetLog } from '@/types/workout';
import { getStrengthLevel } from '@/lib/strength-standards';

/** % of max for a set taken to failure at 1…12 reps. */
const PCT = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 70.7, 68.0];
/** Above this many reps-to-failure, estimates get unreliable; such sets only count when nothing better exists. */
export const RELIABLE_REPS = 15;
const MAX_REPS = 20;

/** Fraction of your max you can lift for `repsToFailure` reps (personal `calib`: <1 = you get more reps than average). */
export function pctOfMax(repsToFailure: number, calib = 1): number {
  const r = Math.min(MAX_REPS, Math.max(1, repsToFailure));
  const n = 1 + (r - 1) * calib;
  if (n <= 1) return 1;
  if (n <= 12) {
    const i = Math.floor(n) - 1;
    const frac = n - Math.floor(n);
    const a = PCT[i], b = PCT[Math.min(11, i + 1)];
    return (a + (b - a) * frac) / 100;
  }
  return Math.max(40, 68 - 2.2 * (n - 12)) / 100;
}

/** Estimated one-rep max from a load and reps to failure. */
export function maxFrom(load: number, repsToFailure: number, calib = 1): number {
  if (load <= 0 || repsToFailure <= 0) return 0;
  return load / pctOfMax(repsToFailure, calib);
}

/** Load you can lift for `reps` leaving `rir` in the tank, from a max. */
export function loadFor(max: number, reps: number, rir: number, calib = 1): number {
  if (max <= 0) return 0;
  return max * pctOfMax(Math.max(1, reps + rir), calib);
}

/** Most reps you could do with `load` leaving `rir` in reserve (0 if not even one). */
export function repsAt(max: number, load: number, rir: number, calib = 1): number {
  for (let r = MAX_REPS; r >= 1; r--) if (loadFor(max, r, rir, calib) >= load - 1e-9) return r;
  return 0;
}

// ─── Bodyweight ────────────────────────────────────────────────────────────

/**
 * Share of your bodyweight a bodyweight move lifts (approximate, from
 * biomechanics studies): pull-ups/chin-ups/dips ≈ 95%, push-ups ≈ 64%.
 * Null when we can't tell, so we don't invent numbers.
 */
export function bodyFraction(id: string, custom: CustomExercise[] = []): number | null {
  if (id === 'pull_up') return 0.95;
  const c = custom.find(e => e.id === id);
  if (!c || c.equipment !== 'bodyweight') return null;
  const n = c.name.toLowerCase();
  if (/pull|chin|dip|muscle/.test(n)) return 0.95;
  if (/push|press.?up/.test(n)) return 0.64;
  if (/inverted|australian|body.?row/.test(n)) return 0.6;
  if (/pistol|squat|lunge|split/.test(n)) return 0.8;
  return null;
}

export interface LoadOptions {
  /** The bodyweight share this lift moves (from `bodyFraction`) and your bodyweight. */
  bodyFraction?: number | null;
  bodyweightLb?: number;
}

/** Bodyweight that counts toward the load on each rep (0 for normal lifts). */
export const bodyLoad = (o: LoadOptions = {}) => (o.bodyFraction && o.bodyweightLb ? o.bodyFraction * o.bodyweightLb : 0);
/** Total load on a set: the bar or dumbbell, plus your body for bodyweight moves. */
export const loadOf = (s: Pick<SetLog, 'weight'>, o: LoadOptions = {}) => (Number(s.weight) || 0) + bodyLoad(o);

// ─── Personal calibration ──────────────────────────────────────────────────

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const withSets = (logs: ExerciseLog[]) => logs.filter(l => Array.isArray(l.sets) && l.sets.length > 0);

/**
 * Personal rep-endurance factor from your recent sets (newest-first history).
 * Needs a few low-rep (≤5 to failure) and higher-rep (8–20) sets within 8 weeks;
 * shrunk toward 1 (average) when there's little data.
 */
export function calibrate(history: ExerciseLog[], o: LoadOptions = {}): { factor: number; samples: number } {
  const logs = withSets(history);
  if (!logs.length) return { factor: 1, samples: 0 };
  const newest = new Date(logs[0].date).getTime();
  const sets = logs
    .filter(l => newest - new Date(l.date).getTime() <= 56 * 86400000)
    .slice(0, 12)
    .flatMap(l => l.sets)
    .map(s => ({ load: loadOf(s, o), n: s.reps + rirOf(s) }))
    .filter(s => s.load > 0 && s.n >= 1);
  const low = sets.filter(s => s.n <= 5);
  const high = sets.filter(s => s.n >= 8 && s.n <= MAX_REPS);
  const m = Math.min(low.length, high.length);
  if (low.length < 2 || high.length < 2) return { factor: 1, samples: m };
  let best = 1, bestErr = Infinity;
  for (let c = 0.6; c <= 1.5001; c += 0.02) {
    const err = Math.abs(Math.log(median(high.map(s => maxFrom(s.load, s.n, c))) / median(low.map(s => maxFrom(s.load, s.n, c)))));
    if (err < bestErr - 1e-12) { bestErr = err; best = c; }
  }
  const factor = 1 + (best - 1) * (m / (m + 4));
  return { factor: Math.round(factor * 100) / 100, samples: m };
}

// ─── Per-session estimates and trend ──────────────────────────────────────

/** Best estimated max in one session, preferring reliable (≤15 reps to failure) sets. */
export function sessionMax(log: ExerciseLog, calib = 1, o: LoadOptions = {}): number {
  const all = log.sets.map(s => ({ load: loadOf(s, o), reps: s.reps, n: s.reps + rirOf(s) })).filter(s => s.load > 0 && s.reps > 0);
  const reliable = all.filter(s => s.n <= RELIABLE_REPS);
  const use = reliable.length ? reliable : all;
  return use.reduce((best, s) => Math.max(best, maxFrom(s.load, s.n, calib)), 0);
}

export interface TrendPoint { date: string; value: number; smooth: number }
export interface StrengthTrend {
  points: TrendPoint[];
  /** Latest smoothed estimated max (0 with no data). */
  current: number;
  calib: number;
  /** Change per week over the last ~5 weeks, as a fraction (0.01 = +1%/week); null without enough data. */
  perWeek: number | null;
  /** Flat for 3+ weeks across 5+ sessions. */
  plateau: boolean;
  /** Smoothed max over the last two sessions went up by more than 1%. */
  rising: boolean;
}

/**
 * Smoothed strength line for a lift (newest-first history in). Smoothing
 * (exponential, α = 0.5) keeps one bad night or lucky day from deciding things.
 */
export function strengthTrend(history: ExerciseLog[], o: LoadOptions = {}): StrengthTrend {
  const { factor } = calibrate(history, o);
  const chron = withSets(history).slice().reverse();
  const points: TrendPoint[] = [];
  for (const l of chron) {
    const value = sessionMax(l, factor, o);
    if (value <= 0) continue;
    const prev = points[points.length - 1];
    points.push({ date: l.date, value, smooth: prev ? prev.smooth + 0.5 * (value - prev.smooth) : value });
  }
  const current = points.length ? points[points.length - 1].smooth : 0;
  let perWeek: number | null = null;
  let plateau = false;
  if (points.length >= 3) {
    const lastT = new Date(points[points.length - 1].date).getTime();
    const recent = points.filter(p => lastT - new Date(p.date).getTime() <= 35 * 86400000);
    const span = recent.length ? (lastT - new Date(recent[0].date).getTime()) / 86400000 : 0;
    if (recent.length >= 3 && span >= 10) {
      // Least-squares slope of the raw estimates against days.
      const xs = recent.map(p => (new Date(p.date).getTime() - lastT) / 86400000);
      const ys = recent.map(p => p.value);
      const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
      const my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
      const slope = sxx > 0 ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
      perWeek = my > 0 ? (slope * 7) / my : 0;
      plateau = recent.length >= 5 && span >= 21 && Math.abs(perWeek) < 0.005;
    }
  }
  const n = points.length;
  const rising = n >= 2 && points[n - 1].smooth > points[Math.max(0, n - 3)].smooth * 1.01;
  return { points, current, calib: factor, perWeek, plateau, rising };
}

// ─── Jump size ─────────────────────────────────────────────────────────────

const LEVEL_PCT = { beginner: 0.05, novice: 0.05, intermediate: 0.025, advanced: 0.015, elite: 0.01 } as const;

/**
 * How far to raise the weight: a share of the load that shrinks as you get
 * stronger (5% → 2.5% → 1.5%), never below your smallest jump and rounded to it.
 * Level comes from strength standards for the main lifts, otherwise from how
 * long you've trained the lift.
 */
export function jumpSize(opts: { load: number; step: number; exercise: string; max?: number; sessions?: number; bodyweightLb?: number }): { jump: number; pct: number; level: keyof typeof LEVEL_PCT } {
  const step = opts.step > 0 ? opts.step : 5;
  let level: keyof typeof LEVEL_PCT;
  if (isBuiltInExercise(opts.exercise) && opts.exercise !== 'pull_up' && opts.max && opts.bodyweightLb) {
    level = getStrengthLevel(opts.exercise as CompoundExercise, opts.max, opts.bodyweightLb).level;
  } else {
    const n = opts.sessions ?? 0;
    level = n < 12 ? 'novice' : n < 40 ? 'intermediate' : 'advanced';
  }
  const pct = LEVEL_PCT[level];
  const jump = Math.max(step, Math.round((opts.load * pct) / step) * step);
  return { jump, pct, level };
}

