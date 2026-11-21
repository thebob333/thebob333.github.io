import { useSyncExternalStore } from 'react';
import type { Store } from '@/lib/store';

/** Subscribe a component to a shared store; re-renders only when that key changes. */
export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
