import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { activeWorkoutActions } from '@/hooks/useWorkouts';
import { ListRow } from '@/components/app/ListRow';
import { getExerciseLabel, isBodyweightExercise, isBuiltInExercise, type CustomExercise, type ExerciseConfig } from '@/types/workout';
import { WeeklySplitEditor } from './WeeklySplitEditor';
import { ExerciseSheet } from './ExerciseSheet';
import { splitLabel } from '@/lib/gym-format';

export function ProgramView({ customExercises, configs, onStarted }: {
  customExercises: CustomExercise[];
  configs: ExerciseConfig[];
  onStarted: () => void;
}) {
  const [edit, setEdit] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const visible = configs
    .filter(c => !customExercises.find(e => e.id === c.exercise)?.archived)
    .sort((a, b) => getExerciseLabel(a.exercise, customExercises).localeCompare(getExerciseLabel(b.exercise, customExercises)));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="section-label">Your week</h2>
        <p className="px-1 text-footnote text-muted-foreground">What you train each day. Today, Plan and the Workout tab all follow this.</p>
        <WeeklySplitEditor
          customExercises={customExercises.filter(e => !e.archived)}
          onStartDay={(splitDay, exercises) => {
            activeWorkoutActions.load(splitDay, []);
            exercises.forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
            onStarted();
            toast.success(`${splitLabel(splitDay)} day started`);
          }}
        />
      </section>

      <section className="space-y-2">
        <h2 className="section-label">Exercises & targets</h2>
        <p className="px-1 text-footnote text-muted-foreground">TELOS raises these automatically when you hit the top of the rep range. Tap one to change it.</p>
        <div className="list-group">
          {visible.map(c => {
            const bw = isBodyweightExercise(c.exercise, customExercises);
            return (
              <ListRow
                key={c.exercise}
                chevron
                onClick={() => setEdit(c.exercise)}
                title={getExerciseLabel(c.exercise, customExercises)}
                subtitle={`${c.targetSets} sets × ${c.repRangeMin}–${c.repRangeMax} reps${isBuiltInExercise(c.exercise) ? '' : ' · custom'}`}
                trailing={bw && !c.currentWeight
                  ? <span className="text-footnote text-muted-foreground">Bodyweight</span>
                  : <span className="text-headline tabular-nums">{bw ? `+${c.currentWeight}` : c.currentWeight}<span className="ml-0.5 text-footnote font-normal text-muted-foreground"> lb</span></span>}
              />
            );
          })}
          <ListRow onClick={() => setCreating(true)} leading={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-move/10 text-move"><Plus className="h-4 w-4" /></span>} title="Add a custom exercise" />
        </div>
      </section>

      <ExerciseSheet open={!!edit} exerciseId={edit} onClose={() => setEdit(null)} />
      <ExerciseSheet open={creating} exerciseId={null} onClose={() => setCreating(false)} />
    </div>
  );
}
