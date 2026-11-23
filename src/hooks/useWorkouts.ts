import {
  WorkoutSession, ExerciseConfig, getExerciseLabel, CustomExercise, SetLog, SplitDay,
  isBodyweightExercise, sanitizeConfig, defaultConfigFor, rpeFromRir,
} from '@/types/workout';
import { stores, generateId, type ActiveWorkout } from '@/lib/storage';
import { getExerciseHistory, getProgressionSuggestion, planNextSession, applyDeload, settingsOf, plannedWeights, progressionOptions } from '@/lib/progressive-overload';
import { useStore } from '@/hooks/useStore';
import { toast } from 'sonner';
import { checkAchievements } from '@/lib/achievements';
import { newRecordsIn } from '@/lib/insights';

const S = stores.SESSIONS;
/** Progression options for an exercise, with your bodyweight from Settings. */
export const optsFor = (exercise: string, custom: CustomExercise[] = stores.CUSTOM_EXERCISES.get()) =>
  progressionOptions(exercise, custom, stores.SETTINGS.get().bodyweight);
const CFG = stores.EXERCISE_CONFIGS;
const AW = stores.ACTIVE_WORKOUT;

export const workoutActions = {
  /** Log a session, then apply any earned progression (one source of truth: progressive-overload.ts). */
  /**
   * `quiet`: skip the toasts (the post-workout summary shows the same news).
   * Stalled lifts get their lighter week applied automatically (autopilot rule:
   * small, reversible, in-app) — the summary shows it with Undo.
   */
  addSession(session: Omit<WorkoutSession, 'id'>, customExercises: CustomExercise[] = stores.CUSTOM_EXERCISES.get(), opts: { quiet?: boolean } = {}): WorkoutSession {
    const newSession: WorkoutSession = {
      ...session,
      id: generateId(),
      exercises: session.exercises.filter(e => e.sets.length > 0),
    };
    const previous = S.get();
    S.update(list => [...list, newSession]);

    // New personal records get their own moment.
    const records = newRecordsIn(newSession, previous, customExercises);
    if (records.length > 0 && !opts.quiet) {
      toast(`🎉 New personal record${records.length > 1 ? 's' : ''}!`, {
        description: records.map(r => `${r.label} ${r.value}`).join(' · '),
        duration: 7000,
      });
    }

    const allSessions = S.get();
    const changes: string[] = [];
    CFG.update(configs => {
      let changed = false;
      const next = configs.map(config => {
        if (!newSession.exercises.some(e => e.exercise === config.exercise)) return config;
        const plan = planNextSession(config, getExerciseHistory(allSessions, config.exercise), optsFor(config.exercise, customExercises));
        if (!plan) return config;
        changed = true;
        const name = getExerciseLabel(config.exercise, customExercises);
        changes.push(plan.change === 'increase_weight'
          ? `${name} → ${isBodyweightExercise(config.exercise, customExercises) ? '+' : ''}${plan.config.currentWeight} lbs`
          : `${name} → ${plan.config.repRangeMin}–${plan.config.repRangeMax} reps`);
        return plan.config;
      });
      return changed ? next : configs;
    });

    if (changes.length > 0 && !opts.quiet) toast.success('Level up for next session 📈', { description: changes.join(' · ') });

    // Automatic lighter week for lifts that have stalled.
    CFG.update(configs => {
      let changed = false;
      const next = configs.map(config => {
        if (!newSession.exercises.some(e => e.exercise === config.exercise)) return config;
        const s = getProgressionSuggestion(config, getExerciseHistory(allSessions, config.exercise), optsFor(config.exercise, customExercises));
        if (s.type !== 'deload' || s.suggestedWeight === undefined || s.suggestedWeight >= config.currentWeight) return config;
        changed = true;
        return applyDeload(config, s.suggestedWeight);
      });
      return changed ? next : configs;
    });

    // Celebrate badges the moment they're earned (and save them with a real date).
    const { newlyUnlocked } = checkAchievements(S.get(), stores.ACHIEVEMENTS.get());
    if (newlyUnlocked.length > 0) {
      const at = new Date().toISOString();
      stores.ACHIEVEMENTS.update(prev => {
        const have = new Set(prev.map(a => a.id));
        const add = newlyUnlocked.filter(a => !have.has(a.id)).map(a => ({ id: a.id, unlockedAt: at }));
        return add.length ? [...prev, ...add] : prev;
      });
      newlyUnlocked.slice(0, 2).forEach(a => toast(`${a.icon} Badge unlocked: ${a.title}`, { description: a.description, duration: 6000 }));
    }
    return newSession;
  },

  deleteSession(id: string) {
    S.update(list => list.filter(s => s.id !== id));
  },

  restoreSession(session: WorkoutSession) {
    S.update(list => (list.some(s => s.id === session.id) ? list : [...list, session]));
  },

  updateConfig(exercise: string, updates: Partial<ExerciseConfig>) {
    CFG.update(list => list.map(c => (c.exercise === exercise ? { ...c, ...updates } : c)));
  },

  /** Clamp a config to sane values (run on blur so typing isn't interrupted). */
  sanitizeConfig(exercise: string) {
    CFG.update(list => {
      const i = list.findIndex(c => c.exercise === exercise);
      if (i < 0) return list;
      const clean = sanitizeConfig(list[i]);
      if (JSON.stringify(clean) === JSON.stringify(list[i])) return list;
      return list.map((c, j) => (j === i ? clean : c));
    });
  },

  addConfig(config: ExerciseConfig) {
    CFG.update(list => (list.some(c => c.exercise === config.exercise) ? list : [...list, sanitizeConfig(config)]));
  },

  deleteConfig(exercise: string) {
    CFG.update(list => list.filter(c => c.exercise !== exercise));
  },

  applyDeload(exercise: string, weight: number) {
    CFG.update(list => list.map(c => (c.exercise === exercise ? applyDeload(c, weight) : c)));
  },

  /** Config for an exercise, creating a sensible default if it has none. */
  ensureConfig(exercise: string, customExercises: CustomExercise[] = stores.CUSTOM_EXERCISES.get()): ExerciseConfig {
    const existing = CFG.get().find(c => c.exercise === exercise);
    if (existing) return existing;
    const created = defaultConfigFor(exercise, isBodyweightExercise(exercise, customExercises));
    CFG.update(list => [...list, created]);
    return created;
  },
};

// ─── Workout in progress (saved continuously) ────────────────────────────────

function emptyWorkout(splitDay = 'push'): ActiveWorkout {
  return { splitDay, exercises: [], notes: '', startedAt: new Date().toISOString() };
}

function updateActive(fn: (w: ActiveWorkout) => ActiveWorkout) {
  AW.update(w => fn(w ?? emptyWorkout()));
}

export const activeWorkoutActions = {
  setSplitDay(splitDay: SplitDay | string) {
    updateActive(w => ({ ...w, splitDay }));
  },

  setNotes(notes: string) {
    updateActive(w => ({ ...w, notes }));
  },

  /** Add an exercise prefilled from your last session (or your config). */
  addExercise(exercise: string, customExercises: CustomExercise[] = stores.CUSTOM_EXERCISES.get()) {
    const config = workoutActions.ensureConfig(exercise, customExercises);
    const last = getExerciseHistory(S.get(), exercise).find(l => l.sets.length > 0);
    const suggestion = getProgressionSuggestion(config, getExerciseHistory(S.get(), exercise), optsFor(exercise, customExercises));
    const tr = settingsOf(config).targetRir;
    // Prefill with exactly what the coach suggests: the planned weights (top set + back-offs if
    // chosen, a lighter comeback after time off) and target reps.
    const n = last ? Math.max(last.sets.length, config.targetSets) : config.targetSets;
    const comeback = suggestion.type === 'comeback' && suggestion.suggestedWeight !== undefined ? suggestion.suggestedWeight / Math.max(1, config.currentWeight) : 1;
    const weights = plannedWeights(config, n).map(w => (comeback < 1 ? Math.round((w * comeback) / (config.weightIncrement || 5)) * (config.weightIncrement || 5) : w));
    const sets: SetLog[] = weights.map((weight, i) => ({ reps: suggestion.suggestedReps ?? last?.sets[i]?.reps ?? config.repRangeMin, weight, rir: tr, rpe: rpeFromRir(tr) }));
    updateActive(w => ({ ...w, exercises: [...w.exercises, { id: generateId(), exercise, sets }] }));
  },

  /** Replace the whole workout (e.g. from a saved workout or today's split). */
  load(splitDay: string, exercises: { exercise: string; sets: SetLog[] }[]) {
    AW.set({ ...emptyWorkout(splitDay), exercises: exercises.map(e => ({ id: generateId(), ...e })) });
  },

  updateSet(exerciseId: string, setIdx: number, field: keyof SetLog, value: number) {
    updateActive(w => ({
      ...w,
      exercises: w.exercises.map(e => e.id !== exerciseId ? e : {
        ...e,
        sets: e.sets.map((s, i) => (i === setIdx ? { ...s, [field]: value } : s)),
      }),
    }));
  },

  /** Reps left in the tank for a set (keeps the old 1–5 effort in step). */
  setEffort(exerciseId: string, setIdx: number, rir: number) {
    updateActive(w => ({
      ...w,
      exercises: w.exercises.map(e => e.id !== exerciseId ? e : {
        ...e,
        sets: e.sets.map((s, i) => (i === setIdx ? { ...s, rir, rpe: rpeFromRir(rir) } : s)),
      }),
    }));
  },

  addSet(exerciseId: string) {
    updateActive(w => ({
      ...w,
      exercises: w.exercises.map(e => {
        if (e.id !== exerciseId) return e;
        const last = e.sets[e.sets.length - 1] ?? { reps: 8, weight: 0, rpe: 3, rir: 2 };
        return { ...e, sets: [...e.sets, { ...last }] };
      }),
    }));
  },

  removeSet(exerciseId: string, setIdx: number) {
    updateActive(w => ({
      ...w,
      exercises: w.exercises.map(e => (e.id !== exerciseId ? e : { ...e, sets: e.sets.filter((_, i) => i !== setIdx) })),
    }));
  },

  removeExercise(exerciseId: string) {
    updateActive(w => ({ ...w, exercises: w.exercises.filter(e => e.id !== exerciseId) }));
  },

  discard() {
    AW.set(null);
  },

  /** Log it as a session and clear the draft. */
  finish(customExercises?: CustomExercise[], opts: { quiet?: boolean } = {}): WorkoutSession | null {
    const w = AW.get();
    if (!w || w.exercises.length === 0) return null;
    const date = new Date().toISOString();
    const session = workoutActions.addSession({
      date,
      splitDay: w.splitDay as SplitDay,
      exercises: w.exercises.map(e => ({ exercise: e.exercise, sets: e.sets, date, notes: w.notes || undefined })),
      notes: w.notes || undefined,
    }, customExercises, opts);
    AW.set(null);
    return session;
  },
};

export function useActiveWorkout() {
  return useStore(AW);
}

export function useWorkouts(customExercises?: CustomExercise[]) {
  const sessions = useStore(S);
  const configs = useStore(CFG);
  return {
    sessions,
    configs,
    addSession: (session: Omit<WorkoutSession, 'id'>) => workoutActions.addSession(session, customExercises),
    deleteSession: workoutActions.deleteSession,
    updateConfig: workoutActions.updateConfig,
    addConfig: workoutActions.addConfig,
    deleteConfig: workoutActions.deleteConfig,
  };
}
