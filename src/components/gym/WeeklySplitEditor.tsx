import { useState } from 'react';
import { ChevronDown, Play, Plus, X } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CustomExercise, SplitDay, getExerciseLabel } from '@/types/workout';
import { PLAN_DAYS, SPLIT_OPTIONS, addPlanExercise, removePlanExercise, setDaySplit, useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { useTodayKey } from '@/hooks/useToday';
import { dayOfWeek } from '@/lib/dates';
import { ExercisePicker } from './ExercisePicker';
import { cn } from '@/lib/utils';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Props {
  customExercises: CustomExercise[];
  /** Start a given day's workout now (e.g. doing Tuesday's on Monday). */
  onStartDay?: (splitDay: string, exercises: string[]) => void;
}

/** Your weekly training split — what you train each day. Today and Plan read it. */
export function WeeklySplitEditor({ customExercises, onStartDay }: Props) {
  const { days } = useWeeklyPlan();
  const todayIdx = (dayOfWeek(useTodayKey()) + 6) % 7;
  const [addingTo, setAddingTo] = useState<number | null>(null);

  return (
    <>
      <div className="list-group">
        {days.map((d, idx) => {
          const isToday = idx === todayIdx;
          const rest = d.splitDay === 'rest';
          return (
            <div key={d.day} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-12 shrink-0">
                  <p className={cn('text-headline', isToday && 'text-move')}>{PLAN_DAYS[idx].slice(0, 3)}</p>
                  {isToday && <p className="text-[11px] font-bold uppercase tracking-wide text-move">Today</p>}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger aria-label={`${PLAN_DAYS[idx]} training`}
                    className={cn('flex h-9 items-center gap-1 rounded-full px-3.5 text-footnote font-semibold', rest ? 'bg-secondary text-muted-foreground' : 'bg-move/10 text-move')}>
                    {cap(d.splitDay)} <ChevronDown className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {SPLIT_OPTIONS.map(s => <DropdownMenuItem key={s} className="h-10 text-body" onSelect={() => setDaySplit(idx, s as SplitDay)}>{cap(s)}</DropdownMenuItem>)}
                  </DropdownMenuContent>
                </DropdownMenu>
                <span className="flex-1" />
                {!rest && onStartDay && (
                  <button type="button" aria-label={`Start ${PLAN_DAYS[idx]}'s workout now`} onClick={() => onStartDay(d.splitDay, d.exercises)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-move">
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                )}
              </div>
              {!rest && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-[60px]">
                  {d.exercises.map(ex => (
                    <span key={ex} className="inline-flex h-8 items-center gap-0.5 rounded-full bg-secondary pl-3 pr-1 text-footnote font-medium">
                      {getExerciseLabel(ex, customExercises)}
                      <button type="button" aria-label={`Remove ${getExerciseLabel(ex, customExercises)}`} onClick={() => removePlanExercise(idx, ex)} className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <button type="button" onClick={() => setAddingTo(idx)} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-move/50 px-3 text-footnote font-semibold text-move">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <ExercisePicker
        open={addingTo !== null}
        onClose={() => setAddingTo(null)}
        title={addingTo !== null ? `Add to ${PLAN_DAYS[addingTo]}` : 'Add exercise'}
        customExercises={customExercises}
        exclude={addingTo !== null ? days[addingTo].exercises : []}
        onPick={id => addingTo !== null && addPlanExercise(addingTo, id)}
      />
    </>
  );
}
