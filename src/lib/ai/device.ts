/**
 * Device-only AI settings: your Anthropic key and this month's usage.
 * Deliberately NOT part of KEYS, so they're never in backups, exports or
 * snapshots — the key stays on this phone.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'telos_ai_key';
const USAGE = 'telos_ai_usage';

/** Claude Opus 5.5 list prices, $ per million tokens. */
export const PRICE_IN = 4;
export const PRICE_OUT = 20;

export interface AiUsage { month: string; input: number; output: number; calls: number }

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY || e.key === USAGE) l(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(l); window.removeEventListener('storage', onStorage); };
};

const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };

export function getAiKey(): string | null {
  const k = read(KEY);
  return k && k.trim() ? k.trim() : null;
}

export function setAiKey(key: string | null) {
  try {
    if (key && key.trim()) localStorage.setItem(KEY, key.trim());
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable */ }
  emit();
}

export function useAiKey(): string | null {
  return useSyncExternalStore(subscribe, getAiKey, () => null);
}

/** "sk-ant-…a1b2" */
export const maskKey = (k: string) => (k.length > 12 ? `${k.slice(0, 7)}…${k.slice(-4)}` : '••••');

const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

let usageCache: { raw: string | null; value: AiUsage } | null = null;
export function getUsage(): AiUsage {
  const raw = read(USAGE);
  if (usageCache && usageCache.raw === raw && usageCache.value.month === thisMonth()) return usageCache.value;
  let value: AiUsage = { month: thisMonth(), input: 0, output: 0, calls: 0 };
  try {
    const parsed = raw ? JSON.parse(raw) as AiUsage : null;
    if (parsed && parsed.month === thisMonth()) value = parsed;
  } catch { /* reset */ }
  usageCache = { raw, value };
  return value;
}

export function addUsage(input: number, output: number) {
  const u = getUsage();
  try { localStorage.setItem(USAGE, JSON.stringify({ ...u, input: u.input + input, output: u.output + output, calls: u.calls + 1 })); } catch { /* ignore */ }
  emit();
}

export const usageCost = (u: AiUsage) => (u.input * PRICE_IN + u.output * PRICE_OUT) / 1_000_000;

export function useAiUsage(): AiUsage {
  return useSyncExternalStore(subscribe, getUsage, getUsage);
}
