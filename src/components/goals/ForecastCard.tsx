import { CalendarClock } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { stores } from '@/lib/storage';
import { parseDateKey } from '@/lib/dates';
import { goalForecast, vsDeadline } from '@/lib/forecast';
import type { Goal } from '@/types/goals';
import { cn } from '@/lib/utils';

const fmt = (k: string) => parseDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: parseDateKey(k).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });

const VS = {
  ahead: { text: 'Ahead of your target date', tone: 'text-success' },
  'on-track': { text: 'On track for your target date', tone: 'text-success' },
  'at-risk': { text: 'Your target date is at risk', tone: 'text-warning' },
  behind: { text: 'Behind your target date at this pace', tone: 'text-destructive' },
} as const;

/** "At this pace: Mar 3 – Apr 10" — only when your own data supports it. */
export function ForecastCard({ goal }: { goal: Goal }) {
  const today = useTodayKey();
  const metrics = useStore(stores.METRICS);
  const f = goalForecast(goal, metrics, today);
  if (!f) return null;
  const vs = vsDeadline(f, goal.deadline);
  return (
    <section className="surface flex items-start gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><CalendarClock className="h-[18px] w-[18px]" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-footnote font-semibold text-muted-foreground">Forecast</p>
        {f.kind === 'range' ? (
          <>
            <p className="text-headline">At this pace: {fmt(f.from)} – {fmt(f.to)}</p>
            <p className="text-footnote text-muted-foreground">Most likely around {fmt(f.likely)}. {f.basis}</p>
            {vs && <p className={cn('mt-1 text-footnote font-semibold', VS[vs].tone)}>{VS[vs].text}</p>}
          </>
        ) : (
          <p className={cn('text-body', f.kind === 'done' ? 'font-semibold text-success' : 'text-muted-foreground')}>{f.basis}</p>
        )}
      </div>
    </section>
  );
}
