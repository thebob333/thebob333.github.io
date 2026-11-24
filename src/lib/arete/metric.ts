/** Reading results the way people type them: "7:42", "1:45:30", "1,000", "$10k", "1.5×", "V5". */
import type { MetricKind } from '@/types/arete';

/** "7:42" → 462 s, "1:45:30" → 6330 s. A bare number means minutes ("25" → 25:00). */
export function parseTime(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(parseFloat(t) * 60);
  const m = t.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return null;
  const [a, b, c] = [Number(m[1]), Number(m[2]), m[3] === undefined ? null : Number(m[3])];
  if (b > 59 || (c !== null && c > 59)) return null;
  return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
}

/**
 * "1,000" → 1000, "$10k" → 10000, "2.5M" → 2500000, "1.5×" → 1.5, "V5" → 5.
 * Distances stay in metres: "100 m" → 100, "3 km" → 3000 (a small "m" only means
 * million next to a "$").
 */
export function parseAmount(text: string): number | null {
  const money = text.includes('$');
  const t = text.trim().replace(/[$,\s]/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)([kKmMbB])?/);
  if (!m) return null;
  const s = m[2];
  const mult = !s ? 1 : s === 'k' || s === 'K' ? 1e3 : s === 'b' || s === 'B' ? 1e9 : s === 'M' || money ? 1e6 : 1;
  return parseFloat(m[1]) * mult;
}

/**
 * A typed result as a number for a ladder. For bodyweight-multiple lifts you can
 * type the weight in lb (anything over 10) and it's divided by your bodyweight.
 */
export function parseResult(kind: MetricKind, text: string, bodyweightLb?: number): number | null {
  if (kind === 'time') return parseTime(text);
  const v = parseAmount(text);
  if (v === null) return null;
  if (kind === 'bwx' && v > 10) return bodyweightLb && bodyweightLb > 0 ? v / bodyweightLb : null;
  return v;
}
