import { useMemo, useState } from 'react';
import { ChevronDown, PartyPopper } from 'lucide-react';
import { toast } from 'sonner';
import { ProgressRing } from '@/components/ProgressRing';
import { CheckRow, StreakBadge } from './HabitCheckRow';
import type { FlatHabit } from '@/lib/habits';

export interface ChecklistTodo {
  todoId: string;
  title: string;
  goalId: string;
  goalTitle: string;
  phaseId: string;
  taskId: string;
  taskTitle?: string;
  days: number; // days until due (negative = overdue)
}

interface Props {
  habits: (FlatHabit & { completed: boolean; streak: number })[];
  todos: ChecklistTodo[];
  onToggleHabit: (habitId: string) => void;
  onToggleTodo: (t: ChecklistTodo) => void;
}

function dueLabel(days: number) {
  if (days < 0) return <span className="text-xs font-semibold text-destructive">{Math.abs(days)}d late</span>;
  if (days === 0) return <span className="text-xs font-semibold text-primary">Today</span>;
  if (days === 1) return <span className="text-xs text-muted-foreground">Tomorrow</span>;
  return <span className="text-xs text-muted-foreground">in {days}d</span>;
}

/**
 * Everything to do today in one list: habits (with the goal they serve) and
 * to-dos that are due or late. Upcoming to-dos sit in a collapsible section.
 */
export function TodayChecklist({ habits, todos, onToggleHabit, onToggleTodo }: Props) {
  const [showUpcoming, setShowUpcoming] = useState(false);
  const dueNow = useMemo(() => todos.filter(t => t.days <= 0), [todos]);
  const upcoming = useMemo(() => todos.filter(t => t.days > 0), [todos]);

  // Unfinished first, finished sink to the bottom.
  const sortedHabits = useMemo(() => [...habits].sort((a, b) => Number(a.completed) - Number(b.completed)), [habits]);
  const total = habits.length + dueNow.length;
  const done = habits.filter(h => h.completed).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const allDone = total > 0 && done === total;

  if (habits.length === 0 && todos.length === 0) return null;

  const toggleTodo = (t: ChecklistTodo) => {
    onToggleTodo(t);
    toast.success(`Done: ${t.title}`, { action: { label: 'Undo', onClick: () => onToggleTodo(t) } });
  };

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="Today's checklist">
      <div className="mb-2 flex items-center gap-3">
        <ProgressRing value={pct} size={44} strokeWidth={4} />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">Today</h2>
          <p className="text-xs text-muted-foreground">
            {allDone ? 'Everything done — great work.' : total === 0 ? 'Nothing due today.' : `${done} of ${total} done`}
          </p>
        </div>
        {allDone && <PartyPopper className="h-6 w-6 text-amber" aria-hidden />}
      </div>

      <div className="divide-y divide-border/60">
        {dueNow.map(t => (
          <CheckRow
            key={t.todoId}
            tone="todo"
            done={false}
            title={t.title}
            context={t.goalTitle}
            right={dueLabel(t.days)}
            onToggle={() => toggleTodo(t)}
          />
        ))}
        {sortedHabits.map(h => (
          <CheckRow
            key={h.habit.id}
            done={h.completed}
            title={h.habit.target ? `${h.habit.title} · ${h.habit.target}` : h.habit.title}
            context={`${h.goalTitle} · ${h.taskTitle}`}
            right={<StreakBadge days={h.streak} />}
            onToggle={() => onToggleHabit(h.habit.id)}
          />
        ))}
      </div>

      {upcoming.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <button
            type="button"
            onClick={() => setShowUpcoming(v => !v)}
            className="flex h-10 w-full items-center justify-between text-sm font-medium text-muted-foreground"
            aria-expanded={showUpcoming}
          >
            Coming up this week ({upcoming.length})
            <ChevronDown className={`h-4 w-4 transition-transform ${showUpcoming ? 'rotate-180' : ''}`} />
          </button>
          {showUpcoming && (
            <div className="divide-y divide-border/60">
              {upcoming.map(t => (
                <CheckRow key={t.todoId} tone="todo" done={false} title={t.title} context={t.goalTitle} right={dueLabel(t.days)} onToggle={() => toggleTodo(t)} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
