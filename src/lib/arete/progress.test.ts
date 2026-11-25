import { describe, expect, it } from 'vitest';
import { buildGraph, claimLadder, claimNode, formatLike, ladderHits, nextNice, summarize } from './engine';
import { badgesFor, characterOf, featuredArea, isInterchange, profileOf, seasonFor, stationFacts } from './progress';
import { CORE_NODES, LADDER_BY_ID } from './tree';
import type { AreteState } from '@/types/arete';

const fresh = (): AreteState => ({ claims: {}, pinned: [], grown: [], goalLinks: {} });
const BOOKS = 'mind.reading.books';
const MILE = 'body.running.mile-time';
const id = (suffix: string) => CORE_NODES.find(n => n.id.endsWith(suffix))!.id;

describe('lines that never end', () => {
  it('round numbers and labels in the line\'s own style', () => {
    expect([1, 2.5, 5, 9, 10, 2500].map(nextNice)).toEqual([2.5, 5, 10, 10, 25, 5000]);
    expect(formatLike(['$10k', '$1M', '$1B'], 2.5e9)).toBe('$2.5B');
    expect(formatLike(['$10k', '$1M'], 25000)).toBe('$25k');
    expect(formatLike(['100', '1,000', '1M'], 2.5e6)).toBe('2.5M');
    expect(formatLike(['5', '10', '2,500'], 5000)).toBe('5,000');
  });

  it('a new stop appears once you reach the end, and keeps going', () => {
    const last = LADDER_BY_ID.get(BOOKS)!.rungs.at(-1)!;
    expect(buildGraph().byId.has(`${BOOKS}@5-000`)).toBe(false);
    const s = claimNode(buildGraph(), fresh(), last, '2026-11-24').state;
    const g = buildGraph([], s.claims);
    const next = g.byId.get(`${BOOKS}@5-000`)!;
    expect(next).toMatchObject({ title: 'Read 5,000 books in your life', requires: [last], ladder: BOOKS, value: 5000 });
    expect(g.rungs.get(BOOKS)!.at(-1)).toBe(next.id);
    // Same claims → same graph (so the map doesn't redraw for nothing).
    expect(buildGraph([], { ...s.claims })).toBe(g);
    // Lines with a ceiling or times don't extend.
    expect(LADDER_BY_ID.get(MILE)!.extend).toBeUndefined();
    expect(LADDER_BY_ID.get('spirit.travel.countries')!.extend).toBeUndefined();
  });

  it('a result past the end of the line claims the new stops it reaches', () => {
    const g = buildGraph();
    const first = g.byId.get(LADDER_BY_ID.get(BOOKS)!.rungs[0])!;
    const hits = ladderHits(g, first, '12,000')!;
    expect(hits.top!.title).toBe('Read 10,000 books in your life');
    const r = claimLadder(g, fresh(), BOOKS, '12,000', '2026-11-24');
    expect(r.state.claims[`${BOOKS}@10-000`]).toEqual({ at: '2026-11-24', result: '12,000' });
    expect(r.state.claims[`${BOOKS}@5-000`].implied).toBe(true);
    expect(r.state.claims[`${BOOKS}@2-500`].implied).toBe(true);
    expect(r.unlocked).toContain(`${BOOKS}@10-000`);
    const g2 = buildGraph([], r.state.claims);
    expect(g2.byId.has(`${BOOKS}@25-000`)).toBe(true);
    expect(summarize(g2, r.state).claimed).toBe(Object.keys(r.state.claims).length);
  });
});

describe('seasons and quests', () => {
  it('areas take turns being featured', () => {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'].map(featuredArea);
    expect(new Set(months).size).toBe(6);
    expect(featuredArea('2026-07')).toBe(featuredArea('2026-01'));
  });

  it('quests track what you claim in the month and pay out when done', () => {
    const g = buildGraph();
    const empty = seasonFor(g, fresh(), '2026-11');
    expect(empty.quests).toHaveLength(4);
    expect(empty.quests.every(q => !q.done && q.progress === 0)).toBe(true);
    expect(empty.bonusXp).toBe(0);
    const area = featuredArea('2026-11');
    const starts = CORE_NODES.filter(n => n.area === area && !n.requires.length).slice(0, 2);
    let s = fresh();
    for (const n of starts) s = claimNode(g, s, n.id, '2026-11-10').state;
    const season = seasonFor(g, s, '2026-11');
    const featured = season.quests.find(q => q.id.endsWith(':featured'))!;
    expect(featured).toMatchObject({ progress: 2, done: true });
    expect(season.bonusXp).toBeGreaterThanOrEqual(featured.xp);
    // Claims from another month don't count.
    expect(seasonFor(g, s, '2026-12').quests.every(q => q.progress === 0)).toBe(true);
  });
});

describe('badges, class and profile', () => {
  it('earns medals along a line and in a discipline', () => {
    const g = buildGraph();
    const s = claimLadder(g, fresh(), MILE, '6:50', '2026-11-24').state;
    const badges = badgesFor(g, s, []);
    const line = badges.find(b => b.id === `line:${MILE}`)!;
    expect(line.medal).toBe('silver');
    expect(line.at).toBe('2026-11-24');
    expect(line.target).toBe(Math.ceil((LADDER_BY_ID.get(MILE)!.rungs.length * 3) / 4));
    expect(badges.find(b => b.id === 'disc:body.running')!.medal).not.toBeNull();
    expect(badges.find(b => b.id === 'rarity')!.medal).toBe('bronze'); // a 7:00 mile is Rare
    expect(badges.find(b => b.id === 'breadth')!.medal).toBeNull();
  });

  it('works out a class from your strongest areas', () => {
    const g = buildGraph();
    expect(characterOf(summarize(g, fresh())).className).toBe('Wanderer');
    const body = claimLadder(g, fresh(), MILE, '5:30', '2026-11-24').state;
    expect(characterOf(summarize(g, body)).className).toBe('Athlete');
    const both = claimLadder(g, body, BOOKS, '1,000', '2026-11-24').state;
    const c = characterOf(summarize(g, both));
    expect(c.className).toBe('Scholar-athlete');
    expect(c.radar).toHaveLength(6);
    expect(c.radar.find(r => r.area === 'body')!.value).toBeGreaterThan(0);
  });

  it('the profile adds season, quest and badge XP on top of stations', () => {
    const g = buildGraph();
    const s = claimLadder(g, fresh(), MILE, '7:30', '2026-11-24').state;
    const p = profileOf(g, s, '2026-11-24');
    expect(p.xp.stations).toBe(summarize(g, s).xp);
    expect(p.summary.xp).toBe(p.xp.stations + p.xp.season + p.xp.quests + p.xp.badges);
    expect(p.xp.badges).toBeGreaterThan(0);
    expect(p.bests[0]).toMatchObject({ ladder: MILE, result: '7:30' });
    expect(p.timeline[0]).toMatchObject({ month: '2026-11' });
    expect(p.timeline[0].items.every(i => !s.claims[i.node.id].implied)).toBe(true);
    expect(p.season.month).toBe('2026-11');
    expect(profileOf(g, s, '2026-11-24')).toBe(p);
  });
});

describe('station facts', () => {
  it('rarity, time, line position, branches and interchanges', () => {
    const g = buildGraph();
    const s = claimLadder(g, fresh(), MILE, '7:12', '2026-11-24').state;
    const f = stationFacts(g, s, g.byId.get(`${MILE}@7-00`)!);
    expect(f.rarity).toMatch(/1 in/);
    expect(f.time.length).toBeGreaterThan(3);
    expect(f.line).toMatchObject({ name: 'Mile', index: 7, claimed: 6, best: { result: '7:12' } });
    // A later claim further along without a result shows that stop, not an older result.
    const s2 = claimNode(g, s, `${MILE}@6-30`, '2026-11-25').state;
    expect(stationFacts(g, s2, g.byId.get(`${MILE}@6-00`)!).line!.best!.result).toBe('6:30');
    expect(f.stepsAway).toBe(1);
    const tri = g.byId.get(id('triathlon.sprint'))!;
    expect(isInterchange(g, tri)).toBe(true);
    expect(stationFacts(g, s, tri).interchange.length).toBeGreaterThan(0);
    expect(stationFacts(g, s, g.byId.get(id('running.5k'))!).feeds.map(n => n.id)).toContain(tri.id);
  });
});
