import { Plus, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomExercise, EXERCISE_LABELS, SplitDay, getExerciseLabel } from '@/types/workout';
import {
  PLAN_DAYS, SPLIT_OPTIONS, addPlanExercise, removePlanExercise, setDaySplit, useWeeklyPlan,
} from '@/hooks/useWeeklyPlan';
import { useTodayKey } from '@/hooks/useToday';
import { dayOfWeek } from '@/lib/dates';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  customExercises: CustomExercise[];
  onStartDay: (splitDay: string, exercises: string[]) => void;
}

/** Your weekly training split — what you train each day. Lives in Gym, next to logging. */
export function WeeklySplitEditor({ customExercises, onStartDay }: Props) {
  const { days } = useWeeklyPlan();
  const todayIdx = (dayOfWeek(useTodayKey()) + 6) % 7;
  const allExercises = [
    ...Object.keys(EXERCISE_LABELS),
    ...customExercises.map(e => e.id),
  ];

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick what you train each day. Today and Plan use this to show your workout, and Start fills in every exercise for you.
      </p>
      {days.map((d, idx) => {
        const isToday = idx === todayIdx;
        const available = allExercises.filter(e => !d.exercises.includes(e));
        return (
          <div key={d.day} className={`rounded-xl border bg-card p-3 shadow-sm ${isToday ? 'border-primary/40 ring-1 ring-primary/15' : ''}`}>
            <div className="flex items-center gap-2">
              <div className="w-20 shrink-0">
                <p className="text-sm font-semibold">{PLAN_DAYS[idx].slice(0, 3)}</p>
                {isToday && <p className="text-[11px] font-medium text-primary">Today</p>}
              </div>
              <Select value={d.splitDay} onValueChange={v => setDaySplit(idx, v as SplitDay)}>
                <SelectTrigger className="h-10 flex-1" aria-label={`${PLAN_DAYS[idx]} split`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPLIT_OPTIONS.map(s => <SelectItem key={s} value={s}>{cap(s)}</SelectItem>)}
                </SelectContent>
              </Select>
              {d.splitDay !== 'rest' && (
                <Button size="icon" variant={isToday ? 'default' : 'outline'} className="h-10 w-10 shrink-0" aria-label={`Start ${PLAN_DAYS[idx]}'s workout`} onClick={() => onStartDay(d.splitDay, d.exercises)}>
                  <Play className="h-4 w-4" />
                </Button>
              )}
            </div>
            {d.splitDay !== 'rest' && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {d.exercises.map(ex => (
                  <span key={ex} className="inline-flex h-8 items-center gap-1 rounded-full border bg-background pl-3 pr-1 text-xs font-medium">
                    {getExerciseLabel(ex, customExercises)}
                    <button type="button" aria-label={`Remove ${getExerciseLabel(ex, customExercises)}`} onClick={() => removePlanExercise(idx, ex)} className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {available.length > 0 && (
                  <Select value="" onValueChange={v => v && addPlanExercise(idx, v)}>
                    <SelectTrigger className="h-8 w-auto gap-1 rounded-full border-dashed px-3 text-xs" aria-label="Add exercise">
                      <Plus className="h-3.5 w-3.5" /> <span>Add</span>
                    </SelectTrigger>
                    <SelectContent>
                      {available.map(ex => <SelectItem key={ex} value={ex}>{getExerciseLabel(ex, customExercises)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
