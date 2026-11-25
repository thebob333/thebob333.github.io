/**
 * The little language the Arete tree is written in. Every file in this folder
 * calls `branch(area, discipline)` and adds achievements with `feat()` and
 * series with `ladder()`; they all land in one shared list.
 *
 * Ids are permanent (claims are stored by id): `${area}.${slug(discipline)}.${id}`
 * for feats and `${area}.${slug(discipline)}.${ladderId}@${slug(label)}` for
 * ladder rungs. Never rename or reuse one.
 *
 * Tiers: 0–1 anyone can do soon · 2–3 takes real effort · 4–5 years of work ·
 * 6–7 exceptional · 8–9 legendary · 10 once in a generation.
 */
import type { AreaId, AreteNode, MetricKind } from '@/types/arete';
import { parseAmount, parseTime } from '../metric';

export interface LadderInfo {
  id: string;
  /** The line's name on the map, e.g. "Mile". */
  name: string;
  area: AreaId;
  branch: string;
  kind: MetricKind;
  lowerIsBetter: boolean;
  /** Question for quick placement, e.g. "Fastest mile". */
  ask?: string;
  /** Example of what to type, e.g. "7:42". */
  hint?: string;
  rungs: string[];
  /** The line never ends: past its last rung, new ones appear by formula (amount ladders only). */
  extend?: boolean;
  /** Where an extending line stops for good (e.g. 195 countries). */
  max?: number;
  /** The title template, so extension rungs read like the rest. */
  title: (label: string) => string;
}

/** How a discipline works: shown on every station in it. */
export interface Guide {
  /** One or two sentences: how people usually progress. */
  how: string;
  /** One sentence: what most often stops people. */
  stops: string;
}

/** What each ladder's line is called on the map. */
const LINE_NAMES: Record<string, string> = {
  'body.running.mile-time': 'Mile', 'body.running.5k-time': '5K', 'body.running.10k-time': '10K', 'body.running.half-time': 'Half marathon',
  'body.running.marathon-time': 'Marathon', 'body.running.lifetime-miles': 'Lifetime miles',
  'body.strength.pushups': 'Push-ups', 'body.strength.pullups': 'Pull-ups', 'body.strength.squat': 'Squat', 'body.strength.bench': 'Bench press',
  'body.strength.deadlift': 'Deadlift', 'body.strength.press': 'Overhead press', 'body.strength.total': 'Big three total',
  'body.swimming.distance': 'Nonstop swim', 'body.cycling.ride': 'Longest ride', 'body.health.steps': 'Steps in a day', 'body.sport.boulder': 'Bouldering',
  'mind.reading.books': 'Books read', 'mind.learning.wpm': 'Typing speed', 'mind.science.papers': 'Papers', 'mind.mental-games.chess': 'Chess rating',
  'mind.mental-games.cube-time': 'Cube solve',
  'craft.writing.copies': 'Copies sold', 'craft.music.streams': 'Plays', 'craft.building.users': 'Users', 'craft.cooking.recipes': 'Dishes',
  'wealth.money.cushion': 'Savings cushion', 'wealth.money.net-worth': 'Net worth', 'wealth.career.income': 'Yearly income',
  'wealth.business.revenue': 'Monthly revenue', 'wealth.business.team': 'Team size',
  'bonds.love-and-family.years': 'Partnership', 'bonds.leadership.led': 'People led', 'bonds.service.hours': 'Volunteer hours',
  'bonds.service.given': 'Money given', 'bonds.service.blood-times': 'Blood donations', 'bonds.service.helped': 'People helped', 'bonds.voice.audience': 'Audience',
  'spirit.discipline.streak': 'Daily streak', 'spirit.stillness.sit': 'Longest sit', 'spirit.stillness.days': 'Days meditated', 'spirit.travel.countries': 'Countries',
};

export const nodes: AreteNode[] = [];
export const ladders: LadderInfo[] = [];
export const guides = new Map<string, Guide>();
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export interface LadderOpts {
  kind?: MetricKind;
  /** The line's name on the map (defaults to the discipline name). */
  name?: string;
  ask?: string;
  hint?: string;
  detail?: string;
  /** Never-ending: keep adding rungs past the last one (amount ladders only). */
  extend?: boolean;
  /** Cap for a never-ending line. */
  max?: number;
}
export interface Ladder { first: string; last: string; at: (label: string) => string }

export const disciplineKey = (area: AreaId, name: string) => `${area}.${slug(name)}`;

export function branch(area: AreaId, name: string) {
  const key = disciplineKey(area, name);
  /** One achievement. `after` = what must come first (the first is its parent on the map). */
  const feat = (id: string, title: string, tier: number, after: string | string[] | null = null, detail?: string): string => {
    const full = `${key}.${id}`;
    nodes.push({ id: full, area, branch: name, title, detail, tier, requires: after ? (Array.isArray(after) ? after : [after]) : [], source: 'core' });
    return full;
  };
  /**
   * A series of ever-harder rungs. `title` gets each label; tiers are spread
   * evenly from `tiers[0]` to `tiers[1]`. Times are "lower is better".
   */
  const ladder = (id: string, after: string | null, title: (v: string) => string, labels: string[], tiers: [number, number], opts: LadderOpts = {}): Ladder => {
    const kind = opts.kind ?? 'amount';
    const lid = `${key}.${id}`;
    const ids: string[] = [];
    labels.forEach((label, i) => {
      const full = `${lid}@${slug(label)}`;
      const tier = Math.round(tiers[0] + ((tiers[1] - tiers[0]) * i) / Math.max(1, labels.length - 1));
      const value = kind === 'time' ? parseTime(label) : parseAmount(label);
      nodes.push({
        id: full, area, branch: name, title: title(label), detail: opts.detail, tier,
        requires: i === 0 ? (after ? [after] : []) : [ids[i - 1]],
        ladder: lid, value: value ?? undefined, short: label, source: 'core',
      });
      ids.push(full);
    });
    ladders.push({
      id: lid, name: opts.name ?? LINE_NAMES[lid] ?? name, area, branch: name, kind, lowerIsBetter: kind === 'time',
      ask: opts.ask, hint: opts.hint, rungs: ids, extend: kind !== 'time' && opts.extend ? true : undefined, max: opts.max, title,
    });
    return { first: ids[0], last: ids[ids.length - 1], at: label => `${lid}@${slug(label)}` };
  };
  /** How this discipline works (shown on its stations). */
  const guide = (g: Guide) => { guides.set(key, g); };
  return { feat, ladder, guide };
}
