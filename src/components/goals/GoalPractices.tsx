import { useMemo } from 'react';
import { ChevronRight, RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { stores } from '@/lib/storage';
import { addDays } from '@/lib/dates';
import { doneBetween, inRestart, loadLabel, maxPerWeekOf, perWeekOf, weekStart, weeksOnTarget } from '@/lib/practice';
import type { Goal, Habit } from '@/types/goals';
import type { EditTarget } from './EditItemDialog';
import { cn } from '@/lib/utils';

/** Five little bars: this week's sessions against the target. */
function WeekDots({ done, of }: { done: number; of: number }) {
  return (
    <span className="flex gap-1" aria-label={`${done} of ${of} this week`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={cn('h-1.5 w-4 rounded-full', i < done ? 'bg-habits' : 'bg-secondary')} />
      ))}
    </span>
  );
}

/**
 * The goal's recurring practices with their live load: what you're doing now,
 * what it's building toward, this week so far, consistency over recent weeks,
 * and the engine's latest change (with its reason).
 */
export function GoalPractices({ goal, onEdit, onAdd }: { goal: Goal; onEdit: (t: EditTarget) => void; onAdd?: () => void }) {
  const today = useTodayKey();
  const logs = useStore(stores.HABIT_LOGS);
  const adjustments = useStore(stores.ADJUSTMENTS);
  const practices = useMemo(() => goal.phases.flatMap(p => p.tasks.flatMap(t => (t.habits ?? []).map(h => ({ h, phaseId: p.id, taskId: t.id, task: t.title })))), [goal]);
  if (practices.length === 0) {
    if (!onAdd || !['keep', 'better', 'become'].includes(goal.shape ?? '')) return null;
    return (
      <section className="surface p-4">
        <p className="text-headline">Add a practice</p>
        <p className="mt-1 text-footnote text-muted-foreground">Something you do each week, like "run 3×/week" or "write 20 minutes". The plan steps it up when you're on a roll and eases off when life gets busy.</p>
        <button type="button" onClick={onAdd} className="pressable mt-3 h-10 rounded-full bg-primary px-4 text-footnote font-semibold text-primary-foreground">Add practice</button>
      </section>
    );
  }
  const ws = weekStart(today);

  const lastChange = (h: Habit) => adjustments
    .filter(a => a.habitId === h.id && (a.status === 'applied' || a.status === 'pending'))
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="section-label">Practices</h2>
        <span className="text-footnote text-muted-foreground">adapts weekly</span>
      </div>
      <div className="list-group">
        {practices.map(({ h, phaseId, taskId }) => {
          const pw = perWeekOf(h);
          const done = Math.min(pw, doneBetween(h.id, logs, ws, addDays(ws, 6)));
          const consistency = weeksOnTarget(h, logs, today);
          const change = lastChange(h);
          const restart = inRestart(h, today);
          const max = maxPerWeekOf(h);
          return (
            <button key={h.id} type="button" onClick={() => onEdit({ kind: 'habit', goalId: goal.id, phaseId, taskId, habit: h })}
              className={cn('flex w-full items-start gap-3 px-4 py-3 text-left active:bg-accent/70', !h.active && 'opacity-50')}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-body font-semibold">{h.title}</p>
                  <p className="shrink-0 text-footnote font-semibold tabular-nums">{loadLabel(h)}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <WeekDots done={done} of={Math.min(pw, 7)} />
                  <p className="text-footnote text-muted-foreground">
                    {consistency.of > 0 ? `On target ${consistency.hit} of last ${consistency.of} wks` : 'New this week'}
                    {max > pw ? ` · building to ${max === 7 ? 'daily' : `${max}×`}` : ''}
                  </p>
                </div>
                {restart ? (
                  <p className="mt-1.5 flex items-center gap-1 text-footnote text-primary"><RotateCcw className="h-3.5 w-3.5" /> Restart week: {h.minimum || 'just a few minutes'}</p>
                ) : change ? (
                  <p className={cn('mt-1.5 flex items-start gap-1 text-footnote', change.kind === 'up' ? 'text-success' : change.kind === 'ease' ? 'text-warning' : 'text-muted-foreground')}>
                    {change.kind === 'up' ? <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                    <span className="line-clamp-2">{change.status === 'pending' ? 'Suggested: ' : ''}{change.reason}</span>
                  </p>
                ) : h.minimum ? (
                  <p className="mt-1.5 text-footnote text-muted-foreground">Easy version: {h.minimum}</p>
                ) : null}
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/60" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
