/**
 * Parses an AI-written goal plan into phases / tasks / to-dos / habits, and
 * merges it into an existing goal.
 *
 * Forgiving by design: AI replies often add bullets, bold, numbering, missing
 * dates or extra notes inside tags. Anything that looks like a plan line but
 * can't be read is reported as a warning instead of being silently dropped.
 */
import type { AdaptationProtocol, EffortLevel, Goal, HabitEvolution, Phase } from '@/types/goals';
import { isDateKey } from '@/lib/dates';

export interface ParsedHabit { title: string; frequency: string; target: string; evolution?: HabitEvolution; }
export interface ParsedTodo { title: string; deadline: string; effort?: EffortLevel; isBenchmark?: boolean; }
export interface ParsedTask { title: string; description: string; deadline: string; todos: ParsedTodo[]; habits: ParsedHabit[]; }
export interface ParsedPhase { title: string; description: string; deadline: string; tasks: ParsedTask[]; }
export interface ParseResult { phases: ParsedPhase[]; warnings: string[]; adaptationProtocol?: AdaptationProtocol; }

const KEYWORDS = ['PHASE', 'TASK', 'TODO', 'HABIT'] as const;
type Keyword = (typeof KEYWORDS)[number];

/** Strip markdown noise: bullets, numbering, bold/italics, backticks. */
function clean(line: string): string {
  return line
    .trim()
    .replace(/^(?:[-*•>]+|\d+[.)])\s+/, '')
    .replace(/[*_`]{1,3}([^*_`]+)[*_`]{1,3}/g, '$1')
    .replace(/^[*_`]+|[*_`]+$/g, '')
    .trim();
}

function splitFields(rest: string): string[] {
  return rest.split('|').map(f => f.trim());
}

const TAG_RE = /^\[([A-Z]+)(?:[^\]]*)\]$/i;

function readTag(field: string | undefined): string | undefined {
  if (!field) return undefined;
  const m = field.match(TAG_RE);
  return m ? m[1].toUpperCase() : undefined;
}

function pickDate(fields: string[]): string {
  return fields.find(f => isDateKey(f)) ?? '';
}

export function parseGoalPlan(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  const phases: ParsedPhase[] = [];
  const warnings: string[] = [];
  const proto: AdaptationProtocol = { ahead: '', behind: '', blocked: '' };
  let currentPhase: ParsedPhase | null = null;
  let currentTask: ParsedTask | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = clean(lines[i]);
    if (!line) continue;
    const lineNo = i + 1;

    // Adaptation protocol lines can appear anywhere (usually at the end).
    const ifMatch = line.match(/^IF\s+(AHEAD|BEHIND|BLOCKED)\s*:\s*(.+)$/i);
    if (ifMatch) {
      const k = ifMatch[1].toLowerCase() as keyof AdaptationProtocol;
      proto[k] = ifMatch[2].trim();
      continue;
    }

    const kw = line.match(/^(PHASE|TASK|TODO|HABIT)\s*\d*\s*[:—-]\s*(.*)$/i);
    if (!kw) continue; // prose, headings, ADAPTATION PROTOCOL title, etc.
    const keyword = kw[1].toUpperCase() as Keyword;
    const fields = splitFields(kw[2]);
    const title = fields[0];
    if (!title) {
      warnings.push(`Line ${lineNo}: ${keyword} has no title — skipped.`);
      continue;
    }

    if (keyword === 'PHASE') {
      const date = pickDate(fields.slice(1));
      const description = fields.slice(1).find(f => f && !isDateKey(f)) ?? '';
      currentPhase = { title, description, deadline: date, tasks: [] };
      phases.push(currentPhase);
      currentTask = null;
      continue;
    }

    if (keyword === 'TASK') {
      if (!currentPhase) {
        // Be forgiving: create a phase to hold orphan tasks rather than dropping them.
        currentPhase = { title: 'Plan', description: '', deadline: '', tasks: [] };
        phases.push(currentPhase);
        warnings.push(`Line ${lineNo}: TASK before any PHASE — put it in a phase called "Plan".`);
      }
      const date = pickDate(fields.slice(1));
      const description = fields.slice(1).find(f => f && !isDateKey(f)) ?? '';
      currentTask = { title, description, deadline: date, todos: [], habits: [] };
      currentPhase.tasks.push(currentTask);
      continue;
    }

    if (!currentTask) {
      warnings.push(`Line ${lineNo}: ${keyword} before any TASK — skipped ("${title}").`);
      continue;
    }

    if (keyword === 'TODO') {
      const effortTag = fields.slice(1).map(readTag).find(t => t === 'LOW' || t === 'MED' || t === 'HIGH') as EffortLevel | undefined;
      currentTask.todos.push({
        title,
        deadline: pickDate(fields.slice(1)),
        effort: effortTag,
        isBenchmark: /^Benchmark\s*[—–:-]\s*/i.test(title) || undefined,
      });
      continue;
    }

    // HABIT: title | frequency | target | [EVOLUTION …]
    const rest = fields.slice(1);
    const evolution = rest.map(readTag).find(t => t === 'NEW' || t === 'CARRY' || t === 'INCREASE' || t === 'REPLACE') as HabitEvolution | undefined;
    const plain = rest.filter(f => f && !TAG_RE.test(f));
    currentTask.habits.push({
      title,
      frequency: plain[0] || 'daily',
      target: plain[1] || '',
      evolution,
    });
  }

  if (phases.length === 0) {
    warnings.push('No PHASE: lines found. Make sure the AI reply follows the format in the prompt.');
  }

  const adaptationProtocol = proto.ahead || proto.behind || proto.blocked ? proto : undefined;
  return { phases, warnings, adaptationProtocol };
}

const norm = (s: string) => s.trim().toLowerCase();

export interface MergeStats { phases: number; tasks: number; todos: number; habits: number; skipped: number }

/**
 * Merge a parsed plan into a goal's phases. Same-named phases and tasks are
 * merged, and to-dos / habits that already exist (by title) are skipped, so
 * importing the same plan twice doesn't duplicate anything.
 */
export function mergePlanIntoPhases(existing: Phase[], plan: ParsedPhase[], newId: () => string): { phases: Phase[]; stats: MergeStats } {
  const stats: MergeStats = { phases: 0, tasks: 0, todos: 0, habits: 0, skipped: 0 };
  const phases: Phase[] = existing.map(p => ({ ...p, tasks: [...p.tasks] }));

  for (const pp of plan) {
    let phase = phases.find(p => norm(p.title) === norm(pp.title));
    if (!phase) {
      phase = { id: newId(), title: pp.title, description: pp.description, deadline: pp.deadline || undefined, tasks: [], order: phases.length };
      phases.push(phase);
      stats.phases++;
    } else if (!phase.deadline && pp.deadline) {
      phase.deadline = pp.deadline;
    }

    for (const pt of pp.tasks) {
      const idx = phase.tasks.findIndex(t => norm(t.title) === norm(pt.title));
      const base = idx >= 0
        ? { ...phase.tasks[idx], todos: [...(phase.tasks[idx].todos ?? [])], habits: [...(phase.tasks[idx].habits ?? [])] }
        : {
            id: newId(), title: pt.title, description: pt.description, status: 'not_started' as const,
            deadline: pt.deadline || undefined, order: phase.tasks.length, todos: [], habits: [],
          };
      if (idx < 0) stats.tasks++;

      for (const ptd of pt.todos) {
        if (base.todos.some(t => norm(t.title) === norm(ptd.title))) { stats.skipped++; continue; }
        base.todos.push({
          id: newId(), title: ptd.title, done: false, order: base.todos.length,
          deadline: ptd.deadline || undefined, effort: ptd.effort, isBenchmark: ptd.isBenchmark,
        });
        stats.todos++;
      }
      for (const ph of pt.habits) {
        if (base.habits.some(h => norm(h.title) === norm(ph.title))) { stats.skipped++; continue; }
        base.habits.push({ id: newId(), title: ph.title, frequency: ph.frequency, target: ph.target || undefined, active: true, evolution: ph.evolution });
        stats.habits++;
      }

      if (idx >= 0) phase.tasks[idx] = base;
      else phase.tasks.push(base);
    }
  }

  return { phases, stats };
}

export function applyPlanToGoal(goal: Goal, plan: ParseResult, newId: () => string): { goal: Goal; stats: MergeStats } {
  const { phases, stats } = mergePlanIntoPhases(goal.phases, plan.phases, newId);
  return {
    goal: { ...goal, phases, ...(plan.adaptationProtocol ? { adaptationProtocol: plan.adaptationProtocol } : {}) },
    stats,
  };
}
