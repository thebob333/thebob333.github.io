/**
 * Schema versioning for everything in localStorage.
 *
 * `migrateData` is pure and shared by app startup and backup import, so an old
 * backup file is upgraded exactly like old on-device data.
 */
import { KEYS, META_KEYS, CIRCLE_RINGS, INFLUENCE_TAGS, RELATIONSHIP_TAGS, type StorageKey } from '@/lib/storage';
import { getStore, reloadAllStores, type Kind } from '@/lib/store';
import { addDays, isDateKey, todayKey, type DateKey } from '@/lib/dates';

export type DataMap = Partial<Record<StorageKey, unknown>>;

export interface MigrationContext {
  now: Date;
  today: DateKey;
  newId(): string;
}

export interface Migration {
  version: number;
  name: string;
  up(d: DataMap, ctx: MigrationContext): void;
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

export function kindOf(key: StorageKey): Kind | undefined {
  return getStore(key)?.spec.kind;
}

export function matchesKind(v: unknown, kind: Kind | undefined): boolean {
  if (!kind) return false;
  if (kind === 'array') return Array.isArray(v);
  if (kind === 'object') return isObj(v);
  return v === null || isObj(v);
}

// ─── Migrations ─────────────────────────────────────────────────────────────

const STATUSES = ['not_started', 'in_progress', 'complete'];

function fixTodo(td: Obj, i: number, ctx: MigrationContext): Obj {
  return {
    ...td,
    id: str(td.id) || ctx.newId(),
    title: str(td.title, 'Untitled'),
    done: Boolean(td.done),
    order: num(td.order, i),
  };
}

function fixHabit(h: Obj, ctx: MigrationContext): Obj {
  return {
    ...h,
    id: str(h.id) || ctx.newId(),
    title: str(h.title, 'Untitled habit'),
    frequency: str(h.frequency) || 'daily',
    active: h.active === undefined ? true : Boolean(h.active),
  };
}

function fixTask(t: Obj, i: number, ctx: MigrationContext): Obj {
  return {
    ...t,
    id: str(t.id) || ctx.newId(),
    title: str(t.title, 'Untitled task'),
    description: str(t.description),
    status: STATUSES.includes(t.status as string) ? t.status : 'not_started',
    order: num(t.order, i),
    todos: arr(t.todos).filter(isObj).map((td, j) => fixTodo(td, j, ctx)),
    habits: arr(t.habits).filter(isObj).map(h => fixHabit(h, ctx)),
    notes: arr(t.notes).filter(isObj),
  };
}

function fixPhase(p: Obj, i: number, ctx: MigrationContext): Obj {
  return {
    ...p,
    id: str(p.id) || ctx.newId(),
    title: str(p.title, `Phase ${i + 1}`),
    description: str(p.description),
    order: num(p.order, i),
    tasks: arr(p.tasks).filter(isObj).map((t, j) => fixTask(t, j, ctx)),
  };
}

function fixGoal(g: Obj, ctx: MigrationContext): Obj {
  return {
    ...g,
    id: str(g.id) || ctx.newId(),
    title: str(g.title, 'Untitled goal'),
    description: str(g.description),
    endGoal: str(g.endGoal),
    createdAt: str(g.createdAt) || ctx.now.toISOString(),
    phases: arr(g.phases).filter(isObj).map((p, i) => fixPhase(p, i, ctx)),
  };
}

function fixGoalTemplate(t: Obj, ctx: MigrationContext): Obj {
  return {
    ...t,
    id: str(t.id) || ctx.newId(),
    name: str(t.name, 'Untitled blueprint'),
    description: str(t.description),
    endGoal: str(t.endGoal),
    createdAt: str(t.createdAt) || ctx.now.toISOString(),
    phases: arr(t.phases).filter(isObj).map(p => ({
      ...p,
      title: str(p.title, 'Phase'),
      description: str(p.description),
      tasks: arr(p.tasks).filter(isObj).map(task => ({
        ...task,
        title: str(task.title, 'Task'),
        description: str(task.description),
        // Older blueprints store to-dos as plain strings; newer ones as objects.
        todos: arr(task.todos).filter(x => typeof x === 'string' || (isObj(x) && typeof x.title === 'string')),
        habits: arr(task.habits).filter(isObj).map(h => ({
          ...h,
          title: str(h.title, 'Habit'),
          frequency: str(h.frequency) || 'daily',
        })),
      })),
    })),
  };
}

/** The UTC date the OLD code produced for a local calendar day (it used toISOString on local midnight). */
function legacyUtcKey(k: DateKey): string {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d).toISOString().slice(0, 10);
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'top-level-shape',
    up(d) {
      for (const key of Object.values(KEYS)) {
        if (!(key in d)) continue;
        if (d[key] === null || !matchesKind(d[key], kindOf(key))) delete d[key];
      }
      const plan = d[KEYS.WEEKLY_PLAN];
      if (isObj(plan)) {
        if (!Array.isArray(plan.days)) {
          delete d[KEYS.WEEKLY_PLAN];
        } else {
          d[KEYS.WEEKLY_PLAN] = {
            ...plan,
            days: plan.days.filter(isObj).map(day => ({
              ...day,
              day: str(day.day),
              splitDay: str(day.splitDay) || 'rest',
              exercises: arr(day.exercises).filter((x): x is string => typeof x === 'string'),
            })),
          };
        }
      }
    },
  },
  {
    version: 2,
    name: 'goal-tree-backfill',
    up(d, ctx) {
      if (Array.isArray(d[KEYS.GOALS])) {
        d[KEYS.GOALS] = (d[KEYS.GOALS] as unknown[]).filter(isObj).map(g => fixGoal(g, ctx));
      }
      if (Array.isArray(d[KEYS.GOAL_TEMPLATES])) {
        d[KEYS.GOAL_TEMPLATES] = (d[KEYS.GOAL_TEMPLATES] as unknown[]).filter(isObj).map(t => fixGoalTemplate(t, ctx));
      }
    },
  },
  {
    version: 3,
    name: 'contacts-defaults',
    up(d, ctx) {
      const contacts = d[KEYS.CONTACTS];
      if (!Array.isArray(contacts)) return;
      const fixed = contacts.filter(isObj).map(c => ({
        ...c,
        id: str(c.id) || ctx.newId(),
        name: str(c.name, 'Unnamed'),
        relationship: RELATIONSHIP_TAGS.includes(c.relationship as never) ? c.relationship : 'other',
        circleRing: CIRCLE_RINGS.includes(c.circleRing as never) ? c.circleRing : 'distant',
        influenceTag: INFLUENCE_TAGS.includes(c.influenceTag as never) ? c.influenceTag : 'neutral',
        notes: str(c.notes),
        plan: str(c.plan),
        createdAt: str(c.createdAt) || ctx.now.toISOString(),
      }));
      d[KEYS.CONTACTS] = fixed;
      const ids = new Set(fixed.map(c => c.id));
      for (const key of [KEYS.INTERACTIONS, KEYS.COMMITMENTS, KEYS.RELATIONSHIP_GOALS] as const) {
        if (Array.isArray(d[key])) {
          d[key] = (d[key] as unknown[]).filter(x => isObj(x) && ids.has(x.contactId as string));
        }
      }
    },
  },
  {
    version: 4,
    name: 'settings-sanitize',
    up(d) {
      const s = d[KEYS.SETTINGS];
      if (!isObj(s)) return;
      const targets: Record<string, number> = {};
      if (isObj(s.goldTargets)) {
        for (const [k, v] of Object.entries(s.goldTargets)) {
          if (typeof v === 'number' && Number.isFinite(v) && v > 0) targets[k] = v;
        }
      }
      const bw = s.bodyweight;
      d[KEYS.SETTINGS] = {
        ...s,
        goldTargets: targets,
        bodyweight: typeof bw === 'number' && Number.isFinite(bw) && bw >= 50 ? bw : 180,
        customQuotes: arr(s.customQuotes).filter((x): x is string => typeof x === 'string'),
        quotesEnabled: s.quotesEnabled === undefined ? true : Boolean(s.quotesEnabled),
        ambientSoundEnabled: Boolean(s.ambientSoundEnabled),
      };
    },
  },
  {
    version: 5,
    name: 'local-date-cutover',
    up(d, ctx) {
      // Habit logs: clamp future dates (written by the old UTC code on the
      // evening of the update) and merge duplicates for the same day.
      if (Array.isArray(d[KEYS.HABIT_LOGS])) {
        const byKey = new Map<string, Obj>();
        for (const raw of d[KEYS.HABIT_LOGS] as unknown[]) {
          if (!isObj(raw) || typeof raw.habitId !== 'string' || !isDateKey(raw.date)) continue;
          const date = raw.date > ctx.today ? ctx.today : raw.date;
          const k = `${raw.habitId}|${date}`;
          const prev = byKey.get(k);
          byKey.set(k, prev
            ? { ...prev, ...raw, date, completed: Boolean(prev.completed) || Boolean(raw.completed) }
            : { ...raw, date, completed: Boolean(raw.completed) });
        }
        d[KEYS.HABIT_LOGS] = [...byKey.values()];
      }
      // Time blocks were keyed by toISOString() of LOCAL midnight — exactly
      // recoverable. West of UTC this is a no-op; east of UTC it shifts +1 day.
      if (Array.isArray(d[KEYS.TIME_BLOCKS])) {
        d[KEYS.TIME_BLOCKS] = (d[KEYS.TIME_BLOCKS] as unknown[]).filter(isObj).map(b => {
          const k = b.dayName;
          if (!isDateKey(k)) return b;
          const local = [k, addDays(k, 1)].find(c => legacyUtcKey(c) === k) ?? k;
          return local === k ? b : { ...b, dayName: local };
        });
      }
    },
  },
];

export const CURRENT_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export function defaultContext(now = new Date()): MigrationContext {
  return { now, today: todayKey(now), newId: () => crypto.randomUUID() };
}

/** Pure: never mutates its input. */
export function migrateData(input: DataMap, from: number, ctx: MigrationContext = defaultContext()): { data: DataMap; applied: string[] } {
  const data = JSON.parse(JSON.stringify(input ?? {})) as DataMap;
  const applied: string[] = [];
  for (const m of MIGRATIONS) {
    if (m.version > from) {
      m.up(data, ctx);
      applied.push(`v${m.version} ${m.name}`);
    }
  }
  return { data, applied };
}

// ─── Raw storage helpers ────────────────────────────────────────────────────

export type RawMap = Map<StorageKey, string | null>;

export function readAllRaw(): RawMap {
  const m: RawMap = new Map();
  for (const key of Object.values(KEYS)) {
    let v: string | null = null;
    try {
      v = localStorage.getItem(key);
    } catch {
      v = null;
    }
    m.set(key, v);
  }
  return m;
}

/** Parse raw values; unreadable keys are left out (the store quarantines them on read). */
export function parseRaw(raw: RawMap): { data: DataMap; unreadable: StorageKey[] } {
  const data: DataMap = {};
  const unreadable: StorageKey[] = [];
  raw.forEach((v, k) => {
    if (v === null) return;
    try {
      data[k] = JSON.parse(v);
    } catch {
      unreadable.push(k);
    }
  });
  return { data, unreadable };
}

/** Write every entry (null = remove). On any failure, restores the touched keys and returns false. */
export function writeRawWithRollback(next: RawMap, rollback: RawMap): boolean {
  const touched: StorageKey[] = [];
  try {
    next.forEach((v, k) => {
      touched.push(k);
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    });
    return true;
  } catch {
    for (const k of touched) {
      const prev = rollback.get(k) ?? null;
      try {
        if (prev === null) localStorage.removeItem(k);
        else localStorage.setItem(k, prev);
      } catch {
        /* best effort */
      }
    }
    return false;
  }
}

/** Diff migrated data against the raw originals; only changed keys are written. */
export function diffForWrite(original: RawMap, migrated: DataMap, considered: StorageKey[]): RawMap {
  const next: RawMap = new Map();
  for (const key of considered) {
    const before = original.get(key) ?? null;
    const after = key in migrated ? JSON.stringify(migrated[key]) : null;
    if (after !== before) next.set(key, after);
  }
  return next;
}

export function getStoredSchemaVersion(): number | null {
  try {
    const v = localStorage.getItem(META_KEYS.SCHEMA_VERSION);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

function setStoredSchemaVersion(v: number) {
  localStorage.setItem(META_KEYS.SCHEMA_VERSION, String(v));
}

export type StartupResult =
  | { status: 'fresh' | 'current' | 'migrated'; from: number; to: number; applied: string[] }
  | { status: 'newer'; stored: number }
  | { status: 'failed'; from: number; error: unknown };

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), ms))]);
}

export async function runStartupMigrations(opts: {
  snapshot?: (raw: RawMap) => Promise<unknown>;
  ctx?: MigrationContext;
} = {}): Promise<StartupResult> {
  const stored = getStoredSchemaVersion();
  const raw = readAllRaw();
  const hasData = [...raw.values()].some(v => v !== null);

  if (stored === null && !hasData) {
    try {
      setStoredSchemaVersion(CURRENT_SCHEMA_VERSION);
    } catch {
      /* ignore */
    }
    return { status: 'fresh', from: CURRENT_SCHEMA_VERSION, to: CURRENT_SCHEMA_VERSION, applied: [] };
  }

  const from = stored ?? 0;
  if (from > CURRENT_SCHEMA_VERSION) return { status: 'newer', stored: from };
  if (from === CURRENT_SCHEMA_VERSION) {
    return { status: 'current', from, to: from, applied: [] };
  }

  if (opts.snapshot) {
    try {
      await withTimeout(opts.snapshot(raw), 1500);
    } catch {
      /* a snapshot failure must not block startup */
    }
  }

  try {
    const { data: parsed, unreadable } = parseRaw(raw);
    const { data, applied } = migrateData(parsed, from, opts.ctx);
    const considered = (Object.values(KEYS) as StorageKey[]).filter(k => !unreadable.includes(k));
    const next = diffForWrite(raw, data, considered);
    if (!writeRawWithRollback(next, raw)) {
      return { status: 'failed', from, error: new Error('Could not save upgraded data (storage may be full).') };
    }
    try {
      setStoredSchemaVersion(CURRENT_SCHEMA_VERSION);
    } catch (err) {
      writeRawWithRollback(new Map([...next.keys()].map(k => [k, raw.get(k) ?? null])), raw);
      return { status: 'failed', from, error: err };
    }
    reloadAllStores();
    return { status: 'migrated', from, to: CURRENT_SCHEMA_VERSION, applied };
  } catch (error) {
    return { status: 'failed', from, error };
  }
}
