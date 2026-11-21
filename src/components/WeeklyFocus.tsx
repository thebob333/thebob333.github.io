import { Goal, calculateGoalProgress } from '@/types/goals';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { ProgressRing } from '@/components/ProgressRing';
import { Star } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  goals: Goal[];
}

export function WeeklyFocus({ goals }: Props) {
  const { focusIds } = useWeeklyFocus();
  // Deleted goals simply drop out here; deleteGoal also removes them from storage.
  const focusGoals = focusIds
    .map(id => goals.find(g => g.id === id))
    .filter((g): g is Goal => Boolean(g) && !g.archived);

  if (focusGoals.length === 0) return null;

  return (
    <div className="rounded-xl bg-gradient-to-r from-violet/5 to-primary/5 border border-violet/20 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Star className="h-4 w-4 text-violet fill-violet" />
        <p className="text-xs text-violet uppercase tracking-widest font-semibold">Weekly Focus</p>
      </div>
      <div className="space-y-2">
        {focusGoals.map(goal => {
          const progress = calculateGoalProgress(goal);
          return (
            <div key={goal.id} className="flex items-center gap-3">
              <ProgressRing value={progress} size={32} strokeWidth={3} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{goal.title}</p>
                <div className="w-full bg-border rounded-full h-1.5 mt-1">
                  <div
                    className="bg-violet h-1.5 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
              <span className="text-xs font-semibold text-violet">{progress}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FocusStar({ goalId }: { goalId: string; goals?: Goal[] }) {
  const { focusIds, toggle: toggleFocus, max } = useWeeklyFocus();
  const isFocused = focusIds.includes(goalId);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const result = toggleFocus(goalId);
    if (result === 'full') toast(`You can focus on ${max} goals at a time`, { description: 'Unstar one to make room.' });
  };

  return (
    <button
      onClick={toggle}
      className="p-0.5 hover:scale-110 transition-transform"
      aria-pressed={isFocused}
      aria-label={isFocused ? 'Remove from weekly focus' : 'Add to weekly focus'}
      title={isFocused ? 'Remove from weekly focus' : focusIds.length >= max ? `Max ${max} focus goals` : 'Add to weekly focus'}
    >
      <Star className={`h-4 w-4 ${isFocused ? 'text-violet fill-violet' : 'text-muted-foreground/40 hover:text-violet/60'}`} />
    </button>
  );
}
