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
