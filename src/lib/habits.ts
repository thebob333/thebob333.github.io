import { Goal, Habit, HabitLog } from '@/types/goals';
import { addDays, dayOfWeek, startOfWeekKey, todayKey, type DateKey } from '@/lib/dates';
import { doneBetween, inRestart, isPracticeDue, perWeekOf, weekStart } from '@/lib/practice';

/** Today's LOCAL calendar date (kept under the old name for existing callers). */
export function getTodayKey(): DateKey {
  return todayKey();
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_ABBRS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_ALIASES: Record<string, number> = { tues: 2, weds: 3, thur: 4, thurs: 4 };

/** Which weekdays (0=Sun) a frequency string names, matched as whole words ("monthly" is not "mon"). */
export function mentionedDays(freq: string): number[] {
  const words = freq.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const days = new Set<number>();
  for (const w of words) {
    const i = DAY_NAMES.indexOf(w);
    if (i >= 0) days.add(i);
    const j = DAY_ABBRS.indexOf(w);
    if (j >= 0) days.add(j);
    if (w in DAY_ALIASES) days.add(DAY_ALIASES[w]);
    // plurals like "mondays"
    if (w.endsWith('s')) {
      const k = DAY_NAMES.indexOf(w.slice(0, -1));
      if (k >= 0) days.add(k);
    }
  }
  return [...days];
}

export function isHabitDueToday(habit: Habit, day: DateKey = todayKey()): boolean {
  if (!habit.active) return false;
  const freq = (habit.frequency || 'daily').toLowerCase().trim();
  const dow = dayOfWeek(day);
  if (freq === 'daily') return true;
  if (freq === 'weekdays') return dow >= 1 && dow <= 5;
  if (freq === 'weekends') return dow === 0 || dow === 6;
  // "3x/week", "4x/week" etc — show it, user decides which days
  if (/^\d+x\/week$/i.test(freq)) return true;
  // Specific day mentions: "mon/wed/fri", "tuesday, thursday"
  const days = mentionedDays(freq);
  if (days.length > 0) return days.includes(dow);
  return true; // default: show it
}

export function isHabitCompletedOn(habitId: string, date: string, logs: HabitLog[]): boolean {
  return logs.some(l => l.habitId === habitId && l.date === date && l.completed);
}

export function getHabitLogForDate(habitId: string, date: string, logs: HabitLog[]): HabitLog | undefined {
  return logs.find(l => l.habitId === habitId && l.date === date);
}

function completedDates(habitId: string, logs: HabitLog[]): Set<string> {
  const s = new Set<string>();
  for (const l of logs) if (l.habitId === habitId && l.completed) s.add(l.date);
  return s;
}

/** Consecutive completed days ending today (or yesterday, if today isn't done yet). */
export function getCurrentStreak(habitId: string, logs: HabitLog[], today: DateKey = todayKey()): number {
  const done = completedDates(habitId, logs);
  if (done.size === 0) return 0;
  let cursor = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(cursor) && streak < 3650) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function getLongestStreak(habitId: string, logs: HabitLog[]): number {
  const dates = [...completedDates(habitId, logs)].sort();
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    if (addDays(dates[i - 1], 1) === dates[i]) {
      current++;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

export function getWeeklyCompletionRate(habitId: string, logs: HabitLog[], frequency: string, today: DateKey = todayKey()): number {
  const weekStart = startOfWeekKey(today, 0);
  let completedDays = 0;
  completedDates(habitId, logs).forEach(d => {
    if (d >= weekStart && d <= today) completedDays++;
  });

  const freq = (frequency || 'daily').toLowerCase();
  let targetDays = 7;
  if (freq === 'weekdays') targetDays = 5;
  else if (freq === 'weekends') targetDays = 2;
  else {
    const match = freq.match(/^(\d+)x\/week$/i);
    if (match) targetDays = Math.max(1, parseInt(match[1]));
    else {
      const days = mentionedDays(freq);
      if (days.length > 0) targetDays = days.length;
    }
  }
  return Math.min(1, completedDays / targetDays);
}

export interface HabitStats {
  habitId: string;
  currentStreak: number;
  longestStreak: number;
  weeklyRate: number;
  totalCompletions: number;
}

export function getHabitStats(habitId: string, frequency: string, logs: HabitLog[]): HabitStats {
  return {
    habitId,
    currentStreak: getCurrentStreak(habitId, logs),
    longestStreak: getLongestStreak(habitId, logs),
    weeklyRate: getWeeklyCompletionRate(habitId, logs, frequency),
    totalCompletions: completedDates(habitId, logs).size,
  };
}

/** Get all active habits from all goals, flattened with their parent context */
export interface FlatHabit {
  habit: Habit;
  goalId: string;
  goalTitle: string;
  taskId: string;
  taskTitle: string;
}

/**
 * Returns active habits from ALL non-complete tasks in the current phase per goal.
 * "Current phase" = the first phase that has any non-complete task.
 * This allows parallel habits (e.g., swim + bike + run + nutrition in an Ironman plan)
 * while preventing future-phase habits from showing.
 */
export function getAllActiveHabits(goals: Goal[]): FlatHabit[] {
  const result: FlatHabit[] = [];
  for (const goal of goals) {
    if (goal.archived || (goal.status && goal.status !== 'active')) continue;
    for (const phase of goal.phases ?? []) {
      const tasks = phase.tasks ?? [];
      const isTaskComplete = (t: (typeof tasks)[number]) => {
        const todos = t.todos ?? [];
        return todos.length > 0 ? todos.every(td => td.done) : t.status === 'complete';
      };
      if (!tasks.some(t => !isTaskComplete(t))) continue;
      for (const task of tasks) {
        if (isTaskComplete(task)) continue;
        for (const habit of task.habits ?? []) {
          if (habit.active) {
            result.push({ habit, goalId: goal.id, goalTitle: goal.title, taskId: task.id, taskTitle: task.title });
          }
        }
      }
      break; // only current phase — don't show future phases
    }
  }
  return result;
}

export function getTodaysHabits(
  goals: Goal[],
  logs: HabitLog[],
  today: DateKey = todayKey(),
): (FlatHabit & { completed: boolean; streak: number; weekDone: number; perWeek: number; restart: boolean })[] {
  const ws = weekStart(today);
  return getAllActiveHabits(goals)
    .filter(fh => isPracticeDue(fh.habit, logs, today))
    .map(fh => ({
      ...fh,
      completed: isHabitCompletedOn(fh.habit.id, today, logs),
      streak: getCurrentStreak(fh.habit.id, logs, today),
      weekDone: doneBetween(fh.habit.id, logs, ws, today),
      perWeek: perWeekOf(fh.habit),
      restart: inRestart(fh.habit, today),
    }));
}
