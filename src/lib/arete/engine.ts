/**
 * Arete's rules: what's unlocked, what you can see through the fog, what a
 * result unlocks on a ladder, XP and levels. Pure — the state comes in and a
 * new state goes out. Tested in engine.test.ts.
 */
import type { AreaId, AreteNode, AreteState } from '@/types/arete';
import { AREAS, CORE_NODES, LADDER_BY_ID } from './tree';
import { parseResult } from './metric';

export interface Graph {
  nodes: AreteNode[];
  byId: Map<string, AreteNode>;
  /** Everything that lists this node in `requires`. */
  dependents: Map<string, string[]>;
}

const AREA_IDS = new Set<string>(AREAS.map(a => a.id));
const clampTier = (t: unknown) => Math.min(10, Math.max(0, Math.round(Number(t) || 0)));

let cache: { grown: AreteNode[]; graph: Graph } | null = null;

/** The core tree plus the nodes you or the AI added (ones pointing at nothing are dropped). */
export function buildGraph(grown: AreteNode[] = []): Graph {
  if (cache && cache.grown === grown) return cache.graph;
  const byId = new Map<string, AreteNode>(CORE_NODES.map(n => [n.id, n]));
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
  const graph = { nodes, byId, dependents };
  cache = { grown, graph };
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

/** Which rungs of a node's ladder a typed result reaches. Null if it isn't a ladder or the text can't be read. */
export function ladderHits(g: Graph, node: AreteNode, text: string, bodyweightLb?: number): { value: number; ids: string[]; top: AreteNode | null; reached: boolean } | null {
  const info = node.ladder ? LADDER_BY_ID.get(node.ladder) : undefined;
  if (!info) return null;
  const value = parseResult(info.kind, text, bodyweightLb);
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  const ids = info.rungs.filter(id => {
    const v = g.byId.get(id)?.value;
    return v !== undefined && (info.lowerIsBetter ? value <= v : value >= v);
  });
  return { value, ids, top: ids.length ? g.byId.get(ids[ids.length - 1])! : null, reached: ids.includes(node.id) };
}

/** Claim as far up a ladder as a result reaches (e.g. "7:12" unlocks every mile time down to 7:30). */
export function claimLadder(g: Graph, state: AreteState, ladderId: string, text: string, at: string, bodyweightLb?: number): ClaimResult {
  const info = LADDER_BY_ID.get(ladderId);
  const first = info && g.byId.get(info.rungs[0]);
  if (!info || !first) return { state, unlocked: [] };
  const hits = ladderHits(g, first, text, bodyweightLb);
  if (!hits?.top) return { state, unlocked: [] };
  return claimNode(g, state, hits.top.id, at, text);
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
