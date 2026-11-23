import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { activeWorkoutActions, workoutActions } from '@/hooks/useWorkouts';
import { calculateVolumeLoad } from '@/lib/progressive-overload';
import { fmtLb, sessionVolume, splitLabel } from '@/lib/gym-format';
import { getExerciseLabel, rirOf, type CustomExercise, type WorkoutSession } from '@/types/workout';


/** One past session: every set, notes, repeat or delete. */
export function SessionSheet({ session, customExercises, onClose, onRepeat }: {
  session: WorkoutSession | null;
  customExercises: CustomExercise[];
  onClose: () => void;
  /** Called after the session is loaded as the current workout. */
  onRepeat?: () => void;
}) {
  if (!session) return null;
  const date = new Date(session.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const repeat = () => {
    activeWorkoutActions.load(session.splitDay, session.exercises.map(e => ({ exercise: e.exercise, sets: e.sets.map(s => ({ ...s })) })));
    onClose();
    onRepeat?.();
    toast.success('Loaded — adjust and go');
  };
  const remove = () => {
    const removed = session;
    workoutActions.deleteSession(session.id);
    onClose();
    toast.success('Session deleted', { action: { label: 'Undo', onClick: () => workoutActions.restoreSession(removed) } });
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">{splitLabel(session.splitDay)} day</DialogTitle>
          <DialogDescription>{date} · {fmtLb(sessionVolume(session))} lb moved</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto">
          {session.notes && <p className="rounded-xl bg-secondary px-3 py-2 text-footnote">{session.notes}</p>}
          {session.exercises.map((ex, i) => (
            <div key={i} className="list-group">
              <div className="flex items-baseline justify-between px-4 py-2.5">
                <p className="text-headline">{getExerciseLabel(ex.exercise, customExercises)}</p>
                <p className="text-footnote text-muted-foreground">{fmtLb(calculateVolumeLoad(ex.sets))} lb</p>
              </div>
              {ex.sets.map((s, j) => (
                <div key={j} className="flex items-center gap-3 px-4 py-2 text-body tabular-nums">
                  <span className="w-12 text-footnote text-muted-foreground">Set {j + 1}</span>
                  <span className="flex-1 font-medium">{s.weight ? `${s.weight} lb × ${s.reps}` : `${s.reps} reps`}</span>
                  <span className="text-footnote text-muted-foreground">{rirOf(s)} left</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-12 flex-1 rounded-xl text-body" onClick={repeat}><RotateCcw className="mr-2 h-4 w-4" /> Do again</Button>
          <Button variant="secondary" className="h-12 rounded-xl px-4 text-destructive" aria-label="Delete session" onClick={remove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
