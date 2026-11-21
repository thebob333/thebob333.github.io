import { describe, expect, it, vi } from 'vitest';
import { KEYS, stores } from '@/lib/storage';
import { buildBackup, clearAllData, exportAllData, parseBackup, restoreBackup, restoreSnapshotById } from './backup';
import { listSnapshots } from './snapshots';

const seed = () => {
  localStorage.setItem(KEYS.GOALS, JSON.stringify([{ id: 'g', title: 'Goal', phases: [] }]));
  localStorage.setItem(KEYS.WEEKLY_FOCUS, JSON.stringify(['g']));
  localStorage.setItem(KEYS.GOAL_TEMPLATES, JSON.stringify([{ id: 't', name: 'Tpl', phases: [] }]));
  localStorage.setItem(KEYS.CONTACTS, JSON.stringify([{ id: 'c', name: 'Sam', circleRing: 'core', influenceTag: 'neutral', relationship: 'friend', notes: '', plan: '', createdAt: 'x' }]));
  localStorage.setItem('telos_schema_version', '5');
};

describe('backup', () => {
  it('exports every data key that has a value — including the two the old export missed', () => {
    for (const key of Object.values(KEYS)) localStorage.setItem(key, key.includes('settings') || key.includes('schedule') ? '{}' : key.includes('weekly_plan') ? '{"days":[]}' : '[]');
    const b = buildBackup();
    expect(Object.keys(b.data).sort()).toEqual(Object.values(KEYS).sort());
    expect(b.app).toBe('telos');
    expect(b.data).toHaveProperty(KEYS.WEEKLY_FOCUS);
    expect(b.data).toHaveProperty(KEYS.GOAL_TEMPLATES);
  });

  it('round-trips: export → clear → restore gives identical data', async () => {
    seed();
    const json = exportAllData();
    const before = Object.fromEntries(Object.values(KEYS).map(k => [k, localStorage.getItem(k)]));
    await clearAllData();
    expect(stores.GOALS.get()).toEqual([]);

    const parsed = parseBackup(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const r = await restoreBackup(parsed.backup, { replaceAll: !parsed.legacy });
    expect(r.ok).toBe(true);
    const after = Object.fromEntries(Object.values(KEYS).map(k => [k, localStorage.getItem(k)]));
    // Contents identical after migration-normalization of the goal tree.
    expect(JSON.parse(after[KEYS.WEEKLY_FOCUS]!)).toEqual(JSON.parse(before[KEYS.WEEKLY_FOCUS]!));
    expect(JSON.parse(after[KEYS.CONTACTS]!)).toEqual(JSON.parse(before[KEYS.CONTACTS]!));
    expect(stores.GOALS.get()[0].title).toBe('Goal'); // stores reloaded without a page refresh
  });

  it('accepts old-format exports and upgrades them', () => {
    const legacy = JSON.stringify({ goals: [{ id: 'g', title: 'Old', phases: [{ id: 'p', title: 'P', tasks: [{ id: 't', title: 'T', todos: [] }] }] }], contacts: [] });
    const parsed = parseBackup(legacy);
    expect(parsed.ok && parsed.legacy).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary.find(s => s.key === KEYS.GOALS)?.count).toBe(1);
  });

  it('legacy restore only overwrites the sections in the file', async () => {
    seed();
    const parsed = parseBackup(JSON.stringify({ goals: [] }));
    if (!parsed.ok) throw new Error('parse failed');
    await restoreBackup(parsed.backup, { replaceAll: false });
    expect(stores.GOALS.get()).toEqual([]);
    expect(stores.WEEKLY_FOCUS.get()).toEqual(['g']);
  });

  it('rejects non-TELOS files, future versions and wrong shapes', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"hello":"world"}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'telos', schemaVersion: 999, data: { telos_goals: [] } })).ok).toBe(false);
    const wrong = parseBackup(JSON.stringify({ app: 'telos', schemaVersion: 5, data: { telos_goals: {}, telos_contacts: [] } }));
    expect(wrong.ok).toBe(true);
    if (wrong.ok) expect(wrong.warnings.join(' ')).toMatch(/Goals/);
  });

  it('a storage-full error mid-restore rolls everything back', async () => {
    seed();
    const before = localStorage.getItem(KEYS.GOALS);
    const parsed = parseBackup(JSON.stringify({ app: 'telos', schemaVersion: 5, data: { telos_goals: [{ id: 'new', title: 'New', phases: [] }], telos_contacts: [] } }));
    if (!parsed.ok) throw new Error('parse failed');
    const real = Storage.prototype.setItem;
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === KEYS.CONTACTS && v === '[]') throw new DOMException('full', 'QuotaExceededError');
      return real.call(this, k, v);
    });
    const r = await restoreBackup(parsed.backup, { replaceAll: false });
    spy.mockRestore();
    expect(r.ok).toBe(false);
    expect(localStorage.getItem(KEYS.GOALS)).toBe(before);
  });

  it('clearing data saves a safety copy that can be restored', async () => {
    seed();
    await clearAllData();
    const snaps = await listSnapshots();
    const pre = snaps.find(s => s.reason === 'pre-clear');
    expect(pre).toBeTruthy();
    await restoreSnapshotById(pre!.id);
    expect(stores.WEEKLY_FOCUS.get()).toEqual(['g']);
  });
});
