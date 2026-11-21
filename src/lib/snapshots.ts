/**
 * Automatic local safety copies of all app data, kept in IndexedDB (not
 * localStorage — iOS gives localStorage ~5 MB and copies there would eat the
 * space real data needs).
 *
 * Snapshots protect against bugs and bad imports. They do NOT protect against
 * the browser wiping site data — only an exported backup file survives that.
 */
import { KEYS, type StorageKey } from '@/lib/storage';
import { toDateKey } from '@/lib/dates';
import { readAllRaw, type RawMap } from '@/lib/migrations';

export type SnapshotReason = 'daily' | 'pre-migration' | 'pre-import' | 'pre-reset' | 'pre-clear' | 'manual';

export interface SnapshotMeta {
  id: string;
  reason: SnapshotReason;
  createdAt: string;
  schemaVersion: number | null;
  bytes: number;
}

export interface Snapshot extends SnapshotMeta {
  data: Partial<Record<StorageKey, string>>;
}

export interface SnapshotBackend {
  put(s: Snapshot): Promise<void>;
  list(): Promise<SnapshotMeta[]>;
  get(id: string): Promise<Snapshot | undefined>;
  remove(id: string): Promise<void>;
}

const DAILY_KEEP = 7;
const NAMED_KEEP = 5;

// ─── Backends ───────────────────────────────────────────────────────────────

export function createMemoryBackend(): SnapshotBackend {
  const m = new Map<string, Snapshot>();
  return {
    async put(s) { m.set(s.id, s); },
    async list() { return [...m.values()].map(({ data: _d, ...meta }) => meta); },
    async get(id) { return m.get(id); },
    async remove(id) { m.delete(id); },
  };
}

function createIdbBackend(): SnapshotBackend {
  const DB = 'telos-snapshots';
  const STORE = 'snapshots';
  let dbPromise: Promise<IDBDatabase> | null = null;

  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      dbPromise.catch(() => { dbPromise = null; });
    }
    return dbPromise;
  };

  const tx = async <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  };

  return {
    async put(s) { await tx('readwrite', st => st.put(s)); },
    async list() {
      const all = await tx<Snapshot[]>('readonly', st => st.getAll() as IDBRequest<Snapshot[]>);
      return all.map(({ data: _d, ...meta }) => meta);
    },
    async get(id) { return tx<Snapshot | undefined>('readonly', st => st.get(id) as IDBRequest<Snapshot | undefined>); },
    async remove(id) { await tx('readwrite', st => st.delete(id)); },
  };
}

let backend: SnapshotBackend | null = null;

function getBackend(): SnapshotBackend {
  if (!backend) {
    backend = typeof indexedDB !== 'undefined' ? createIdbBackend() : createMemoryBackend();
  }
  return backend;
}

/** Tests inject an in-memory backend (jsdom has no IndexedDB). */
export function setSnapshotBackend(b: SnapshotBackend | null) {
  backend = b;
}

export function snapshotsAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

// ─── API ────────────────────────────────────────────────────────────────────

function currentSchemaVersion(): number | null {
  try {
    const v = localStorage.getItem('telos_schema_version');
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export async function saveSnapshot(reason: SnapshotReason, raw: RawMap = readAllRaw()): Promise<boolean> {
  try {
    const data: Partial<Record<StorageKey, string>> = {};
    let bytes = 0;
    raw.forEach((v, k) => {
      if (v !== null) {
        data[k] = v;
        bytes += v.length;
      }
    });
    if (bytes === 0) return false; // nothing worth keeping
    const snap: Snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      reason,
      createdAt: new Date().toISOString(),
      schemaVersion: currentSchemaVersion(),
      bytes,
      data,
    };
    await getBackend().put(snap);
    await prune();
    return true;
  } catch {
    return false;
  }
}

export async function listSnapshots(): Promise<SnapshotMeta[]> {
  try {
    const all = await getBackend().list();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function getSnapshot(id: string): Promise<Snapshot | undefined> {
  try {
    return await getBackend().get(id);
  } catch {
    return undefined;
  }
}

async function prune() {
  const all = await listSnapshots();
  const daily = all.filter(s => s.reason === 'daily');
  const named = all.filter(s => s.reason !== 'daily');
  const drop = [...daily.slice(DAILY_KEEP), ...named.slice(NAMED_KEEP)];
  for (const s of drop) await getBackend().remove(s.id);
}

/** Take at most one 'daily' snapshot per local calendar day. */
export async function maybeDailySnapshot(now = new Date()): Promise<boolean> {
  const today = toDateKey(now);
  const all = await listSnapshots();
  if (all.some(s => s.reason === 'daily' && toDateKey(new Date(s.createdAt)) === today)) return false;
  return saveSnapshot('daily');
}

/** Turn a snapshot back into the key → raw-string map used by restore. */
export function snapshotToRaw(s: Snapshot): RawMap {
  const m: RawMap = new Map();
  for (const key of Object.values(KEYS)) m.set(key, s.data[key] ?? null);
  return m;
}

export async function requestPersistentStorage(): Promise<{ persisted: boolean; usage?: number; quota?: number }> {
  try {
    const sm = navigator.storage;
    if (!sm) return { persisted: false };
    let persisted = (await sm.persisted?.()) ?? false;
    if (!persisted && sm.persist) persisted = await sm.persist();
    const est = await sm.estimate?.();
    return { persisted, usage: est?.usage, quota: est?.quota };
  } catch {
    return { persisted: false };
  }
}

export const SNAPSHOT_REASON_LABELS: Record<SnapshotReason, string> = {
  daily: 'Daily auto-save',
  'pre-migration': 'Before app upgrade',
  'pre-import': 'Before import',
  'pre-reset': 'Before section reset',
  'pre-clear': 'Before clearing data',
  manual: 'Manual',
};
