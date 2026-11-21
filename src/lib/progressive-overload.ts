import { dateKeyOf, startOfWeekKey } from '@/lib/dates';
import { ExerciseConfig, ExerciseLog, SetLog, WorkoutSession, PersonalRecord } from '@/types/workout';

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

const DELOAD_FACTOR = 0.9; // a normal deload takes ~10% off, not 40%+

function avgRpe(session: ExerciseLog): number {
  return session.sets.reduce((s, set) => s + (set.rpe || 0), 0) / session.sets.length;
}

function bestSetE1RM(session: ExerciseLog): number {
  return Math.max(...session.sets.map(s => estimateE1RM(s.weight, s.reps)));
}

function roundTo(weight: number, step: number): number {
  const s = step > 0 ? step : 5;
  return Math.max(0, Math.round(weight / s) * s);
}

const withSets = (logs: ExerciseLog[]) => logs.filter(l => Array.isArray(l.sets) && l.sets.length > 0);

/**
 * What to do next session for one exercise. This is the single source of
 * truth: the UI shows it, and `planNextSession` applies it after logging.
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

  const latest = recentSessions[0];
  const unit = opts.bodyweight && config.currentWeight === 0 ? '' : ' lbs';
  const latestMaxWeight = Math.max(...latest.sets.map(s => s.weight));
  const allSetsHitMax = latest.sets.every(s => s.reps >= config.repRangeMax);
  const allSetsHitMin = latest.sets.every(s => s.reps >= config.repRangeMin);
  const rpe = avgRpe(latest);
  const e1rm = opts.bodyweight ? 0 : bestSetE1RM(latest);
  const e1rmStr = e1rm > 0 ? ` (e1RM: ${e1rm} lbs)` : '';
  const weightStr = (w: number) => (opts.bodyweight && w === 0 ? 'bodyweight' : `${w}${unit}`);

  // ─── The plan was already adjusted after the last session ───
  const adj = config.lastAdjustment;
  if (adj && new Date(adj.at).getTime() >= new Date(latest.date).getTime()) {
    const verb = adj.type === 'deload' ? 'Deloaded' : adj.type === 'increase_reps' ? 'Rep target raised' : 'Weight increased';
    return {
      type: 'hold',
      message: `${verb} — aim for ${config.repRangeMin}–${config.repRangeMax} reps at ${weightStr(config.currentWeight)}.${e1rmStr}`,
      suggestedWeight: config.currentWeight,
      suggestedReps: config.repRangeMin,
      e1rm,
    };
  }

  // ─── Fatigue (RPE climbing across 3 sessions at the same weight) ───
  if (recentSessions.length >= 3) {
    const sameWeight = recentSessions.slice(0, 4).filter(s => Math.max(...s.sets.map(x => x.weight)) === latestMaxWeight);
    if (sameWeight.length >= 3) {
      const rpes = sameWeight.map(avgRpe);
      const climbing = rpes[0] > rpes[1] && rpes[1] > rpes[2];
      if (climbing && rpe >= 4.5) {
        const deloadWeight = roundTo(config.currentWeight * DELOAD_FACTOR, config.weightIncrement);
        return {
          type: 'fatigue_warning',
          message: `Fatigue building — effort climbing across sessions (${rpes.slice(0, 3).map(r => r.toFixed(1)).join(' → ')}). Take a rest day${config.currentWeight > 0 ? ` or drop to ${deloadWeight} lbs for a session` : ''}.${e1rmStr}`,
          suggestedWeight: config.currentWeight > 0 ? deloadWeight : undefined,
          e1rm,
        };
      }
    }
  }

  // ─── Stalling (2 of the last 3 sessions missed the minimum reps) ───
  const stalled = recentSessions.slice(0, 3).filter(session => session.sets.some(s => s.reps < config.repRangeMin));
  if (stalled.length >= 2) {
    if (config.currentWeight > 0) {
      const deloadWeight = roundTo(config.currentWeight * DELOAD_FACTOR, config.weightIncrement);
      return {
        type: 'deload',
        message: `Stalled for a couple of sessions. Drop to ${deloadWeight} lbs (about 10% lighter), then build back up.${e1rmStr}`,
        suggestedWeight: deloadWeight,
        e1rm,
      };
    }
    return {
      type: 'hold',
      message: `Reps have stalled. Rest well, keep form strict, and aim for ${config.repRangeMin} reps on every set.`,
    };
  }

  // ─── Every set hit the top of the range with effort to spare ───
  if (allSetsHitMax && rpe <= 4) {
    if (opts.bodyweight && config.currentWeight === 0) {
      return {
        type: 'increase_reps',
        message: `All sets at ${config.repRangeMax}+ reps (effort ${rpe.toFixed(1)})! Raise your target to ${config.repRangeMin + 1}–${config.repRangeMax + 1} reps, or add weight.`,
        suggestedReps: config.repRangeMin + 1,
      };
    }
    const newWeight = config.currentWeight + config.weightIncrement;
    return {
      type: 'increase_weight',
      message: `All sets at ${config.repRangeMax} reps (effort ${rpe.toFixed(1)})! Increase to ${newWeight} lbs and reset to ${config.repRangeMin} reps.${e1rmStr}`,
      suggestedWeight: newWeight,
      suggestedReps: config.repRangeMin,
      e1rm,
    };
  }

  if (allSetsHitMax) {
    return {
      type: 'hold',
      message: `Hit max reps but effort was high (${rpe.toFixed(1)}). Repeat at ${weightStr(config.currentWeight)} — when it feels easier, you'll progress.${e1rmStr}`,
      suggestedWeight: config.currentWeight,
      e1rm,
    };
  }

  if (allSetsHitMin) {
    const targetReps = Math.min(Math.min(...latest.sets.map(s => s.reps)) + 1, config.repRangeMax);
    return {
      type: 'increase_reps',
      message: `Good work at effort ${rpe.toFixed(1)}! Add 1 rep per set next time. Target: ${targetReps} reps at ${weightStr(config.currentWeight)}.${e1rmStr}`,
      suggestedReps: targetReps,
      e1rm,
    };
  }

  return {
    type: 'hold',
    message: `Stay at ${weightStr(config.currentWeight)}. Focus on hitting ${config.repRangeMin} reps on every set (effort ${rpe.toFixed(1)}).${e1rmStr}`,
    e1rm,
  };
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
