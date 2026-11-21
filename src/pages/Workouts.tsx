import { useSearchParams } from 'react-router-dom';
import { useStore } from '@/hooks/useStore';
import { useActiveWorkout, useWorkouts } from '@/hooks/useWorkouts';
import { stores } from '@/lib/storage';
import { PageHeader } from '@/components/app/PageHeader';
import { WorkoutView } from '@/components/gym/WorkoutView';
import { ProgressView } from '@/components/gym/ProgressView';
import { ProgramView } from '@/components/gym/ProgramView';
import { cn } from '@/lib/utils';

type Section = 'workout' | 'progress' | 'program';
const SECTIONS: [Section, string][] = [['workout', 'Workout'], ['progress', 'Progress'], ['program', 'Program']];

/** Gym: log today's workout, see progress, shape your program. */
export default function WorkoutsPage() {
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const { sessions, configs } = useWorkouts(customExercises);
  const active = useActiveWorkout();
  const [params, setParams] = useSearchParams();
  const raw = params.get('s');
  const section: Section = raw === 'progress' || raw === 'program' ? raw : 'workout';
  const go = (s: Section) => {
    setParams(s === 'workout' ? {} : { s }, { replace: true });
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-6">
      <PageHeader title="Gym" />
      <div role="tablist" aria-label="Gym sections" className="grid grid-cols-3 rounded-xl bg-secondary p-1">
        {SECTIONS.map(([s, label]) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => go(s)}
            className={cn('relative h-9 rounded-lg text-footnote font-semibold transition-colors', section === s ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
            {label}
            {s === 'workout' && active && section !== 'workout' && <span className="absolute right-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-move" aria-label="Workout in progress" />}
          </button>
        ))}
      </div>

      {section === 'workout' && <WorkoutView customExercises={customExercises} sessions={sessions} configs={configs} onGoToProgram={() => go('program')} />}
      {section === 'progress' && <ProgressView customExercises={customExercises} sessions={sessions} onStartLogging={() => go('workout')} />}
      {section === 'program' && <ProgramView customExercises={customExercises} configs={configs} onStarted={() => go('workout')} />}
    </div>
  );
}
