/**
 * What "today" looks like: the four progress rings and the unified Up Next list.
 * Pure functions so they're easy to test.
 */
import type { Goal } from '@/types/goals';
import type { WorkoutSession } from '@/types/workout';
import type { Commitment, Contact, Interaction } from '@/lib/storage';
import type { FlatHabit } from '@/lib/habits';
import type { DayPlan } from '@/hooks/useWeeklyPlan';
import { flattenTodos } from '@/lib/goal-tree';
import { dateKeyOf, daysBetween, type DateKey } from '@/lib/dates';

export type RingKey = 'habits' | 'tasks' | 'move' | 'people';

export interface Ring {
  key: RingKey;
  label: string;
  done: number;
  total: number;
  /** Short status shown in the legend, e.g. "3/5" or "Rest day". */
  status: string;
}

export type TodayHabit = FlatHabit & { completed: boolean; streak: number };

export interface TodayInput {
  today: DateKey;
  goals: Goal[];
  habits: TodayHabit[];
  plan: DayPlan | null;
  sessions: WorkoutSession[];
  contacts: Contact[];
  interactions: Interaction[];
  commitments: Commitment[];
  streakStatus: (c: Contact) => 'on-track' | 'due-soon' | 'overdue' | 'no-goal';
}

const isToday = (iso: string | undefined, today: DateKey) => !!iso && dateKeyOf(iso) === today;

export function computeRings(i: TodayInput): Ring[] {
  const rings: Ring[] = [];

  // Habits due today
  const hDone = i.habits.filter(h => h.completed).length;
  rings.push({ key: 'habits', label: 'Habits', done: hDone, total: i.habits.length, status: i.habits.length ? `${hDone}/${i.habits.length}` : 'None today' });

  // To-dos: finished today + still due today or late
  const todos = flattenTodos(i.goals);
  const doneToday = todos.filter(t => t.todo.done && isToday(t.todo.doneAt, i.today)).length;
  const dueNow = todos.filter(t => !t.todo.done && t.todo.deadline && daysBetween(i.today, dateKeyOf(t.todo.deadline)) <= 0).length;
  const tTotal = doneToday + dueNow;
  rings.push({ key: 'tasks', label: 'To-dos', done: doneToday, total: tTotal, status: tTotal ? `${doneToday}/${tTotal}` : 'Clear' });

  // Move: today's planned workout (rest days count as done)
  const trained = i.sessions.some(s => isToday(s.date, i.today));
  const rest = i.plan?.splitDay === 'rest';
  rings.push({
    key: 'move', label: 'Workout',
    done: trained || rest ? 1 : 0, total: 1,
    status: trained ? 'Done' : rest ? 'Rest day' : i.plan ? `${cap(i.plan.splitDay)} day` : 'Not yet',
  });

  // People: people due a check-in + commitments due, vs what you handled today
  if (i.contacts.length > 0) {
    const withGoal = i.contacts.filter(c => c.interactionGoalDays);
    const talkedToday = new Set(i.interactions.filter(x => isToday(x.date, i.today)).map(x => x.contactId));
    const due = withGoal.filter(c => talkedToday.has(c.id) || ['overdue', 'due-soon'].includes(i.streakStatus(c)));
    const handled = due.filter(c => talkedToday.has(c.id)).length;
    const kDue = i.commitments.filter(c => !c.completedAt && c.dueDate && daysBetween(i.today, dateKeyOf(c.dueDate)) <= 0).length;
    const kDone = i.commitments.filter(c => isToday(c.completedAt, i.today)).length;
    const done = handled + kDone;
    const total = due.length + kDue + kDone;
    rings.push({ key: 'people', label: 'People', done, total, status: total ? `${done}/${total}` : 'All caught up' });
  }

  return rings;
}

/** Overall score for the center of the rings: the average fill of rings that have something to do. */
export function overallScore(rings: Ring[]): number {
  const active = rings.filter(r => r.total > 0);
  if (active.length === 0) return 100;
  return Math.round((active.reduce((s, r) => s + Math.min(1, r.done / r.total), 0) / active.length) * 100);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
