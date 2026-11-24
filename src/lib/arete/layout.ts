/**
 * Where everything sits on the Arete map: a metro network.
 *
 * You are the central station. Each life area is a line leaving it along a
 * shared corridor, then turning into its own trunk (some upward, some downward). Disciplines branch
 * off a trunk to either side, and inside a discipline every chain of nodes is
 * a straight line of evenly spaced stations. Where something forks, a branch
 * line leaves the junction at 45° into its own column — so the whole thing is
 * drawn with only horizontal, vertical and 45° segments, like a transit map.
 *
 * Branches are packed as close as their station names allow (each subtree
 * keeps a left/right outline per row), so it sprawls without wasting space.
 * Deterministic: the same tree always draws the same map.
 */
import type { AreaId, AreteNode } from '@/types/arete';
import { AREAS, LADDER_BY_ID } from './tree';
import type { Graph } from './engine';

export interface Point { x: number; y: number }
export interface Hub {
  id: string;
  kind: 'area' | 'branch';
  area: AreaId;
  name: string;
  x: number;
  y: number;
  /** Which side of the trunk a discipline sits on (1 = right). */
  side: 1 | -1;
  /** Which way the area grows from the main line (-1 = up). */
  dir: 1 | -1;
}
export interface MetroLayout {
  pos: Map<string, Point>;
  /** A node's parent on the map: another node, or its discipline's hub. */
  parent: Map<string, string>;
  /** The piece of track from a node's parent to the node (SVG path). */
  seg: Map<string, string>;
  /** Which side of the station its name goes on (-1 = left). */
  side: Map<string, 1 | -1>;
  /** Line colour index per node (a line = a straight run of stations). */
  color: Map<string, number>;
  hubs: Hub[];
  hubPos: Map<string, Point>;
  /** Each area's line out of the central station and up its trunk, plus the discipline feeders. */
  rails: { area: AreaId; d: string; trunk: boolean }[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

export const LINE_COLORS = 8;
/** Zoom you land on when you jump to a station or tap into the zoomed-out map: names are comfortably readable. */
export const READ_ZOOM = 0.95;
const ROW = 46; // between stations on a line
const CHAR = 6.1; // average width of a label character
const LABEL_GAP = 13; // station → its name
const CLEAR = 20; // free space on the far side of a line
const GAP = 14; // between neighbouring branches
const DIAG = 22; // size of a 45° corner
const WRAP = 18; // characters per label line
const BASE = 130; // main line → first discipline
const BLOCK_GAP = 96; // between stacked disciplines
const TRUNK_MARGIN = 30; // trunk → nearest station name
const AREA_GAP = 170;
/** Areas that grow upward from the centre (the rest grow downward): two for the wide map, three for the slim one. */
const topAreas = (cap: number): AreaId[] => (cap < WIDE ? ['body', 'mind', 'craft'] : ['body', 'craft']);
/** Sideways gap between area lines sharing the corridor out of the central station. */
export const LANE = 8;

export const branchHubId = (area: AreaId, branch: string) => `hub:${area}/${branch}`;
export const areaHubId = (area: AreaId) => `hub:${area}`;

/** A title wrapped onto up to three short lines. */
export function titleLines(title: string): string[] {
  const lines: string[] = [];
  for (const word of title.split(/\s+/)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last.length + 1 + word.length <= WRAP || lines.length === 3)) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  if (lines.length === 3 && lines[2].length > WRAP + 2) lines[2] = `${lines[2].slice(0, WRAP)}…`;
  return lines;
}

/** How often a ladder repeats its line name beside a rung, so you never lose track of which line you're on. */
const TAG_EVERY = 5;

/**
 * The words shown next to a station. Ladder rungs use their short value
 * ("7:30"), with the line's name above the first and every fifth one;
 * everything else is its title, wrapped.
 */
export function labelLines(n: AreteNode): { lines: string[]; tagged: boolean } {
  const ladder = n.ladder ? LADDER_BY_ID.get(n.ladder) : undefined;
  if (ladder && n.short) {
    return ladder.rungs.indexOf(n.id) % TAG_EVERY === 0 ? { lines: [ladder.name, n.short], tagged: true } : { lines: [n.short], tagged: false };
  }
  return { lines: titleLines(n.title), tagged: false };
}
const labelWidth = (n: AreteNode) => Math.max(...labelLines(n).lines.map(l => l.length)) * CHAR;

/** Outline of a subtree: for each row above its root, how far it reaches left and right of the root's line. */
interface Shape { L: number[]; R: number[] }

/** How wide one branch-off from a trunk may get before the discipline starts another one further up. */
export const WIDE = 920;
/** Narrower branch-offs make a taller, slimmer map: better on a phone held upright. */
export const SLIM = 600;

let cache: { graph: Graph; byCap: Map<number, MetroLayout> } | null = null;

export function layoutMetro(g: Graph, cap: number = WIDE): MetroLayout {
  if (cache?.graph !== g) cache = { graph: g, byCap: new Map() };
  const known = cache.byCap.get(cap);
  if (known) return known;

  // Map parent: the first requirement, or the discipline hub for starting points.
  const parent = new Map<string, string>();
  const kids = new Map<string, string[]>();
  const branches = new Map<AreaId, string[]>(AREAS.map(a => [a.id, []]));
  const link = (p: string, c: string) => { parent.set(c, p); kids.set(p, [...(kids.get(p) ?? []), c]); };
  for (const n of g.nodes) {
    const first = n.requires[0];
    if (first && g.byId.has(first)) { link(first, n.id); continue; }
    const list = branches.get(n.area)!;
    if (!list.includes(n.branch)) list.push(n.branch);
    link(branchHubId(n.area, n.branch), n.id);
  }

  // Longest run below each node: the line carries straight on along it.
  const height = new Map<string, number>();
  const h = (id: string): number => {
    const known = height.get(id);
    if (known !== undefined) return known;
    const v = 1 + Math.max(0, ...(kids.get(id) ?? []).map(h));
    height.set(id, v);
    return v;
  };
  /** Children in drawing order: first the one the line continues to, then branches (short ones closest). */
  const ordered = (id: string): string[] => {
    const cs = [...(kids.get(id) ?? [])];
    if (cs.length < 2) return cs;
    const me = g.byId.get(id);
    const straight = cs.find(c => me?.ladder && g.byId.get(c)!.ladder === me.ladder) ?? cs.reduce((a, b) => (h(b) > h(a) ? b : a));
    return [straight, ...cs.filter(c => c !== straight).sort((a, b) => h(a) - h(b))];
  };

  // Pack every subtree: where each branch sits relative to its junction.
  const shape = new Map<string, Shape>();
  const dx = new Map<string, number>();
  /** Add `s` (shifted `at` sideways, `up` rows) to an outline. */
  const merge = (into: Shape, s: Shape, at: number, up: number) => {
    for (let r = 0; r < s.L.length; r++) {
      into.L[r + up] = Math.min(into.L[r + up] ?? Infinity, at + s.L[r]);
      into.R[r + up] = Math.max(into.R[r + up] ?? -Infinity, at + s.R[r]);
    }
  };
  /** The nearest a branch outline can sit to the right of what's already placed. */
  const fit = (placed: Shape, s: Shape, up: number, min: number) => {
    let at = min;
    for (let r = 0; r < s.L.length; r++) if (placed.R[r + up] !== undefined) at = Math.max(at, placed.R[r + up] - s.L[r] + GAP);
    return Math.round(at);
  };
  const pack = (id: string) => {
    const cs = ordered(id);
    for (const c of cs) pack(c);
    const out: Shape = { L: [-(labelWidth(g.byId.get(id)!) + LABEL_GAP)], R: [CLEAR] };
    cs.forEach((c, i) => {
      const s = shape.get(c)!;
      const at = i === 0 ? 0 : fit(out, s, 1, DIAG + 12);
      dx.set(c, at);
      merge(out, s, at, 1);
      // The track to a branch runs along the junction's own row.
      if (i > 0) out.R[0] = Math.max(out.R[0], at + 4);
    });
    shape.set(id, out);
  };

  /** One branch-off from a trunk: a feeder with some of a discipline's starting points side by side. */
  interface Block { hub: string; branch: string; entries: string[]; width: number; rows: number }
  /** A discipline's branch-offs: its starting points packed side by side, a new feeder whenever one gets too wide. */
  const blocksOf = (area: AreaId, branch: string): Block[] => {
    const hub = branchHubId(area, branch);
    const all = [...(kids.get(hub) ?? [])].sort((a, b) => h(b) - h(a));
    for (const e of all) pack(e);
    const out: Block[] = [];
    let cur: { entries: string[]; outline: Shape } | null = null;
    const close = () => {
      if (!cur) return;
      out.push({ hub: out.length ? `${hub}#${out.length + 1}` : hub, branch: out.length ? '' : branch, entries: cur.entries, width: Math.max(0, ...cur.outline.R.filter(Number.isFinite)), rows: cur.outline.L.length });
      cur = null;
    };
    for (const e of all) {
      const s = shape.get(e)!;
      // Everything stays clear of the trunk; later entries tuck in beside earlier ones.
      const clear = Math.round(TRUNK_MARGIN - Math.min(...s.L));
      let at = cur ? fit(cur.outline, s, 1, Math.max(DIAG + 12, clear)) : clear;
      if (cur && at + Math.max(...s.R) > cap) { close(); at = clear; }
      cur ??= { entries: [], outline: { L: [0], R: [0] } };
      dx.set(e, at);
      merge(cur.outline, s, at, 1);
      cur.entries.push(e);
    }
    close();
    return out;
  };

  // Each area: a trunk with its disciplines stacked on both sides (a discipline keeps to one side).
  interface Placed extends Block { side: 1 | -1; base: number }
  const areas = AREAS.map(a => {
    const stack = { 1: BASE, [-1]: BASE } as Record<1 | -1, number>;
    const width = { 1: 0, [-1]: 0 } as Record<1 | -1, number>;
    const placed: Placed[] = branches.get(a.id)!.flatMap(b => {
      const side: 1 | -1 = stack[1] <= stack[-1] ? 1 : -1;
      return blocksOf(a.id, b).map(block => {
        const base = stack[side];
        stack[side] += (block.rows - 1) * ROW + BLOCK_GAP;
        width[side] = Math.max(width[side], block.width);
        return { ...block, side, base };
      });
    });
    return { area: a.id, placed, left: width[-1] + 40, right: width[1] + 40, top: Math.max(BASE, ...placed.map(p => p.base)) };
  });

  const pos = new Map<string, Point>();
  const seg = new Map<string, string>();
  const side = new Map<string, 1 | -1>();
  const color = new Map<string, number>();
  const hubPos = new Map<string, Point>();
  const hubs: Hub[] = [];
  const rails: MetroLayout['rails'] = [];
  const trunkXs: number[] = [];

  // Where each trunk stands: the rows are centred on you.
  const TOP = topAreas(cap);
  const rows = [[areas.filter(a => TOP.includes(a.area)), -1], [areas.filter(a => !TOP.includes(a.area)), 1]] as const;
  const trunkX = new Map<AreaId, number>();
  for (const [row] of rows) {
    const total = row.reduce((s, a) => s + a.left + a.right, 0) + AREA_GAP * (row.length - 1);
    let cursor = -total / 2;
    for (const a of row) {
      trunkX.set(a.area, Math.round(cursor + a.left) || 1);
      cursor += a.left + a.right + AREA_GAP;
    }
  }

  for (const [row, dir] of rows) {
    for (const a of row) {
      const tx = trunkX.get(a.area)!;
      trunkXs.push(tx);
      // Lines heading the same way share a corridor; the nearest trunk takes the outer lane so none cross.
      const sx = Math.sign(tx);
      const further = row.filter(o => Math.sign(trunkX.get(o.area)!) === sx && Math.abs(trunkX.get(o.area)!) > Math.abs(tx)).length;
      const o = (further + 1) * LANE;
      const y0 = dir * o;
      hubPos.set(areaHubId(a.area), { x: tx, y: y0 });
      hubs.push({ id: areaHubId(a.area), kind: 'area', area: a.area, name: AREAS.find(x => x.id === a.area)!.name, x: tx, y: y0, side: sx >= 0 ? 1 : -1, dir });
      rails.push({ area: a.area, trunk: true, d: `M0 0L${sx * o} ${y0}H${tx}V${dir * a.top}` });

      let line = 0; // colour counter, restarted per area so neighbours differ
      for (const b of a.placed) {
        const s = b.side;
        const fy = dir * b.base;
        hubPos.set(b.hub, { x: tx, y: fy });
        hubs.push({ id: b.hub, kind: 'branch', area: a.area, name: b.branch, x: tx, y: fy, side: s, dir });
        const last = Math.max(...b.entries.map(e => dx.get(e)!));
        rails.push({ area: a.area, trunk: false, d: `M${tx} ${fy}H${tx + s * (last - DIAG)}` });

        const place = (id: string, lx: number, r: number, col: number) => {
          const x = tx + s * lx;
          const y = fy + dir * r * ROW;
          pos.set(id, { x, y });
          side.set(id, (-s) as 1 | -1);
          color.set(id, col);
          ordered(id).forEach((c, i) => {
            const cx = tx + s * (lx + dx.get(c)!);
            const cy = y + dir * ROW;
            if (i === 0) {
              seg.set(c, `M${x} ${y}V${cy}`);
              place(c, lx, r + 1, col);
            } else {
              // A branch line: along the junction's row, a 45° turn, then straight on.
              let next = line++ % LINE_COLORS;
              if (next === col) next = line++ % LINE_COLORS;
              seg.set(c, `M${x} ${y}H${cx - s * DIAG}L${cx} ${y + dir * DIAG}V${cy}`);
              place(c, lx + dx.get(c)!, r + 1, next);
            }
          });
        };
        for (const e of b.entries) {
          const ex = tx + s * dx.get(e)!;
          seg.set(e, `M${ex - s * DIAG} ${fy}L${ex} ${fy + dir * DIAG}V${fy + dir * ROW}`);
          place(e, dx.get(e)!, 1, line++ % LINE_COLORS);
        }
      }
    }
  }

  const xs = [...pos.values()].map(p => p.x).concat(trunkXs, 0);
  const ys = [...pos.values()].map(p => p.y).concat(0);
  const bounds = { x0: Math.min(...xs) - 180, y0: Math.min(...ys) - 80, x1: Math.max(...xs) + 180, y1: Math.max(...ys) + 80 };

  const layout: MetroLayout = { pos, parent, seg, side, color, hubs, hubPos, rails, bounds };
  cache.byCap.set(cap, layout);
  return layout;
}
