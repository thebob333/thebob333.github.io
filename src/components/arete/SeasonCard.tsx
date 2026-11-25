import { Check, Sparkles } from 'lucide-react';
import { AREAS } from '@/lib/arete/tree';
import { SEASON_COMPLETE_XP, daysLeftInMonth, monthName, type Season } from '@/lib/arete/progress';
import type { DateKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

/** This month's season: the featured area and four quests, with progress and XP. */
export function SeasonCard({ season, today, onFeatured }: { season: Season; today: DateKey; onFeatured: () => void }) {
  const area = AREAS.find(a => a.id === season.featured)!;
  const left = daysLeftInMonth(today);
  const done = season.quests.filter(q => q.done).length;
  return (
    <section className="surface overflow-hidden">
      <div className="flex items-center gap-3 px-4 pt-3.5">
        <div className="min-w-0 flex-1">
          <p className="text-footnote font-semibold uppercase tracking-wide text-muted-foreground">Season · {monthName(season.month)}</p>
          <p className="text-headline">{season.complete ? 'Season complete' : `${done} of ${season.quests.length} quests done`}</p>
        </div>
        <span className="shrink-0 text-footnote tabular-nums text-muted-foreground">{left === 0 ? 'Last day' : `${left} day${left === 1 ? '' : 's'} left`}</span>
      </div>
      <button type="button" onClick={onFeatured} className="mx-4 mt-2.5 flex w-[calc(100%-2rem)] items-center gap-2 rounded-xl px-3 py-2 text-left"
        style={{ background: `hsl(${area.hue} / 0.12)` }}>
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: `hsl(${area.hue})` }} />
        <span className="min-w-0 flex-1 text-footnote"><b style={{ color: `hsl(${area.hue})` }}>{area.name}</b> is featured: its stations earn 1.5× XP this month.</span>
      </button>
      <div className="mt-2 divide-y divide-border/60">
        {season.quests.map(q => (
          <div key={q.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', q.done ? 'bg-success text-white' : 'bg-secondary text-muted-foreground')}>
              {q.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <span className="text-[11px] font-bold tabular-nums">{q.progress}/{q.target}</span>}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block text-body font-medium', q.done && 'text-muted-foreground line-through decoration-muted-foreground/40')}>{q.title}</span>
              <span className="block truncate text-footnote text-muted-foreground">{q.detail}</span>
            </span>
            <span className={cn('shrink-0 text-footnote font-semibold tabular-nums', q.done ? 'text-success' : 'text-muted-foreground')}>+{q.xp}</span>
          </div>
        ))}
      </div>
      <p className="border-t border-border/60 px-4 py-2.5 text-footnote text-muted-foreground">
        {season.complete ? `All done: +${SEASON_COMPLETE_XP} XP season bonus earned.` : `Finish all four for a +${SEASON_COMPLETE_XP} XP season bonus. New quests every month.`}
      </p>
    </section>
  );
}
