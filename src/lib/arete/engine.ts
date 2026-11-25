/**
 * Arete's rules: what's unlocked, what you can see through the fog, what a
 * result unlocks on a ladder, XP and levels. Pure — the state comes in and a
 * new state goes out. Tested in engine.test.ts.
 */
import type { AreaId, AreteNode, AreteState } from '@/types/arete';
import { AREAS, CORE_NODES, LADDERS, LADDER_BY_ID, type LadderInfo } from './tree';
import { slug } from './tree/dsl';
import { parseResult } from './metric';

export interface Graph {
  nodes: AreteNode[];
  byId: Map<string, AreteNode>;
  /** Everything that lists this node in `requires`. */
  dependents: Map<string, string[]>;
  /** Every rung of each line, in order, including never-ending extensions that have appeared. */
  rungs: Map<string, string[]>;
}

const AREA_IDS = new Set<string>(AREAS.map(a => a.id));
const clampTier = (t: unknown) => Math.min(10, Math.max(0, Math.round(Number(t) || 0)));
const CORE_BY_ID = new Map(CORE_NODES.map(n => [n.id, n]));

// ─── Lines that never end ──────────────────────────────────────────────────

/** The next round number past v: 1, 2.5, 5 × 10ⁿ. */
export function nextNice(v: number): number {
  let p = 10 ** Math.floor(Math.log10(Math.max(1, v)));
  for (;;) {
    for (const s of [1, 2.5, 5]) if (s * p > v * 1.0001) return s * p;
    p *= 10;
  }
}

const trim = (x: number) => String(Math.round(x * 10) / 10);
/** A number written the way the line's own labels are ("$2.5M", "25,000", "1B"). */
export function formatLike(labels: string[], v: number): string {
  const money = labels.some(l => l.includes('$'));
  const compact = money || labels.some(l => /\d[kKMB]$/.test(l.trim()));
  const pre = money ? '$' : '';
  if (compact && v >= 1e9) return `${pre}${trim(v / 1e9)}B`;
  if (compact && v >= 1e6) return `${pre}${trim(v / 1e6)}M`;
  if (money && v >= 1e3) return `${pre}${trim(v / 1e3)}k`;
  return `${pre}${Math.round(v).toLocaleString('en-US')}`;
}

/** The rung after `prev` on a never-ending line (null if the line has a cap, or isn't never-ending). */
export function nextRung(info: LadderInfo, prev: AreteNode): AreteNode | null {
  if (!info.extend || prev.value === undefined) return null;
  const v = nextNice(prev.value);
  if (info.max !== undefined && v > info.max) return null;
  const labels = info.rungs.map(id => CORE_BY_ID.get(id)?.short ?? '');
  const label = formatLike(labels, v);
  return {
    id: `${info.id}@${slug(label)}`, area: prev.area, branch: prev.branch, title: info.title(label), detail: prev.detail,
    tier: prev.tier, requires: [prev.id], ladder: info.id, value: v, short: label, source: 'core',
  };
}

/** Extension rungs that exist for these claims: every one you've reached, plus the next. */
function extensions(claims: AreteState['claims']): AreteNode[] {
  const out: AreteNode[] = [];
  for (const info of LADDERS) {
    if (!info.extend) continue;
    let prev = CORE_BY_ID.get(info.rungs[info.rungs.length - 1]);
    for (let i = 0; i < 40 && prev && claims[prev.id]; i++) {
      const nx = nextRung(info, prev);
      if (!nx) break;
      out.push(nx);
      prev = nx;
    }
  }
  return out;
}

let cache: { grown: AreteNode[]; sig: string; graph: Graph } | null = null;

/**
 * The core tree, plus the stations that appeared at the end of never-ending
 * lines, plus the nodes you or the AI added (ones pointing at nothing are dropped).
 */
export function buildGraph(grown: AreteNode[] = [], claims: AreteState['claims'] = {}): Graph {
  const ext = extensions(claims);
  const sig = ext.map(n => n.id).join('|');
  if (cache && (cache.grown === grown || (!cache.grown.length && !grown.length)) && cache.sig === sig) return cache.graph;
  const byId = new Map<string, AreteNode>(CORE_NODES.map(n => [n.id, n]));
  for (const n of ext) byId.set(n.id, n);
  let pending = grown.filter(n => !byId.has(n.id) && AREA_IDS.has(n.area) && n.requires.length > 0);
  // Grown nodes can hang off other grown nodes: add in passes until nothing new fits.
  for (let pass = 0; pass < 50 && pending.length; pass++) {
    const rest: AreteNode[] = [];
    for (const n of pending) {
      if (n.requires.every(r => byId.has(r))) byId.set(n.id, { ...n, tier: clampTier(n.tier) });
      else rest.push(n);
    }
    if (rest.length === pending.length) break;
    pending = rest;
  }
  const nodes = [...byId.values()];
  const dependents = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  for (const n of nodes) for (const r of n.requires) dependents.get(r)?.push(n.id);
  const rungs = new Map(LADDERS.map(l => [l.id, [...l.rungs]]));
  for (const n of ext) rungs.get(n.ladder!)!.push(n.id);
  const graph = { nodes, byId, dependents, rungs };
  cache = { grown, sig, graph };
  return graph;
}

// ─── Status and fog ────────────────────────────────────────────────────────

export type NodeStatus = 'claimed' | 'open' | 'locked';

export function statusOf(n: AreteNode, state: AreteState): NodeStatus {
  if (state.claims[n.id]) return 'claimed';
  return n.requires.every(r => state.claims[r]) ? 'open' : 'locked';
}

/**
 * lit = unlocked · open = within reach now · near = one step beyond (or on the
 * way to something you pinned) · legend = far-off legendary silhouettes ·
 * fog = hidden.
 */
export type Visibility = 'lit' | 'open' | 'near' | 'legend' | 'fog';
export const LEGEND_TIER = 8;

/** Everything that must come before a node (not including it). */
export function ancestorsOf(g: Graph, id: string): string[] {
  const seen = new Set<string>();
  const stack = [...(g.byId.get(id)?.requires ?? [])];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    stack.push(...(g.byId.get(x)?.requires ?? []));
  }
  return [...seen];
}

export function visibilityMap(g: Graph, state: AreteState): Map<string, Visibility> {
  const out = new Map<string, Visibility>();
  const reach = new Set<string>(); // claimed or open
  for (const n of g.nodes) {
    const s = statusOf(n, state);
    if (s === 'claimed') { out.set(n.id, 'lit'); reach.add(n.id); } else if (s === 'open') { out.set(n.id, 'open'); reach.add(n.id); }
  }
  const pinnedPath = new Set<string>();
  for (const p of state.pinned) if (g.byId.has(p)) { pinnedPath.add(p); for (const a of ancestorsOf(g, p)) pinnedPath.add(a); }
  for (const n of g.nodes) {
    if (out.has(n.id)) continue;
    if (pinnedPath.has(n.id) || n.requires.some(r => reach.has(r))) out.set(n.id, 'near');
    else out.set(n.id, n.tier >= LEGEND_TIER ? 'legend' : 'fog');
  }
  return out;
}

// ─── Claiming ──────────────────────────────────────────────────────────────

export interface ClaimResult { state: AreteState; unlocked: string[] }

/** Claim a node. Everything that has to come before it is unlocked too (marked as implied). */
export function claimNode(g: Graph, state: AreteState, id: string, at: string, result?: string): ClaimResult {
  const node = g.byId.get(id);
  if (!node) return { state, unlocked: [] };
  const claims = { ...state.claims };
  const unlocked: string[] = [];
  const text = result?.trim() || undefined;
  const had = claims[id];
  let changed = false;
  if (!had || had.implied) {
    if (!had) unlocked.push(id);
    claims[id] = { at, ...(text ? { result: text } : {}) };
    changed = true;
  } else if (had.at !== at || (text && text !== had.result)) {
    // Already yours: correct the date or the result.
    claims[id] = { at, ...(text ?? had.result ? { result: text ?? had.result } : {}) };
    changed = true;
  }
  for (const a of ancestorsOf(g, id)) {
    if (!claims[a]) { claims[a] = { at, implied: true }; unlocked.push(a); changed = true; }
  }
  return { state: changed ? { ...state, claims } : state, unlocked };
}

/**
 * Which rungs of a node's line a typed result reaches. On a never-ending line
 * this can go past the stations that exist yet (they're made on the fly).
 * Null if it isn't a line or the text can't be read.
 */
export function ladderHits(g: Graph, node: AreteNode, text: string, bodyweightLb?: number): { value: number; rungs: AreteNode[]; top: AreteNode | null; reached: boolean } | null {
  const info = node.ladder ? LADDER_BY_ID.get(node.ladder) : undefined;
  if (!info) return null;
  const line = (g.rungs.get(info.id) ?? info.rungs).map(id => g.byId.get(id)).filter((n): n is AreteNode => !!n);
  // On lines measured in seconds (sprints), a bare "11.5" means seconds, not minutes.
  const short = info.kind === 'time' && Math.max(0, ...line.map(r => r.value ?? 0)) <= 120;
  const value = parseResult(info.kind, text, bodyweightLb, short);
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (info.extend && line.length) {
    for (let last = line[line.length - 1], i = 0; i < 40 && last.value !== undefined && last.value < value; i++) {
      const nx = nextRung(info, last);
      if (!nx || nx.value! > value) break;
      line.push(nx);
      last = nx;
    }
  }
  const rungs = line.filter(r => r.value !== undefined && (info.lowerIsBetter ? value <= r.value : value >= r.value));
  const top = rungs.length ? rungs[rungs.length - 1] : null;
  return { value, rungs, top, reached: rungs.some(r => r.id === node.id) };
}

/** Claim as far up a line as a result reaches (e.g. "7:12" unlocks every mile time down to 7:30). */
export function claimLadder(g: Graph, state: AreteState, ladderId: string, text: string, at: string, bodyweightLb?: number): ClaimResult {
  const info = LADDER_BY_ID.get(ladderId);
  const first = info && g.byId.get(info.rungs[0]);
  if (!info || !first) return { state, unlocked: [] };
  const hits = ladderHits(g, first, text, bodyweightLb);
  if (!hits?.top) return { state, unlocked: [] };
  if (g.byId.has(hits.top.id)) return claimNode(g, state, hits.top.id, at, text);
  // Past the stations that exist yet: claim the last real one, then the new ones up to the result.
  const known = hits.rungs.filter(r => g.byId.has(r.id));
  const fresh = hits.rungs.filter(r => !g.byId.has(r.id));
  const lastKnown = known[known.length - 1].id;
  const base = claimNode(g, state, lastKnown, at);
  const claims = { ...base.state.claims };
  const unlocked = [...base.unlocked];
  if (base.unlocked.includes(lastKnown)) claims[lastKnown] = { at, implied: true }; // reached on the way
  fresh.forEach((r, i) => {
    const isTop = i === fresh.length - 1;
    if (!claims[r.id]) unlocked.push(r.id);
    claims[r.id] = isTop ? { at, result: text.trim() } : claims[r.id] && !claims[r.id].implied ? claims[r.id] : { at, implied: true };
  });
  return { state: { ...state, claims }, unlocked };
}

/** Remove a claim, and anything beyond it that depended on it. */
export function unclaimNode(g: Graph, state: AreteState, id: string): AreteState {
  if (!state.claims[id]) return state;
  const claims = { ...state.claims };
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (!claims[x]) continue;
    delete claims[x];
    stack.push(...(g.dependents.get(x) ?? []));
  }
  return { ...state, claims };
}

export const MAX_PINS = 8;

export function togglePin(state: AreteState, id: string): AreteState {
  if (state.pinned.includes(id)) return { ...state, pinned: state.pinned.filter(p => p !== id) };
  return { ...state, pinned: [...state.pinned, id].slice(-MAX_PINS) };
}

// ─── Growing the tree ──────────────────────────────────────────────────────

export interface DiscoveredNode { title: string; detail: string; tier: number; after: number }

/**
 * Turn the AI's "what lies beyond" reply into nodes hanging off `parent`.
 * `after` = index of an earlier node in the reply it builds on, or -1 for the parent.
 */
export function discoveredToNodes(g: Graph, parent: AreteNode, found: DiscoveredNode[], newId: () => string): AreteNode[] {
  const taken = new Set((g.dependents.get(parent.id) ?? []).map(id => g.byId.get(id)!.title.trim().toLowerCase()));
  const out: (AreteNode | null)[] = [];
  found.slice(0, 8).forEach((f, i) => {
    const title = (f.title ?? '').trim();
    const base = Number.isInteger(f.after) && f.after >= 0 && f.after < i ? out[f.after] : null;
    if (!title || taken.has(title.toLowerCase())) { out.push(null); return; }
    taken.add(title.toLowerCase());
    const before = base ?? parent;
    out.push({
      id: `ai.${newId()}`, area: parent.area, branch: parent.branch, title, detail: f.detail?.trim() || undefined,
      tier: Math.max(before.tier, clampTier(f.tier)), requires: [before.id], source: 'ai',
    });
  });
  return out.filter((n): n is AreteNode => n !== null);
}

export function customNode(parent: AreteNode, title: string, detail: string, tier: number, newId: () => string): AreteNode {
  return {
    id: `my.${newId()}`, area: parent.area, branch: parent.branch, title: title.trim(), detail: detail.trim() || undefined,
    tier: Math.max(parent.tier, clampTier(tier)), requires: [parent.id], source: 'custom',
  };
}

export function addGrown(state: AreteState, nodes: AreteNode[]): AreteState {
  return nodes.length ? { ...state, grown: [...state.grown, ...nodes] } : state;
}

/** Delete a node you or the AI added, with everything grown beyond it. */
export function removeGrown(g: Graph, state: AreteState, id: string): AreteState {
  const node = g.byId.get(id);
  if (!node || node.source === 'core') return state;
  const gone = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const x = stack.pop()!;
    if (gone.has(x)) continue;
    gone.add(x);
    stack.push(...(g.dependents.get(x) ?? []));
  }
  const keep = <T>(rec: Record<string, T>) => Object.fromEntries(Object.entries(rec).filter(([k]) => !gone.has(k)));
  return {
    ...state,
    grown: state.grown.filter(n => !gone.has(n.id)),
    claims: keep(state.claims),
    goalLinks: keep(state.goalLinks),
    pinned: state.pinned.filter(p => !gone.has(p)),
  };
}

// ─── XP, levels, rarity ────────────────────────────────────────────────────

const XP = [5, 10, 20, 35, 60, 100, 160, 260, 420, 680, 1100];
export const xpFor = (tier: number) => XP[clampTier(tier)];

export const RARITY = [
  { name: 'Common', min: 0, tone: 'text-white/70', ring: 'hsl(0 0% 75%)' },
  { name: 'Uncommon', min: 2, tone: 'text-success', ring: 'hsl(var(--success))' },
  { name: 'Rare', min: 4, tone: 'text-sky', ring: 'hsl(var(--sky))' },
  { name: 'Epic', min: 6, tone: 'text-violet', ring: 'hsl(var(--violet))' },
  { name: 'Legendary', min: 8, tone: 'text-amber', ring: 'hsl(var(--amber))' },
  { name: 'Mythic', min: 10, tone: 'text-coral', ring: 'hsl(var(--coral))' },
] as const;
export const rarityOf = (tier: number) => [...RARITY].reverse().find(r => clampTier(tier) >= r.min)!;

/** Level n starts at 30·(n−1)² XP — early levels come fast, later ones are earned. */
export function levelFor(xp: number): { level: number; into: number; need: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 30)) + 1;
  const start = 30 * (level - 1) ** 2;
  return { level, into: xp - start, need: 30 * level ** 2 - start };
}

const RANKS: [number, string][] = [[1, 'Novice'], [4, 'Apprentice'], [8, 'Adept'], [13, 'Expert'], [20, 'Master'], [30, 'Champion'], [45, 'Hero'], [60, 'Legend']];
export const rankFor = (level: number) => [...RANKS].reverse().find(([min]) => level >= min)![1];

export interface AreaSummary { xp: number; level: number; claimed: number; total: number }
export interface Summary {
  xp: number; level: number; into: number; need: number; rank: string;
  claimed: number; total: number;
  areas: Record<AreaId, AreaSummary>;
}

export function summarize(g: Graph, state: AreteState): Summary {
  const areas = Object.fromEntries(AREAS.map(a => [a.id, { xp: 0, level: 1, claimed: 0, total: 0 }])) as Record<AreaId, AreaSummary>;
  let xp = 0;
  let claimed = 0;
  for (const n of g.nodes) {
    const a = areas[n.area];
    a.total++;
    if (!state.claims[n.id]) continue;
    const v = xpFor(n.tier);
    a.xp += v; a.claimed++;
    xp += v; claimed++;
  }
  for (const a of Object.values(areas)) a.level = levelFor(a.xp).level;
  const l = levelFor(xp);
  return { xp, ...l, rank: rankFor(l.level), claimed, total: g.nodes.length, areas };
}

/** Quick placement: one answer per ladder ("Fastest mile: 7:42") claims everything it reaches. */
export function placement(g: Graph, state: AreteState, answers: Record<string, string>, at: string, bodyweightLb?: number): ClaimResult {
  let next = state;
  const unlocked: string[] = [];
  for (const [ladderId, text] of Object.entries(answers)) {
    if (!text.trim()) continue;
    const r = claimLadder(g, next, ladderId, text, at, bodyweightLb);
    next = r.state;
    unlocked.push(...r.unlocked);
  }
  return { state: next, unlocked };
}
