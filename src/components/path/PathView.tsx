import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, Clock, ExternalLink, Flag, History, Lock, Route as RouteIcon, Sparkles, Target, Undo2, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { goalActions } from '@/hooks/useGoals';
import { stores } from '@/lib/storage';
import { applySchedule, buildPath, pathDate, type PathNode } from '@/lib/path';
import { compareRoutes, switchRoute, undoLastChange } from '@/lib/day-zero';
import { daysBetween, type DateKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';
import { cn } from '@/lib/utils';
import { PathMap } from './PathMap';

const HOURS = [2, 3, 5, 7, 10, 15, 20];

const STATUS_TEXT = {
  ahead: { label: 'Ahead of your target', tone: 'text-success', bg: 'bg-success/10' },
  'on-track': { label: 'On track for your target', tone: 'text-success', bg: 'bg-success/10' },
  'at-risk': { label: 'Your target is at risk', tone: 'text-warning', bg: 'bg-warning/10' },
  behind: { label: 'Behind your target at this pace', tone: 'text-destructive', bg: 'bg-destructive/10' },
} as const;

const weeksText = (days: number) => (days < 14 ? `${days} days` : days < 70 ? `${Math.round(days / 7)} weeks` : `${Math.round(days / 30)} months`);

/** Save a goal change and re-schedule it (so the steps' dates follow). */
function saveScheduled(goal: Goal, today: DateKey) {
  const { goal: next } = applySchedule(goal, buildPath(goal, today));
  stores.GOALS.update(goals => goals.map(g => (g.id === goal.id ? next : g)));
}

/**
 * The Path: where you'll land, what's holding you back, the map, and the
 * choices that change it (routes and hours a week).
 */
export function PathView({ goal, today, onOpenTask, onRethink }: {
  goal: Goal;
  today: DateKey;
  onOpenTask: (node: PathNode) => void;
  onRethink?: () => void;
}) {
  const [hours, setHours] = useState<number | null>(null); // what-if, before saving
  const [preview, setPreview] = useState<string | null>(null); // route id being previewed
  const [showStrategy, setShowStrategy] = useState(false);
  const a = goal.architect;
  const plan = useMemo(() => buildPath(goal, today, hours ? { hoursPerWeek: hours } : {}), [goal, today, hours]);
  const routes = useMemo(() => (a && a.routes.length > 1 ? compareRoutes(goal, today, hours ?? undefined) : []), [goal, a, today, hours]);
  const shown = preview ? routes.find(r => r.route.id === preview) : null;
  const mapPlan = shown && !shown.active ? shown.plan : plan;
  const status = plan.vsDeadline ? STATUS_TEXT[plan.vsDeadline] : null;
  const b = plan.bottleneck;
  const base = goal.hoursPerWeek ?? plan.hoursPerWeek;
  const unseen = (a?.history ?? []).filter(h => !h.seen);

  const setGoalHours = (h: number) => {
    setHours(null);
    saveScheduled({ ...goal, hoursPerWeek: h }, today);
    toast.success(`${h} hours a week`, { description: 'The Path is re-planned around it.' });
  };
  const doSwitch = (routeId: string) => {
    const before = goal;
    const next = switchRoute(goal, routeId, today, new Date(), () => crypto.randomUUID());
    stores.GOALS.update(goals => goals.map(g => (g.id === goal.id ? next : g)));
    setPreview(null);
    toast.success('Route switched', { description: 'Finished work was kept.', action: { label: 'Undo', onClick: () => goalActions.restoreGoal(before) } });
  };
  const markSeen = () => {
    if (!a || !unseen.length) return;
    goalActions.updateGoal(goal.id, { architect: { ...a, history: a.history.map(h => ({ ...h, seen: true })) } });
  };

  if (!plan.nodes.length) {
    return <p className="py-8 text-center text-footnote text-muted-foreground">Add tasks with steps to this goal and its path appears here.</p>;
  }

  return (
    <div className="space-y-4">
      {/* What changed */}
      {unseen.length > 0 && (
        <div className="rounded-2xl bg-info/10 p-3">
          <p className="flex items-center gap-1.5 text-footnote font-semibold text-info"><History className="h-4 w-4" /> Plan updated</p>
          {unseen.slice(-2).map(h => <p key={h.id} className="mt-0.5 text-footnote">{h.note}</p>)}
          <div className="mt-2 flex gap-2">
            <button type="button" className="h-8 rounded-full bg-card px-3 text-footnote font-semibold" onClick={markSeen}>Got it</button>
            {a?.undo && (
              <button type="button" className="flex h-8 items-center gap-1 rounded-full bg-card px-3 text-footnote font-semibold" onClick={() => {
                stores.GOALS.update(goals => goals.map(g => (g.id === goal.id ? undoLastChange(g, new Date(), () => crypto.randomUUID()) : g)));
                toast.success('Change undone');
              }}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
            )}
          </div>
        </div>
      )}

      {/* Where you'll land */}
      <div className="grid grid-cols-3 gap-2">
        <div className="surface col-span-2 px-3 py-3">
          <p className="text-footnote text-muted-foreground">Likely finish</p>
          <p className="text-[24px] font-bold leading-7 tracking-tight">{plan.finish ? pathDate(plan.finish, today) : 'Done 🎉'}</p>
          {plan.early && plan.late && plan.early !== plan.late && (
            <p className="text-footnote text-muted-foreground">range {pathDate(plan.early, today)} – {pathDate(plan.late, today)}</p>
          )}
        </div>
        <div className="surface px-3 py-3">
          <p className="text-footnote text-muted-foreground">Left</p>
          <p className="text-[24px] font-bold leading-7 tracking-tight tabular-nums">{Math.round(plan.remainingHours)}h</p>
          <p className="text-footnote text-muted-foreground">of {Math.round(plan.totalHours)}h</p>
        </div>
      </div>

      {status && (
        <div className={cn('flex items-start gap-2.5 rounded-2xl p-3', status.bg)}>
          <Target className={cn('mt-0.5 h-4 w-4 shrink-0', status.tone)} />
          <div className="min-w-0 flex-1">
            <p className={cn('text-body font-semibold', status.tone)}>{status.label}</p>
            <p className="text-footnote text-muted-foreground">
              Target {pathDate(plan.deadline!, today)}
              {plan.finish && plan.deadline && plan.finish > plan.deadline ? ` · about ${weeksText(daysBetween(plan.deadline, plan.finish))} late` : ''}
              {plan.neededHours ? ` · ${plan.neededHours} h a week would make it` : ''}
            </p>
          </div>
          {plan.neededHours && !hours && (
            <button type="button" className="h-8 shrink-0 rounded-full bg-card px-3 text-footnote font-semibold" onClick={() => setHours(plan.neededHours)}>Try it</button>
          )}
        </div>
      )}

      {/* Holding you back */}
      {b && (
        <button type="button" onClick={() => onOpenTask(b)} className="pressable surface flex w-full items-start gap-3 p-3 text-left">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning"><Zap className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-footnote font-semibold text-muted-foreground">What matters most right now</span>
            <span className="block text-body font-semibold">{b.title}</span>
            <span className="block text-footnote text-muted-foreground">
              {[b.critical && 'sets your finish date', b.downstream > 0 && `${b.downstream} step${b.downstream === 1 ? '' : 's'} wait on it`, b.waitDays > 0 && `then ${b.waitDays} days of waiting — start early`, `${b.remaining}h left`].filter(Boolean).join(' · ')}
            </span>
          </span>
        </button>
      )}

      {/* The map */}
      <div className="surface overflow-hidden py-2">
        {shown && !shown.active && <p className="px-3 pb-1 text-footnote font-semibold text-primary">Previewing "{shown.route.name}"</p>}
        <PathMap plan={mapPlan} today={today} onSelect={shown && !shown.active ? undefined : onOpenTask} ghost={!!shown && !shown.active} />
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 pt-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full border-2 border-warning" /> sets the finish date</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 rounded-full bg-success" /> done</span>
          <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> waiting on something</span>
          <span className="flex items-center gap-1"><span className="h-0 w-4 border-t-2 border-dotted border-muted-foreground" /> waiting time</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-4 rounded bg-primary/15" /> likely landing zone</span>
        </div>
      </div>

      {/* Hours a week */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-footnote font-semibold text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Hours a week</p>
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...HOURS, base])].sort((x, y) => x - y).map(h => {
            const on = (hours ?? base) === h;
            return (
              <button key={h} type="button" aria-pressed={on} onClick={() => setHours(h === base ? null : h)}
                className={cn('pressable h-9 min-w-[44px] rounded-full px-3 text-footnote font-semibold tabular-nums', on ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                {h}
              </button>
            );
          })}
        </div>
        {hours !== null && hours !== base && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary/70 px-3 py-2">
            <p className="min-w-0 flex-1 text-footnote">At {hours} h/week you'd likely finish <b>{plan.finish ? pathDate(plan.finish, today) : '—'}</b>.</p>
            <button type="button" className="h-8 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground" onClick={() => setGoalHours(hours)}>Use it</button>
          </div>
        )}
        <p className="mt-1.5 text-footnote text-muted-foreground">
          {plan.paceKnown && Math.abs(plan.pace - 1) > 0.05
            ? `Dates use your real pace lately (about ${Math.round(plan.pace * 100)}% of ${plan.hoursPerWeek} h). Estimates usually run long, so a margin is built in.`
            : 'Estimates usually run long, so a margin is built in. After three weeks, your real pace takes over.'}
        </p>
      </div>

      {/* Routes */}
      {routes.length > 1 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-footnote font-semibold text-muted-foreground"><RouteIcon className="h-3.5 w-3.5" /> Routes</p>
          <div className="space-y-2">
            {routes.map(({ route, plan: rp, active }) => {
              const previewing = preview === route.id;
              return (
                <div key={route.id} className={cn('surface p-3', active && 'ring-2 ring-primary/60', previewing && !active && 'ring-2 ring-primary/30')}>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-body font-semibold">{route.name}{active && <span className="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Current</span>}</p>
                    <p className="shrink-0 text-footnote tabular-nums text-muted-foreground">{rp.finish ? pathDate(rp.finish, today) : 'done'} · {Math.round(rp.remainingHours)}h</p>
                  </div>
                  <p className="mt-0.5 text-footnote text-muted-foreground">{route.summary}</p>
                  {route.tradeoff && <p className="mt-0.5 text-footnote"><span className="text-muted-foreground">Trade-off:</span> {route.tradeoff}</p>}
                  {!active && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="h-8 rounded-full bg-secondary px-3 text-footnote font-semibold" onClick={() => setPreview(previewing ? null : route.id)}>{previewing ? 'Hide preview' : 'Preview on map'}</button>
                      <button type="button" className="h-8 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground" onClick={() => doSwitch(route.id)}>Switch</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy and research */}
      {a && (
        <div className="surface p-3">
          <button type="button" onClick={() => setShowStrategy(s => !s)} className="flex w-full items-center gap-2 text-left">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="flex-1 text-body font-semibold">Strategy</span>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', showStrategy && 'rotate-180')} />
          </button>
          {!showStrategy && <p className="mt-1 line-clamp-2 text-footnote text-muted-foreground">{a.strategy}</p>}
          {showStrategy && (
            <div className="mt-2 space-y-3 text-footnote">
              <p className="text-body">{a.strategy}</p>
              {a.research && <div><p className="font-semibold text-muted-foreground">What the research found</p><p>{a.research}</p></div>}
              {a.sources && a.sources.length > 0 && (
                <div className="space-y-1">
                  {a.sources.map(s => (
                    <a key={s.url} href={s.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-primary">
                      <ExternalLink className="h-3 w-3 shrink-0" /><span className="truncate">{s.title || s.url}</span>
                    </a>
                  ))}
                </div>
              )}
              {a.assumptions.length > 0 && (
                <div><p className="font-semibold text-muted-foreground">Assumes</p><ul className="ml-4 list-disc">{a.assumptions.map(x => <li key={x}>{x}</li>)}</ul></div>
              )}
              {a.risks.length > 0 && (
                <div className="space-y-1">
                  <p className="font-semibold text-muted-foreground">Risks and what the plan does</p>
                  {a.risks.map(r => <p key={r.risk} className="flex gap-1.5"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /><span><b>{r.risk}</b> — {r.mitigation}</span></p>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Keep it current */}
      <div className="space-y-2">
        {a && (
          <label className="surface flex items-center gap-3 p-3">
            <span className="min-w-0 flex-1">
              <span className="block text-body font-medium">Autopilot</span>
              <span className="block text-footnote text-muted-foreground">When you slip or get ahead, re-plan the dates and tell you. Your own dates and the target never move.</span>
            </span>
            <Switch checked={a.autopilot} onCheckedChange={v => goalActions.updateGoal(goal.id, { architect: { ...a, autopilot: v } })} />
          </label>
        )}
        {onRethink && (
          <button type="button" onClick={onRethink} className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-body font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> {a ? 'Something changed — rethink the plan' : 'Design this with Day Zero'}
          </button>
        )}
      </div>

      {a && a.history.length > 0 && (
        <details className="text-footnote">
          <summary className="cursor-pointer font-semibold text-muted-foreground"><Flag className="mr-1 inline h-3.5 w-3.5" />Plan history</summary>
          <ul className="mt-2 space-y-1.5">
            {[...a.history].reverse().slice(0, 12).map(h => (
              <li key={h.id} className="flex gap-2">
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">{new Date(h.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <span>{h.note}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
