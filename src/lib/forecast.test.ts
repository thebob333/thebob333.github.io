import { describe, expect, it } from 'vitest';
import { goalForecast, metricForecast, stepForecast, vsDeadline } from './forecast';
import type { Goal, MetricEntry } from '@/types/goals';

const TODAY = '2026-11-25';
const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g', title: 'x', description: '', endGoal: '', createdAt: '', shape: 'better',
  metric: { name: '5K', unit: 'min', start: 32, target: 25, higherIsBetter: false }, phases: [], ...over,
});
const e = (date: string, value: number): MetricEntry => ({ id: date, goalId: 'g', date, value });

describe('metric forecast', () => {
  it('needs enough data', () => {
    expect(metricForecast(goal(), [e('2026-11-20', 30), e('2026-11-24', 29.5)], TODAY).kind).toBe('not-enough');
  });

  it('gives a range around the trend', () => {
    // Improving ~1 minute every 10 days; at 27.1 on Nov 15 → about 3 weeks more to 25.
    const entries = [e('2026-10-06', 31), e('2026-10-16', 30.1), e('2026-10-26', 28.9), e('2026-11-05', 28), e('2026-11-15', 27.1)];
    const f = metricForecast(goal(), entries, TODAY);
    expect(f.kind).toBe('range');
    if (f.kind !== 'range') return;
    expect(f.from <= f.likely && f.likely <= f.to).toBe(true);
    expect(f.likely > '2026-11-30' && f.likely < '2026-12-20').toBe(true);
    expect(f.to > f.from).toBe(true);
    expect(vsDeadline(f, '2027-06-01')).toBe('ahead');
    expect(vsDeadline(f, '2026-12-01')).toBe('behind');
  });

  it('says stalled when moving the wrong way, done when there', () => {
    expect(metricForecast(goal(), [e('2026-10-01', 28), e('2026-10-20', 29), e('2026-11-10', 30)], TODAY).kind).toBe('stalled');
    expect(metricForecast(goal(), [e('2026-10-01', 28), e('2026-10-20', 26), e('2026-11-10', 24.9)], TODAY).kind).toBe('done');
  });

  it('never forecasts become or keep-up goals', () => {
    expect(goalForecast(goal({ shape: 'become' }), [], TODAY)).toBeNull();
    expect(goalForecast(goal({ shape: 'keep' }), [], TODAY)).toBeNull();
  });
});

describe('step forecast', () => {
  const withSteps = (done: string[], open: number): Goal => goal({
    shape: 'build', metric: undefined,
    phases: [{ id: 'p', title: 'p', description: '', order: 0, tasks: [{ id: 't', title: 't', description: '', status: 'in_progress', order: 0, habits: [],
      todos: [...done.map((d, i) => ({ id: `d${i}`, title: 'd', done: true, doneAt: `${d}T12:00:00`, order: i })), ...Array.from({ length: open }, (_, i) => ({ id: `o${i}`, title: 'o', done: false, order: 100 + i }))] }] }],
  });

  it('projects remaining steps at the recent pace, leaning later', () => {
    const f = stepForecast(withSteps(['2026-10-30', '2026-11-04', '2026-11-11', '2026-11-18', '2026-11-24'], 10), TODAY);
    expect(f.kind).toBe('range');
    if (f.kind === 'range') expect(f.from < f.likely && f.likely < f.to).toBe(true);
  });

  it('done and not-enough cases', () => {
    expect(stepForecast(withSteps(['2026-11-01', '2026-11-05', '2026-11-09'], 0), TODAY).kind).toBe('done');
    expect(stepForecast(withSteps(['2026-11-20'], 4), TODAY).kind).toBe('not-enough');
  });
});
