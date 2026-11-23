/**
 * The Path engine: turns a goal's tasks into a schedule you can see.
 *
 * - Effort: each task's hands-on hours (set by Day Zero or you, else estimated
 *   from its steps), minus what's already done.
 * - Dependencies: explicit "needs first" links, or — when a goal has none —
 *   stages in order.
 * - Critical chain: the longest chain of work + waiting (critical path method).
 *   Its length is the fastest the goal could possibly go.
 * - Schedule: one person working `hoursPerWeek`, always on the ready task that
 *   heads the longest remaining chain (a classic list-scheduling rule), with
 *   waiting time (replies, shipping) respected between tasks.
 * - Honest dates: estimates usually run long (the planning fallacy), so the
 *   likely date assumes ~15% more work than planned, and the range runs from
 *   10% less to 50% more. After three weeks, your real pace replaces the
 *   promised hours.
 *
 * Pure functions — no storage. Tested in path.test.ts.
 */
import { addDays, daysBetween, dateKeyOf, type DateKey } from '@/lib/dates';
import type { Goal, Phase, Task, ToDo } from '@/types/goals';

export const DEFAULT_HOURS_PER_WEEK = 5;
const UNESTIMATED_STEP_MIN = 45;
const MAX_DAYS = 365 * 4;

export type NodeState = 'done' | 'active' | 'ready' | 'blocked';

export interface PathNode {
  id: string;
  phaseId: string;
  phaseIndex: number;
  phaseTitle: string;
  title: string;
  milestone: boolean;
  /** Total hands-on hours. */
  effort: number;
  /** Hours still to do. */
  remaining: number;
  progress: number; // 0–1
  waitDays: number;
  deps: string[];
  dependents: string[];
  /** How many tasks are waiting on this one, directly or further down the line. */
  downstream: number;
  state: NodeState;
  /** On the chain that sets the earliest possible finish. */
  critical: boolean;
  /** Planned window (likely case). Done tasks get their real finish day. */
  start: DateKey;
  end: DateKey;
}

export type DeadlineStatus = 'ahead' | 'on-track' | 'at-risk' | 'behind';

export interface PathPlan {
  nodes: PathNode[];
  hoursPerWeek: number;
  /** Your real pace vs the hours you set (1 = as planned). */
  pace: number;
  paceKnown: boolean;
  totalHours: number;
  remainingHours: number;
  /** Likely finish (null when nothing is left to schedule). */
  finish: DateKey | null;
  early: DateKey | null;
  late: DateKey | null;
  /** Days the critical chain takes at your hours — the fastest possible if you could do tasks in parallel. */
  floorDays: number;
  deadline: DateKey | null;
  vsDeadline: DeadlineStatus | null;
  /** Hours a week that would make the likely finish hit the deadline (null if no deadline, already fine, or impossible). */
  neededHours: number | null;
  /** The ready task that matters most right now. */
  bottleneck: PathNode | null;
  /** Dependencies came from stage order (the goal has no explicit links). */
  implicit: boolean;
}

// ─── Effort ────────────────────────────────────────────────────────────────

/** Practice-only tasks are ongoing, not steps on the Path. */
export const isPathTask = (t: Task) => (t.todos ?? []).length > 0 || !(t.habits ?? []).length || (t.effortHours ?? 0) > 0;

const stepMin = (td: ToDo) => (td.estimateMin && td.estimateMin > 0 ? td.estimateMin : UNESTIMATED_STEP_MIN);

/** Hands-on hours for a task: yours/Day Zero's number, else the sum of its steps. */
export function effortOf(t: Task): number {
  if (t.effortHours && t.effortHours > 0) return t.effortHours;
  const todos = t.todos ?? [];
  if (todos.length) return Math.max(0.25, todos.reduce((n, td) => n + stepMin(td), 0) / 60);
  return 2;
}

/** Share of a task that's done, weighted by step size. */
export function progressOf(t: Task): number {
  if (t.status === 'complete') return 1;
  const todos = t.todos ?? [];
  if (!todos.length) return 0;
  const total = todos.reduce((n, td) => n + stepMin(td), 0);
  return todos.filter(td => td.done).reduce((n, td) => n + stepMin(td), 0) / total;
}

// ─── Pace ──────────────────────────────────────────────────────────────────

/**
 * Hours of this goal actually done in the last 28 days vs the plan, from when
 * steps were checked off. Shrunk toward 1 until the goal is 8 weeks old.
 */
export function learnPace(goal: Goal, hoursPerWeek: number, today: DateKey): { pace: number; known: boolean } {
  const started = dateKeyOf(goal.architect?.createdAt ?? goal.createdAt ?? today);
  const age = daysBetween(started, today);
  if (age < 21) return { pace: 1, known: false };
  const from = addDays(today, -27);
  let hours = 0;
  for (const p of goal.phases) for (const t of p.tasks) {
    if (!isPathTask(t)) continue;
    const todos = t.todos ?? [];
    const total = todos.reduce((n, td) => n + stepMin(td), 0) || 1;
    const effort = effortOf(t);
    for (const td of todos) if (td.done && td.doneAt && dateKeyOf(td.doneAt) >= from) hours += effort * (stepMin(td) / total);
  }
  const raw = Math.min(1.5, Math.max(0.25, hours / (hoursPerWeek * 4)));
  const trust = Math.min(1, age / 56);
  return { pace: Math.round((1 + (raw - 1) * trust) * 100) / 100, known: true };
}

// ─── Graph ─────────────────────────────────────────────────────────────────

interface Raw { task: Task; phase: Phase; phaseIndex: number; order: number }

function collect(goal: Goal): Raw[] {
  const out: Raw[] = [];
  goal.phases.forEach((phase, phaseIndex) => phase.tasks.forEach(task => {
    if (isPathTask(task)) out.push({ task, phase, phaseIndex, order: out.length });
  }));
  return out;
}

/** Explicit links if the goal has any; otherwise each stage waits for the one before. */
function depsFor(raws: Raw[]): { deps: Map<string, string[]>; implicit: boolean } {
  const ids = new Set(raws.map(r => r.task.id));
  const implicit = !raws.some(r => Array.isArray(r.task.dependsOn));
  const deps = new Map<string, string[]>();
  for (const r of raws) {
    if (implicit) {
      let prev = r.phaseIndex - 1;
      let before: string[] = [];
      while (prev >= 0 && !before.length) { before = raws.filter(x => x.phaseIndex === prev).map(x => x.task.id); prev--; }
      deps.set(r.task.id, before);
    } else {
      deps.set(r.task.id, [...new Set((r.task.dependsOn ?? []).filter(d => d !== r.task.id && ids.has(d)))]);
    }
  }
  return { deps, implicit };
}

/** Topological order (Kahn). Links that would close a loop are dropped. */
function topo(raws: Raw[], deps: Map<string, string[]>): string[] {
  const indeg = new Map(raws.map(r => [r.task.id, 0]));
  const out = new Map<string, string[]>(raws.map(r => [r.task.id, []]));
  for (const [id, ds] of deps) for (const d of ds) { indeg.set(id, (indeg.get(id) ?? 0) + 1); out.get(d)!.push(id); }
  const pos = new Map(raws.map(r => [r.task.id, r.order]));
  const queue = raws.filter(r => indeg.get(r.task.id) === 0).map(r => r.task.id);
  const order: string[] = [];
  while (queue.length) {
    queue.sort((a, b) => pos.get(a)! - pos.get(b)!);
    const id = queue.shift()!;
    order.push(id);
    for (const n of out.get(id)!) { indeg.set(n, indeg.get(n)! - 1); if (indeg.get(n) === 0) queue.push(n); }
  }
  // Anything left is in a loop: keep stage order and cut its links back into the loop.
  const placed = new Set(order);
  for (const r of raws) if (!placed.has(r.task.id)) {
    deps.set(r.task.id, deps.get(r.task.id)!.filter(d => placed.has(d)));
    order.push(r.task.id);
    placed.add(r.task.id);
  }
  return order;
}

// ─── Scheduling ────────────────────────────────────────────────────────────

interface SimResult { start: Map<string, number>; end: Map<string, number>; finish: number }

/**
 * Serial list schedule in fractional days from today. `remaining` hours,
 * `perDay` hours of capacity, `priority` = longest remaining chain.
 */
function simulate(order: string[], deps: Map<string, string[]>, remaining: Map<string, number>, wait: Map<string, number>,
  priority: Map<string, number>, active: Set<string>, perDay: number): SimResult {
  const start = new Map<string, number>();
  const end = new Map<string, number>();
  const pending = new Set(order.filter(id => (remaining.get(id) ?? 0) > 1e-9));
  for (const id of order) if (!pending.has(id)) { start.set(id, 0); end.set(id, 0); }
  const availableAt = (id: string) => Math.max(0, ...deps.get(id)!.map(d => (end.has(d) ? end.get(d)! + (wait.get(d) ?? 0) : Infinity)));
  let t = 0;
  while (pending.size && t < MAX_DAYS) {
    const ready = [...pending].filter(id => availableAt(id) <= t + 1e-9);
    if (!ready.length) {
      const next = Math.min(...[...pending].map(availableAt));
      if (!Number.isFinite(next)) break;
      t = next;
      continue;
    }
    // Finish what you started, then the task heading the longest chain, then stage order.
    ready.sort((a, b) => (Number(active.has(b)) - Number(active.has(a))) || (priority.get(b)! - priority.get(a)!) || (order.indexOf(a) - order.indexOf(b)));
    const id = ready[0];
    start.set(id, t);
    t += remaining.get(id)! / perDay;
    end.set(id, t);
    pending.delete(id);
  }
  for (const id of pending) { start.set(id, MAX_DAYS); end.set(id, MAX_DAYS); }
  return { start, end, finish: Math.max(0, ...end.values()) };
}

const dayKey = (today: DateKey, t: number) => addDays(today, Math.max(0, Math.ceil(t - 1e-9) - 1));

export interface PathOptions {
  /** Override hours per week (e.g. a what-if slider). */
  hoursPerWeek?: number;
  /** Ignore learned pace (for comparing plans on equal terms). */
  ignorePace?: boolean;
}

export function buildPath(goal: Goal, today: DateKey, opts: PathOptions = {}): PathPlan {
  const hoursPerWeek = Math.max(0.5, opts.hoursPerWeek ?? goal.hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK);
  const { pace, known } = opts.ignorePace ? { pace: 1, known: false } : learnPace(goal, hoursPerWeek, today);
  const raws = collect(goal);
  const { deps, implicit } = depsFor(raws);
  const order = topo(raws, deps);
  const byId = new Map(raws.map(r => [r.task.id, r]));

  const effort = new Map(raws.map(r => [r.task.id, effortOf(r.task)]));
  const progress = new Map(raws.map(r => [r.task.id, progressOf(r.task)]));
  const remaining = new Map(raws.map(r => [r.task.id, effort.get(r.task.id)! * (1 - progress.get(r.task.id)!)]));
  const wait = new Map(raws.map(r => [r.task.id, Math.max(0, r.task.waitDays ?? 0)]));
  const dependents = new Map<string, string[]>(raws.map(r => [r.task.id, []]));
  for (const [id, ds] of deps) for (const d of ds) dependents.get(d)!.push(id);

  // Longest chain from each task to the end, in days at your capacity (work + waiting).
  const perDay = (hoursPerWeek * pace) / 7;
  const tail = new Map<string, number>();
  for (const id of [...order].reverse()) {
    // Waiting only matters when something comes after it (same rule as the earliest-start pass below).
    const own = remaining.get(id)! / perDay + (remaining.get(id)! > 1e-9 && dependents.get(id)!.length ? wait.get(id)! : 0);
    tail.set(id, own + Math.max(0, ...dependents.get(id)!.map(n => tail.get(n)!)));
  }
  // Earliest-start pass for the critical chain.
  const es = new Map<string, number>();
  for (const id of order) es.set(id, Math.max(0, ...deps.get(id)!.map(d => es.get(d)! + remaining.get(d)! / perDay + (remaining.get(d)! > 1e-9 ? wait.get(d)! : 0))));
  const floor = Math.max(0, ...order.map(id => es.get(id)! + remaining.get(id)! / perDay));
  const critical = new Set(order.filter(id => remaining.get(id)! > 1e-9 && Math.abs(es.get(id)! + tail.get(id)! - floor) < 1e-6));

  const downstream = new Map<string, number>();
  for (const id of order) {
    const seen = new Set<string>();
    const stack = [...dependents.get(id)!];
    while (stack.length) { const n = stack.pop()!; if (!seen.has(n)) { seen.add(n); stack.push(...dependents.get(n)!); } }
    downstream.set(id, seen.size);
  }

  const active = new Set(order.filter(id => progress.get(id)! > 0 && progress.get(id)! < 1));
  const run = (effortScale: number, capScale: number) => simulate(order, deps,
    new Map([...remaining].map(([k, v]) => [k, v * effortScale])), wait, tail, active, perDay * capScale);
  const likely = run(1.15, 1);
  const early = run(0.9, 1);
  const late = run(1.5, 0.9);

  const lastDone = (t: Task): DateKey => {
    const ds = (t.todos ?? []).filter(td => td.doneAt).map(td => dateKeyOf(td.doneAt!)).sort();
    return ds[ds.length - 1] ?? today;
  };
  const nodes: PathNode[] = order.map(id => {
    const r = byId.get(id)!;
    const done = remaining.get(id)! <= 1e-9;
    const depsDone = deps.get(id)!.every(d => remaining.get(d)! <= 1e-9);
    const state: NodeState = done ? 'done' : !depsDone ? 'blocked' : progress.get(id)! > 0 ? 'active' : 'ready';
    return {
      id, phaseId: r.phase.id, phaseIndex: r.phaseIndex, phaseTitle: r.phase.title, title: r.task.title,
      milestone: !!r.task.milestone,
      effort: Math.round(effort.get(id)! * 10) / 10,
      remaining: Math.round(remaining.get(id)! * 10) / 10,
      progress: progress.get(id)!,
      waitDays: wait.get(id)!,
      deps: deps.get(id)!, dependents: dependents.get(id)!, downstream: downstream.get(id)!,
      state, critical: critical.has(id),
      start: done ? lastDone(r.task) : addDays(today, Math.floor(likely.start.get(id)!)),
      end: done ? lastDone(r.task) : dayKey(today, likely.end.get(id)!),
    };
  });

  const left = order.some(id => remaining.get(id)! > 1e-9);
  const finish = left ? dayKey(today, likely.finish) : null;
  const earlyKey = left ? dayKey(today, early.finish) : null;
  const lateKey = left ? dayKey(today, late.finish) : null;
  const deadline = goal.deadline ? dateKeyOf(goal.deadline) : null;
  const vsDeadline: DeadlineStatus | null = !deadline || !finish ? null
    : finish <= addDays(deadline, -14) ? 'ahead'
      : finish <= deadline ? 'on-track'
        : earlyKey! <= deadline ? 'at-risk' : 'behind';

  let neededHours: number | null = null;
  if (deadline && finish && finish > deadline && !opts.hoursPerWeek) {
    for (const h of [2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40]) {
      if (h <= hoursPerWeek) continue;
      if ((buildPath(goal, today, { hoursPerWeek: h, ignorePace: opts.ignorePace }).finish ?? '') <= deadline) { neededHours = h; break; }
    }
  }

  const candidates = nodes.filter(n => n.state === 'ready' || n.state === 'active');
  candidates.sort((a, b) => (Number(b.critical) - Number(a.critical)) || (b.downstream - a.downstream) || (tail.get(b.id)! - tail.get(a.id)!));

  const totalHours = [...effort.values()].reduce((a, b) => a + b, 0);
  const remainingHours = [...remaining.values()].reduce((a, b) => a + b, 0);
  return {
    nodes, hoursPerWeek, pace, paceKnown: known,
    totalHours: Math.round(totalHours * 10) / 10,
    remainingHours: Math.round(remainingHours * 10) / 10,
    finish, early: earlyKey, late: lateKey,
    floorDays: Math.ceil(floor),
    deadline, vsDeadline, neededHours,
    bottleneck: candidates[0] ?? null,
    implicit,
  };
}

// ─── Applying the schedule ────────────────────────────────────────────────

/**
 * Write the schedule into the goal: each task's planned window, and dates for
 * its open steps spread across that window. Only steps with no date or a date
 * the scheduler set (`scheduled`) are touched — your own dates are never moved,
 * and neither is the goal's deadline.
 */
export function applySchedule(goal: Goal, plan: PathPlan): { goal: Goal; moved: number } {
  const byId = new Map(plan.nodes.map(n => [n.id, n]));
  let moved = 0;
  let changed = false;
  const phases = goal.phases.map(p => {
    let pChanged = false;
    const tasks = p.tasks.map(t => {
      const n = byId.get(t.id);
      if (!n) return t;
      const open = (t.todos ?? []).filter(td => !td.done).sort((a, b) => a.order - b.order);
      const totalW = open.reduce((s, td) => s + stepMin(td), 0) || 1;
      const span = Math.max(0, daysBetween(n.start, n.end));
      let acc = 0;
      const due = new Map<string, DateKey>();
      for (const td of open) {
        acc += stepMin(td);
        due.set(td.id, n.state === 'done' ? n.end : addDays(n.start, Math.round((span * acc) / totalW)));
      }
      let tChanged = t.plannedStart !== n.start || t.plannedEnd !== n.end;
      const todos = (t.todos ?? []).map(td => {
        if (td.done || !due.has(td.id) || (td.deadline && !td.scheduled)) return td;
        const d = due.get(td.id)!;
        if (td.deadline === d && td.scheduled) return td;
        if (td.deadline && td.deadline !== d) moved++;
        tChanged = true;
        return { ...td, deadline: d, scheduled: true };
      });
      if (!tChanged) return t;
      pChanged = true;
      return { ...t, plannedStart: n.start, plannedEnd: n.end, todos };
    });
    if (!pChanged) return p;
    changed = true;
    return { ...p, tasks };
  });
  return { goal: changed ? { ...goal, phases } : goal, moved };
}

/** Steps whose scheduler-set date has passed without being done. */
export function slippedSteps(goal: Goal, today: DateKey): number {
  let n = 0;
  for (const p of goal.phases) for (const t of p.tasks) for (const td of t.todos ?? []) if (!td.done && td.scheduled && td.deadline && td.deadline < today) n++;
  return n;
}

const fmt = (k: DateKey) => new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Autopilot for Day Zero goals: when you slip (a scheduled step's date passed)
 * or a week has gone by, rebuild the schedule around reality and say so.
 * Returns the same goal object when nothing needs to change.
 */
export function autopilot(goal: Goal, today: DateKey, now = new Date(), newId: () => string = () => crypto.randomUUID()): Goal {
  const a = goal.architect;
  if (!a?.autopilot || (goal.status && goal.status !== 'active') || goal.archived) return goal;
  const slipped = slippedSteps(goal, today);
  const last = a.history.map(h => h.at).sort().pop();
  const weekly = !last || daysBetween(dateKeyOf(last), today) >= 7;
  const unplanned = goal.phases.some(p => p.tasks.some(t => isPathTask(t) && !t.plannedStart && (t.todos ?? []).some(td => !td.done)));
  if (!slipped && !weekly && !unplanned) return goal;

  const plan = buildPath(goal, today);
  const res = applySchedule(goal, plan);
  if (res.goal === goal) {
    // Nothing moved; still note the weekly check so it doesn't re-run all week.
    return weekly ? { ...goal, architect: { ...a, history: [...a.history, { id: newId(), at: now.toISOString(), note: 'Weekly check: plan still on schedule.', finish: plan.finish ?? undefined, seen: true, kind: 'auto' as const }].slice(-30) } } : goal;
  }
  const prevFinish = [...a.history].reverse().find(h => h.finish)?.finish;
  const shift = prevFinish && plan.finish ? daysBetween(prevFinish, plan.finish) : 0;
  const finishText = plan.finish ? `Likely finish: ${fmt(plan.finish)}${shift > 2 ? ` (${shift} days later)` : shift < -2 ? ` (${-shift} days sooner)` : ''}.` : '';
  const note = slipped
    ? `${slipped} step${slipped === 1 ? '' : 's'} slipped, so the plan was rebuilt around where you really are. ${finishText}`
    : unplanned ? `New steps scheduled. ${finishText}`
      : shift < -2 ? `You're ahead — the plan moved up. ${finishText}` : `Plan refreshed for the week. ${finishText}`;
  return {
    ...res.goal,
    architect: {
      ...a,
      undo: { at: now.toISOString(), phases: goal.phases },
      history: [...a.history, { id: newId(), at: now.toISOString(), note: note.trim(), finish: plan.finish ?? undefined, seen: !slipped && shift <= 2 && shift >= -2, kind: 'auto' as const }].slice(-30),
    },
  };
}

/** "today", "tomorrow", "Dec 4", "Mar 2, 2027" — dates as people say them. */
export function pathDate(k: DateKey, today: DateKey): string {
  const d = daysBetween(today, k);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return 'yesterday';
  return new Date(`${k}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(k.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}) });
}
