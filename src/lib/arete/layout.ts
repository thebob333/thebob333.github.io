/**
 * Where everything sits on the constellation map.
 *
 * You are at the centre. Each area gets a slice of the sky sized by how much
 * it holds; each discipline a slice of that; and every node sits on the ray
 * of its slice, further out the rarer it is (and always beyond what it needs).
 * Deterministic: the same tree always draws the same sky.
 */
import type { AreaId, AreteNode } from '@/types/arete';
import { AREAS } from './tree';
import type { Graph } from './engine';

export interface Point { x: number; y: number }
export interface Hub { id: string; kind: 'area' | 'branch'; area: AreaId; name: string; x: number; y: number; angle: number }
export interface SkyLayout {
  pos: Map<string, Point>;
  /** A node's parent on the map: another node, or its discipline's hub. */
  parent: Map<string, string>;
  hubs: Hub[];
  hubPos: Map<string, Point>;
  /** Distance from the centre to the outermost node. */
  radius: number;
}

// Before scaling: the sky then grows by whatever factor gives every node its room.
const R_AREA = 135;
const R_BRANCH = 275;
const R_FIRST = 400;
const PER_TIER = 120;
const MIN_STEP = 66;
/** Sideways room every node gets at its own distance from the centre (after scaling). */
const ROOM = 30;
const BRANCH_ROOM = 90;
const AREA_GAP = (3 * Math.PI) / 180;

export const branchHubId = (area: AreaId, branch: string) => `hub:${area}/${branch}`;
export const areaHubId = (area: AreaId) => `hub:${area}`;

let cache: { graph: Graph; layout: SkyLayout } | null = null;

export function layoutSky(g: Graph): SkyLayout {
  if (cache && cache.graph === g) return cache.layout;

  // Tree parent: the first requirement, or the discipline hub for starting points.
  const parent = new Map<string, string>();
  const kids = new Map<string, string[]>();
  const push = (p: string, c: string) => { parent.set(c, p); kids.set(p, [...(kids.get(p) ?? []), c]); };
  const branches = new Map<AreaId, string[]>(AREAS.map(a => [a.id, []]));
  for (const n of g.nodes) {
    const first = n.requires[0];
    if (first && g.byId.has(first)) { push(first, n.id); continue; }
    const list = branches.get(n.area)!;
    if (!list.includes(n.branch)) list.push(n.branch);
    push(branchHubId(n.area, n.branch), n.id);
  }

  // Distance from the centre: by rarity, and always beyond what it needs.
  const r0 = new Map<string, number>();
  const setR = (id: string, parentR: number) => {
    const r = Math.max(parentR + MIN_STEP, R_FIRST + (g.byId.get(id) as AreteNode).tier * PER_TIER);
    r0.set(id, r);
    for (const c of kids.get(id) ?? []) setR(c, r);
  };
  // The slice of sky a node needs: room for itself at its distance, or for everything beyond it.
  const need = new Map<string, number>();
  const slice = (id: string): number => {
    const known = need.get(id);
    if (known !== undefined) return known;
    const v = Math.max(ROOM / r0.get(id)!, (kids.get(id) ?? []).reduce((s, c) => s + slice(c), 0));
    need.set(id, v);
    return v;
  };
  const branchNeed = (area: AreaId, b: string) => {
    const entries = kids.get(branchHubId(area, b)) ?? [];
    for (const e of entries) if (!r0.has(e)) setR(e, R_FIRST - MIN_STEP - 1);
    return Math.max(BRANCH_ROOM / R_BRANCH, entries.reduce((s, e) => s + slice(e), 0));
  };
  const areaNeed = (area: AreaId) => branches.get(area)!.reduce((s, b) => s + branchNeed(area, b), 0) || 0.2;
  const total = AREAS.reduce((s, a) => s + areaNeed(a.id), 0);
  const usable = Math.PI * 2 - AREA_GAP * AREAS.length;
  // If it doesn't fit in one circle, push everything outward until it does.
  const scale = Math.max(1, total / usable);
  const fit = usable / total; // every slice is stretched to fill the circle

  const pos = new Map<string, Point>();
  const hubPos = new Map<string, Point>();
  const hubs: Hub[] = [];
  let radius = R_FIRST * scale;
  const at = (r: number, a: number): Point => ({ x: Math.round(r * Math.cos(a) * 10) / 10, y: Math.round(r * Math.sin(a) * 10) / 10 });

  const place = (id: string, a0: number) => {
    const span = slice(id) * fit;
    const r = r0.get(id)! * scale;
    radius = Math.max(radius, r);
    pos.set(id, at(r, a0 + span / 2));
    const cs = kids.get(id) ?? [];
    // Centre the children under their parent when they need less than its slice.
    const used = cs.reduce((s, c) => s + slice(c) * fit, 0);
    let a = a0 + (span - used) / 2;
    for (const c of cs) { place(c, a); a += slice(c) * fit; }
  };

  // Start so the first area is centred at the top.
  let cursor = -Math.PI / 2 - (areaNeed(AREAS[0].id) * fit) / 2;
  for (const area of AREAS) {
    const span = areaNeed(area.id) * fit;
    const mid = cursor + span / 2;
    const ap = at(R_AREA * scale, mid);
    hubPos.set(areaHubId(area.id), ap);
    hubs.push({ id: areaHubId(area.id), kind: 'area', area: area.id, name: area.name, ...ap, angle: mid });
    let a = cursor;
    for (const b of branches.get(area.id)!) {
      const bs = branchNeed(area.id, b) * fit;
      const hid = branchHubId(area.id, b);
      const bp = at(R_BRANCH * scale, a + bs / 2);
      hubPos.set(hid, bp);
      hubs.push({ id: hid, kind: 'branch', area: area.id, name: b, ...bp, angle: a + bs / 2 });
      const entries = kids.get(hid) ?? [];
      const used = entries.reduce((s, e) => s + slice(e) * fit, 0);
      let ea = a + (bs - used) / 2;
      for (const e of entries) { place(e, ea); ea += slice(e) * fit; }
      a += bs;
    }
    cursor += span + AREA_GAP;
  }

  const layout = { pos, parent, hubs, hubPos, radius };
  cache = { graph: g, layout };
  return layout;
}
