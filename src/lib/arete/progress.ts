/**
 * Everything Arete works out about *you* from your claims: seasons and
 * quests, badges, your class, personal bests, a timeline, and the facts shown
 * on each station. Pure and deterministic: the same claims always give the
 * same profile. Tested in progress.test.ts.
 */
import type { AreaId, AreteClaim, AreteNode, AreteState } from '@/types/arete';
import { addDays, parseDateKey, type DateKey } from '@/lib/dates';
import { AREAS, GUIDES, LADDER_BY_ID, type Guide } from './tree';
import { disciplineKey } from './tree/dsl';
import { ancestorsOf, levelFor, rankFor, rarityOf, statusOf, summarize, xpFor, type Graph, type Summary } from './engine';

const AREA_NAME = Object.fromEntries(AREAS.map(a => [a.id, a.name])) as Record<AreaId, string>;
const explicit = (c: AreteClaim | undefined) => !!c && !c.implied;

/** An interchange: a station that needs progress on more than one discipline. */
export function isInterchange(g: Graph, n: AreteNode): boolean {
  if (n.requires.length < 2) return false;
  const keys = new Set(n.requires.map(r => g.byId.get(r)).filter(Boolean).map(r => `${r!.area}/${r!.branch}`));
  keys.add(`${n.area}/${n.branch}`);
  return keys.size > 1;
}

// ─── Seasons and quests ────────────────────────────────────────────────────

/** "2026-11" for a date key. */
export const monthOf = (k: string) => k.slice(0, 7);
export const monthName = (m: string) => parseDateKey(`${m}-01` as DateKey).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/** Each month features one area (they take turns): its stations earn 1.5× XP that month. */
export function featuredArea(month: string): AreaId {
  const [y, m] = month.split('-').map(Number);
  return AREAS[(((y * 12 + m - 1) % 6) + 6) % 6].id;
}
export const SEASON_BONUS = 0.5;

export interface Quest {
  id: string;
  title: string;
  detail: string;
  target: number;
  progress: number;
  done: boolean;
  xp: number;
}
export interface Season { month: string; featured: AreaId; quests: Quest[]; complete: boolean; bonusXp: number }
export const SEASON_COMPLETE_XP = 150;

/**
 * This month's quests, chosen from where you stood when the month began:
 * a pace quest, the featured area, your weakest area, and pushing a line
 * you've already started.
 */
export function seasonFor(g: Graph, state: AreteState, month: string): Season {
  const start = `${month}-01`;
  const entries = Object.entries(state.claims).filter(([id]) => g.byId.has(id));
  const before = entries.filter(([, c]) => c.at < start);
  const now = entries.filter(([, c]) => explicit(c) && monthOf(c.at) === month).map(([id]) => g.byId.get(id)!);
  const featured = featuredArea(month);

  const xpBefore = Object.fromEntries(AREAS.map(a => [a.id, 0])) as Record<AreaId, number>;
  for (const [id] of before) xpBefore[g.byId.get(id)!.area] += xpFor(g.byId.get(id)!.tier);
  // Weakest area (not the featured one); ties rotate by month so it isn't always the same.
  const rot = Number(month.slice(5, 7));
  const weakest = AREAS.map((a, i) => ({ id: a.id, xp: xpBefore[a.id], k: (i + rot) % 6 }))
    .filter(a => a.id !== featured).sort((a, b) => a.xp - b.xp || a.k - b.k)[0].id;
  const startedLines = new Set(before.map(([id]) => g.byId.get(id)!.ladder).filter(Boolean));

  const pace = before.length >= 50 ? 5 : 3;
  const quest = (id: string, title: string, detail: string, target: number, progress: number, xp: number): Quest =>
    ({ id: `${month}:${id}`, title, detail, target, progress: Math.min(target, progress), done: progress >= target, xp });
  const quests = [
    quest('pace', `Claim ${pace} stations`, 'Anything, anywhere on the map.', pace, now.length, 60),
    quest('featured', `Claim 2 ${AREA_NAME[featured]} stations`, `${AREA_NAME[featured]} is this month's featured area.`, 2, now.filter(n => n.area === featured).length, 80),
    quest('weak', `Claim a ${AREA_NAME[weakest]} station`, 'Shore up the area you\'ve explored least.', 1, now.filter(n => n.area === weakest).length, 50),
    startedLines.size
      ? quest('further', 'Go further on a line you started', 'Reach a new stop on any line you were already on.', 1, now.filter(n => n.ladder && startedLines.has(n.ladder)).length, 70)
      : quest('rare', 'Claim an Uncommon or rarer station', 'Something that took real effort.', 1, now.filter(n => n.tier >= 2).length, 70),
  ];
  const complete = quests.every(q => q.done);
  const bonusXp = quests.reduce((n, q) => n + (q.done ? q.xp : 0), 0) + (complete ? SEASON_COMPLETE_XP : 0);
  return { month, featured, quests, complete, bonusXp };
}

// ─── Badges ────────────────────────────────────────────────────────────────

export type Medal = 'bronze' | 'silver' | 'gold' | 'diamond';
export const MEDALS: Medal[] = ['bronze', 'silver', 'gold', 'diamond'];
export const MEDAL_XP: Record<Medal, number> = { bronze: 25, silver: 75, gold: 200, diamond: 500 };

export interface Badge {
  id: string;
  kind: 'line' | 'discipline' | 'area' | 'breadth' | 'rarity' | 'interchange' | 'seasons';
  name: string;
  /** What the next medal takes (or what the last one took, when all are won). */
  detail: string;
  /** Highest medal won, if any. */
  medal: Medal | null;
  /** When the highest medal was won. */
  at?: string;
  progress: number;
  /** For the next medal (equal to progress when all are won). */
  target: number;
  xp: number;
  area?: AreaId;
}

/** A track of four medals: `thresholds[i]` of something, reached on the dates in `dates` (sorted). */
function track(base: Omit<Badge, 'medal' | 'at' | 'progress' | 'target' | 'xp' | 'detail'>, thresholds: number[], dates: string[], what: (n: number) => string): Badge {
  const progress = dates.length;
  let medal: Medal | null = null;
  let at: string | undefined;
  let xp = 0;
  thresholds.forEach((t, i) => {
    if (progress >= t) { medal = MEDALS[i]; at = dates[t - 1]; xp += MEDAL_XP[MEDALS[i]]; }
  });
  const next = thresholds.find(t => progress < t);
  return { ...base, medal, at, progress, target: next ?? thresholds[thresholds.length - 1], xp, detail: what(next ?? thresholds[thresholds.length - 1]) };
}

const datesOf = (claims: [string, AreteClaim][]) => claims.map(([, c]) => c.at).sort();

export function badgesFor(g: Graph, state: AreteState, seasons: Season[]): Badge[] {
  const claimed = Object.entries(state.claims).filter(([id]) => g.byId.has(id));
  const node = (id: string) => g.byId.get(id)!;
  const out: Badge[] = [];

  // Lines you've started.
  const byLine = new Map<string, [string, AreteClaim][]>();
  for (const e of claimed) { const l = node(e[0]).ladder; if (l) byLine.set(l, [...(byLine.get(l) ?? []), e]); }
  for (const [lid, list] of byLine) {
    const info = LADDER_BY_ID.get(lid)!;
    const n = info.rungs.length;
    // A quarter, half, three quarters, the whole line; never-ending lines: a third, two thirds, the end, 3 past it.
    const steps = info.extend ? [Math.ceil(n / 3), Math.ceil((2 * n) / 3), n, n + 3] : [Math.ceil(n / 4), Math.ceil(n / 2), Math.ceil((3 * n) / 4), n];
    out.push(track({ id: `line:${lid}`, kind: 'line', name: `${info.name} line`, area: info.area }, [...new Set(steps)], datesOf(list),
      t => (t > n ? `${t - n} stops past the end of the line` : t === n ? 'Every stop on the line' : `${t} of ${n} stops`)));
  }

  // Disciplines you've started.
  const byDisc = new Map<string, { area: AreaId; name: string; total: number; list: [string, AreteClaim][] }>();
  for (const n of g.nodes) {
    const k = disciplineKey(n.area, n.branch);
    const d = byDisc.get(k) ?? { area: n.area, name: n.branch, total: 0, list: [] };
    d.total++;
    if (state.claims[n.id]) d.list.push([n.id, state.claims[n.id]]);
    byDisc.set(k, d);
  }
  for (const [k, d] of byDisc) {
    if (!d.list.length) continue;
    // Bronze comes quickly; the rest scale with how big the discipline is.
    const steps = [...new Set([3, Math.max(8, Math.ceil(d.total * 0.15)), Math.max(15, Math.ceil(d.total * 0.35)), Math.max(25, Math.ceil(d.total * 0.6))].map(t => Math.min(t, d.total)))];
    out.push(track({ id: `disc:${k}`, kind: 'discipline', name: d.name, area: d.area }, steps, datesOf(d.list), t => `${t} of ${d.total} stations`));
  }

  // Each area.
  for (const a of AREAS) {
    const list = claimed.filter(([id]) => node(id).area === a.id);
    if (!list.length) continue;
    out.push(track({ id: `area:${a.id}`, kind: 'area', name: `${a.name} explorer`, area: a.id }, [10, 50, 150, 400], datesOf(list), t => `${t} ${a.name} stations`));
  }

  // Breadth: stations in every area.
  if (claimed.length) {
    const perArea = AREAS.map(a => datesOf(claimed.filter(([id]) => node(id).area === a.id)));
    const reachedAt = (t: number) => (perArea.every(d => d.length >= t) ? perArea.map(d => d[t - 1]).sort().pop()! : null);
    const levels = [1, 10, 40, 100];
    const dates = levels.map(reachedAt).filter((d): d is string => !!d);
    const b = track({ id: 'breadth', kind: 'breadth', name: 'All-rounder' }, [1, 2, 3, 4], dates, () => '');
    const next = levels[dates.length];
    out.push({ ...b, progress: Math.min(...perArea.map(d => d.length)), target: next ?? 100, detail: next ? `${next} station${next === 1 ? '' : 's'} in every area` : '100 stations in every area' });
  }

  // Rarity: your first Rare, Epic, Legendary and Mythic stations.
  if (claimed.length) {
    const firstAt = (min: number) => claimed.filter(([id]) => node(id).tier >= min).map(([, c]) => c.at).sort()[0];
    const dates = [4, 6, 8, 10].map(firstAt);
    const won = dates.findIndex(d => !d);
    const count = won === -1 ? 4 : won;
    const b = track({ id: 'rarity', kind: 'rarity', name: 'Rarity hunter' }, [1, 2, 3, 4], dates.slice(0, count) as string[], () => '');
    out.push({ ...b, detail: ['Claim a Rare station', 'Claim an Epic station', 'Claim a Legendary station', 'Claim a Mythic station'][Math.min(3, count)] });
  }

  // Interchanges.
  const inter = claimed.filter(([id]) => isInterchange(g, node(id)));
  if (inter.length) out.push(track({ id: 'interchange', kind: 'interchange', name: 'Interchange' }, [1, 5, 15, 40], datesOf(inter), t => `${t} interchange stations`));

  // Seasons completed.
  const done = seasons.filter(s => s.complete).map(s => `${s.month}-28`);
  if (seasons.some(s => s.quests.some(q => q.done))) out.push(track({ id: 'seasons', kind: 'seasons', name: 'Season runner' }, [1, 3, 6, 12], done.sort(), t => `Complete ${t} season${t === 1 ? '' : 's'}`));

  return out;
}

// ─── Your class ────────────────────────────────────────────────────────────

const SOLO: Record<AreaId, string> = { body: 'Athlete', mind: 'Scholar', craft: 'Maker', wealth: 'Magnate', bonds: 'Connector', spirit: 'Seeker' };
const PAIRS: Record<string, string> = {
  'body+mind': 'Scholar-athlete', 'body+craft': 'Warrior-poet', 'body+wealth': 'Titan', 'body+bonds': 'Captain', 'body+spirit': 'Adventurer',
  'mind+craft': 'Inventor', 'mind+wealth': 'Strategist', 'mind+bonds': 'Teacher', 'mind+spirit': 'Philosopher',
  'craft+wealth': 'Entrepreneur', 'craft+bonds': 'Storyteller', 'craft+spirit': 'Visionary',
  'wealth+bonds': 'Patron', 'wealth+spirit': 'Steward', 'bonds+spirit': 'Guide',
};
const ORDER = AREAS.map(a => a.id);

export interface Character {
  /** e.g. "Scholar-athlete". */
  className: string;
  /** e.g. "Adept Scholar-athlete". */
  title: string;
  /** One line on why. */
  why: string;
  /** Radar: each area's level relative to your strongest (0–1). */
  radar: { area: AreaId; level: number; value: number }[];
}

export function characterOf(summary: Summary): Character {
  const areas = ORDER.map(id => ({ id, xp: summary.areas[id].xp, level: summary.areas[id].level }));
  const maxLevel = Math.max(...areas.map(a => a.level));
  const radar = areas.map(a => ({ area: a.id, level: a.level, value: a.xp > 0 ? a.level / Math.max(2, maxLevel) : 0 }));
  const sorted = [...areas].sort((a, b) => b.xp - a.xp || ORDER.indexOf(a.id) - ORDER.indexOf(b.id));
  const [top, second] = sorted;
  let className: string;
  let why: string;
  if (summary.xp < 60) {
    className = 'Wanderer';
    why = 'Every legend starts somewhere. Claim a few stations and your class appears.';
  } else if (areas.every(a => a.xp > 0) && sorted[5].xp >= sorted[0].xp * 0.45) {
    className = 'Polymath';
    why = 'Strong in all six areas at once.';
  } else if (second.xp < top.xp * 0.5) {
    className = SOLO[top.id];
    why = `${AREA_NAME[top.id]} leads everything else by far.`;
  } else {
    const key = [top.id, second.id].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('+');
    className = PAIRS[key];
    why = `${AREA_NAME[top.id]} and ${AREA_NAME[second.id]} are your strongest areas.`;
  }
  return { className, title: `${summary.rank} ${className.toLowerCase().replace(/^./, c => c.toUpperCase())}`, why, radar };
}

// ─── Station facts ─────────────────────────────────────────────────────────

/** Very rough rarity by tier: how reachable at the easy end, then the share of people who get there. */
const RARITY_TEXT = [
  'Open to almost anyone', 'Within reach for most people', 'Roughly 1 in 5 people get here', 'Roughly 1 in 20 people',
  'Roughly 1 in 100 people', 'Roughly 1 in 500 people', 'Roughly 1 in 2,500 people', 'Roughly 1 in 25,000 people',
  'Roughly 1 in 250,000 people', 'Roughly 1 in 5 million people', 'A handful of people in a generation',
];
/** Very rough time it takes from scratch, by tier. */
const TIME_TEXT = [
  'A day or two', 'A few weeks', 'A few months', '6 to 12 months', '1 to 3 years', '3 to 5 years',
  '5 to 10 years', 'A decade of focus', 'A lifetime of focus', 'A lifetime, and rare talent', 'Once in a generation',
];

export interface StationFacts {
  rarity: string;
  time: string;
  guide?: Guide;
  /** This station's line: name, where it sits, your best on it. */
  line?: { id: string; name: string; index: number; length: number; best?: { title: string; result?: string }; claimed: number };
  /** Needs progress in other disciplines too. */
  interchange: AreteNode[];
  /** Interchanges that need this station. */
  feeds: AreteNode[];
  /** Other ways forward from here (not on the same line). */
  branches: AreteNode[];
  /** Stations a similar distance out in the same discipline. */
  neighbours: AreteNode[];
  /** Steps still between you and this one. */
  stepsAway: number;
}

export function stationFacts(g: Graph, state: AreteState, n: AreteNode): StationFacts {
  const guide = GUIDES.get(disciplineKey(n.area, n.branch));
  let line: StationFacts['line'];
  if (n.ladder) {
    const info = LADDER_BY_ID.get(n.ladder)!;
    const rungs = (g.rungs.get(n.ladder) ?? info.rungs).map(id => g.byId.get(id)).filter((x): x is AreteNode => !!x);
    const mine = rungs.filter(r => state.claims[r.id]);
    const top = mine[mine.length - 1];
    line = {
      id: info.id, name: info.name, index: rungs.findIndex(r => r.id === n.id) + 1, length: rungs.length, claimed: mine.length,
      // Your best is your furthest stop: its own result if you gave one, otherwise the stop itself.
      best: top ? { title: top.title, result: state.claims[top.id].result ?? top.short } : undefined,
    };
  }
  const deps = (g.dependents.get(n.id) ?? []).map(id => g.byId.get(id)!);
  const feeds = deps.filter(d => isInterchange(g, d) && (d.area !== n.area || d.branch !== n.branch));
  const branches = deps.filter(d => !feeds.includes(d) && (!n.ladder || d.ladder !== n.ladder));
  const interchange = isInterchange(g, n) ? n.requires.map(r => g.byId.get(r)!).filter(r => r.area !== n.area || r.branch !== n.branch) : [];
  const neighbours = g.nodes
    .filter(x => x.id !== n.id && x.area === n.area && x.branch === n.branch && Math.abs(x.tier - n.tier) <= 1 && x.ladder !== n.ladder && !deps.includes(x) && !n.requires.includes(x.id))
    .sort((a, b) => Math.abs(a.tier - n.tier) - Math.abs(b.tier - n.tier) || a.title.localeCompare(b.title)).slice(0, 3);
  const stepsAway = statusOf(n, state) === 'claimed' ? 0 : ancestorsOf(g, n.id).filter(a => !state.claims[a]).length + 1;
  const t = Math.min(10, Math.max(0, Math.round(n.tier)));
  return { rarity: RARITY_TEXT[t], time: TIME_TEXT[t], guide, line, interchange, feeds, branches, neighbours, stepsAway };
}

// ─── The whole profile ─────────────────────────────────────────────────────

export interface Profile {
  /** Your totals, including season, quest and badge XP. */
  summary: Summary;
  xp: { stations: number; season: number; quests: number; badges: number };
  season: Season;
  seasons: Season[];
  badges: Badge[];
  character: Character;
  /** Your best on each line you've started, furthest first. */
  bests: { ladder: string; name: string; area: AreaId; node: AreteNode; result?: string; at: string }[];
  /** What you claimed yourself, newest first, grouped by month. */
  timeline: { month: string; items: { node: AreteNode; at: string; result?: string }[] }[];
}

let cache: { g: Graph; claims: AreteState['claims']; today: string; profile: Profile } | null = null;

export function profileOf(g: Graph, state: AreteState, today: DateKey): Profile {
  if (cache && cache.g === g && cache.claims === state.claims && cache.today === today) return cache.profile;
  const base = summarize(g, state);
  const thisMonth = monthOf(today);

  // Season bonus: stations claimed in the month their area was featured.
  const seasonByArea = Object.fromEntries(AREAS.map(a => [a.id, 0])) as Record<AreaId, number>;
  for (const [id, c] of Object.entries(state.claims)) {
    const n = g.byId.get(id);
    if (n && explicit(c) && featuredArea(monthOf(c.at)) === n.area) seasonByArea[n.area] += Math.round(xpFor(n.tier) * SEASON_BONUS);
  }
  const seasonXp = Object.values(seasonByArea).reduce((a, b) => a + b, 0);

  const months = [...new Set(Object.values(state.claims).filter(explicit).map(c => monthOf(c.at)))].filter(m => m <= thisMonth).sort();
  const seasons = months.map(m => seasonFor(g, state, m));
  const season = seasons.find(s => s.month === thisMonth) ?? seasonFor(g, state, thisMonth);
  const questXp = seasons.reduce((n, s) => n + s.bonusXp, 0);

  const badges = badgesFor(g, state, seasons);
  const badgeXp = badges.reduce((n, b) => n + b.xp, 0);

  const areas = Object.fromEntries(AREAS.map(a => {
    const s = base.areas[a.id];
    const xp = s.xp + seasonByArea[a.id];
    return [a.id, { ...s, xp, level: levelFor(xp).level }];
  })) as Summary['areas'];
  const total = base.xp + seasonXp + questXp + badgeXp;
  const lvl = levelFor(total);
  const summary: Summary = { ...base, xp: total, ...lvl, rank: rankFor(lvl.level), areas };

  const bests: Profile['bests'] = [];
  for (const [lid, rungs] of g.rungs) {
    const mine = rungs.filter(id => state.claims[id]);
    if (!mine.length) continue;
    const top = g.byId.get(mine[mine.length - 1])!;
    const info = LADDER_BY_ID.get(lid)!;
    bests.push({ ladder: lid, name: info.name, area: info.area, node: top, result: state.claims[top.id].result ?? top.short, at: state.claims[top.id].at });
  }
  bests.sort((a, b) => b.node.tier - a.node.tier || b.at.localeCompare(a.at));

  const items = Object.entries(state.claims).filter(([id, c]) => explicit(c) && g.byId.has(id))
    .map(([id, c]) => ({ node: g.byId.get(id)!, at: c.at, result: c.result })).sort((a, b) => b.at.localeCompare(a.at));
  const timeline: Profile['timeline'] = [];
  for (const it of items) {
    const m = monthOf(it.at);
    if (timeline[timeline.length - 1]?.month !== m) timeline.push({ month: m, items: [] });
    timeline[timeline.length - 1].items.push(it);
  }

  const profile: Profile = {
    summary, xp: { stations: base.xp, season: seasonXp, quests: questXp, badges: badgeXp },
    season, seasons, badges, character: characterOf(summary), bests, timeline,
  };
  cache = { g, claims: state.claims, today, profile };
  return profile;
}

/** Days left in the month of `today`. */
export function daysLeftInMonth(today: DateKey): number {
  let d = today;
  let n = 0;
  while (monthOf(addDays(d, 1)) === monthOf(today)) { d = addDays(d, 1); n++; }
  return n;
}

export { rarityOf };
