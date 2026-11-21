import { WorkoutSession, ExerciseConfig, getExerciseLabel, CustomExercise } from '@/types/workout';
import { stores, generateId } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { toast } from 'sonner';

const S = stores.SESSIONS;
const CFG = stores.EXERCISE_CONFIGS;

export const workoutActions = {
  addSession(session: Omit<WorkoutSession, 'id'>, customExercises: CustomExercise[] = stores.CUSTOM_EXERCISES.get()): WorkoutSession {
    const newSession = { ...session, id: generateId() };
    S.update(list => [...list, newSession]);

    // Auto-update configs based on performance
    const bumped: string[] = [];
    CFG.update(configs => {
      let changed = false;
      const next = configs.map(config => {
        const log = session.exercises.find(e => e.exercise === config.exercise);
        if (!log || log.sets.length === 0) return config;
        const allHitMax = log.sets.every(s => s.reps >= config.repRangeMax);
        const avgRpe = log.sets.reduce((s, set) => s + set.rpe, 0) / log.sets.length;
        if (allHitMax && avgRpe <= 4) {
          bumped.push(config.exercise);
          changed = true;
          return { ...config, currentWeight: config.currentWeight + config.weightIncrement };
        }
        return config;
      });
      return changed ? next : configs;
    });

    if (bumped.length > 0) {
      const labels = bumped.map(e => getExerciseLabel(e, customExercises)).join(', ');
      toast.success(`Weight increased for next session: ${labels} 📈`);
    }
    return newSession;
  },

  deleteSession(id: string) {
    S.update(list => list.filter(s => s.id !== id));
  },

  updateConfig(exercise: string, updates: Partial<ExerciseConfig>) {
    CFG.update(list => list.map(c => (c.exercise === exercise ? { ...c, ...updates } : c)));
  },

  addConfig(config: ExerciseConfig) {
    CFG.update(list => (list.some(c => c.exercise === config.exercise) ? list : [...list, config]));
  },

  deleteConfig(exercise: string) {
    CFG.update(list => list.filter(c => c.exercise !== exercise));
  },
};

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
