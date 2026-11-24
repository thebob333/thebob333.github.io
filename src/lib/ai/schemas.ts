/** The exact shapes Claude must reply in. Shared by in-app AI and the copy-paste fallback. */
import { z } from 'zod/v4';

export const SHAPE = z.enum(['once', 'better', 'build', 'keep', 'become']);

export const IntakeQuestions = z.object({
  questions: z.array(z.object({
    question: z.string().describe('One short, specific question in plain language.'),
    placeholder: z.string().describe('An example answer, a few words.'),
  })).describe('2 to 5 questions; fewer for small goals.'),
});
export type IntakeQuestions = z.infer<typeof IntakeQuestions>;

export const PlanPractice = z.object({
  title: z.string().describe('Short verb phrase, e.g. "Run".'),
  perWeek: z.number().int().describe('Sessions per week to start with, 1-7. Start achievable.'),
  buildToPerWeek: z.number().int().describe('Sessions per week to build toward, 1-7, >= perWeek.'),
  amount: z.number().nullable().describe('Optional amount per session that can grow, e.g. 20. Null if not useful.'),
  unit: z.string().nullable().describe('Unit for amount, e.g. "min", "pages". Null if no amount.'),
  step: z.number().nullable().describe('How much the amount grows when on target, e.g. 5. Null if no amount.'),
  maxAmount: z.number().nullable().describe('Where the amount tops out. Null if open-ended or no amount.'),
  easyVersion: z.string().describe('The minimum version for bad weeks, e.g. "Walk 10 minutes".'),
  details: z.string().nullable().describe('Optional short detail, e.g. "easy pace".'),
});

export const PlanStep = z.object({
  title: z.string().describe('A concrete one-off action, starting with a verb.'),
  estimateMinutes: z.number().int().nullable().describe('Rough minutes it takes, or null.'),
  dueInDays: z.number().int().nullable().describe('Days from today it should be done by, or null.'),
});

export const PlanStage = z.object({
  title: z.string(),
  description: z.string().describe('One sentence: what this stage is for.'),
  weeks: z.number().int().describe('Rough length in weeks.'),
  steps: z.array(PlanStep).describe('One-off steps; detailed for the first stage, lighter for later ones.'),
  practices: z.array(PlanPractice).describe('Recurring practices for this stage (can be empty).'),
});

export const GoalPlan = z.object({
  summary: z.string().describe('1-2 sentences describing the approach, addressed to the user.'),
  shape: SHAPE,
  why: z.string().nullable().describe("The user's reason in their words, if they gave one."),
  metric: z.object({
    name: z.string(), unit: z.string(),
    start: z.number().nullable(), target: z.number().nullable(), higherIsBetter: z.boolean(),
  }).nullable().describe('For "better" goals: the number being moved. Null otherwise.'),
  targetDateDays: z.number().int().nullable().describe('Realistic days from today to finish, or null if open-ended.'),
  stages: z.array(PlanStage).describe('1 stage for small goals; 2-5 for big ones.'),
  ifThen: z.array(z.string()).describe('2-3 if-then plans for the likeliest obstacles, each "If …, then I will …".'),
  firstStep: z.string().describe('The very first thing to do, small enough to do today.'),
});
export type GoalPlan = z.infer<typeof GoalPlan>;

export const CheckInOpening = z.object({
  message: z.string().describe('A short review of the week (3-6 sentences) in the coach style of the goals.'),
  questions: z.array(z.string()).describe('1-2 questions about what got in the way or what to change.'),
});
export type CheckInOpening = z.infer<typeof CheckInOpening>;

export const Proposal = z.object({
  kind: z.enum(['practice', 'deadline', 'pause', 'step', 'ifThen']),
  goalId: z.string(),
  habitId: z.string().nullable().describe('For kind "practice": which practice.'),
  perWeek: z.number().int().nullable().describe('For "practice": new sessions per week.'),
  amount: z.number().nullable().describe('For "practice": new amount per session, or null to keep.'),
  deadline: z.string().nullable().describe('For "deadline": new date YYYY-MM-DD.'),
  title: z.string().nullable().describe('For "step": the step. For "ifThen": the plan text.'),
  reason: z.string().describe('One sentence the user will see.'),
});
export type Proposal = z.infer<typeof Proposal>;

export const CheckInPlan = z.object({
  message: z.string().describe('The coach reply: honest, specific, 3-6 sentences.'),
  proposals: z.array(Proposal).describe('0-5 concrete changes for the user to accept or skip.'),
  focusGoalIds: z.array(z.string()).describe('Up to 3 goal ids to focus on this week.'),
  nextStep: z.string().describe('The single next action to take.'),
});
export type CheckInPlan = z.infer<typeof CheckInPlan>;

/** Pull the first JSON object out of pasted text (handles code fences and chatter around it). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON found in the reply.');
  return JSON.parse(body.slice(start, end + 1));
}

export function parsePasted<S extends z.ZodType>(schema: S, text: string): z.infer<S> {
  const r = schema.safeParse(extractJson(text));
  if (!r.success) throw new Error("That reply wasn't in the expected format. Copy Claude's whole answer and try again.");
  return r.data;
}

export const schemaText = (schema: z.ZodType) => JSON.stringify(z.toJSONSchema(schema), null, 1);

export const CaptureAction = z.object({
  kind: z.enum(['practice_done', 'step', 'step_done', 'metric', 'note']),
  goalId: z.string(),
  habitId: z.string().nullable().describe('For practice_done.'),
  todoId: z.string().nullable().describe('For step_done.'),
  title: z.string().nullable().describe('For step: the new step. For note: the note text.'),
  dueDate: z.string().nullable().describe('For step: YYYY-MM-DD if a date was mentioned.'),
  value: z.number().nullable().describe('For metric: the measured number in the goal\'s unit.'),
  summary: z.string().describe('What this does, in a few words, e.g. "Mark Run done".'),
});
export type CaptureAction = z.infer<typeof CaptureAction>;

export const Capture = z.object({
  actions: z.array(CaptureAction).describe('Only things clearly stated. Empty if nothing matches a goal.'),
  unmatched: z.array(z.string()).describe('Bits that matched no goal, in the user\'s words.'),
});
export type Capture = z.infer<typeof Capture>;

export const CoachAnswer = z.object({
  answer: z.string().describe('A direct, practical answer in 2-6 short paragraphs or a short list.'),
  proposals: z.array(Proposal).describe('0-4 concrete changes to this goal the user can add with one tap.'),
});
export type CoachAnswer = z.infer<typeof CoachAnswer>;

// ─── Day Zero: the goal architect ───────────────────────────────────────────
// Kept deliberately flat and free of nullable fields: big nested schemas with
// many optional/union fields are rejected as "too complex" by structured outputs.
// Use 0 / "" for "none".

export const ArchPractice = z.object({
  title: z.string().describe('Short verb phrase, e.g. "Practise editing".'),
  perWeek: z.number().int().describe('Sessions per week to start with, 1-7. Start achievable.'),
  buildToPerWeek: z.number().int().describe('Sessions per week to build toward, 1-7, >= perWeek.'),
  minutes: z.number().int().describe('Minutes per session, or 0 if it does not matter.'),
  easyVersion: z.string().describe('The minimum version for bad weeks.'),
});

export const ArchTask = z.object({
  key: z.string().describe('Short unique id within the route, e.g. "t1".'),
  title: z.string().describe('A concrete chunk of work, starting with a verb.'),
  description: z.string().describe('One sentence: what "done" looks like.'),
  effortHours: z.number().describe('Honest hands-on hours for the whole task for THIS person, including learning. Not calendar time.'),
  waitDays: z.number().int().describe('Calendar days of waiting after this is done before dependent tasks can start (replies, reviews, decisions). 0 if none.'),
  dependsOn: z.array(z.string()).describe('Keys of tasks in this route that must be finished first. Only real dependencies.'),
  milestone: z.boolean().describe('True for the few tasks that mark a meaningful achievement.'),
  steps: z.array(z.string()).describe('Concrete one-sitting actions starting with a verb: 2-6 for the recommended route, 1-3 for others.'),
});

export const ArchStage = z.object({
  title: z.string(),
  description: z.string().describe('One sentence: what this stage is for.'),
  tasks: z.array(ArchTask),
  practices: z.array(ArchPractice).describe('Recurring practices, only where repeated skill-building or upkeep matters (often empty).'),
});

export const ArchRoute = z.object({
  name: z.string().describe('2-4 words, e.g. "Scrappy solo", "Build a crew".'),
  summary: z.string().describe('One or two sentences: how this route gets there.'),
  tradeoff: z.string().describe('One sentence: what you gain and give up versus the other routes.'),
  stages: z.array(ArchStage).describe('2-5 stages in order.'),
});

export const DayZeroPlan = z.object({
  title: z.string().describe("The goal as a short title (under 60 characters), in the user's spirit."),
  shape: SHAPE,
  why: z.string().describe("The user's reason in their words, or an empty string."),
  metricName: z.string().describe('For "better" goals: the number being moved (e.g. "5K time"). Empty string otherwise.'),
  metricUnit: z.string().describe('Unit for the metric, or empty string.'),
  metricTarget: z.number().describe('Target value for the metric, or 0.'),
  metricHigherIsBetter: z.boolean().describe('For the metric: true if higher is better.'),
  strategy: z.string().describe('3-5 sentences: the core strategy, why it works, what matters most.'),
  research: z.string().describe('2-4 sentences: key facts from the research that shaped this plan (real deadlines, typical timelines). Empty string if none.'),
  assumptions: z.array(z.string()).describe('2-4 assumptions the plan rests on.'),
  risks: z.array(z.object({ risk: z.string(), mitigation: z.string() })).describe('2-4 likeliest ways this fails and what the plan does about each.'),
  routes: z.array(ArchRoute).describe('2-3 genuinely different routes; the recommended one fully detailed.'),
  recommendedRoute: z.number().int().describe('Index into routes of the recommended one.'),
  suggestedHoursPerWeek: z.number().describe('Hours a week this realistically needs.'),
  targetDateDays: z.number().int().describe('Realistic days from today to finish the recommended route at the suggested hours, or 0 if open-ended.'),
  ifThen: z.array(z.string()).describe('2-3 if-then plans, each "If ..., then I will ...".'),
  firstStep: z.string().describe('The very first action, under 30 minutes, doable today.'),
});
export type DayZeroPlan = z.infer<typeof DayZeroPlan>;
export type ArchRoute = z.infer<typeof ArchRoute>;

// ─── Arete: discovering what lies beyond a node ─────────────────────────────

export const AreteDiscovery = z.object({
  nodes: z.array(z.object({
    title: z.string().describe('The achievement: starts with a verb, objectively checkable, with a number where possible. Under 60 characters.'),
    detail: z.string().describe('One short sentence on what counts. Empty string if obvious.'),
    tier: z.number().int().describe('Difficulty 0-10: 0-1 anyone soon, 2-3 real effort, 4-5 years of work, 6-7 exceptional, 8-9 legendary, 10 once in a generation.'),
    after: z.number().int().describe('-1 if it follows directly from the given node; otherwise the 0-based index of an EARLIER node in this list that must come first.'),
  })).describe('3 to 6 new nodes.'),
});
export type AreteDiscovery = z.infer<typeof AreteDiscovery>;
