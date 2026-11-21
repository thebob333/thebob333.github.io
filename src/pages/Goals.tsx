import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Bookmark, ChevronDown, Plus, Sparkles, Star } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { useHabits } from '@/hooks/useHabits';
import { useWeeklyFocus } from '@/hooks/useWeeklyFocus';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import { ListRow } from '@/components/app/ListRow';
import { ProgressRing } from '@/components/ProgressRing';
import { HabitHeatmap } from '@/components/HabitHeatmap';
import { NewGoalSheet } from '@/components/goals/NewGoalSheet';
import { BlueprintsSheet } from '@/components/goals/BlueprintsSheet';
import { Button } from '@/components/ui/button';
import { domainStyle, dueText, goalSummary } from '@/lib/goal-meta';
import type { Goal } from '@/types/goals';

/** A bold card for a focus goal: gradient, next step, progress. */
function FocusCard({ goal, onOpen }: { goal: Goal; onOpen: () => void }) {
  const s = goalSummary(goal);
  const style = domainStyle(goal.domain);
  return (
    <button type="button" onClick={onOpen} className="pressable relative w-full overflow-hidden rounded-[24px] p-5 text-left text-white shadow-[0_10px_30px_-12px_rgb(60_40_200/0.45)]" style={{ background: style.gradient }}>
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between text-footnote font-semibold uppercase tracking-wider text-white/80">
          <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-white" /> Focus · {style.label}</span>
          {s.daysLeft !== null && <span>{s.daysLeft < 0 ? 'Past due' : `${s.daysLeft}d left`}</span>}
        </div>
        <h3 className="mt-2 text-[24px] font-bold leading-tight tracking-tight">{goal.title}</h3>
        <p className="mt-1 line-clamp-1 text-body text-white/85">{s.next ? `Next: ${s.next.todo.title}` : s.todosTotal ? 'All to-dos done' : 'Add tasks to get started'}</p>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white" style={{ width: `${s.progress}%` }} />
          </div>
          <span className="text-footnote font-bold tabular-nums">{s.progress}%</span>
        </div>
      </div>
    </button>
  );
}

export default function GoalsPage() {
  const { goals, templates } = useGoals();
  const { logs } = useHabits();
  const { focusIds } = useWeeklyFocus();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [blueprintsOpen, setBlueprintsOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  // Today's quick add / onboarding link here with ?new=1 to open the New Goal sheet.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get('new') === '1') {
      setNewOpen(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const active = goals.filter(g => !g.archived);
  const archived = goals.filter(g => g.archived);
  const focus = focusIds.map(id => active.find(g => g.id === id)).filter(Boolean) as Goal[];
  const others = active.filter(g => !focusIds.includes(g.id));
  const open = (g: Goal) => navigate(`/goals/${g.id}`);

  const row = (g: Goal) => {
    const s = goalSummary(g);
    const due = dueText(g.deadline);
    return (
      <ListRow
        key={g.id}
        onClick={() => open(g)}
        chevron
        muted={g.archived}
        leading={<ProgressRing value={s.progress} size={40} strokeWidth={4} />}
        title={g.title}
        subtitle={s.next ? `Next: ${s.next.todo.title}` : due ?? `${s.todosDone}/${s.todosTotal} to-dos`}
      />
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <PageHeader
        title="Goals"
        actions={
          <>
            {templates.length > 0 && (
              <HeaderButton label="Blueprints" onClick={() => setBlueprintsOpen(true)}><Bookmark className="h-[18px] w-[18px]" /></HeaderButton>
            )}
            <HeaderButton label="New goal" primary onClick={() => setNewOpen(true)}><Plus className="h-5 w-5" /></HeaderButton>
          </>
        }
      />

      {active.length === 0 && (
        <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: domainStyle().gradient }}>
          <Sparkles className="h-8 w-8" />
          <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">Turn something big into a plan.</h2>
          <p className="mt-1 text-body text-white/85">Name the goal; TELOS breaks it into phases, to-dos and daily habits.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setNewOpen(true)} className="pressable h-12 flex-1 rounded-2xl bg-white text-headline text-neutral-900">Create a goal</button>
            {templates.length > 0 && (
              <button type="button" onClick={() => setBlueprintsOpen(true)} className="pressable h-12 rounded-2xl bg-white/20 px-4 text-body font-semibold">Blueprints</button>
            )}
          </div>
        </div>
      )}

      {focus.length > 0 && (
        <section className="space-y-3">
          {focus.map(g => <FocusCard key={g.id} goal={g} onOpen={() => open(g)} />)}
        </section>
      )}

      {others.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">{focus.length ? 'More goals' : 'Your goals'}</h2>
          <div className="list-group">{others.map(row)}</div>
          {focus.length === 0 && active.length > 1 && (
            <p className="px-1 text-footnote text-muted-foreground">Tip: open a goal and tap the star to make it a focus goal.</p>
          )}
        </section>
      )}

      {archived.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowArchived(v => !v)} aria-expanded={showArchived}
            className="flex h-11 w-full items-center justify-between px-1 text-footnote font-semibold text-muted-foreground">
            Archived · {archived.length}
            <ChevronDown className={`h-4 w-4 transition-transform ${showArchived ? 'rotate-180' : ''}`} />
          </button>
          {showArchived && <div className="list-group">{archived.map(row)}</div>}
        </section>
      )}

      {active.length > 0 && <HabitHeatmap goals={goals} logs={logs} />}

      {active.length > 0 && (
        <Button variant="secondary" className="h-12 w-full rounded-2xl text-body font-semibold" onClick={() => setNewOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> New goal
        </Button>
      )}

      <NewGoalSheet open={newOpen} onClose={() => setNewOpen(false)} />
      <BlueprintsSheet open={blueprintsOpen} onClose={() => setBlueprintsOpen(false)} />
    </div>
  );
}
