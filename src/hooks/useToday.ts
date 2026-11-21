import { useSyncExternalStore } from 'react';
import { todayKey, type DateKey } from '@/lib/dates';

/**
 * A tiny external store for "today" that re-ticks at local midnight and
 * whenever the app comes back to the foreground (an iPhone PWA resumed the
 * next morning would otherwise keep showing yesterday).
 */
let current: DateKey = todayKey();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function check() {
  const next = todayKey();
  if (next !== current) {
    current = next;
    listeners.forEach(l => l());
  }
}

function scheduleMidnight() {
  if (timer) clearTimeout(timer);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
  timer = setTimeout(() => {
    check();
    scheduleMidnight();
  }, midnight.getTime() - now.getTime());
}

function onVisible() {
  if (document.visibilityState === 'visible') {
    check();
    scheduleMidnight();
  }
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    current = todayKey();
    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearTimeout(timer);
      timer = null;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    }
  };
}

const getSnapshot = () => current;

/** The local calendar date (YYYY-MM-DD); components re-render when the day changes. */
export function useTodayKey(): DateKey {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
