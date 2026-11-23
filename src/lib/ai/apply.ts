/** Turn coach replies into goal changes. Pure; ids from the coach are checked before use. */
import type { Goal, Habit, Phase } from '@/types/goals';
import { addDays, type DateKey } from '@/lib/dates';
import { frequencyFor } from '@/lib/practice';
import type { CaptureAction, GoalPlan, Proposal } from './schemas';

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
const pos = (n: number | null | undefined) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined);

const hasContent = (g: Goal) => g.phases.some(p => p.tasks.some(t => (t.todos ?? []).length || (t.habits ?? []).length));

/** Merge a coach plan into a goal. Empty starter stages are replaced; otherwise stages are added after yours. */
export function applyPlan(goal: Goal, plan: GoalPlan, today: DateKey, newId: () => string = () => crypto.randomUUID()): Goal {
  let weeks = 0;
  const firstLower = plan.firstStep.trim().toLowerCase();
  const stages: Phase[] = plan.stages.map((st, i) => {
    weeks += Math.max(1, st.weeks || 1);
    const habits: Habit[] = st.practices.map(pr => {
      const perWeek = clamp(pr.perWeek || 1, 1, 7);
      const amount = pos(pr.amount);
      return {
        id: newId(), title: pr.title.trim() || 'Practice', active: true,
        perWeek, maxPerWeek: Math.max(perWeek, clamp(pr.buildToPerWeek || perWeek, 1, 7)), frequency: frequencyFor(perWeek),
        ...(amount !== undefined ? { amount, unit: pr.unit?.trim() || undefined, step: pos(pr.step), maxAmount: pos(pr.maxAmount) } : {}),
        minimum: pr.easyVersion?.trim() || undefined, target: pr.details?.trim() || undefined,
        auto: true, since: today,
      };
    });
    const todos = st.steps.map((sp, j) => ({
      id: newId(), title: sp.title.trim(), done: false, order: j,
      deadline: typeof sp.dueInDays === 'number' && sp.dueInDays >= 0 ? addDays(today, Math.round(sp.dueInDays)) : undefined,
      estimateMin: pos(sp.estimateMinutes),
    })).filter(t => t.title);
    if (i === 0 && firstLower && !todos.some(t => t.title.toLowerCase() === firstLower)) {
      todos.unshift({ id: newId(), title: plan.firstStep.trim(), done: false, order: -1, deadline: today, estimateMin: undefined });
      todos.forEach((t, k) => { t.order = k; });
    }
    return {
      id: newId(), title: st.title.trim() || `Stage ${i + 1}`, description: st.description ?? '', order: 0,
      deadline: addDays(today, weeks * 7),
      tasks: [{ id: newId(), title: plan.shape === 'once' ? 'Checklist' : st.title.trim() || 'Plan', description: '', status: 'not_started', order: 0, todos, habits }],
    };
  });

  const phases = (hasContent(goal) ? [...goal.phases, ...stages] : stages).map((p, i) => ({ ...p, order: i }));
  const m = plan.metric;
  return {
    ...goal,
    phases,
    shape: plan.shape,
    why: goal.why || plan.why?.trim() || undefined,
    metric: goal.metric ?? (plan.shape === 'better' && m && m.name ? {
      name: m.name, unit: m.unit, start: m.start ?? undefined, target: m.target ?? undefined, higherIsBetter: m.higherIsBetter,
    } : undefined),
    deadline: goal.deadline ?? (plan.targetDateDays && plan.targetDateDays > 0 ? addDays(today, plan.targetDateDays) : undefined),
    ifThen: [...new Set([...(goal.ifThen ?? []), ...plan.ifThen.map(s => s.trim()).filter(Boolean)])],
  };
}

export interface AppliedProposal { goals: Goal[]; label: string }

/** Apply one accepted check-in suggestion. Returns null if it points at something that doesn't exist. */
export function applyProposal(goals: Goal[], p: Proposal, today: DateKey, newId: () => string = () => crypto.randomUUID()): AppliedProposal | null {
  const goal = goals.find(g => g.id === p.goalId);
  if (!goal) return null;
  const update = (fn: (g: Goal) => Goal) => goals.map(g => (g.id === goal.id ? fn(g) : g));

  switch (p.kind) {
    case 'practice': {
      const found = goal.phases.some(ph => ph.tasks.some(t => (t.habits ?? []).some(h => h.id === p.habitId)));
      if (!found || (p.perWeek == null && p.amount == null)) return null;
      return {
        label: 'Practice updated',
        goals: update(g => ({
          ...g,
          phases: g.phases.map(ph => ({ ...ph, tasks: ph.tasks.map(t => ({ ...t, habits: (t.habits ?? []).map(h => {
            if (h.id !== p.habitId) return h;
            const perWeek = p.perWeek != null ? clamp(p.perWeek, 1, 7) : h.perWeek;
            return { ...h, ...(perWeek ? { perWeek, frequency: frequencyFor(perWeek), maxPerWeek: Math.max(perWeek, h.maxPerWeek ?? perWeek) } : {}), ...(pos(p.amount) !== undefined ? { amount: pos(p.amount) } : {}) };
          }) })) })),
        })),
      };
    }
    case 'deadline':
      if (!p.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(p.deadline) || p.deadline < today) return null;
      return { label: 'Target date moved', goals: update(g => ({ ...g, deadline: p.deadline! })) };
    case 'pause':
      return { label: `Paused "${goal.title}"`, goals: update(g => ({ ...g, status: 'paused' })) };
    case 'step': {
      const title = p.title?.trim();
      const phase = goal.phases.find(ph => ph.tasks.some(t => (t.todos ?? []).some(x => !x.done))) ?? goal.phases.find(ph => ph.tasks.length);
      if (!title || !phase) return null;
      return {
        label: 'Step added',
        goals: update(g => ({ ...g, phases: g.phases.map(ph => ph.id !== phase.id ? ph : {
          ...ph, tasks: ph.tasks.map((t, i) => i !== 0 ? t : { ...t, todos: [...(t.todos ?? []), { id: newId(), title, done: false, order: (t.todos ?? []).length, deadline: addDays(today, 2) }] }),
        }) })),
      };
    }
    case 'ifThen': {
      const text = p.title?.trim();
      if (!text) return null;
      return { label: 'If-then plan saved', goals: update(g => ({ ...g, ifThen: [...new Set([...(g.ifThen ?? []), text])] })) };
    }
  }
}

export type CaptureEffect =
  | { type: 'goals'; goals: Goal[] }
  | { type: 'checkin'; habitId: string }
  | { type: 'metric'; goalId: string; value: number }
  | null;

/** What one brain-dump action should do, or null if it doesn't match your goals. */
export function captureEffect(goals: Goal[], a: CaptureAction, today: DateKey, newId: () => string = () => crypto.randomUUID()): CaptureEffect {
  const goal = goals.find(g => g.id === a.goalId);
  if (!goal) return null;
  const tasks = goal.phases.flatMap(p => p.tasks.map(t => ({ p, t })));
  switch (a.kind) {
    case 'practice_done':
      return tasks.some(({ t }) => (t.habits ?? []).some(h => h.id === a.habitId)) ? { type: 'checkin', habitId: a.habitId! } : null;
    case 'metric':
      return goal.metric && typeof a.value === 'number' && Number.isFinite(a.value) ? { type: 'metric', goalId: goal.id, value: a.value } : null;
    case 'step_done': {
      if (!tasks.some(({ t }) => (t.todos ?? []).some(x => x.id === a.todoId && !x.done))) return null;
      const at = new Date().toISOString();
      return { type: 'goals', goals: goals.map(g => g.id !== goal.id ? g : { ...g, phases: g.phases.map(p => ({ ...p, tasks: p.tasks.map(t => ({ ...t, todos: (t.todos ?? []).map(x => (x.id === a.todoId ? { ...x, done: true, doneAt: at } : x)) })) })) }) };
    }
    case 'step': {
      const r = applyProposal(goals, { kind: 'step', goalId: goal.id, habitId: null, perWeek: null, amount: null, deadline: null, title: a.title, reason: '' }, today, newId);
      if (!r) return null;
      if (a.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(a.dueDate)) {
        // applyProposal dates new steps in 2 days; use the date they said instead.
        const g = r.goals.find(x => x.id === goal.id)!;
        const last = g.phases.flatMap(p => p.tasks.flatMap(t => t.todos ?? [])).find(x => x.title === a.title?.trim() && !x.done && x.deadline === addDays(today, 2));
        if (last) last.deadline = a.dueDate;
      }
      return { type: 'goals', goals: r.goals };
    }
    case 'note': {
      const text = a.title?.trim();
      const target = tasks.find(({ t }) => (t.todos ?? []).some(x => !x.done) || (t.habits ?? []).length) ?? tasks[0];
      if (!text || !target) return null;
      return { type: 'goals', goals: goals.map(g => g.id !== goal.id ? g : { ...g, phases: g.phases.map(p => ({ ...p, tasks: p.tasks.map(t => t.id !== target.t.id ? t : { ...t, notes: [...(t.notes ?? []), { id: newId(), text, createdAt: new Date().toISOString() }] }) })) }) };
    }
  }
}
