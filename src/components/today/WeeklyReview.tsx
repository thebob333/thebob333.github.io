import { useMemo } from 'react';
import { CalendarCheck, Dumbbell, Flame, Star, Trophy, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { ProgressRing } from '@/components/ProgressRing';
import { useGoals } from '@/hooks/useGoals';
import { useHabits } from '@/hooks/useHabits';
import { useStore } from '@/hooks/useStore';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { updateSettings } from '@/hooks/useSettings';
import { stores } from '@/lib/storage';
import { summarizeWeek } from '@/lib/insights';
import { addDays, dayOfWeek, parseDateKey, startOfWeekKey, type DateKey } from '@/lib/dates';

/** The week to review: Monday looks back at last week; any other day shows this week (Mon–Sun). */
export function reviewWeekStart(today: DateKey): DateKey {
  const monday = startOfWeekKey(today, 1);
  return dayOfWeek(today) === 1 ? addDays(monday, -7) : monday;
}

export function isReviewDue(today: DateKey, lastReviewWeek?: string): boolean {
  const dow = dayOfWeek(today);
  if (dow !== 0 && dow !== 1) return false; // Sunday evening / Monday morning ritual
  return lastReviewWeek !== reviewWeekStart(today);
}

const fmt = (k: DateKey) => parseDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export function WeeklyReview({ open, onClose, today }: { open: boolean; onClose: () => void; today: DateKey }) {
  const { goals } = useGoals();
  const { logs } = useHabits();
  const sessions = useStore(stores.SESSIONS);
  const custom = useStore(stores.CUSTOM_EXERCISES);
  const { focusIds, toggle, max } = useWeeklyFocus();
  const start = reviewWeekStart(today);
  const w = useMemo(() => summarizeWeek(start, goals, logs, sessions, custom), [start, goals, logs, sessions, custom]);
  const habitPct = w.habitsDue ? Math.round((w.habitsDone / w.habitsDue) * 100) : 0;

  const finish = () => {
    updateSettings({ lastReviewWeek: start });
    toast.success('Week reviewed — have a great one', { description: focusIds.length ? `Focusing on ${focusIds.length} goal${focusIds.length > 1 ? 's' : ''} this week.` : undefined });
    onClose();
  };

  const stat = (icon: React.ReactNode, value: string | number, label: string) => (
    <div className="flex flex-col items-center gap-1 rounded-xl border bg-background p-3 text-center">
      {icon}
      <span className="text-xl font-bold leading-none">{value}</span>
      <span className="text-[11px] leading-tight text-muted-foreground">{label}</span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Your week · {fmt(w.start)}–{fmt(w.end)}</DialogTitle>
          <DialogDescription>A quick look back, then choose what matters most next week.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2">
            {stat(<Flame className="h-4 w-4 text-amber" />, `${habitPct}%`, 'habits done')}
            {stat(<CalendarCheck className="h-4 w-4 text-success" />, `${w.perfectDays}/7`, 'perfect days')}
            {stat(<Dumbbell className="h-4 w-4 text-primary" />, w.workouts, w.workouts === 1 ? 'workout' : 'workouts')}
            {stat(<Target className="h-4 w-4 text-violet" />, `${w.practicesOnTarget}/${w.practices}`, 'practices on target')}
            {stat(<Trophy className="h-4 w-4 text-coral" />, w.newPRs.length, w.newPRs.length === 1 ? 'new record' : 'new records')}
            {stat(<Dumbbell className="h-4 w-4 text-muted-foreground" />, w.volume >= 10000 ? `${Math.round(w.volume / 1000)}k` : w.volume.toLocaleString(), 'lbs lifted')}
          </div>

          {w.newPRs.length > 0 && (
            <div className="rounded-xl bg-coral/10 p-3 text-sm">
              <p className="font-semibold">🎉 Records this week</p>
              <p className="text-muted-foreground">{w.newPRs.map(p => `${p.label} ${p.value}`).join(' · ')}</p>
            </div>
          )}

          {w.goals.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Star className="h-4 w-4 text-violet" /> Focus for next week</p>
              <p className="mb-2 text-xs text-muted-foreground">Pick up to {max}. They'll sit at the top of Today.</p>
              <div className="space-y-1.5">
                {w.goals.map(g => {
                  const on = focusIds.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { if (toggle(g.id) === 'full') toast(`You can focus on ${max} goals at a time`); }}
                      className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${on ? 'border-violet/50 bg-violet/10' : 'bg-background'}`}
                    >
                      <ProgressRing value={g.progress} size={32} strokeWidth={3} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{g.title}</span>
                      <Star className={`h-5 w-5 ${on ? 'fill-violet text-violet' : 'text-muted-foreground/40'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button className="h-11 w-full font-semibold" onClick={finish}>Finish review</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
