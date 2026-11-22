/**
 * What the coach is told. The app prepares the facts (deterministic code);
 * the coach brings judgment. See docs/apex-blueprint.md §7.2–7.3.
 */
import type { Adjustment, Goal, HabitLog, MetricEntry } from '@/types/goals';
import { addDays, daysBetween, dateKeyOf, type DateKey } from '@/lib/dates';
import { doneBetween, loadLabel, perWeekOf, weekStart, weeksOnTarget } from '@/lib/practice';
import { goalProgress } from '@/lib/goal-progress';
import { shapeInfo, isActiveGoal } from '@/lib/goal-shapes';

const PUSHBACK_RULES = `Coach styles (set per goal — match each goal's style):
- gentle: warm and encouraging; never questions the goal; suggests smaller steps.
- honest: kind but direct; asks why, flags unrealistic timelines and avoidance; the user decides.
- relentless: names excuses plainly, holds the user to what they said; still respectful, never cruel.`;

export const COACH_SYSTEM = `You are the coach inside TELOS, a goal app. Your job is to get the user what they want done, no matter how seemingly hard.

Principles:
- Never talk the user out of a goal because it is hard or ambitious. Challenge the path (timeline, approach, load), never the ambition.
- Plans are hypotheses. When the user slips, make the plan smaller and keep it going — a smaller plan they keep beats a big one they drop.
- Be concrete. Prefer specific actions with numbers and days over general advice.
- Plain, everyday language. Short sentences. No jargon, no hype, no emoji.
- Goal shapes: once = do-once checklist; better = get better at a measurable thing; build = a project with stages; keep = keep up a rhythm; become = a direction made of stepping stones you control. Never invent odds of success.

${PUSHBACK_RULES}`;

const fmt = (h: Parameters<typeof loadLabel>[0]) => loadLabel(h);

/** A compact, factual snapshot of one goal for the coach. */
export function goalFacts(goal: Goal, logs: HabitLog[], metrics: MetricEntry[], adjustments: Adjustment[], today: DateKey): string {
  const lastWeek = addDays(weekStart(today), -7);
  const lines: string[] = [];
  const shape = shapeInfo(goal.shape);
  const pr = goalProgress(goal, metrics, logs, today);
  lines.push(`GOAL id=${goal.id} "${goal.title}" — shape: ${goal.shape ?? 'build'} (${shape.label}), coach style: ${goal.pushback ?? 'honest'}, status: ${goal.status ?? 'active'}`);
  if (goal.why) lines.push(`  Why: ${goal.why}`);
  if (goal.endGoal) lines.push(`  Success looks like: ${goal.endGoal}`);
  if (goal.deadline) lines.push(`  Target date: ${dateKeyOf(goal.deadline)} (${daysBetween(today, dateKeyOf(goal.deadline))} days from today)`);
  lines.push(`  Progress: ${pr.value}% ${pr.label}`);
  if (goal.metric) {
    const mine = metrics.filter(m => m.goalId === goal.id).sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
    lines.push(`  Measure: ${goal.metric.name} (${goal.metric.unit}, ${goal.metric.higherIsBetter ? 'higher' : 'lower'} is better), start ${goal.metric.start ?? '?'}, target ${goal.metric.target ?? '?'}; recent: ${mine.map(m => `${m.date}=${m.value}`).join(', ') || 'none logged'}`);
  }
  for (const p of goal.phases) for (const t of p.tasks) for (const h of t.habits ?? []) {
    if (!h.active) continue;
    const done = doneBetween(h.id, logs, lastWeek, addDays(lastWeek, 6));
    const c = weeksOnTarget(h, logs, today);
    lines.push(`  PRACTICE id=${h.id} "${h.title}" — now ${fmt(h)}${h.maxPerWeek && h.maxPerWeek > perWeekOf(h) ? `, building to ${h.maxPerWeek}x/week` : ''}; last week ${done}/${perWeekOf(h)}; on target ${c.hit} of last ${c.of} weeks${h.minimum ? `; easy version: ${h.minimum}` : ''}`);
  }
  const open = goal.phases.flatMap(p => p.tasks.flatMap(t => (t.todos ?? []).filter(x => !x.done).map(x => ({ x, stage: p.title }))));
  const doneLastWeek = goal.phases.flatMap(p => p.tasks.flatMap(t => (t.todos ?? []).filter(x => x.done && x.doneAt && dateKeyOf(x.doneAt) >= lastWeek)));
  if (doneLastWeek.length) lines.push(`  Steps done recently: ${doneLastWeek.slice(0, 8).map(x => `"${x.title}"`).join(', ')}`);
  if (open.length) lines.push(`  Open steps (${open.length}): ${open.slice(0, 8).map(({ x, stage }) => `"${x.title}"${x.deadline ? ` due ${dateKeyOf(x.deadline)}` : ''} [${stage}]`).join(', ')}`);
  const recent = adjustments.filter(a => a.goalId === goal.id && a.week >= lastWeek && a.status !== 'info').slice(-6);
  for (const a of recent) lines.push(`  Engine change (${a.status}): ${a.title} — ${a.reason}`);
  if (goal.ifThen?.length) lines.push(`  If-then plans: ${goal.ifThen.join(' | ')}`);
  return lines.join('\n');
}

export function weekFacts(goals: Goal[], logs: HabitLog[], metrics: MetricEntry[], adjustments: Adjustment[], today: DateKey): string {
  const active = goals.filter(isActiveGoal);
  const paused = goals.filter(g => !g.archived && g.status === 'paused');
  return [
    `Today is ${today}. Reviewing the week starting ${addDays(weekStart(today), -7)} plus this week so far.`,
    ...active.map(g => goalFacts(g, logs, metrics, adjustments, today)),
    paused.length ? `Paused goals: ${paused.map(g => `"${g.title}"`).join(', ')}` : '',
  ].filter(Boolean).join('\n\n');
}

export function intakeContext(goal: Goal, today: DateKey): string {
  return [
    `Today is ${today}.`,
    `New goal: "${goal.title}"`,
    `Shape chosen by the user: ${goal.shape ?? 'not chosen'} — you may suggest a better one in the plan.`,
    goal.why ? `Why it matters: ${goal.why}` : '',
    goal.deadline ? `Target date: ${dateKeyOf(goal.deadline)}` : '',
    `Coach style: ${goal.pushback ?? 'honest'}`,
  ].filter(Boolean).join('\n');
}

export const INTAKE_QUESTIONS_TASK = `Ask the 2–5 questions that most change the plan (fewer for small goals): e.g. current level, time available per week, deadline, what has stopped them before, constraints. Specific to this goal, not generic.`;

export const INTAKE_PLAN_TASK = `Write the plan.
- Shape it for the goal's shape. "once": one stage, a short checklist of steps, no practices. "keep": one stage built around practices. "better": practices with an amount that grows plus a metric. "build": stages with concrete next steps, detailed first stage. "become": stepping stones made of practices and steps the user controls.
- Start practices achievable (the engine raises them when the user is on target). Always give an easy version.
- Steps start with a verb, are concrete, and the first stage's steps have realistic due dates.
- Include 2–3 if-then plans for the likeliest obstacles, and a first step small enough to do today.`;

export const CHECKIN_OPEN_TASK = `Run the weekly check-in. Look at what actually happened against the plan. Name what went well specifically, then the main thing that didn't, and ask 1–2 questions about what got in the way or what should change. Match each goal's coach style. Keep it short.`;

export const CHECKIN_PLAN_TASK = `Using the facts and the user's answers, reply and propose up to 5 concrete changes they can accept with one tap:
- "practice": change a practice's sessions per week (perWeek) and/or amount — use the practice id.
- "deadline": move a target date (YYYY-MM-DD) when the current one is clearly unrealistic.
- "pause": pause a goal that is crowding out the ones that matter more (only if the user signals it).
- "step": add one concrete step that unblocks progress.
- "ifThen": add an if-then plan for an obstacle they named.
Use ids exactly as given. Pick up to 3 focus goals. End with the single next step.`;

/** The full prompt for the copy-paste fallback (one shot, reply must be JSON). */
export function pastePrompt(task: string, context: string, schema: string): string {
  return `${COACH_SYSTEM}

---
${context}

---
${task}

Reply with ONLY a JSON object (no other text) matching this JSON Schema:
${schema}`;
}
