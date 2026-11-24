import { describe, expect, it, vi } from 'vitest';
import { KEYS, META_KEYS } from '@/lib/storage';
import {
  CURRENT_SCHEMA_VERSION, migrateData, runStartupMigrations, type MigrationContext,
} from './migrations';
import { withTimeZone } from '@/test/tz';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- fixtures are untyped legacy data
type Any = any;
let id = 0;
const ctx = (today = '2026-11-21'): MigrationContext => ({
  now: new Date('2026-11-21T12:00:00Z'),
  today,
  newId: () => `id-${++id}`,
});

describe('migrateData', () => {
  it('backfills goal tasks that predate habits (the Home/Plan/Goals crash)', () => {
    const { data } = migrateData({
      [KEYS.GOALS]: [{ id: 'g', title: 'Run', phases: [{ id: 'p', title: 'P', tasks: [{ id: 't', title: 'T', todos: [{ id: 'x', title: 'a' }] }] }] }],
    }, 0, ctx());
    const task = (data[KEYS.GOALS] as Any)[0].phases[0].tasks[0];
    expect(task.habits).toEqual([]);
    expect(task.status).toBe('not_started');
    expect(task.todos[0].done).toBe(false);
    expect(task.notes).toEqual([]);
  });

  it('backfills goal templates without habits', () => {
    const { data } = migrateData({
      [KEYS.GOAL_TEMPLATES]: [{ id: 'tp', name: 'X', phases: [{ title: 'P', tasks: [{ title: 'T', todos: ['a', 3] }] }] }],
    }, 0, ctx());
    const t = (data[KEYS.GOAL_TEMPLATES] as Any)[0].phases[0].tasks[0];
    expect(t.habits).toEqual([]);
    expect(t.todos).toEqual(['a']);
  });

  it('v6 removes People data and gives goals a shape and practices a weekly load', () => {
    const { data } = migrateData({
      telos_contacts: [{ id: 'c1', name: 'Sam' }],
      telos_interactions: [{ id: 'i1', contactId: 'c1' }],
      [KEYS.GOALS]: [
        { id: 'g1', title: 'Meditate', phases: [{ id: 'p', title: 'P', tasks: [{ id: 't', title: 'T', todos: [], habits: [{ id: 'h', title: 'Sit', frequency: 'mon/wed/fri' }] }] }] },
        { id: 'g2', title: 'Launch', phases: [{ id: 'p', title: 'P', tasks: [{ id: 't', title: 'T', todos: [1, 2, 3, 4, 5, 6].map(i => ({ id: `${i}`, title: 'x' })), habits: [] }] }, { id: 'p2', title: 'Q', tasks: [] }] },
      ],
    } as Any, 0, ctx());
    expect('telos_contacts' in data).toBe(false);
    expect('telos_interactions' in data).toBe(false);
    const [g1, g2] = data[KEYS.GOALS] as Any[];
    expect(g1.shape).toBe('keep');
    expect(g1.status).toBe('active');
    expect(g1.pushback).toBe('honest');
    const h = g1.phases[0].tasks[0].habits[0];
    expect(h).toMatchObject({ perWeek: 3, maxPerWeek: 3, auto: true, since: ctx().today });
    expect(g2.shape).toBe('build');
    // Idempotent.
    expect(migrateData(data, 5, ctx()).data).toEqual(data);
  });

  it('v7 keeps only valid task dependencies and effort numbers', () => {
    const { data } = migrateData({
      [KEYS.GOALS]: [{ id: 'g', title: 'Film', shape: 'once', status: 'active', pushback: 'honest', phases: [{ id: 'p', title: 'P', tasks: [
        { id: 'a', title: 'A', todos: [], habits: [], effortHours: 4 },
        { id: 'b', title: 'B', todos: [], habits: [], dependsOn: ['a', 'a', 'b', 'ghost', 3], effortHours: -2, waitDays: 'x' },
      ] }] }],
    } as Any, 6, ctx());
    const [a, b] = (data[KEYS.GOALS] as Any)[0].phases[0].tasks;
    expect(a.effortHours).toBe(4);
    expect(b.dependsOn).toEqual(['a']);
    expect('effortHours' in b).toBe(false);
    expect('waitDays' in b).toBe(false);
    expect(migrateData(data, 6, ctx()).data).toEqual(data);
  });

  it('v8 keeps the Arete skill tree state well-formed', () => {
    const good = { id: 'my.1', area: 'body', branch: 'Running', title: 'Mine', tier: 3, requires: ['body.running.start'], source: 'custom' };
    const { data } = migrateData({
      [KEYS.ARETE]: {
        claims: { a: { at: '2026-11-24', result: '7:42' }, b: 'yes', c: { result: 'no date' } },
        pinned: ['a', 'a', 4],
        grown: [good, { id: 'bad' }, 'junk'],
        goalLinks: { a: 'g1', b: 2 },
        started: true,
      },
    } as Any, 7, ctx());
    expect(data[KEYS.ARETE]).toEqual({ claims: { a: { at: '2026-11-24', result: '7:42' } }, pinned: ['a'], grown: [good], goalLinks: { a: 'g1' }, started: true });
    expect(migrateData(data, 7, ctx()).data).toEqual(data);
    // The wrong shape entirely is dropped so the default applies.
    expect(KEYS.ARETE in migrateData({ [KEYS.ARETE]: 'nope' } as Any, 0, ctx()).data).toBe(false);
  });

  it('sanitizes settings: null gold targets, zero bodyweight', () => {
    const { data } = migrateData({
      [KEYS.SETTINGS]: { goldTargets: null, bodyweight: 0, customQuotes: 'nope' },
    }, 0, ctx());
    const s = data[KEYS.SETTINGS] as Any;
    expect(s.goldTargets).toEqual({});
    expect(s.bodyweight).toBe(180);
    expect(s.customQuotes).toEqual([]);
  });

  it('drops values with the wrong top-level shape so defaults apply', () => {
    const { data } = migrateData({ [KEYS.GOALS]: { oops: true }, [KEYS.SETTINGS]: [1, 2] }, 0, ctx());
    expect(KEYS.GOALS in data).toBe(false);
    expect(KEYS.SETTINGS in data).toBe(false);
  });

  it('merges duplicate habit logs and clamps future dates', () => {
    const { data } = migrateData({
      [KEYS.HABIT_LOGS]: [
        { habitId: 'h', date: '2026-11-20', completed: false },
        { habitId: 'h', date: '2026-11-20', completed: true, value: 5 },
        { habitId: 'h', date: '2026-11-22', completed: true }, // UTC "tomorrow"
      ],
    }, 4, ctx('2026-11-21'));
    expect(data[KEYS.HABIT_LOGS]).toEqual([
      { habitId: 'h', date: '2026-11-20', completed: true, value: 5 },
      { habitId: 'h', date: '2026-11-21', completed: true },
    ]);
  });

  it('re-keys time blocks exactly: shifts east of UTC, no-op west of UTC', () => {
    const blocks = { [KEYS.TIME_BLOCKS]: [{ id: 'b', dayName: '2026-11-20' }, { id: 'w', dayName: 'Monday' }] };
    withTimeZone('Asia/Tokyo', () => {
      const { data } = migrateData(blocks, 4, ctx());
      expect((data[KEYS.TIME_BLOCKS] as Any[]).map(b => b.dayName)).toEqual(['2026-11-21', 'Monday']);
    });
    withTimeZone('America/New_York', () => {
      const { data } = migrateData(blocks, 4, ctx());
      expect((data[KEYS.TIME_BLOCKS] as Any[]).map(b => b.dayName)).toEqual(['2026-11-20', 'Monday']);
    });
  });

  it('is idempotent and never mutates its input', () => {
    const input = { [KEYS.GOALS]: [{ id: 'g', title: 'x', phases: [] }] };
    const frozen = JSON.stringify(input);
    const once = migrateData(input, 0, ctx()).data;
    const twice = migrateData(once, 0, ctx()).data;
    expect(twice).toEqual(once);
    expect(JSON.stringify(input)).toBe(frozen);
  });
});

describe('runStartupMigrations', () => {
  it('fresh install: just records the current version', async () => {
    const r = await runStartupMigrations();
    expect(r.status).toBe('fresh');
    expect(localStorage.getItem(META_KEYS.SCHEMA_VERSION)).toBe(String(CURRENT_SCHEMA_VERSION));
  });

  it('upgrades old data, snapshots first, writes only changed keys, version last', async () => {
    localStorage.setItem(KEYS.GOALS, JSON.stringify([{ id: 'g', title: 'x', phases: [{ id: 'p', title: 'p', tasks: [{ id: 't', title: 't', todos: [] }] }] }]));
    localStorage.setItem(KEYS.WEEKLY_FOCUS, JSON.stringify(['g']));
    const snapshot = vi.fn(async () => true);
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    const r = await runStartupMigrations({ snapshot, ctx: ctx() });
    expect(r.status).toBe('migrated');
    expect(snapshot).toHaveBeenCalledOnce();
    const writtenKeys = spy.mock.calls.map(c => c[0]);
    expect(writtenKeys).not.toContain(KEYS.WEEKLY_FOCUS);
    expect(writtenKeys[writtenKeys.length - 1]).toBe(META_KEYS.SCHEMA_VERSION);
    spy.mockRestore();
    expect(JSON.parse(localStorage.getItem(KEYS.GOALS)!)[0].phases[0].tasks[0].habits).toEqual([]);
  });

  it('leaves unreadable keys alone (the store quarantines them on read)', async () => {
    localStorage.setItem(KEYS.GOALS, '{corrupt');
    const r = await runStartupMigrations({ ctx: ctx() });
    expect(r.status).toBe('migrated');
    expect(localStorage.getItem(KEYS.GOALS)).toBe('{corrupt');
  });

  it('rolls back and does not bump the version when a write fails', async () => {
    const original = JSON.stringify([{ id: 'g', title: 'x', phases: [] }]);
    localStorage.setItem(KEYS.GOALS, original);
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === KEYS.GOALS && v !== original) throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, k, v);
    });
    const r = await runStartupMigrations({ ctx: ctx() });
    spy.mockRestore();
    expect(r.status).toBe('failed');
    expect(localStorage.getItem(KEYS.GOALS)).toBe(original);
    expect(localStorage.getItem(META_KEYS.SCHEMA_VERSION)).toBeNull();
  });

  it('reports data written by a newer app version', async () => {
    localStorage.setItem(KEYS.GOALS, '[]');
    localStorage.setItem(META_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION + 1));
    const r = await runStartupMigrations();
    expect(r.status).toBe('newer');
  });
});
