import { dateKeyOf, startOfWeekKey } from '@/lib/dates';
import { ExerciseConfig, ExerciseLog, SetLog, WorkoutSession, PersonalRecord, rirOf, isBodyweightExercise, type CustomExercise } from '@/types/workout';
import { bodyFraction, bodyLoad, jumpSize, loadFor, maxFrom, strengthTrend, type LoadOptions, type StrengthTrend } from '@/lib/strength-model';

export function calculateVolumeLoad(sets: SetLog[]): number {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
}

export function calculateSetVolume(set: SetLog): number {
  return set.weight * set.reps;
}

/** Estimated one-rep max from a set taken to failure (reps-to-%-of-max chart; see strength-model.ts). */
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(maxFrom(weight, reps));
}

export interface ProgressionSuggestion {
  type: 'increase_weight' | 'hold' | 'deload' | 'increase_reps' | 'fatigue_warning' | 'comeback' | 'plateau';
  message: string;
  suggestedWeight?: number;
  suggestedReps?: number;
  e1rm?: number;
}

export interface ProgressionOptions extends LoadOptions {
  /** Bodyweight movements progress by reps rather than added weight. */
  bodyweight?: boolean;
  /** "Now", for spotting time off (defaults to the current time). */
  now?: Date;
}

/** Options for one exercise: bodyweight handling and your bodyweight. */
export function progressionOptions(exercise: string, custom: CustomExercise[] = [], bodyweightLb?: number): ProgressionOptions {
  const bodyweight = isBodyweightExercise(exercise, custom);
  return { bodyweight, bodyFraction: bodyweight ? bodyFraction(exercise, custom) : null, bodyweightLb };
}

/** Defaults for the adjustable settings (see ExerciseConfig). */
export const DEFAULTS = { style: 'double' as const, targetRir: 2, deloadPercent: 10, stallSessions: 2, scheme: 'straight' as const, backoffPercent: 10 };

export function settingsOf(c: ExerciseConfig) {
  return {
    style: c.style ?? DEFAULTS.style,
    targetRir: Math.max(0, Math.min(3, c.targetRir ?? DEFAULTS.targetRir)),
    deloadPercent: Math.max(5, Math.min(25, c.deloadPercent ?? DEFAULTS.deloadPercent)),
    stallSessions: Math.max(1, Math.min(3, c.stallSessions ?? DEFAULTS.stallSessions)),
    scheme: c.scheme ?? DEFAULTS.scheme,
    backoffPercent: Math.max(5, Math.min(20, c.backoffPercent ?? DEFAULTS.backoffPercent)),
  };
}

/** The weight for each planned set: all the same, or a top set then lighter back-offs. */
export function plannedWeights(c: ExerciseConfig, sets: number): number[] {
  const st = settingsOf(c);
  const step = c.weightIncrement > 0 ? c.weightIncrement : 5;
  const back = roundTo(c.currentWeight * (1 - st.backoffPercent / 100), step);
  return Array.from({ length: Math.max(1, sets) }, (_, i) => (st.scheme === 'topset' && i > 0 && c.currentWeight > 0 ? back : c.currentWeight));
}

/**
 * The sets progression is judged on. Top-set scheme: only the heaviest set(s);
 * back-offs are there for extra practice and volume.
 */
function judged(session: ExerciseLog, topset: boolean): SetLog[] {
  if (!topset) return session.sets;
  const top = Math.max(...session.sets.map(s => s.weight));
  return session.sets.filter(s => s.weight === top);
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
/** Average reps in reserve across a session's (judged) sets. */
const avgRir = (sets: SetLog[]) => avg(sets.map(rirOf));

/**
 * Estimated max that accounts for effort: a set of 8 with 2 left in the tank
 * is like a 10-rep max (reps + reps in reserve).
 */
export function effortE1RM(weight: number, reps: number, rir = 0, calib = 1): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(maxFrom(weight, reps + Math.max(0, rir), calib));
}

/**
 * Your current estimated max for a lift: the smoothed trend across sessions,
 * personally calibrated, counting reps left in the tank (and bodyweight for
 * bodyweight moves). `sessions` limits how much history is used.
 */
export function bestRecentE1RM(history: ExerciseLog[], sessions = 6, o: LoadOptions = {}): number {
  return Math.round(strengthTrend(withSets(history).slice(0, sessions), o).current);
}

/** The weight for `reps` reps leaving `rir` in the tank, from an estimated max (rounded to your step). */
export function prescribeWeight(e1rm: number, reps: number, rir: number, step: number, calib = 1): number {
  if (e1rm <= 0) return 0;
  return roundTo(loadFor(e1rm, Math.max(1, reps), rir, calib), step);
}

export function roundTo(weight: number, step: number): number {
  const s = step > 0 ? step : 5;
  return Math.max(0, Math.round(weight / s) * s);
}

const withSets = (logs: ExerciseLog[]) => logs.filter(l => Array.isArray(l.sets) && l.sets.length > 0);
const tank = (r: number) => (r < 0.5 ? 'nothing left' : `~${Math.round(r)} left in the tank`);
const DAY = 86400000;

/** Everything the app knows about a lift's strength, for screens that explain the numbers. */
export function liftInsight(history: ExerciseLog[], o: ProgressionOptions = {}): StrengthTrend & { bodyLoad: number } {
  return { ...strengthTrend(history, o), bodyLoad: bodyLoad(o) };
}

/**
 * What to do next session for one exercise. This is the single source of
 * truth: the UI shows it, and `planNextSession` applies it after logging.
 *
 * The method: double progression (reps first, then weight) or linear
 * progression, judged by reps in reserve. Stalls and plateaus are judged on a
 * smoothed strength trend, not one session. Jumps are a share of the load that
 * shrinks as you get stronger, capped by your personal estimated max. Time off
 * brings you back a little lighter.
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
  const topset = st.scheme === 'topset';
  const step = config.weightIncrement > 0 ? config.weightIncrement : 5;
  const now = opts.now ?? new Date();

  const latest = recentSessions[0];
  const sets = judged(latest, topset);
  const unit = opts.bodyweight && config.currentWeight === 0 ? '' : ' lb';
  const latestMaxWeight = Math.max(...latest.sets.map(s => s.weight));
  const allSetsHitMax = sets.every(s => s.reps >= config.repRangeMax);
  const allSetsHitMin = sets.every(s => s.reps >= config.repRangeMin);
  const rir = avgRir(sets);
  const body = bodyLoad(opts);
  const trend = strengthTrend(recentSessions, opts);
  const e1rm = Math.round(trend.current);
  const weightStr = (w: number) => (opts.bodyweight && w === 0 ? 'bodyweight' : `${w}${unit}`);
  const deload = (w: number) => roundTo(w * (1 - st.deloadPercent / 100), step);

  // ─── Coming back after time off ───
  const daysOff = Math.floor((now.getTime() - new Date(latest.date).getTime()) / DAY);
  if (daysOff >= 14) {
    const pct = daysOff < 28 ? 0.9 : daysOff < 56 ? 0.85 : 0.8;
    const weeks = Math.round(daysOff / 7);
    if (config.currentWeight > 0) {
      const w = roundTo(config.currentWeight * pct, step);
      return {
        type: 'comeback',
        message: `${weeks} weeks since you last did this. Ease back in at ${w} lb (${Math.round((1 - pct) * 100)}% lighter) — strength comes back fast, and you'll return to ${config.currentWeight} lb next time.`,
        suggestedWeight: w,
        suggestedReps: config.repRangeMin,
        e1rm,
      };
    }
    return {
      type: 'comeback',
      message: `${weeks} weeks since you last did this. Ease back in: aim for ${Math.max(1, config.repRangeMin - 1)}–${config.repRangeMin} reps, leaving a little extra in the tank.`,
      suggestedReps: Math.max(1, config.repRangeMin - 1),
    };
  }

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
      const rirs = sameWeight.map(s => avgRir(judged(s, topset)));
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

  // ─── Stalling: missed the rep minimum in N of the last 3 sessions, and the trend isn't climbing ───
  const stalled = recentSessions.slice(0, 3).filter(session => judged(session, topset).some(s => s.reps < config.repRangeMin));
  if (stalled.length >= st.stallSessions) {
    if (trend.rising) {
      return {
        type: 'hold',
        message: `Missed ${config.repRangeMin} reps on a set, but your strength trend is still climbing. Repeat ${weightStr(config.currentWeight)} and own it.`,
        suggestedWeight: config.currentWeight,
        e1rm,
      };
    }
    if (config.currentWeight > 0) {
      const w = deload(config.currentWeight);
      return {
        type: 'deload',
        message: `Stalled — missed ${config.repRangeMin} reps in ${stalled.length} of your last ${Math.min(3, recentSessions.length)} sessions and your strength trend has flattened. Drop to ${w} lb (${st.deloadPercent}% lighter), then build back up.`,
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
  const hitTarget = st.style === 'linear' ? allSetsHitMin : allSetsHitMax;
  const earned = hitTarget && rir >= st.targetRir - 1;
  if (earned) {
    if (opts.bodyweight && config.currentWeight === 0) {
      // Strong enough to add weight? Once you can do 12+ and we know your bodyweight, prescribe it.
      if (config.repRangeMax >= 12 && body > 0 && e1rm > 0) {
        const added = Math.max(step, prescribeWeight(e1rm, config.repRangeMin, st.targetRir, step, trend.calib) - roundTo(body, step));
        return {
          type: 'increase_weight',
          message: `${config.repRangeMax}+ reps with ${tank(rir)} — time to add weight. Try +${added} lb for ${config.repRangeMin} reps (a belt or a dumbbell between your feet).`,
          suggestedWeight: added,
          suggestedReps: config.repRangeMin,
          e1rm,
        };
      }
      return {
        type: 'increase_reps',
        message: `All sets at ${config.repRangeMax}+ reps with ${tank(rir)}! Raise your target to ${config.repRangeMin + 1}–${config.repRangeMax + 1} reps, or add weight.`,
        suggestedReps: config.repRangeMin + 1,
      };
    }

    const load = config.currentWeight + body;
    const { jump: base } = jumpSize({ load, step, exercise: config.exercise, max: e1rm, sessions: recentSessions.length, bodyweightLb: opts.bodyweightLb });
    // A jump that big a share of the load (light dumbbells): earn it with extra reps first.
    if (st.style === 'double' && base / load > 0.1 && sets.some(s => s.reps < config.repRangeMax + 2)) {
      const aim = config.repRangeMax + 2;
      return {
        type: 'increase_reps',
        message: `The next weight up (+${base} lb) is a ${Math.round((base / load) * 100)}% jump — too big to take yet. Keep adding reps: when every set hits ${aim}, move up.`,
        suggestedReps: Math.min(aim, Math.min(...sets.map(s => s.reps)) + 1),
        e1rm,
      };
    }
    // Way too easy (2+ more reps in reserve than your target) two sessions running
    // (or on your first)? Jump two — but never past what your estimated max says.
    const prevEasy = recentSessions.length === 1 || avgRir(judged(recentSessions[1], topset)) >= st.targetRir + 1;
    const cap = loadFor(e1rm, config.repRangeMin, st.targetRir, trend.calib) - body; // unrounded: never round past it
    const jump = rir >= st.targetRir + 2 && prevEasy && cap >= config.currentWeight + 2 * base ? 2 * base : base;
    const newWeight = config.currentWeight + jump;
    return {
      type: 'increase_weight',
      message: st.style === 'linear'
        ? `Every ${topset ? 'top set' : 'set'} hit ${config.repRangeMin}+ reps with ${tank(rir)}. Add ${jump} lb: ${newWeight} lb next time.`
        : `${topset ? 'Top set' : 'All sets'} at ${config.repRangeMax} reps with ${tank(rir)}. Go to ${newWeight} lb${jump > base ? ' (that was easy — a double step)' : ''} and aim for ${config.repRangeMin}–${config.repRangeMax} reps.`,
      suggestedWeight: newWeight,
      suggestedReps: config.repRangeMin,
      e1rm,
    };
  }

  if (hitTarget) {
    return {
      type: 'hold',
      message: `Hit the reps, but with ${tank(rir)} — harder than your target of ~${st.targetRir}. Repeat ${weightStr(config.currentWeight)}; when it feels easier, you'll move up.`,
      suggestedWeight: config.currentWeight,
      e1rm,
    };
  }

  // ─── Plateau: strength flat for 3+ weeks without earning anything ───
  if (trend.plateau) {
    return {
      type: 'plateau',
      message: `Your estimated max has been flat for 3+ weeks. Shake it up: switch rep range (e.g. ${config.repRangeMin <= 6 ? '8–12' : '4–6'}), add a set, or take a lighter week.`,
      suggestedWeight: config.currentWeight,
      e1rm,
    };
  }

  if (st.style === 'double' && allSetsHitMin) {
    const targetReps = Math.min(Math.min(...sets.map(s => s.reps)) + 1, config.repRangeMax);
    return {
      type: 'increase_reps',
      message: `Good session. Add a rep per ${topset ? 'top set' : 'set'} next time: ${targetReps} reps at ${weightStr(config.currentWeight)}.`,
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

// ─── Weekly sets (volume) ─────────────────────────────────────────────────

export interface VolumeAdvice { type: 'add_set' | 'drop_set'; targetSets: number; message: string }

/**
 * Whether to change the number of sets. The best-supported range for growth is
 * about 10–20 hard sets per muscle a week. Adds a set when you're below 10 (or
 * plateaued under 20) and recovering well; drops one above 20 when performance
 * is sliding. Only offered — never applied by itself.
 */
export function volumeAdvice(config: ExerciseConfig, history: ExerciseLog[], weeklySets: number | null, muscle: string | null, opts: ProgressionOptions = {}): VolumeAdvice | null {
  const logs = withSets(history);
  if (weeklySets === null || !muscle || logs.length < 2) return null;
  const st = settingsOf(config);
  const s = getProgressionSuggestion(config, logs, opts);
  const recovering = avgRir(judged(logs[0], st.scheme === 'topset')) >= st.targetRir - 0.5 && s.type !== 'deload' && s.type !== 'fatigue_warning';
  const trend = strengthTrend(logs, opts);
  if (config.targetSets < 6 && recovering && (weeklySets < 10 || (s.type === 'plateau' && weeklySets < 20))) {
    return {
      type: 'add_set',
      targetSets: config.targetSets + 1,
      message: weeklySets < 10
        ? `${cap(muscle)} got ${weeklySets} hard sets this week — below the 10–20 that grows muscle best, and you're recovering well. Add a set.`
        : `Strength is flat and ${muscle} is at ${weeklySets} sets a week — there's room for one more.`,
    };
  }
  if (config.targetSets > 2 && weeklySets > 20 && (s.type === 'deload' || s.type === 'fatigue_warning' || (trend.perWeek ?? 0) < -0.01)) {
    return {
      type: 'drop_set',
      targetSets: config.targetSets - 1,
      message: `${cap(muscle)} is at ${weeklySets} sets a week and performance is slipping — more than you're recovering from. Drop a set.`,
    };
  }
  return null;
}
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);


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
