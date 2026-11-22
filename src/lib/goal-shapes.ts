/** Labels and guidance for the five goal shapes and coach styles (docs/apex-blueprint.md §5). */
import { CheckSquare, Compass, Hammer, Repeat, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Goal, GoalShape, GoalStatus, Pushback } from '@/types/goals';

export interface ShapeInfo {
  value: GoalShape;
  label: string;
  /** One line: what this shape is. */
  hint: string;
  examples: string;
  /** What we call the goal's phases for this shape. */
  stages: string;
  icon: LucideIcon;
}

export const SHAPES: ShapeInfo[] = [
  { value: 'once', label: 'Do once', hint: 'A short checklist, often one session.', examples: 'Tie a tie · renew passport', stages: 'Steps', icon: CheckSquare },
  { value: 'better', label: 'Get better', hint: 'Training with targets that rise as you improve.', examples: '5K · bench press · guitar · Spanish', stages: 'Blocks', icon: TrendingUp },
  { value: 'build', label: 'Build', hint: 'Stages and next steps; re-planned as you learn.', examples: 'Start a company · write a book', stages: 'Stages', icon: Hammer },
  { value: 'keep', label: 'Keep up', hint: 'A rhythm you keep, with an easy version for bad weeks.', examples: 'Meditate · sleep by 11 · call grandma', stages: 'Parts', icon: Repeat },
  { value: 'become', label: 'Become', hint: 'A direction, made of stepping stones you control.', examples: 'President · nirvana · a great dad', stages: 'Stepping stones', icon: Compass },
];

export function shapeInfo(shape?: GoalShape): ShapeInfo {
  return SHAPES.find(s => s.value === shape) ?? SHAPES[2];
}

export const PUSHBACK: { value: Pushback; label: string; hint: string }[] = [
  { value: 'gentle', label: 'Gentle', hint: 'Encourages. Never questions the goal.' },
  { value: 'honest', label: 'Honest', hint: 'Asks why, flags unrealistic timelines and avoidance. Your call.' },
  { value: 'relentless', label: 'Relentless', hint: 'Names excuses directly and keeps you on the hook.' },
];

export const STATUSES: { value: GoalStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'dropped', label: 'Dropped' },
];

export const isActiveGoal = (g: Goal) => !g.archived && (!g.status || g.status === 'active');
