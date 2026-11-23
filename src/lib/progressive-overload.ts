import { dateKeyOf, startOfWeekKey } from '@/lib/dates';
import { ExerciseConfig, ExerciseLog, SetLog, WorkoutSession, PersonalRecord, rirOf } from '@/types/workout';

export function calculateVolumeLoad(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculateSetVolume(set: SetLog): number {
  return set.weight * set.reps;
}

// Epley formula: e1RM = weight × (1 + reps/30)
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export interface ProgressionSuggestion {
  type: 'increase_weight' | 'hold' | 'deload' | 'increase_reps' | 'fatigue_warning';
  message: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  e1rm?: number;
}

export interface ProgressionOptions {
  /** Bodyweight movements progress by reps rather than added weight. */
  bodyweight?: boolean;
}

/** Defaults for the adjustable settings (see ExerciseConfig). */
export const DEFAULTS = { style: 'double' as const, targetRir: 2, deloadPercent: 10, stallSessions: 2 };

export function settingsOf(c: ExerciseConfig) {
  return {
    style: c.style ?? DEFAULTS.style,
    targetRir: Math.max(0, Math.min(3, c.targetRir ?? DEFAULTS.targetRir)),
    deloadPercent: Math.max(5, Math.min(25, c.deloadPercent ?? DEFAULTS.deloadPercent)),
    stallSessions: Math.max(1, Math.min(3, c.stallSessions ?? DEFAULTS.stallSessions)),
  };
}

/** Average reps in reserve across a session's sets. */
function avgRir(session: ExerciseLog): number {
  return session.sets.reduce((s, set) => s + rirOf(set), 0) / session.sets.length;
}

function bestSetE1RM(session: ExerciseLog): number {
  return Math.max(...session.sets.map(s => estimateE1RM(s.weight, s.reps)));
}

/**
 * Estimated max that accounts for effort: a set of 8 with 2 left in the tank
 * is like a 10-rep max (reps + reps in reserve), which is what Epley expects.
 */
export function effortE1RM(weight: number, reps: number, rir = 0): number {
  return estimateE1RM(weight, reps + Math.max(0, rir));
}

/** Best effort-adjusted estimated max over the last few sessions. */
export function bestRecentE1RM(history: ExerciseLog[], sessions = 3): number {
  const recent = withSets(history).slice(0, sessions);
  let best = 0;
  for (const l of recent) for (const st of l.sets) best = Math.max(best, effortE1RM(st.weight, st.reps, rirOf(st)));
  return best;
}

/** The weight for `reps` reps leaving `rir` in the tank, from an estimated max (rounded to your step). */
export function prescribeWeight(e1rm: number, reps: number, rir: number, step: number): number {
  if (e1rm <= 0) return 0;
  const total = Math.max(1, reps + rir);
  return roundTo(total === 1 ? e1rm : e1rm / (1 + total / 30), step);
}

export function roundTo(weight: number, step: number): number {
  const s = step > 0 ? step : 5;
  return Math.max(0, Math.round(weight / s) * s);
}

const withSets = (logs: ExerciseLog[]) => logs.filter(l => Array.isArray(l.sets) && l.sets.length > 0);
const tank = (r: number) => (r < 0.5 ? 'nothing left' : `~${Math.round(r)} left in the tank`);

/**
 * What to do next session for one exercise. This is the single source of
 * truth: the UI shows it, and `planNextSession` applies it after logging.
 *
 * The method: double progression (reps first, then weight) or linear
 * progression, judged by reps in reserve; weight jumps are capped by your
 * effort-adjusted estimated max; stalls trigger a lighter week.
 */
export function getProgressionSuggestion(
  config: ExerciseConfig,
  history: ExerciseLog[],
  opts: ProgressionOptions = {},
): ProgressionSuggestion {
  const recentSessions = withSets(history);
  if (recentSessions.length === 0) {
    return { type: 'hold', message: 'No data yet. Complete your first session!' };
  }
  const st = settingsOf(config);
  const step = config.weightIncrement > 0 ? config.weightIncrement : 5;

  const latest = recentSessions[0];
  const unit = opts.bodyweight && config.currentWeight === 0 ? '' : ' lb';
  const latestMaxWeight = Math.max(...latest.sets.map(s => s.weight));
  const allSetsHitMax = latest.sets.every(s => s.reps >= config.repRangeMax);
  const allSetsHitMin = latest.sets.every(s => s.reps >= config.repRangeMin);
  const rir = avgRir(latest);
  const e1rm = opts.bodyweight ? 0 : bestRecentE1RM(recentSessions);
  const weightStr = (w: number) => (opts.bodyweight && w === 0 ? 'bodyweight' : `${w}${unit}`);
  const deload = (w: number) => roundTo(w * (1 - st.deloadPercent / 100), step);

  // ─── The plan was already adjusted after the last session ───
  const adj = config.lastAdjustment;
  if (adj && new Date(adj.at).getTime() >= new Date(latest.date).getTime()) {
    const verb = adj.type === 'deload' ? 'Deloaded' : adj.type === 'increase_reps' ? 'Rep target raised' : 'Weight increased';
    return {
      type: 'hold',
      message: `${verb} — aim for ${config.repRangeMin}–${config.repRangeMax} reps at ${weightStr(config.currentWeight)}, leaving ~${st.targetRir} in the tank.`,
      suggestedWeight: config.currentWeight,
      suggestedReps: config.repRangeMin,
      e1rm,
    };
  }

  // ─── Fatigue: same weight, effort climbing (reps in reserve falling) for 3 sessions ───
  if (recentSessions.length >= 3) {
    const sameWeight = recentSessions.slice(0, 4).filter(s => Math.max(...s.sets.map(x => x.weight)) === latestMaxWeight);
    if (sameWeight.length >= 3) {
      const rirs = sameWeight.map(avgRir);
      const climbing = rirs[0] < rirs[1] && rirs[1] < rirs[2];
      if (climbing && rir <= 0.5) {
        const w = deload(config.currentWeight);
        return {
          type: 'fatigue_warning',
          message: `Fatigue building — each session at this weight has felt harder. Take a rest day${config.currentWeight > 0 ? ` or drop to ${w} lb for a session` : ''}.`,
          suggestedWeight: config.currentWeight > 0 ? w : undefined,
          e1rm,
        };
      }
    }
  }

  // ─── Stalling: missed the rep minimum in N of the last 3 sessions ───
  const stalled = recentSessions.slice(0, 3).filter(session => session.sets.some(s => s.reps < config.repRangeMin));
  if (stalled.length >= st.stallSessions) {
    if (config.currentWeight > 0) {
      const w = deload(config.currentWeight);
      return {
        type: 'deload',
        message: `Stalled — missed ${config.repRangeMin} reps in ${stalled.length} of your last ${Math.min(3, recentSessions.length)} sessions. Drop to ${w} lb (${st.deloadPercent}% lighter), then build back up.`,
        suggestedWeight: w,
        e1rm,
      };
    }
    return {
      type: 'hold',
      message: `Reps have stalled. Rest well, keep form strict, and aim for ${config.repRangeMin} reps on every set.`,
    };
  }

  // ─── Earned progress (judged by effort, not just reps) ───
  const earned = (st.style === 'linear' ? allSetsHitMin : allSetsHitMax) && rir >= st.targetRir - 1;
  if (earned) {
    if (opts.bodyweight && config.currentWeight === 0) {
      return {
        type: 'increase_reps',
        message: `All sets at ${config.repRangeMax}+ reps with ${tank(rir)}! Raise your target to ${config.repRangeMin + 1}–${config.repRangeMax + 1} reps, or add weight.`,
        suggestedReps: config.repRangeMin + 1,
      };
    }
    // Way too easy (2+ more reps in reserve than your target)? Jump two steps —
    // but never past what your estimated max says you can do for your reps.
    const cap = prescribeWeight(e1rm, config.repRangeMin, st.targetRir, step);
    const jump = rir >= st.targetRir + 2 && cap >= config.currentWeight + 2 * step ? 2 : 1;
    const newWeight = config.currentWeight + jump * step;
    return {
      type: 'increase_weight',
      message: st.style === 'linear'
        ? `Every set hit ${config.repRangeMin}+ reps with ${tank(rir)}. Add ${jump * step} lb: ${newWeight} lb next time.`
        : `All sets at ${config.repRangeMax} reps with ${tank(rir)}. Go to ${newWeight} lb${jump > 1 ? ' (that was easy — a double step)' : ''} and aim for ${config.repRangeMin}–${config.repRangeMax} reps.`,
      suggestedWeight: newWeight,
      suggestedReps: config.repRangeMin,
      e1rm,
    };
  }

  if (st.style === 'linear' ? allSetsHitMin : allSetsHitMax) {
    return {
      type: 'hold',
      message: `Hit the reps, but with ${tank(rir)} — harder than your target of ~${st.targetRir}. Repeat ${weightStr(config.currentWeight)}; when it feels easier, you'll move up.`,
      suggestedWeight: config.currentWeight,
      e1rm,
    };
  }

  if (st.style === 'double' && allSetsHitMin) {
    const targetReps = Math.min(Math.min(...latest.sets.map(s => s.reps)) + 1, config.repRangeMax);
    return {
      type: 'increase_reps',
      message: `Good session. Add a rep per set next time: ${targetReps} reps at ${weightStr(config.currentWeight)}.`,
      suggestedReps: targetReps,
      e1rm,
    };
  }

  return {
    type: 'hold',
    message: `Stay at ${weightStr(config.currentWeight)}. Focus on hitting ${config.repRangeMin} reps on every set, leaving ~${st.targetRir} in the tank.`,
    e1rm,
  };
}

/** Plates per side for a barbell (45 lb bar), largest first. Null if it can't be made exactly. */
export function platesPerSide(total: number, bar = 45, plates = [45, 35, 25, 10, 5, 2.5]): number[] | null {
  let side = (total - bar) / 2;
  if (side < 0) return null;
  const out: number[] = [];
  for (const p of plates) while (side >= p - 1e-9) { out.push(p); side -= p; }
  return Math.abs(side) < 1e-9 ? out : null;
}

/**
 * After a session is logged: the config change to apply automatically, if any.
 * Increases are applied (you earned them); deloads are only suggested.
 */
export function planNextSession(
  config: ExerciseConfig,
  historyIncludingNew: ExerciseLog[],
  opts: ProgressionOptions = {},
  now = new Date(),
): { config: ExerciseConfig; change: 'increase_weight' | 'increase_reps' } | null {
  const s = getProgressionSuggestion({ ...config, lastAdjustment: undefined }, historyIncludingNew, opts);
  const at = now.toISOString();
  if (s.type === 'increase_weight' && s.suggestedWeight !== undefined && s.suggestedWeight > config.currentWeight) {
    return {
      change: 'increase_weight',
      config: { ...config, currentWeight: s.suggestedWeight, lastAdjustment: { type: 'increase_weight', at, from: config.currentWeight } },
    };
  }
  if (s.type === 'increase_reps' && opts.bodyweight && config.currentWeight === 0 && s.suggestedReps === config.repRangeMin + 1) {
    return {
      change: 'increase_reps',
      config: {
        ...config,
        repRangeMin: config.repRangeMin + 1,
        repRangeMax: config.repRangeMax + 1,
        lastAdjustment: { type: 'increase_reps', at, from: config.repRangeMin },
      },
    };
  }
  return null;
}

/** Apply a suggested deload chosen by the user. */
export function applyDeload(config: ExerciseConfig, weight: number, now = new Date()): ExerciseConfig {
  return { ...config, currentWeight: weight, lastAdjustment: { type: 'deload', at: now.toISOString(), from: config.currentWeight } };
}

export function getExerciseHistory(
  sessions: WorkoutSession[],
  exercise: string
): ExerciseLog[] {
  return sessions
    .flatMap(s => s.exercises.filter(e => e.exercise === exercise))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Best set per exercise. Weighted lifts: heaviest weight (then reps).
 * Bodyweight lifts: most reps (then weight) — so a weighted set with fewer
 * reps no longer replaces your max-reps record.
 */
export function getPersonalRecords(
  sessions: WorkoutSession[],
  isBodyweight: (exercise: string) => boolean = id => id === 'pull_up',
): PersonalRecord[] {
  const prMap = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const ex of session.exercises) {
      const bw = isBodyweight(ex.exercise);
      for (const set of ex.sets) {
        const current = prMap.get(ex.exercise);
        const better = !current || (bw
          ? set.reps > current.reps || (set.reps === current.reps && set.weight > current.weight)
          : set.weight > current.weight || (set.weight === current.weight && set.reps > current.reps));
        if (better) {
          prMap.set(ex.exercise, {
            exercise: ex.exercise,
            weight: set.weight,
            reps: set.reps,
            date: ex.date,
            volumeLoad: set.weight * set.reps,
          });
        }
      }
    }
  }

  return Array.from(prMap.values());
}

export function getWeeklyVolume(sessions: WorkoutSession[]): { week: string; volume: number }[] {
  const weekMap = new Map<string, number>();

  for (const session of sessions) {
    const weekKey = startOfWeekKey(dateKeyOf(session.date), 0);

    const sessionVolume = session.exercises.reduce(
      (sum, ex) => sum + calculateVolumeLoad(ex.sets), 0
    );

    weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + sessionVolume);
  }

  return Array.from(weekMap.entries())
    .map(([week, volume]) => ({ week, volume }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
