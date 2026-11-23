/**
 * Day Zero: turns the architect's design into a living goal, switches routes
 * without losing finished work, and folds in redesigns. Pure (ids and time are
 * passed in); tested in day-zero.test.ts.
 */
import { addDays, type DateKey } from '@/lib/dates';
import { frequencyFor } from '@/lib/practice';
import { applySchedule, buildPath, DEFAULT_HOURS_PER_WEEK, type PathPlan } from '@/lib/path';
import type { DayZeroPlan, ArchRoute } from '@/lib/ai/schemas';
import type { Architecture, BlueprintTask, Goal, Habit, Phase, Route, Task, ToDo } from '@/types/goals';

type NewId = () => string;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pos = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);
const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** The architect's route → a stored blueprint (keys made unique and links checked). */
export function toRoute(r: ArchRoute, newId: NewId): Route {
  const seen = new Set<string>();
  const stages = r.stages.map(st => ({
    title: st.title.trim() || 'Stage',
    description: st.description ?? '',
    tasks: st.tasks.map((t): BlueprintTask => {
      let key = (t.key || '').trim() || newId();
      while (seen.has(key)) key = `${key}_`;
      seen.add(key);
      return {
        key, title: t.title.trim() || 'Task', description: t.description ?? '',
        effortHours: clamp(Number(t.effortHours) || 2, 0.25, 400),
        waitDays: clamp(Math.round(Number(t.waitDays) || 0), 0, 365),
        dependsOn: t.dependsOn ?? [], milestone: !!t.milestone,
        steps: (t.steps ?? []).map(x => (typeof x === 'string' ? x : '').trim()).filter(Boolean).map(title => ({ title, minutes: null })),
        practices: [],
      };
    }),
    practices: (st.practices ?? []).map((p): BlueprintTask['practices'][number] => ({
      title: p.title, perWeek: p.perWeek, buildToPerWeek: p.buildToPerWeek, easyVersion: p.easyVersion,
      // A session length becomes a growable amount (+5 min when on target).
      amount: pos(p.minutes) ?? null, unit: pos(p.minutes) ? 'min' : null, step: pos(p.minutes) ? 5 : null, maxAmount: null, details: null,
    })),
  }));
  const keys = new Set(stages.flatMap(s => s.tasks.map(t => t.key)));
  for (const s of stages) for (const t of s.tasks) t.dependsOn = [...new Set(t.dependsOn.filter(k => k !== t.key && keys.has(k)))];
  // Stage practices ride on the stage's first task.
  return {
    id: newId(), name: r.name.trim() || 'Route', summary: r.summary ?? '', tradeoff: r.tradeoff ?? '',
    stages: stages.map(({ practices, ...st }) => ({
      ...st,
      tasks: st.tasks.map((t, i) => (i === 0 ? { ...t, practices } : t)),
    })),
  };
}

function practiceHabit(p: BlueprintTask['practices'][number], today: DateKey, newId: NewId): Habit {
  const perWeek = clamp(p.perWeek || 1, 1, 7);
  const amount = pos(p.amount);
  return {
    id: newId(), title: p.title.trim() || 'Practice', active: true,
    perWeek, maxPerWeek: Math.max(perWeek, clamp(p.buildToPerWeek || perWeek, 1, 7)), frequency: frequencyFor(perWeek),
    ...(amount !== undefined ? { amount, unit: p.unit?.trim() || undefined, step: pos(p.step), maxAmount: pos(p.maxAmount) } : {}),
    minimum: p.easyVersion?.trim() || undefined, target: p.details?.trim() || undefined,
    auto: true, since: today,
  };
}

/** A route blueprint → real stages, tasks (with links), steps and practices. */
export function materialize(route: Route, today: DateKey, newId: NewId): Phase[] {
  const idOf = new Map<string, string>();
  for (const s of route.stages) for (const t of s.tasks) idOf.set(t.key, newId());
  return route.stages.map((st, i) => ({
    id: newId(), title: st.title, description: st.description, order: i,
    tasks: st.tasks.map((t, j): Task => ({
      id: idOf.get(t.key)!, title: t.title, description: t.description, status: 'not_started', order: j,
      effortHours: t.effortHours, waitDays: t.waitDays || undefined, milestone: t.milestone || undefined,
      dependsOn: t.dependsOn.map(k => idOf.get(k)!).filter(Boolean),
      todos: t.steps.map((s, k): ToDo => ({ id: newId(), title: s.title, done: false, order: k, estimateMin: s.minutes ?? undefined })),
      habits: t.practices.map(p => practiceHabit(p, today, newId)),
    })),
  }));
}

const hasProgress = (t: Task) => t.status === 'complete' || (t.todos ?? []).some(td => td.done);

/**
 * Put new stages in place of old ones without losing anything you've done:
 * tasks and practices with the same name keep their ids (so check-ins and
 * links survive) and their finished steps; finished work that the new plan
 * doesn't mention is kept in a "Done so far" stage.
 */
export function carryOver(oldPhases: Phase[], fresh: Phase[], newId: NewId): Phase[] {
  const oldTasks = oldPhases.flatMap(p => p.tasks);
  const oldHabits = oldTasks.flatMap(t => t.habits ?? []);
  const usedTasks = new Set<string>();
  const usedHabits = new Set<string>();
  const remap = new Map<string, string>(); // fresh task id → kept old id

  const next = fresh.map(p => ({
    ...p,
    tasks: p.tasks.map(t => {
      const match = oldTasks.find(o => !usedTasks.has(o.id) && norm(o.title) === norm(t.title));
      const habits = (t.habits ?? []).map(h => {
        const old = oldHabits.find(o => !usedHabits.has(o.id) && norm(o.title) === norm(h.title));
        if (!old) return h;
        usedHabits.add(old.id);
        return { ...h, id: old.id, perWeek: old.perWeek ?? h.perWeek, amount: old.amount ?? h.amount, since: old.since ?? h.since, frequency: old.frequency };
      });
      if (!match) return { ...t, habits };
      usedTasks.add(match.id);
      remap.set(t.id, match.id);
      const doneOld = (match.todos ?? []).filter(td => td.done);
      const todos = [
        ...doneOld,
        ...(t.todos ?? []).filter(td => !doneOld.some(d => norm(d.title) === norm(td.title))),
      ].map((td, k) => ({ ...td, order: k }));
      return { ...t, id: match.id, notes: match.notes, todos, habits };
    }),
  }));
  for (const p of next) for (const t of p.tasks) if (t.dependsOn) t.dependsOn = t.dependsOn.map(d => remap.get(d) ?? d);

  // Finished work and practices the new plan dropped.
  const leftovers = oldTasks.filter(o => !usedTasks.has(o.id) && hasProgress(o)).map(o => ({ ...o, todos: (o.todos ?? []).filter(td => td.done), dependsOn: [], habits: [] }));
  const keptHabits = oldHabits.filter(h => !usedHabits.has(h.id) && h.active);
  if (leftovers.length || keptHabits.length) {
    if (keptHabits.length) leftovers.push({ id: newId(), title: 'Practices', description: '', status: 'in_progress', order: leftovers.length, todos: [], habits: keptHabits, dependsOn: [] });
    next.unshift({ id: newId(), title: 'Done so far', description: 'Finished work from earlier plans.', order: -1, tasks: leftovers.map((t, i) => ({ ...t, order: i })) });
  }
  return next.map((p, i) => ({ ...p, order: i }));
}

const fmt = (k: DateKey) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

/** Schedule a goal and write it in. */
function scheduled(goal: Goal, today: DateKey): { goal: Goal; plan: PathPlan } {
  const plan = buildPath(goal, today);
  return { goal: applySchedule(goal, plan).goal, plan };
}

export interface ArchitectOptions {
  brief: string;
  hoursPerWeek: number;
  deadline?: DateKey;
  sources?: { title: string; url: string }[];
  today: DateKey;
  now: Date;
  newId: NewId;
  /** Which route to start on (index into plan.routes); defaults to the recommendation. */
  routeIndex?: number;
}

/**
 * Apply a Day Zero design. With `existing`, the goal is redesigned in place
 * (finished work kept); otherwise a new goal is created.
 */
export function architect(plan: DayZeroPlan, opts: ArchitectOptions, existing?: Goal): Goal {
  const routes = plan.routes.map(r => toRoute(r, opts.newId));
  if (!routes.length) throw new Error('The design came back without a route.');
  const idx = clamp(opts.routeIndex ?? plan.recommendedRoute ?? 0, 0, routes.length - 1);
  const active = routes[idx];
  const fresh = materialize(active, opts.today, opts.newId);
  const first = plan.firstStep?.trim();
  if (first) {
    const t0 = fresh.flatMap(p => p.tasks).find(t => !(t.dependsOn ?? []).length);
    if (t0 && !t0.todos.some(td => norm(td.title) === norm(first))) {
      t0.todos = [{ id: opts.newId(), title: first, done: false, order: 0, estimateMin: 30 }, ...t0.todos.map(td => ({ ...td, order: td.order + 1 }))];
    }
  }
  const phases = existing ? carryOver(existing.phases, fresh, opts.newId) : fresh;
  const hoursPerWeek = clamp(opts.hoursPerWeek || plan.suggestedHoursPerWeek || DEFAULT_HOURS_PER_WEEK, 0.5, 80);
  const nowIso = opts.now.toISOString();
  const arch: Architecture = {
    brief: opts.brief.trim(),
    strategy: plan.strategy,
    research: plan.research?.trim() || existing?.architect?.research,
    sources: opts.sources?.length ? opts.sources : existing?.architect?.sources,
    assumptions: plan.assumptions,
    risks: plan.risks,
    routes,
    activeRouteId: active.id,
    createdAt: existing?.architect?.createdAt ?? nowIso,
    autopilot: existing?.architect?.autopilot ?? true,
    history: existing?.architect?.history ?? [],
    undo: existing ? { at: nowIso, phases: existing.phases, activeRouteId: existing.architect?.activeRouteId } : undefined,
  };
  const base: Goal = existing
    ? { ...existing, phases, hoursPerWeek, architect: arch, ifThen: [...new Set([...(existing.ifThen ?? []), ...plan.ifThen.map(s => s.trim()).filter(Boolean)])] }
    : {
      id: opts.newId(), title: plan.title.trim() || opts.brief.trim().slice(0, 60), description: '', endGoal: opts.brief.trim(),
      createdAt: nowIso, phases, shape: plan.shape, status: 'active', pushback: 'honest', why: plan.why?.trim() || undefined,
      metric: plan.shape === 'better' && plan.metricName?.trim() ? { name: plan.metricName.trim(), unit: plan.metricUnit ?? '', target: pos(plan.metricTarget), higherIsBetter: !!plan.metricHigherIsBetter } : undefined,
      deadline: opts.deadline ?? (plan.targetDateDays && plan.targetDateDays > 0 ? addDays(opts.today, plan.targetDateDays) : undefined),
      ifThen: plan.ifThen.map(s => s.trim()).filter(Boolean),
      hoursPerWeek, architect: arch,
    };
  const { goal, plan: path } = scheduled(base, opts.today);
  const note = existing
    ? `Redesigned on the "${active.name}" route.${path.finish ? ` Likely finish: ${fmt(path.finish)}.` : ''}`
    : `Designed by Day Zero on the "${active.name}" route.${path.finish ? ` Likely finish: ${fmt(path.finish)}.` : ''}`;
  return { ...goal, architect: { ...goal.architect!, history: [...arch.history, { id: opts.newId(), at: nowIso, note, finish: path.finish ?? undefined, seen: true, kind: existing ? 'coach' as const : 'route' as const }].slice(-30) } };
}

/** Switch to another stored route, keeping everything you've finished. */
export function switchRoute(goal: Goal, routeId: string, today: DateKey, now: Date, newId: NewId): Goal {
  const a = goal.architect;
  const route = a?.routes.find(r => r.id === routeId);
  if (!a || !route || a.activeRouteId === routeId) return goal;
  const phases = carryOver(goal.phases, materialize(route, today, newId), newId);
  const { goal: next, plan } = scheduled({ ...goal, phases }, today);
  return {
    ...next,
    architect: {
      ...a,
      activeRouteId: routeId,
      undo: { at: now.toISOString(), phases: goal.phases, activeRouteId: a.activeRouteId },
      history: [...a.history, { id: newId(), at: now.toISOString(), note: `Switched to the "${route.name}" route.${plan.finish ? ` Likely finish: ${fmt(plan.finish)}.` : ''}`, finish: plan.finish ?? undefined, seen: true, kind: 'route' as const }].slice(-30),
    },
  };
}

/** What each route would take (same hours, no learned pace — a fair comparison). */
export function compareRoutes(goal: Goal, today: DateKey, hoursPerWeek?: number): { route: Route; plan: PathPlan; active: boolean }[] {
  const a = goal.architect;
  if (!a) return [];
  let n = 0;
  const tempId = () => `cmp${++n}`;
  return a.routes.map(route => {
    const active = route.id === a.activeRouteId;
    const phases = active ? goal.phases : carryOver(goal.phases, materialize(route, today, tempId), tempId);
    return { route, active, plan: buildPath({ ...goal, phases }, today, { hoursPerWeek, ignorePace: true }) };
  });
}

/** A compact description of where a goal stands, for a redesign. */
export function goalStateText(goal: Goal, today: DateKey): string {
  const plan = buildPath(goal, today);
  const lines = [
    `Goal: ${goal.title}${goal.deadline ? ` (target ${goal.deadline})` : ''}`,
    goal.architect ? `Route so far: ${goal.architect.routes.find(r => r.id === goal.architect!.activeRouteId)?.name ?? 'custom'}` : '',
    `Hours a week planned: ${plan.hoursPerWeek}${plan.paceKnown ? `; real pace lately ≈ ${Math.round(plan.pace * 100)}% of that` : ''}.`,
    plan.finish ? `Likely finish at this rate: ${plan.finish}.` : '',
    'Tasks:',
    ...plan.nodes.map(n => `- [${n.state}] ${n.title} — ${n.effort}h${n.remaining && n.state !== 'done' ? `, ${n.remaining}h left` : ''}${n.deps.length ? `, after: ${n.deps.map(d => plan.nodes.find(x => x.id === d)?.title).filter(Boolean).join('; ')}` : ''}`),
  ];
  return lines.filter(Boolean).join('\n');
}

/** Undo the last automatic or route change. */
export function undoLastChange(goal: Goal, now: Date, newId: NewId): Goal {
  const a = goal.architect;
  if (!a?.undo) return goal;
  return {
    ...goal,
    phases: a.undo.phases,
    architect: { ...a, activeRouteId: a.undo.activeRouteId ?? a.activeRouteId, undo: undefined, history: [...a.history, { id: newId(), at: now.toISOString(), note: 'Last plan change undone.', seen: true, kind: 'auto' as const }].slice(-30) },
  };
}
