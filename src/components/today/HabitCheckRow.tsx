import { Check, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface CheckRowProps {
  done: boolean;
  title: string;
  /** Why this matters — e.g. the goal and task a habit belongs to. */
  context?: string;
  right?: ReactNode;
  onToggle: () => void;
  tone?: 'habit' | 'todo';
}

/** One big, fully-tappable row with a round check. Used for habits and to-dos everywhere. */
export function CheckRow({ done, title, context, right, onToggle, tone = 'habit' }: CheckRowProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      onClick={onToggle}
      className="flex min-h-[48px] w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition-colors active:bg-accent/60"
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all',
          done
            ? tone === 'habit' ? 'border-amber bg-amber text-white' : 'border-primary bg-primary text-primary-foreground'
            : tone === 'habit' ? 'border-amber/60' : 'border-muted-foreground/40',
        )}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[15px] leading-tight', done && 'text-muted-foreground line-through')}>{title}</span>
        {context && <span className="block truncate text-xs text-muted-foreground">{context}</span>}
      </span>
      {right && <span className="shrink-0">{right}</span>}
    </button>
  );
}

export function StreakBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  return (
    <span className="flex items-center gap-0.5 text-xs font-semibold text-amber" aria-label={`${days} day streak`}>
      <Flame className="h-3.5 w-3.5" />{days}
    </span>
  );
}
