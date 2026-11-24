import { describe, expect, it } from 'vitest';
import { AREAS, CORE_NODES, LADDERS, LADDER_BY_ID } from './tree';
import { parseAmount, parseResult, parseTime } from './metric';
import {
  addGrown, ancestorsOf, buildGraph, claimLadder, claimNode, customNode, discoveredToNodes, ladderHits, levelFor, placement,
  rarityOf, removeGrown, statusOf, summarize, togglePin, unclaimNode, visibilityMap, xpFor, MAX_PINS,
} from './engine';
import { labelLines, layoutMetro, SLIM } from './layout';
import { EMPTY_ARETE, type AreteState } from '@/types/arete';

const g = buildGraph();
const fresh = (): AreteState => ({ claims: {}, pinned: [], grown: [], goalLinks: {} });
const id = (suffix: string) => {
  const n = CORE_NODES.find(x => x.id.endsWith(suffix));
  if (!n) throw new Error(`no node ${suffix}`);
  return n.id;
};
const MILE = 'body.running.mile-time';

describe('the core tree', () => {
  it('is big, covers every area and starts from basics', () => {
    expect(CORE_NODES.length).toBeGreaterThan(550);
    for (const a of AREAS) {
      const mine = CORE_NODES.filter(n => n.area === a.id);
      expect(mine.length).toBeGreaterThan(50);
      expect(mine.some(n => n.requires.length === 0 && n.tier === 0)).toBe(true);
      expect(mine.some(n => n.tier === 10)).toBe(true);
    }
  });

  it('has unique ids, real links, no loops, and gets harder as it goes', () => {
    const ids = new Set(CORE_NODES.map(n => n.id));
    expect(ids.size).toBe(CORE_NODES.length);
    for (const n of CORE_NODES) {
      expect(n.title.trim().length).toBeGreaterThan(3);
      for (const r of n.requires) {
        expect(ids.has(r), `${n.id} needs ${r}`).toBe(true);
        expect(g.byId.get(r)!.tier, `${n.id} (tier ${n.tier}) comes after ${r}`).toBeLessThanOrEqual(n.tier);
      }
      expect(ancestorsOf(g, n.id)).not.toContain(n.id);
    }
  });

  it('ladders have readable, ordered thresholds', () => {
    expect(LADDERS.length).toBeGreaterThan(40);
    for (const l of LADDERS) {
      const values = l.rungs.map(r => g.byId.get(r)!.value);
      expect(values.every(v => typeof v === 'number' && Number.isFinite(v)), l.id).toBe(true);
      for (let i = 1; i < values.length; i++) {
        expect(l.lowerIsBetter ? values[i]! < values[i - 1]! : values[i]! > values[i - 1]!, `${l.id} rung ${i}`).toBe(true);
      }
    }
    expect(new Set(LADDERS.map(l => l.id)).size).toBe(LADDERS.length);
  });
});

describe('reading results', () => {
  it('times and amounts', () => {
    expect(parseTime('7:42')).toBe(462);
    expect(parseTime('1:45:30')).toBe(6330);
    expect(parseTime('25')).toBe(1500);
    expect(parseTime('7:75')).toBeNull();
    expect(parseAmount('1,000')).toBe(1000);
    expect(parseAmount('$10k')).toBe(10000);
    expect(parseAmount('$2.5M')).toBe(2500000);
    expect(parseAmount('$2.5m')).toBe(2500000);
    expect(parseAmount('1B')).toBe(1e9);
    expect(parseAmount('100 m')).toBe(100);
    expect(parseAmount('3 km')).toBe(3000);
    expect(parseAmount('1.5×')).toBe(1.5);
    expect(parseAmount('V5')).toBe(5);
    expect(parseAmount('nope')).toBeNull();
  });

  it('lifts typed in lb become bodyweight multiples', () => {
    expect(parseResult('bwx', '270', 180)).toBe(1.5);
    expect(parseResult('bwx', '1.5')).toBe(1.5);
    expect(parseResult('bwx', '270')).toBeNull(); // no bodyweight known
  });
});

describe('claiming', () => {
  it('claiming a node unlocks what comes before it, marked as implied', () => {
    const marathon = id('running.marathon');
    const { state, unlocked } = claimNode(g, fresh(), marathon, '2026-11-24', '4:12:00');
    expect(state.claims[marathon]).toEqual({ at: '2026-11-24', result: '4:12:00' });
    expect(state.claims[id('running.half')]).toEqual({ at: '2026-11-24', implied: true });
    expect(state.claims[id('running.start')].implied).toBe(true);
    expect(unlocked[0]).toBe(marathon);
    expect(unlocked.length).toBeGreaterThan(4);
    // Claiming again changes nothing; a new date or result corrects it.
    expect(claimNode(g, state, marathon, '2026-11-24').state).toBe(state);
    expect(claimNode(g, state, marathon, '2026-10-01').state.claims[marathon]).toEqual({ at: '2026-10-01', result: '4:12:00' });
    expect(claimNode(g, state, marathon, '2026-11-24', '4:05:00').unlocked).toEqual([]);
    // An implied node can be claimed properly later.
    const half = claimNode(g, state, id('running.half'), '2024-05-01', '1:59:10');
    expect(half.state.claims[id('running.half')]).toEqual({ at: '2024-05-01', result: '1:59:10' });
    expect(half.unlocked).toEqual([]);
  });

  it('a result climbs a ladder exactly as far as it reaches', () => {
    const node = g.byId.get(`${MILE}@7-00`)!;
    const hits = ladderHits(g, node, '7:12')!;
    expect(hits.reached).toBe(false);
    expect(hits.top!.title).toBe('Run a mile in 7:30');
    expect(ladderHits(g, node, '6:59')!.reached).toBe(true);
    expect(ladderHits(g, node, 'fast')).toBeNull();

    const { state } = claimLadder(g, fresh(), MILE, '7:12', '2026-11-24');
    expect(state.claims[`${MILE}@7-30`]).toEqual({ at: '2026-11-24', result: '7:12' });
    expect(state.claims[`${MILE}@8-00`].implied).toBe(true);
    expect(state.claims[`${MILE}@7-00`]).toBeUndefined();
    // Too slow for the first rung → nothing.
    expect(claimLadder(g, fresh(), MILE, '15:00', '2026-11-24').unlocked).toEqual([]);
  });

  it('removing a claim also removes what depended on it', () => {
    const { state } = claimLadder(g, fresh(), MILE, '6:50', '2026-11-24');
    const back = unclaimNode(g, state, `${MILE}@8-00`);
    expect(back.claims[`${MILE}@8-00`]).toBeUndefined();
    expect(back.claims[`${MILE}@7-00`]).toBeUndefined();
    expect(back.claims[`${MILE}@9-00`]).toBeDefined();
  });

  it('quick placement claims several ladders at once', () => {
    const squat = LADDERS.find(l => l.id.endsWith('strength.squat'))!;
    const r = placement(g, fresh(), { [MILE]: '8:30', [squat.id]: '270', 'mind.reading.books': '60', nothing: '5' }, '2026-11-24', 180);
    expect(r.state.claims[`${MILE}@9-00`]).toBeDefined();
    expect(r.state.claims[`${squat.id}@1-5`]).toBeDefined();
    expect(r.state.claims[`${squat.id}@1-75`]).toBeUndefined();
    expect(r.state.claims['mind.reading.books@50']).toBeDefined();
    expect(LADDER_BY_ID.has('mind.reading.books')).toBe(true);
  });
});

describe('fog of war', () => {
  it('shows what is within reach, one step beyond, and far-off legends', () => {
    const start = id('running.start');
    let vis = visibilityMap(g, fresh());
    expect(vis.get(start)).toBe('open');
    expect(vis.get(id('running.mile'))).toBe('near');
    expect(vis.get(id('running.5k'))).toBe('fog');
    expect(vis.get(id('science.cure'))).toBe('legend');
    expect(statusOf(g.byId.get(id('running.mile'))!, fresh())).toBe('locked');

    const s = claimNode(g, fresh(), start, '2026-11-24').state;
    vis = visibilityMap(g, s);
    expect(vis.get(start)).toBe('lit');
    expect(vis.get(id('running.mile'))).toBe('open');
    expect(vis.get(id('running.5k'))).toBe('near');
  });

  it('pinning a far node reveals the way to it', () => {
    const marathon = id('running.marathon');
    const s = togglePin(fresh(), marathon);
    const vis = visibilityMap(g, s);
    expect(vis.get(marathon)).toBe('near');
    expect(vis.get(id('running.half'))).toBe('near');
    expect(togglePin(s, marathon).pinned).toEqual([]);
    let many = fresh();
    for (const n of CORE_NODES.slice(0, MAX_PINS + 3)) many = togglePin(many, n.id);
    expect(many.pinned).toHaveLength(MAX_PINS);
  });
});

describe('levels', () => {
  it('rarer nodes are worth more and levels get harder', () => {
    expect(xpFor(0)).toBeLessThan(xpFor(5));
    expect(xpFor(5)).toBeLessThan(xpFor(10));
    expect(rarityOf(0).name).toBe('Common');
    expect(rarityOf(9).name).toBe('Legendary');
    expect(rarityOf(10).name).toBe('Mythic');
    expect(levelFor(0)).toEqual({ level: 1, into: 0, need: 30 });
    expect(levelFor(30).level).toBe(2);
    expect(levelFor(120).level).toBe(3);
  });

  it('sums XP by area', () => {
    const s = claimLadder(g, fresh(), MILE, '8:00', '2026-11-24').state;
    const sum = summarize(g, s);
    expect(sum.areas.body.claimed).toBeGreaterThan(4);
    expect(sum.areas.mind.claimed).toBe(0);
    expect(sum.xp).toBe(sum.areas.body.xp);
    expect(sum.level).toBeGreaterThan(1);
    expect(sum.total).toBe(CORE_NODES.length);
    // Everything claimed lands on a sensible top level.
    const all: AreteState = { ...fresh(), claims: Object.fromEntries(CORE_NODES.map(n => [n.id, { at: '2026-01-01' }])) };
    const top = summarize(g, all);
    expect(top.level).toBeGreaterThan(50);
    expect(top.level).toBeLessThan(120);
  });
});

describe('growing the tree', () => {
  it('AI discoveries and your own nodes hang off a parent and can be removed', () => {
    const parent = g.byId.get(id('running.200-mile'))!;
    let n = 0;
    const found = discoveredToNodes(g, parent, [
      { title: 'Finish a 250-mile desert race', detail: 'Self-supported.', tier: 9, after: -1 },
      { title: 'Win it', detail: '', tier: 3, after: 0 },
      { title: 'Finish a 250-mile desert race', detail: 'dup', tier: 9, after: -1 },
      { title: 'Run across a country', detail: '', tier: 10, after: 7 },
    ], () => `x${++n}`);
    expect(found).toHaveLength(3);
    expect(found[1].requires).toEqual([found[0].id]);
    expect(found[1].tier).toBe(9); // never easier than what it builds on
    expect(found[2].requires).toEqual([parent.id]);
    const mine = customNode(parent, ' Run my hometown loop 100 times ', '', 2, () => 'c1');
    expect(mine).toMatchObject({ id: 'my.c1', title: 'Run my hometown loop 100 times', tier: parent.tier, source: 'custom' });

    let s = addGrown(fresh(), [...found, mine]);
    const g2 = buildGraph(s.grown);
    expect(g2.nodes.length).toBe(CORE_NODES.length + 4);
    expect(buildGraph(s.grown)).toBe(g2); // cached
    s = claimNode(g2, s, found[1].id, '2026-11-24').state;
    s = togglePin(s, found[0].id);
    const after = removeGrown(g2, s, found[0].id);
    expect(after.grown.map(x => x.id)).toEqual([found[2].id, 'my.c1']);
    expect(after.claims[found[1].id]).toBeUndefined();
    expect(after.pinned).toEqual([]);
    expect(removeGrown(g2, s, parent.id)).toBe(s); // core nodes can't be deleted
    // Orphans (parent missing) are ignored rather than breaking the map.
    expect(buildGraph([{ ...mine, id: 'my.orphan', requires: ['nope'] }]).nodes.length).toBe(CORE_NODES.length);
  });
});

describe('the metro layout', () => {
  const m = layoutMetro(g);

  it('places every node on a line that runs away from the main line', () => {
    expect(m.pos.size).toBe(CORE_NODES.length);
    for (const n of CORE_NODES) {
      const p = m.pos.get(n.id)!;
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      const parent = m.parent.get(n.id)!;
      const pp = m.pos.get(parent) ?? m.hubPos.get(parent)!;
      expect(Math.abs(p.y), n.id).toBeGreaterThan(Math.abs(pp.y));
      expect(m.seg.get(n.id), n.id).toMatch(/^M/);
      expect(m.side.has(n.id) && m.color.has(n.id)).toBe(true);
    }
    expect(m.hubs.filter(h => h.kind === 'area')).toHaveLength(6);
    expect(layoutMetro(g)).toBe(m);
    // The slim shape (for phones) is narrower, and both stay cached.
    const slim = layoutMetro(g, SLIM);
    expect(slim.bounds.x1 - slim.bounds.x0).toBeLessThan(m.bounds.x1 - m.bounds.x0);
    expect(slim.pos.size).toBe(CORE_NODES.length);
    expect(layoutMetro(g)).toBe(m);
    expect(EMPTY_ARETE.pinned).toEqual([]);
  });

  it('only uses horizontal, vertical and 45° track', () => {
    for (const d of [...m.seg.values(), ...m.rails.map(r => r.d)]) {
      let x = 0; let y = 0;
      for (const [, cmd, args] of d.matchAll(/([MHVL])([^MHVL]*)/g)) {
        const v = args.trim().split(/[ ,]+/).map(Number);
        if (cmd === 'M') { [x, y] = v; } else if (cmd === 'H') { x = v[0]; } else if (cmd === 'V') { y = v[0]; } else {
          expect(Math.abs(Math.abs(v[0] - x) - Math.abs(v[1] - y)), d).toBeLessThan(0.01);
          [x, y] = v;
        }
      }
    }
  });

  it('keeps stations and their names apart', () => {
    const pts = CORE_NODES.map(n => ({ n, p: m.pos.get(n.id)!, w: Math.max(...labelLines(n).lines.map(l => l.length)) * 6.3, s: m.side.get(n.id)! }));
    let min = Infinity;
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i]; const b = pts[j];
      min = Math.min(min, Math.hypot(a.p.x - b.p.x, a.p.y - b.p.y));
      // Names on the same row must not run into each other or into another station.
      if (a.p.y !== b.p.y) continue;
      const span = (q: typeof a) => (q.s < 0 ? [q.p.x - 13 - q.w, q.p.x + 6] : [q.p.x - 6, q.p.x + 13 + q.w]);
      const [a0, a1] = span(a); const [b0, b1] = span(b);
      expect(a1 < b0 || b1 < a0, `${a.n.id} overlaps ${b.n.id}`).toBe(true);
    }
    expect(min).toBeGreaterThan(34);
  });

  it('labels: short values on ladders, the line name on the first rung, long titles wrapped', () => {
    expect(labelLines(g.byId.get(`${MILE}@12-00`)!)).toEqual({ lines: ['Mile', '12:00'], tagged: true });
    expect(labelLines(g.byId.get(`${MILE}@7-30`)!).tagged).toBe(true); // sixth rung: the name repeats every fifth
    expect(labelLines(g.byId.get(`${MILE}@8-00`)!)).toEqual({ lines: ['8:00'], tagged: false });
    const long = labelLines(g.byId.get(id('film.release'))!);
    expect(long.lines.length).toBeLessThanOrEqual(3);
    expect(long.lines.every(l => l.length <= 24)).toBe(true);
    expect(LADDERS.every(l => l.name && l.name !== l.branch || l.name)).toBe(true);
  });
});
