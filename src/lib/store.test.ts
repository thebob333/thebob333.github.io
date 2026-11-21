import { describe, expect, it, vi } from 'vitest';
import { configureStores, createStore, CORRUPT_PREFIX, setWritesBlocked } from './store';

let n = 0;
const makeStore = () => {
  const key = `test_store_${++n}`;
  return { key, store: createStore<number[]>({ key, label: 'Test', kind: 'array', fallback: () => [] }) };
};
const makeObjectStore = () => {
  const key = `test_store_${++n}`;
  return { key, store: createStore<Record<string, number>>({ key, label: 'Test', kind: 'object', fallback: () => ({ a: 1 }) }) };
};

describe('store', () => {
  it('reads lazily and returns the fallback for missing, null or wrong-shaped data', () => {
    const { key, store } = makeStore();
    expect(store.get()).toEqual([]);

    localStorage.setItem(key, 'null');
    store.reload();
    expect(store.get()).toEqual([]);

    localStorage.setItem(key, '{"not":"an array"}');
    store.reload();
    expect(store.get()).toEqual([]);
  });

  it('keeps a copy of corrupt JSON before falling back', () => {
    const { key, store } = makeStore();
    const onReadError = vi.fn();
    configureStores({ onReadError });
    localStorage.setItem(key, '{broken');
    expect(store.get()).toEqual([]);
    expect(onReadError).toHaveBeenCalled();
    const kept = Object.keys(localStorage).find(k => k.startsWith(`${CORRUPT_PREFIX}${key}:`));
    expect(kept && localStorage.getItem(kept)).toBe('{broken');
  });

  it('50 updates in a row keep all 50 items (the bulk-import bug)', () => {
    const { key, store } = makeStore();
    for (let i = 0; i < 50; i++) store.update(prev => [...prev, i]);
    expect(store.get()).toHaveLength(50);
    expect(JSON.parse(localStorage.getItem(key)!)).toHaveLength(50);
  });

  it('update() sees a write made outside the store before any storage event', () => {
    const { key, store } = makeStore();
    store.set([1]);
    localStorage.setItem(key, '[1,2]'); // e.g. another tab
    store.update(prev => [...prev, 3]);
    expect(store.get()).toEqual([1, 2, 3]);
  });

  it('returning prev is a no-op: no write, no notification', () => {
    const { store } = makeStore();
    store.set([1]);
    const listener = vi.fn();
    store.subscribe(listener);
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    store.update(prev => prev);
    expect(spy).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('a failed write (storage full) returns false and leaves the cache unchanged', () => {
    const { store } = makeStore();
    store.set([1]);
    const onWriteError = vi.fn();
    configureStores({ onWriteError });
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    expect(store.update(prev => [...prev, 2])).toBe(false);
    spy.mockRestore();
    expect(store.get()).toEqual([1]);
    expect(onWriteError).toHaveBeenCalled();
  });

  it('reloads when another tab writes (storage event), including a full clear', () => {
    const { key, store } = makeStore();
    store.set([1]);
    const listener = vi.fn();
    store.subscribe(listener);

    localStorage.setItem(key, '[9]');
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: '[9]', storageArea: localStorage }));
    expect(store.get()).toEqual([9]);

    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
    expect(store.get()).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('blocks writes while a newer app version owns the data', () => {
    const { store } = makeStore();
    setWritesBlocked('newer version');
    expect(store.set([1])).toBe(false);
    setWritesBlocked(null);
    expect(store.set([1])).toBe(true);
  });

  it('freezes cached values in development so accidental in-place edits throw', () => {
    const { store } = makeStore();
    store.set([1, 2]);
    expect(() => (store.get() as number[]).push(3)).toThrow();
  });

  it('reset() removes the key and falls back', () => {
    const { key, store } = makeObjectStore();
    store.set({ b: 2 });
    store.reset();
    expect(localStorage.getItem(key)).toBeNull();
    expect(store.get()).toEqual({ a: 1 });
  });
});
