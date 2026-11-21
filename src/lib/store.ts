/**
 * A tiny shared store per localStorage key.
 *
 * Why: previously every hook/component kept its own `useState` copy of
 * localStorage and saved from that (possibly stale) copy, so two saves in a row
 * could silently drop data. Every reader now shares ONE cached value per key and
 * every write goes through `update(prev => next)`, which always starts from the
 * latest value.
 *
 * No React or app imports here — see `useStore` for the React binding.
 */

export type Kind = 'array' | 'object' | 'nullable';

export interface StoreSpec<T> {
  key: string;
  /** Human-readable name shown in backups / recovery screens. */
  label: string;
  /** Expected top-level JSON shape; anything else falls back. */
  kind: Kind;
  /** Factory so arrays/objects are never shared between stores. */
  fallback: () => T;
  /** Cheap, idempotent shape fix applied on read (e.g. merge defaults). */
  normalize?: (v: T) => T;
}

export interface Store<T> {
  readonly key: string;
  readonly spec: StoreSpec<T>;
  /** Cached snapshot (stable reference until the value changes). */
  get(): T;
  /** Returns false if the write failed or is blocked; the cache is then unchanged. */
  set(next: T): boolean;
  /** `fn` runs once, synchronously, on the latest value. Returning `prev` is a no-op. */
  update(fn: (prev: T) => T): boolean;
  subscribe(listener: () => void): () => void;
  /** Re-read from localStorage; notifies only if the raw string changed. */
  reload(): void;
  /** Remove the key and fall back to defaults. */
  reset(): boolean;
}

export const CORRUPT_PREFIX = 'telos__corrupt:';

interface StoreHooks {
  onWriteError?(key: string, err: unknown): void;
  onReadError?(key: string, raw: string, err: unknown): void;
}

let hooks: StoreHooks = {};
let writesBlockedReason: string | null = null;
const registry = new Map<string, InternalStore<unknown>>();
let listenerAttached = false;

const IS_DEV = (() => {
  try {
    return Boolean(import.meta.env?.DEV);
  } catch {
    return false;
  }
})();

export function configureStores(h: StoreHooks) {
  hooks = { ...hooks, ...h };
}

export function setWritesBlocked(reason: string | null) {
  writesBlockedReason = reason;
}

export function getWritesBlockedReason() {
  return writesBlockedReason;
}

export function getStores(): Store<unknown>[] {
  return [...registry.values()];
}

export function getStore(key: string): Store<unknown> | undefined {
  return registry.get(key);
}

export function reloadAllStores() {
  registry.forEach(s => s.reload());
}

/** Test helper: forget every cached value (stores re-read lazily). */
export function __resetStoresForTests() {
  registry.forEach(s => s.__forget());
  writesBlockedReason = null;
  hooks = {};
}

function matchesKind(v: unknown, kind: Kind): boolean {
  if (kind === 'array') return Array.isArray(v);
  if (kind === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
  // nullable object
  return v === null || (typeof v === 'object' && !Array.isArray(v));
}

function deepFreeze<T>(v: T): T {
  if (!IS_DEV || v === null || typeof v !== 'object' || Object.isFrozen(v)) return v;
  Object.freeze(v);
  for (const k of Object.keys(v as object)) deepFreeze((v as Record<string, unknown>)[k]);
  return v;
}

function safeGetItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function attachStorageListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  listenerAttached = true;
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.storageArea && e.storageArea !== localStorage) return;
    if (e.key === null) {
      reloadAllStores();
      return;
    }
    registry.get(e.key)?.reload();
  });
}

interface InternalStore<T> extends Store<T> {
  __forget(): void;
}

export function createStore<T>(spec: StoreSpec<T>): Store<T> {
  let loaded = false;
  let raw: string | null = null;
  let value: T;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach(l => l());

  function parse(nextRaw: string | null): T {
    if (nextRaw === null) return spec.fallback();
    let parsed: unknown;
    try {
      parsed = JSON.parse(nextRaw);
    } catch (err) {
      // Keep the unreadable original before anything can overwrite it.
      try {
        localStorage.setItem(`${CORRUPT_PREFIX}${spec.key}:${Date.now()}`, nextRaw);
      } catch {
        /* quota — nothing more we can do */
      }
      hooks.onReadError?.(spec.key, nextRaw, err);
      return spec.fallback();
    }
    if (!matchesKind(parsed, spec.kind)) return spec.fallback();
    if (parsed === null) return spec.fallback();
    const v = parsed as T;
    return spec.normalize ? spec.normalize(v) : v;
  }

  function load() {
    raw = safeGetItem(spec.key);
    value = deepFreeze(parse(raw));
    loaded = true;
  }

  function ensureLoaded() {
    if (!loaded) load();
  }

  const store: InternalStore<T> = {
    key: spec.key,
    spec,

    get() {
      ensureLoaded();
      return value;
    },

    set(next: T) {
      ensureLoaded();
      if (writesBlockedReason) {
        hooks.onWriteError?.(spec.key, new Error(`Saving is paused: ${writesBlockedReason}`));
        return false;
      }
      let nextRaw: string;
      try {
        nextRaw = JSON.stringify(next);
      } catch (err) {
        hooks.onWriteError?.(spec.key, err);
        return false;
      }
      if (nextRaw === raw) {
        // Same content; still adopt the new reference so callers see what they passed.
        if (next !== value) {
          value = deepFreeze(next);
          notify();
        }
        return true;
      }
      try {
        localStorage.setItem(spec.key, nextRaw);
      } catch (err) {
        hooks.onWriteError?.(spec.key, err);
        return false;
      }
      raw = nextRaw;
      value = deepFreeze(next);
      notify();
      return true;
    },

    update(fn: (prev: T) => T) {
      ensureLoaded();
      // Another tab (or legacy code) may have written since we cached.
      if (safeGetItem(spec.key) !== raw) store.reload();
      const prev = value;
      const next = fn(prev);
      if (next === prev) return true;
      return store.set(next);
    },

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    reload() {
      if (!loaded) {
        load();
        notify();
        return;
      }
      const nextRaw = safeGetItem(spec.key);
      if (nextRaw === raw) return;
      raw = nextRaw;
      value = deepFreeze(parse(nextRaw));
      notify();
    },

    reset() {
      try {
        localStorage.removeItem(spec.key);
      } catch (err) {
        hooks.onWriteError?.(spec.key, err);
        return false;
      }
      store.reload();
      return true;
    },

    __forget() {
      loaded = false;
      raw = null;
      value = undefined as T;
    },
  };

  registry.set(spec.key, store as InternalStore<unknown>);
  attachStorageListener();
  return store;
}
