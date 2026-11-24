/**
 * The core of Arete: a universal skill tree for a human life.
 *
 * Six areas, each with disciplines that start from bare basics and branch
 * outward to the legendary. Hand-designed feats plus ladders built from
 * series (every mile time, lift, distance, count…). Anyone starts at the same
 * place; the AI "Discover" and your own nodes extend it from there.
 *
 * Tiers: 0–1 anyone can do soon · 2–3 takes real effort · 4–5 years of work ·
 * 6–7 exceptional · 8–9 legendary · 10 once in a generation.
 *
 * Ids are permanent (claims are stored by id) — never rename or reuse one.
 */
import type { AreaId, AreteNode, MetricKind } from '@/types/arete';
import { parseAmount, parseTime } from './metric';

export const AREAS: { id: AreaId; name: string; blurb: string; hue: string }[] = [
  { id: 'body', name: 'Body', blurb: 'Strength, endurance, health', hue: 'var(--teal)' },
  { id: 'mind', name: 'Mind', blurb: 'Knowledge, languages, thinking', hue: 'var(--sky)' },
  { id: 'craft', name: 'Craft', blurb: 'Making things', hue: 'var(--violet)' },
  { id: 'wealth', name: 'Wealth', blurb: 'Career, business, money', hue: 'var(--amber)' },
  { id: 'bonds', name: 'Bonds', blurb: 'Relationships, leadership, community', hue: 'var(--coral)' },
  { id: 'spirit', name: 'Spirit', blurb: 'Discipline, calm, adventure', hue: 'var(--primary)' },
];

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

const nodes: AreteNode[] = [];
const ladders: LadderInfo[] = [];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

interface LadderOpts { kind?: MetricKind; ask?: string; hint?: string; detail?: string }
interface Ladder { first: string; last: string; at: (label: string) => string }

function branch(area: AreaId, name: string) {
  const key = `${area}.${slug(name)}`;
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
    ladders.push({ id: lid, name: LINE_NAMES[lid] ?? name, area, branch: name, kind, lowerIsBetter: kind === 'time', ask: opts.ask, hint: opts.hint, rungs: ids });
    return { first: ids[0], last: ids[ids.length - 1], at: label => `${lid}@${slug(label)}` };
  };
  return { feat, ladder };
}

// ════════════════════════════════ BODY ════════════════════════════════

/** Anchors for nodes that need more than one discipline (triathlon). */
const TRI: Record<string, string> = {};

{
  const b = branch('body', 'Running');
  const start = b.feat('start', 'Run for 10 minutes without stopping', 0);
  const mile0 = b.feat('mile', 'Run a mile without stopping', 1, start);
  b.ladder('mile-time', mile0, v => `Run a mile in ${v}`,
    ['12:00', '11:00', '10:00', '9:00', '8:00', '7:30', '7:00', '6:30', '6:00', '5:30', '5:00', '4:40', '4:20', '4:00'], [1, 9],
    { kind: 'time', ask: 'Fastest mile', hint: '7:42' });
  const k5 = b.feat('5k', 'Finish a 5K', 1, mile0);
  b.ladder('5k-time', k5, v => `Run a 5K in ${v}`,
    ['35:00', '32:30', '30:00', '27:30', '25:00', '22:30', '20:00', '19:00', '18:00', '17:00', '16:00', '15:00', '14:00', '13:00'], [1, 10],
    { kind: 'time', ask: 'Fastest 5K', hint: '26:30' });
  const k10 = b.feat('10k', 'Finish a 10K', 2, k5);
  b.ladder('10k-time', k10, v => `Run a 10K in ${v}`,
    ['1:10:00', '1:05:00', '1:00:00', '55:00', '50:00', '45:00', '42:00', '40:00', '37:30', '35:00', '32:30', '30:00', '28:00'], [2, 9],
    { kind: 'time', ask: 'Fastest 10K', hint: '55:00' });
  const half = b.feat('half', 'Finish a half marathon', 3, k10);
  b.ladder('half-time', half, v => `Run a half marathon in ${v}`,
    ['2:30:00', '2:15:00', '2:00:00', '1:50:00', '1:40:00', '1:30:00', '1:25:00', '1:20:00', '1:15:00', '1:10:00', '1:05:00', '1:00:00'], [3, 9],
    { kind: 'time', ask: 'Fastest half marathon', hint: '1:58:00' });
  const mar = b.feat('marathon', 'Finish a marathon', 4, half);
  const mart = b.ladder('marathon-time', mar, v => `Run a marathon in ${v}`,
    ['5:00:00', '4:30:00', '4:00:00', '3:45:00', '3:30:00', '3:15:00', '3:00:00', '2:50:00', '2:40:00', '2:30:00', '2:20:00', '2:10:00', '2:05:00'], [4, 10],
    { kind: 'time', ask: 'Fastest marathon', hint: '4:10:00' });
  b.feat('boston', 'Qualify for the Boston Marathon', 6, mart.at('3:30:00'), 'Run your age group\'s qualifying time.');
  const majors = b.feat('majors', 'Run all six World Marathon Majors', 7, mar);
  b.feat('continents', 'Run a marathon on every continent', 8, majors);
  const u50k = b.feat('50k', 'Finish a 50K ultramarathon', 5, mar);
  const u50m = b.feat('50-mile', 'Finish a 50-mile race', 6, u50k);
  const u100k = b.feat('100k', 'Finish a 100K', 6, u50m);
  const u100 = b.feat('100-mile', 'Finish a 100-mile race', 7, u100k);
  b.feat('100-mile-24h', 'Run 100 miles in under 24 hours', 8, u100);
  b.feat('200-mile', 'Finish a 200-mile race', 9, u100);
  b.ladder('lifetime-miles', start, v => `Run ${v} miles in your life`,
    ['50', '100', '250', '500', '1,000', '2,500', '5,000', '10,000', '25,000', '50,000', '100,000'], [0, 9],
    { ask: 'Lifetime running miles (rough)', hint: '800' });

  // Triathlon grows where running, swimming and cycling meet (see below).
  TRI.run5k = k5; TRI.run10k = k10; TRI.half = half; TRI.mar = mar;
}

{
  const b = branch('body', 'Strength');
  const pu1 = b.feat('pushup', 'Do a push-up', 0);
  const pus = b.ladder('pushups', pu1, v => `${v} push-ups in a row`, ['5', '10', '20', '30', '40', '50', '75', '100'], [0, 6],
    { ask: 'Most push-ups in a row', hint: '25' });
  b.feat('one-arm-pushup', 'Do a one-arm push-up', 5, pus.at('30'));
  const hang = b.feat('hang', 'Dead hang for 30 seconds', 0);
  const pull1 = b.feat('pullup', 'Do a pull-up', 1, hang);
  const pulls = b.ladder('pullups', pull1, v => `${v} pull-ups in a row`, ['3', '5', '8', '10', '12', '15', '20', '25', '30', '40'], [1, 8],
    { ask: 'Most pull-ups in a row', hint: '6' });
  const mu = b.feat('muscle-up', 'Do a muscle-up', 5, pulls.at('10'));
  b.feat('muscle-up-5', '5 muscle-ups in a row', 6, mu);
  b.feat('weighted-pullup', 'Pull-up with half your bodyweight added', 6, pulls.at('10'));
  b.feat('front-lever', 'Hold a front lever for 5 seconds', 6, pulls.at('12'));
  b.feat('one-arm-pullup', 'Do a one-arm pull-up', 8, pulls.at('20'));
  b.feat('human-flag', 'Hold a human flag for 5 seconds', 7, pulls.at('15'));

  const gym = b.feat('first-session', 'Complete a strength workout', 0);
  const habit = b.feat('month', 'Lift 3 times a week for a month', 1, gym);
  b.feat('year', 'Lift 3 times a week for a year', 4, habit);
  const bw: LadderOpts = { kind: 'bwx', detail: 'One clean rep. × means times your own bodyweight.' };
  const squat = b.ladder('squat', habit, v => `Squat ${v} bodyweight`, ['0.5×', '0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×', '2.25×', '2.5×', '2.75×', '3×'], [1, 9],
    { ...bw, ask: 'Best squat (lb)', hint: '225' });
  const bench = b.ladder('bench', habit, v => `Bench press ${v} bodyweight`, ['0.5×', '0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×', '2.25×', '2.5×'], [1, 9],
    { ...bw, ask: 'Best bench press (lb)', hint: '185' });
  const dead = b.ladder('deadlift', habit, v => `Deadlift ${v} bodyweight`, ['0.75×', '1×', '1.25×', '1.5×', '1.75×', '2×', '2.25×', '2.5×', '2.75×', '3×', '3.25×', '3.5×'], [1, 9],
    { ...bw, ask: 'Best deadlift (lb)', hint: '275' });
  b.ladder('press', habit, v => `Overhead press ${v} bodyweight`, ['0.35×', '0.5×', '0.65×', '0.75×', '0.85×', '1×', '1.1×', '1.25×'], [1, 9],
    { ...bw, ask: 'Best overhead press (lb)', hint: '115' });
  b.ladder('total', squat.at('1×'), v => `Squat + bench + deadlift total ${v} lb`, ['500', '750', '1,000', '1,250', '1,500', '1,750', '2,000', '2,250'], [3, 10],
    { ask: 'Squat + bench + deadlift total (lb)', hint: '900', detail: 'Your best single of each, added together. 1,000 lb is "the 1,000-pound club".' });
  const meet = b.feat('meet', 'Compete in a lifting meet', 4, [bench.at('1×'), squat.at('1.25×'), dead.at('1.5×')]);
  const win = b.feat('meet-win', 'Win your class at a meet', 6, meet);
  b.feat('national', 'Win a national lifting title', 9, win);
}

{
  const b = branch('body', 'Movement');
  const toes = b.feat('toes', 'Touch your toes with straight legs', 0);
  b.feat('palms', 'Palms flat on the floor, legs straight', 2, toes);
  const fs = b.feat('front-splits', 'Front splits', 5, toes);
  b.feat('middle-splits', 'Middle splits', 6, fs);
  const sq = b.feat('deep-squat', 'Sit in a deep squat for 1 minute', 0);
  const sq5 = b.feat('deep-squat-5', 'Sit in a deep squat for 5 minutes', 2, sq);
  b.feat('pistol', 'Do a pistol squat on each leg', 4, sq5);
  const bridge = b.feat('bridge', 'Hold a bridge for 30 seconds', 2, toes);
  b.feat('stand-to-bridge', 'Stand, drop to a bridge and stand back up', 5, bridge);
  const wall = b.feat('wall-handstand', 'Hold a wall handstand for 30 seconds', 2);
  const hs = b.feat('handstand', 'Hold a freestanding handstand for 10 seconds', 4, wall);
  const hs60 = b.feat('handstand-60', 'Hold a handstand for 60 seconds', 6, hs);
  b.feat('handstand-walk', 'Walk 10 metres on your hands', 6, hs);
  b.feat('handstand-pushup', 'Do a freestanding handstand push-up', 7, hs60);
  b.feat('one-arm-handstand', 'Hold a one-arm handstand', 9, hs60);
  const lsit = b.feat('l-sit', 'Hold an L-sit for 10 seconds', 3);
  const lsit30 = b.feat('l-sit-30', 'Hold an L-sit for 30 seconds', 5, lsit);
  const vsit = b.feat('v-sit', 'Hold a V-sit', 7, lsit30);
  b.feat('planche', 'Hold a full planche', 8, vsit);
  const yoga = b.feat('yoga', 'Complete a yoga or mobility class', 0);
  b.feat('yoga-30', 'Stretch or do yoga daily for 30 days', 2, yoga);
}

{
  const b = branch('body', 'Swimming');
  const s25 = b.feat('25', 'Swim 25 metres', 0);
  const dist = b.ladder('distance', s25, v => `Swim ${v} without stopping`, ['100 m', '200 m', '400 m', '800 m', '1,500 m', '3 km', '5 km', '10 km'], [1, 7],
    { ask: 'Longest nonstop swim (metres)', hint: '400' });
  b.feat('open-water', 'Swim a mile in open water', 4, dist.at('1,500 m'));
  const channel = b.feat('channel', 'Swim the English Channel', 9, dist.at('10 km'));
  b.feat('oceans-seven', 'Complete the Oceans Seven', 10, channel, 'The seven hardest channel swims in the world.');
  TRI.swim400 = dist.at('400 m'); TRI.swim1500 = dist.at('1,500 m'); TRI.swim3k = dist.at('3 km');
}

{
  const b = branch('body', 'Cycling');
  const r10 = b.feat('10', 'Ride 10 miles', 0);
  const ride = b.ladder('ride', r10, v => `Ride ${v} miles in a day`, ['25', '50', '75', '100', '125', '200', '300'], [1, 7],
    { ask: 'Longest ride in a day (miles)', hint: '40' });
  const pbp = b.feat('1200k', 'Finish a 1,200 km ride inside 90 hours', 8, ride.at('300'), 'For example Paris–Brest–Paris.');
  const country = b.feat('across-country', 'Cycle across a country', 6, ride.at('100'));
  const continent = b.feat('across-continent', 'Cycle across a continent', 8, country);
  b.feat('around-world', 'Cycle around the world', 10, [continent, pbp]);

  // Triathlon: needs all three.
  const t = branch('body', 'Triathlon');
  const sprint = t.feat('sprint', 'Finish a sprint triathlon', 3, [TRI.run5k, TRI.swim400, ride.at('25')]);
  const oly = t.feat('olympic', 'Finish an Olympic-distance triathlon', 4, [sprint, TRI.run10k, TRI.swim1500]);
  const h70 = t.feat('half-ironman', 'Finish a half Ironman (70.3)', 6, [oly, TRI.half, ride.at('50')]);
  const im = t.feat('ironman', 'Finish an Ironman', 7, [h70, TRI.mar, TRI.swim3k, ride.at('100')]);
  const im10 = t.feat('ironman-10h', 'Finish an Ironman in under 10 hours', 8, im);
  t.feat('kona', 'Qualify for the Ironman World Championship', 9, im10);
}

{
  const b = branch('body', 'Health');
  const walk = b.feat('walk', 'Walk for 30 minutes', 0);
  const steps = b.ladder('steps', walk, v => `Walk ${v} steps in a day`, ['5,000', '8,000', '10,000', '15,000', '20,000', '30,000', '50,000'], [0, 5],
    { ask: 'Most steps in one day', hint: '14,000' });
  const s30 = b.feat('steps-30', '10,000 steps a day for 30 days', 2, steps.at('10,000'));
  const s100 = b.feat('steps-100', '10,000 steps a day for 100 days', 4, s30);
  b.feat('steps-365', '10,000 steps a day for a year', 6, s100);
  const sleep = b.feat('sleep-7', 'Sleep 7+ hours every night for a week', 0);
  const sleep30 = b.feat('sleep-30', 'Sleep 7+ hours every night for 30 days', 2, sleep);
  b.feat('sleep-100', 'Sleep 7+ hours every night for 100 days', 4, sleep30);
  b.feat('checkup', 'Get a full health check-up', 0);
  const dry = b.feat('dry-30', 'No alcohol for 30 days', 2);
  b.feat('dry-365', 'No alcohol for a year', 5, dry);
  const rhr = b.feat('rhr-60', 'Resting heart rate under 60', 3, walk);
  b.feat('rhr-50', 'Resting heart rate under 50', 5, rhr);
  const meals = b.feat('whole-food-week', 'Eat home-cooked whole food for a week', 1);
  b.feat('whole-food-90', 'Eat mostly whole food for 90 days', 4, meals);
}

{
  const b = branch('body', 'Sport');
  const team = b.feat('join', 'Join a team or club', 1);
  const season = b.feat('season', 'Play a full season', 2, team);
  const league = b.feat('league', 'Win a league or tournament', 4, season);
  const college = b.feat('college', 'Compete at college or regional level', 6, league);
  const pro = b.feat('pro', 'Compete as a professional athlete', 8, college);
  const nat = b.feat('national-team', 'Represent your country', 9, pro);
  b.feat('olympic-medal', 'Win an Olympic or world championship medal', 10, nat);
  const ma = b.feat('martial-first', 'Take a martial arts class', 0);
  const ma3 = b.feat('martial-3mo', 'Train a martial art for 3 months', 2, ma);
  const belt = b.feat('belt', 'Earn your first belt or rank', 2, ma3);
  const fight = b.feat('compete', 'Compete in a match or tournament', 4, belt);
  const black = b.feat('black-belt', 'Earn a black belt', 7, fight);
  b.feat('martial-champion', 'Win a national martial arts title', 9, black);
  const climb = b.feat('climb', 'Top out an indoor climbing route', 0);
  b.ladder('boulder', climb, v => `Climb a ${v} boulder`, ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V10', 'V12', 'V14'], [1, 10],
    { ask: 'Hardest boulder grade (V-scale number)', hint: '3' });
}

// ════════════════════════════════ MIND ════════════════════════════════

{
  const b = branch('mind', 'Reading');
  const one = b.feat('one', 'Finish a book', 0);
  const books = b.ladder('books', one, v => `Read ${v} books in your life`, ['5', '10', '25', '50', '100', '250', '500', '1,000', '2,500'], [0, 8],
    { ask: 'Books you\'ve read (rough)', hint: '40' });
  const y12 = b.feat('year-12', 'Read 12 books in a year', 2, books.at('5'));
  const y24 = b.feat('year-24', 'Read 24 books in a year', 3, y12);
  const y52 = b.feat('year-52', 'Read 52 books in a year', 5, y24);
  b.feat('year-100', 'Read 100 books in a year', 7, y52);
  b.feat('long', 'Finish a book of 1,000+ pages', 2, one);
  b.feat('daily-30', 'Read every day for 30 days', 1, one);
  b.feat('great-books', 'Read 100 of the great books', 7, books.at('100'));
}

{
  const b = branch('mind', 'Learning');
  const course = b.feat('course', 'Finish an online course', 0);
  const c5 = b.feat('courses-5', 'Finish 5 courses', 2, course);
  b.feat('courses-20', 'Finish 20 courses', 4, c5);
  b.feat('cert', 'Earn a professional certificate', 3, course);
  const ba = b.feat('bachelor', 'Earn a bachelor\'s degree', 4, course);
  const ms = b.feat('master', 'Earn a master\'s degree', 5, ba);
  const phd = b.feat('doctorate', 'Earn a doctorate', 7, ms);
  b.feat('professor', 'Become a tenured professor', 8, phd);
  const type = b.feat('touch-type', 'Learn to touch-type', 0);
  b.ladder('wpm', type, v => `Type ${v} words a minute`, ['40', '60', '80', '100', '120', '150'], [1, 8], { ask: 'Typing speed (words a minute)', hint: '55' });
  const explain = b.feat('explain', 'Explain a hard idea to a friend so they get it', 0);
  const teach = b.feat('teach', 'Teach a class or workshop', 3, explain);
  b.feat('tutor', 'Tutor someone to a real result', 3, explain);
  const c100 = b.feat('course-100', 'Create a course taken by 100 people', 5, teach);
  b.feat('course-10k', 'Teach 10,000 students', 7, c100);
  b.feat('textbook', 'Write a textbook used in classrooms', 8, teach);
}

{
  const b = branch('mind', 'Languages');
  const w100 = b.feat('100-words', 'Learn 100 words of a new language', 0);
  const chat = b.feat('chat', 'Hold a 5-minute conversation in it', 2, w100);
  const b1 = b.feat('b1', 'Get by while travelling (B1)', 3, chat);
  const b2 = b.feat('b2', 'Speak it fluently in conversation (B2)', 5, b1);
  const c1 = b.feat('c1', 'Work or study in it (C1)', 6, b2);
  b.feat('c2', 'Near-native mastery (C2)', 8, c1);
  b.feat('book', 'Read a novel in a foreign language', 5, b1);
  const l2 = b.feat('second', 'Fluent in two foreign languages', 7, b2);
  const l3 = b.feat('third', 'Fluent in three foreign languages', 8, l2);
  const l5 = b.feat('polyglot', 'Fluent in five foreign languages', 9, l3);
  b.feat('hyperpolyglot', 'Fluent in ten foreign languages', 10, l5);
}

{
  const b = branch('mind', 'Science');
  const paper = b.feat('read-paper', 'Read a scientific paper start to finish', 1);
  const review = b.feat('review', 'Write a review of the research on one question', 3, paper);
  const exp = b.feat('experiment', 'Design and run your own experiment', 4, review);
  const conf = b.feat('conference', 'Present your work at a conference', 5, exp);
  const pub = b.feat('publish', 'Publish a peer-reviewed paper', 6, conf);
  const papers = b.ladder('papers', pub, v => `Publish ${v} peer-reviewed papers`, ['5', '10', '25', '50', '100'], [6, 9], { ask: 'Peer-reviewed papers published', hint: '0' });
  const lab = b.feat('lab', 'Lead a research lab', 8, papers.at('10'));
  const disc = b.feat('discovery', 'Make a discovery that changes your field', 9, lab);
  b.feat('cure', 'Cure a disease', 10, disc);
  b.feat('nobel', 'Win a Nobel Prize', 10, disc);
  const patent = b.feat('patent', 'Be granted a patent', 5, exp);
  b.feat('patents-10', 'Hold 10 patents', 7, patent);
  const quad = b.feat('quadratic', 'Solve a quadratic equation by hand', 1);
  const calc = b.feat('calculus', 'Learn calculus well enough to use it', 3, quad);
  const proof = b.feat('proof', 'Prove a theorem nobody showed you', 5, calc);
  const math = b.feat('publish-math', 'Publish original mathematics', 7, proof);
  b.feat('fields', 'Win the Fields Medal or Abel Prize', 10, math);
}

{
  const b = branch('mind', 'Mental games');
  const rules = b.feat('chess-rules', 'Learn the rules of chess', 0);
  b.ladder('chess', rules, v => `Reach a chess rating of ${v}`, ['800', '1000', '1200', '1400', '1600', '1800', '2000', '2200', '2400', '2500', '2700'], [1, 10],
    { ask: 'Chess rating', hint: '1100', detail: '2200 is master, 2400 international master, 2500 grandmaster.' });
  const cube = b.feat('cube', 'Solve a Rubik\'s cube', 1);
  b.ladder('cube-time', cube, v => `Solve a Rubik's cube in ${v}`, ['2:00', '1:00', '0:45', '0:30', '0:20', '0:15', '0:10', '0:07', '0:05'], [2, 9],
    { kind: 'time', ask: 'Fastest Rubik\'s cube solve', hint: '1:20' });
  const poem = b.feat('poem', 'Memorise a poem', 0);
  const pi20 = b.feat('pi-20', 'Memorise 20 digits of π', 1, poem);
  const pi100 = b.feat('pi-100', 'Memorise 100 digits of π', 3, pi20);
  const deck = b.feat('deck', 'Memorise a shuffled deck of cards', 4, pi100);
  const deck5 = b.feat('deck-5', 'Memorise a deck in under 5 minutes', 6, deck);
  const deck1 = b.feat('deck-1', 'Memorise a deck in under 1 minute', 8, deck5);
  b.feat('memory-gm', 'Earn the title Grandmaster of Memory', 9, deck1);
  const deep = b.feat('deep-30', '30 minutes of focused work, phone away', 0);
  const deep1 = b.feat('deep-60', 'One hour of unbroken deep work', 1, deep);
  const deep2 = b.feat('deep-120', 'Two hours of unbroken deep work', 2, deep1);
  const deep4 = b.feat('deep-4h', 'Four hours of deep work in one day', 4, deep2);
  b.feat('deep-4h-30', 'Four hours of deep work a day for 30 days', 6, deep4);
}

// ════════════════════════════════ CRAFT ════════════════════════════════

{
  const b = branch('craft', 'Writing');
  const w500 = b.feat('500', 'Write 500 words', 0);
  const d7 = b.feat('daily-7', 'Write every day for a week', 1, w500);
  const d30 = b.feat('daily-30', 'Write every day for 30 days', 2, d7);
  const d100 = b.feat('daily-100', 'Write every day for 100 days', 4, d30);
  b.feat('daily-365', 'Write every day for a year', 6, d100);
  const story = b.feat('story', 'Finish a short story or essay', 2, w500);
  const pubs = b.feat('published', 'Get a piece published', 3, story);
  const w50k = b.feat('50k', 'Write 50,000 words of one project', 4, story);
  const ms = b.feat('manuscript', 'Finish a book manuscript', 5, w50k);
  const book = b.feat('book', 'Publish a book', 6, [ms, pubs]);
  const sold = b.ladder('copies', book, v => `Sell ${v} copies of your books`, ['100', '1,000', '10,000', '100,000', '1M', '10M'], [6, 10], { ask: 'Book copies sold', hint: '0' });
  b.feat('bestseller', 'Reach a national bestseller list', 8, sold.at('10,000'));
  const prize = b.feat('prize', 'Win a major literary prize', 9, book);
  b.feat('nobel-lit', 'Win the Nobel Prize in Literature', 10, prize);
  const books3 = b.feat('books-3', 'Publish three books', 7, book);
  b.feat('books-10', 'Publish ten books', 8, books3);
}

{
  const b = branch('craft', 'Music');
  const song = b.feat('song', 'Play a simple song on an instrument', 0);
  const p30 = b.feat('practice-30', 'Practise an instrument 30 days in a row', 2, song);
  const ten = b.feat('ten-songs', 'Play 10 songs from memory', 3, p30);
  const perf = b.feat('perform', 'Perform for an audience', 3, ten);
  const band = b.feat('band', 'Play in a band or ensemble', 4, perf);
  const gig = b.feat('gig', 'Play a paid gig', 5, band);
  const venue = b.feat('venue', 'Headline a venue of 1,000', 7, gig);
  b.feat('arena', 'Sell out an arena', 9, venue);
  b.feat('advanced', 'Reach conservatory or grade-8 level', 6, ten);
  const own = b.feat('write-song', 'Write your own song', 3, song);
  const rel = b.feat('release', 'Record and release a song', 4, own);
  const album = b.feat('album', 'Release an album', 5, rel);
  const streams = b.ladder('streams', rel, v => `${v} plays of your music`, ['1,000', '10,000', '100,000', '1M', '10M', '100M', '1B'], [4, 10], { ask: 'Total plays of your music', hint: '0' });
  b.feat('award', 'Win a major music award', 9, [album, streams.at('10M')]);
  const sing = b.feat('sing', 'Sing a song in front of people', 1);
  b.feat('choir', 'Sing in a choir or group for a season', 3, sing);
}

{
  const b = branch('craft', 'Visual art');
  const draw = b.feat('drawing', 'Finish a drawing', 0);
  const d30 = b.feat('daily-30', 'Draw every day for 30 days', 2, draw);
  const d100 = b.feat('daily-100', 'Draw every day for 100 days', 4, d30);
  b.feat('daily-365', 'Draw every day for a year', 6, d100);
  const ten = b.feat('ten', 'Finish 10 pieces', 2, draw);
  const book = b.feat('sketchbook', 'Fill a whole sketchbook', 3, ten);
  b.feat('portrait', 'Paint or draw a portrait from life', 4, book);
  const sell = b.feat('sell', 'Sell a piece of your art', 4, ten);
  const group = b.feat('group-show', 'Exhibit in a group show', 4, ten);
  const solo = b.feat('solo-show', 'Have a solo exhibition', 6, [group, sell]);
  const gallery = b.feat('gallery', 'Be represented by a gallery', 7, solo);
  b.feat('museum', 'Have work in a museum collection', 9, gallery);
  const photo = b.feat('photo', 'Take a photo you\'re proud of', 0);
  const photopub = b.feat('photo-published', 'Have a photo published', 4, photo);
  b.feat('photo-award', 'Win a photography competition', 6, photopub);
  const design = b.feat('design', 'Design a poster or logo', 1);
  b.feat('design-paid', 'Get paid for design work', 4, design);
}

{
  const b = branch('craft', 'Film');
  const one = b.feat('1min', 'Shoot and edit a 1-minute video', 0);
  const short = b.feat('short', 'Finish a short film', 3, one);
  const fest = b.feat('festival', 'Get a film selected by a festival', 5, short);
  const award = b.feat('award', 'Win a festival award', 6, fest);
  const feature = b.feat('feature', 'Finish a feature film', 7, award);
  const release = b.feat('release', 'Get a film released in cinemas or on a major streamer', 8, feature);
  b.feat('oscar', 'Win an Academy Award', 10, release);
  const v10 = b.feat('videos-10', 'Publish 10 videos', 2, one);
  b.feat('videos-100', 'Publish 100 videos', 5, v10);
  const stage = b.feat('stage', 'Act or perform on a stage', 2);
  const lead = b.feat('lead', 'Play a lead role in a production', 5, stage);
  b.feat('pro-actor', 'Earn your living as a performer', 8, lead);
}

{
  const b = branch('craft', 'Building');
  const hello = b.feat('program', 'Write your first program', 0);
  const tool = b.feat('tool', 'Build a small tool you actually use', 2, hello);
  const ship = b.feat('ship', 'Ship an app or site to the public', 3, tool);
  b.ladder('users', ship, v => `${v} people use something you built`, ['10', '100', '1,000', '10,000', '100,000', '1M', '10M', '100M', '1B'], [3, 10], { ask: 'Users of something you built', hint: '0' });
  const oss = b.feat('open-source', 'Get a contribution merged into an open-source project', 3, hello);
  const s1k = b.feat('stars-1k', 'Maintain a project with 1,000 stars', 6, oss);
  b.feat('stars-10k', 'Maintain a project with 10,000 stars', 8, s1k);
  const fix = b.feat('fix', 'Fix something broken at home', 0);
  const furn = b.feat('furniture', 'Build a piece of furniture', 3, fix);
  const room = b.feat('renovate', 'Renovate a room yourself', 5, furn);
  b.feat('house', 'Build a house', 8, room);
  const circuit = b.feat('circuit', 'Build a working electronic circuit', 2);
  b.feat('robot', 'Build a robot that does a useful job', 5, circuit);
  b.feat('sew', 'Sew a garment you wear', 2);
  const grow = b.feat('grow', 'Grow something you eat', 1);
  b.feat('garden', 'Grow most of your vegetables for a season', 5, grow);
  const invent = b.feat('invent', 'Invent something and build the prototype', 5, tool);
  b.feat('product', 'Bring a physical product to market', 7, invent);
}

{
  const b = branch('craft', 'Cooking');
  const meal = b.feat('meal', 'Cook a meal from scratch', 0);
  const rec = b.ladder('recipes', meal, v => `Cook ${v} dishes well from memory`, ['5', '10', '25', '50', '100', '250'], [1, 6], { ask: 'Dishes you cook well from memory', hint: '8' });
  b.feat('dinner', 'Host a dinner for eight', 3, rec.at('5'));
  const bread = b.feat('bread', 'Bake bread from scratch', 2, meal);
  b.feat('sourdough', 'Bake sourdough from your own starter', 3, bread);
  b.feat('month', 'Cook every meal for 30 days', 4, rec.at('10'));
  const tasting = b.feat('tasting', 'Cook a five-course tasting menu', 5, rec.at('25'));
  const pro = b.feat('pro-kitchen', 'Work in a professional kitchen', 6, tasting);
  const rest = b.feat('restaurant', 'Run your own restaurant', 7, pro);
  const star = b.feat('star', 'Earn a Michelin star', 9, rest);
  b.feat('three-stars', 'Earn three Michelin stars', 10, star);
}

{
  const b = branch('craft', 'Dance');
  const routine = b.feat('routine', 'Learn a dance routine', 1);
  const perform = b.feat('perform', 'Perform a dance for an audience', 3, routine);
  const comp = b.feat('compete', 'Compete in a dance competition', 5, perform);
  b.feat('pro', 'Dance professionally', 8, comp);
  b.feat('social', 'Dance with a stranger at a social', 2, routine);
}

// ════════════════════════════════ WEALTH ════════════════════════════════

{
  const b = branch('wealth', 'Money');
  const track = b.feat('track', 'Track every dollar for a month', 0);
  const bud3 = b.feat('budget-3', 'Live on a budget for 3 months', 2, track);
  b.feat('budget-12', 'Live on a budget for a year', 4, bud3);
  const s100 = b.feat('save-100', 'Save your first $100', 0);
  const e1k = b.feat('fund-1k', 'Build a $1,000 emergency fund', 1, s100);
  const cushion = b.ladder('cushion', e1k, v => `Save ${v} of living costs`, ['1 month', '3 months', '6 months', '12 months'], [2, 5],
    { ask: 'Months of living costs saved', hint: '2' });
  const debts = b.feat('list-debts', 'List everything you owe', 0);
  const one = b.feat('debt-one', 'Pay off one debt completely', 2, debts);
  const cc = b.feat('no-card-debt', 'Carry no credit-card debt', 3, one);
  const free = b.feat('debt-free', 'Debt-free apart from a mortgage', 5, cc);
  const invest = b.feat('first-investment', 'Make your first investment', 1, s100);
  const inv12 = b.feat('invest-12', 'Invest every month for a year', 3, invest);
  b.feat('max-retirement', 'Max out a retirement account for a year', 4, inv12);
  const worth = b.ladder('net-worth', invest, v => `Net worth of ${v}`, ['$10k', '$25k', '$50k', '$100k', '$250k', '$500k', '$1M', '$2.5M', '$5M', '$10M', '$25M', '$100M', '$1B'], [2, 10],
    { ask: 'Net worth (optional, stays on this phone)', hint: '$40k' });
  const home = b.feat('home', 'Buy a home', 5, cushion.at('3 months'));
  b.feat('home-paid', 'Own your home outright', 7, [home, free]);
  b.feat('fi', 'Financial independence: investments cover your living costs', 8, worth.at('$500k'));
}

{
  const b = branch('wealth', 'Career');
  const pay = b.feat('paycheck', 'Earn your first paycheck', 0);
  b.ladder('income', pay, v => `Earn ${v} in a year`, ['$25k', '$50k', '$75k', '$100k', '$150k', '$250k', '$500k', '$1M', '$10M'], [1, 9],
    { ask: 'Most earned in a year (optional)', hint: '$60k' });
  const job = b.feat('job', 'Land a job you applied for', 1, pay);
  const raise = b.feat('raise', 'Earn a raise or promotion', 2, job);
  b.feat('negotiate', 'Negotiate an offer upward', 2, job);
  const proj = b.feat('lead-project', 'Lead a project from start to finish', 3, raise);
  const mgr = b.feat('manager', 'Manage a team', 4, proj);
  const mgr2 = b.feat('manage-managers', 'Manage other managers', 6, mgr);
  const exec = b.feat('executive', 'Become an executive', 7, mgr2);
  b.feat('ceo', 'Run a company of 1,000+ people', 9, exec);
  const goto = b.feat('go-to', 'Become the person your team asks', 3, job);
  const expert = b.feat('expert', 'Be recognised as an expert in your industry', 6, goto);
  b.feat('top', 'Reach the very top of your field', 9, expert);
  b.feat('switch', 'Move into a career you chose on purpose', 4, job);
  b.feat('offers-3', 'Hold three job offers at once', 4, job);
}

{
  const b = branch('wealth', 'Business');
  const d1 = b.feat('first-dollar', 'Earn your first $1 on your own', 1);
  const rev = b.ladder('revenue', d1, v => `Make ${v} a month from your own business`, ['$100', '$1,000', '$5,000', '$10,000', '$50,000', '$100,000', '$1M', '$10M', '$100M'], [2, 10],
    { ask: 'Best month of your own business revenue', hint: '$0' });
  b.feat('register', 'Register a company', 2, d1);
  const client = b.feat('client', 'Win your first paying client', 2, d1);
  const c10 = b.feat('clients-10', 'Serve 10 paying clients', 4, client);
  b.feat('replace-salary', 'Replace your salary with your own work', 6, [c10, rev.at('$5,000')]);
  const hire = b.feat('hire', 'Hire your first employee', 5, rev.at('$5,000'));
  const team = b.ladder('team', hire, v => `Employ ${v} people`, ['10', '100', '1,000', '10,000'], [6, 10], { ask: 'People you employ', hint: '0' });
  const fund = b.feat('funding', 'Raise outside funding', 6, hire);
  b.feat('exit', 'Sell a company', 8, team.at('10'));
  b.feat('ipo', 'Take a company public', 9, team.at('100'));
  b.feat('unicorn', 'Build a company worth $1 billion', 10, fund);
}

// ════════════════════════════════ BONDS ════════════════════════════════

{
  const b = branch('bonds', 'Friendship');
  const reach = b.feat('reach-out', 'Reach out to someone you lost touch with', 0);
  const host = b.feat('host', 'Host a gathering', 1, reach);
  const weekly = b.feat('weekly', 'See friends every week for 3 months', 2, host);
  const group = b.feat('group-year', 'Run a group that meets monthly for a year', 4, weekly);
  b.feat('group-decade', 'Keep a group meeting for 10 years', 7, group);
  const newf = b.feat('new-friend', 'Make a new close friend as an adult', 2, reach);
  const f10 = b.feat('decade', 'Keep a friendship alive for 10 years', 4, newf);
  const f25 = b.feat('25-years', 'Keep a friendship alive for 25 years', 6, f10);
  b.feat('50-years', 'Keep a friendship alive for 50 years', 8, f25);
  const thanks = b.feat('thanks', 'Write someone a heartfelt thank-you', 0);
  b.feat('thanks-30', 'Thank someone every day for 30 days', 2, thanks);
  const stranger = b.feat('stranger', 'Start a conversation with a stranger', 0);
  b.feat('stranger-30', 'Talk to a stranger every day for 30 days', 3, stranger);
}

{
  const b = branch('bonds', 'Love and family');
  const ask = b.feat('ask', 'Ask someone out', 1);
  const y1 = b.feat('year', 'Build a relationship that lasts a year', 3, ask);
  b.ladder('years', y1, v => `A partnership of ${v} years`, ['5', '10', '25', '50'], [4, 9], { ask: 'Longest partnership (years)', hint: '3' });
  const dinner = b.feat('dinner', 'Share a family meal every week for a year', 3);
  const crisis = b.feat('crisis', 'Be the person someone calls in a crisis', 3);
  b.feat('care', 'Care for a family member through a hard time', 5, crisis);
  b.feat('repair', 'Repair a broken relationship', 5, crisis);
  b.feat('raise', 'Raise a child to adulthood', 8, dinner);
  b.feat('history', 'Record your family\'s story for the next generation', 4, dinner);
}

{
  const b = branch('bonds', 'Leadership');
  const meet = b.feat('meeting', 'Run a meeting', 1);
  const cap = b.feat('captain', 'Captain a team or chair a club', 3, meet);
  b.ladder('led', cap, v => `Lead ${v} people`, ['5', '25', '100', '1,000', '10,000', '100,000'], [3, 9], { ask: 'Most people you\'ve led', hint: '4' });
  const vote = b.feat('vote', 'Vote in every election for four years', 1);
  const camp = b.feat('campaign', 'Volunteer on a campaign', 2, vote);
  const run = b.feat('run', 'Run for office', 5, camp);
  const local = b.feat('local', 'Win a local election', 6, run);
  const state = b.feat('regional', 'Win state or regional office', 8, local);
  const natl = b.feat('national', 'Serve in a national legislature', 9, state);
  b.feat('head-of-state', 'Become head of state', 10, natl);
  const mentor = b.feat('mentor', 'Mentor one person for six months', 3, meet);
  const m10 = b.feat('mentor-10', 'Mentor 10 people', 6, mentor);
  b.feat('mentor-100', 'Mentor 100 people', 8, m10);
}

{
  const b = branch('bonds', 'Service');
  const hour = b.feat('hour', 'Volunteer for an hour', 0);
  b.ladder('hours', hour, v => `Volunteer ${v} hours`, ['10', '50', '100', '500', '1,000', '5,000', '10,000'], [1, 8], { ask: 'Hours volunteered in your life', hint: '20' });
  const give = b.feat('donate', 'Give money to a cause you believe in', 0);
  b.ladder('given', give, v => `Give away ${v}`, ['$100', '$1,000', '$10,000', '$100,000', '$1M', '$10M', '$100M', '$1B'], [1, 10], { ask: 'Total given to causes', hint: '$300' });
  const blood = b.feat('blood', 'Donate blood', 1);
  b.ladder('blood-times', blood, v => `Donate blood ${v} times`, ['10', '25', '50', '100'], [3, 7], { ask: 'Times you\'ve donated blood', hint: '2' });
  b.feat('cpr', 'Get certified in CPR and first aid', 1);
  const found = b.feat('nonprofit', 'Found a nonprofit or community project', 6, hour);
  b.ladder('helped', found, v => `Help ${v} people through your work`, ['1,000', '100,000', '1M', '100M'], [6, 10], { ask: 'People helped through your work', hint: '0' });
}

{
  const b = branch('bonds', 'Voice');
  const up = b.feat('speak-up', 'Speak up in a meeting', 0);
  const t5 = b.feat('talk-5', 'Give a 5-minute talk', 2, up);
  const t50 = b.feat('talk-50', 'Speak to a room of 50', 3, t5);
  const conf = b.feat('conference', 'Give a conference talk', 5, t50);
  const key = b.feat('keynote', 'Give a keynote to 1,000 people', 7, conf);
  b.feat('crowd', 'Speak live to 10,000 people', 9, key);
  const pub = b.feat('publish', 'Publish something publicly under your name', 0);
  b.ladder('audience', pub, v => `${v} people follow your work`, ['100', '1,000', '10,000', '100,000', '1M', '10M', '100M'], [2, 10], { ask: 'People who follow your work', hint: '150' });
  const story = b.feat('story', 'Tell a story that holds a room', 1, up);
  b.feat('standup', 'Perform five minutes of stand-up', 4, story);
}

// ════════════════════════════════ SPIRIT ════════════════════════════════

{
  const b = branch('spirit', 'Discipline');
  const d7 = b.feat('seven', 'Do one small thing daily for 7 days', 0);
  b.ladder('streak', d7, v => `A daily practice kept for ${v} days`, ['14', '30', '60', '100', '200', '365', '730', '1,000', '2,000', '3,650'], [1, 9],
    { ask: 'Longest daily streak of anything (days)', hint: '21' });
  const wake = b.feat('wake-30', 'Wake at the same time for 30 days', 2);
  b.feat('wake-100', 'Wake at the same time for 100 days', 4, wake);
  const off = b.feat('offline-24', 'Spend 24 hours offline', 1);
  b.feat('offline-week', 'Spend a week offline', 4, off);
  b.feat('no-social-30', '30 days without social media', 3, off);
  b.feat('phone-free-morning', 'No phone in the first hour, 30 days', 2);
  const cold = b.feat('cold', 'Take a cold shower', 0);
  const cold30 = b.feat('cold-30', 'Cold showers for 30 days', 3, cold);
  b.feat('cold-365', 'Cold showers for a year', 6, cold30);
  const code = b.feat('code', 'Write down the rules you want to live by', 1);
  b.feat('code-year', 'Live by your written code for a year', 5, code);
}

{
  const b = branch('spirit', 'Stillness');
  const five = b.feat('five', 'Sit in silence for 5 minutes', 0);
  b.ladder('sit', five, v => `Meditate for ${v} minutes in one sitting`, ['10', '20', '30', '45', '60', '120'], [0, 5], { ask: 'Longest meditation (minutes)', hint: '15' });
  const days = b.ladder('days', five, v => `Meditate on ${v} days of your life`, ['10', '30', '100', '365', '1,000', '3,650'], [1, 8], { ask: 'Days you\'ve meditated (rough)', hint: '30' });
  const r1 = b.feat('retreat-1', 'Complete a one-day silent retreat', 3, days.at('30'));
  const r3 = b.feat('retreat-3', 'Complete a three-day silent retreat', 4, r1);
  const r10 = b.feat('retreat-10', 'Complete a ten-day silent retreat', 6, r3);
  const r30 = b.feat('retreat-30', 'Complete a 30-day silent retreat', 7, r10);
  const r90 = b.feat('retreat-90', 'Complete a three-month retreat', 8, r30);
  const r3y = b.feat('retreat-3y', 'Complete a three-year retreat', 10, r90);
  b.feat('nirvana', 'Lasting inner peace', 10, [r3y, days.at('3,650')], 'Only you can know.');
  const journal = b.feat('journal', 'Write a journal entry', 0);
  const j30 = b.feat('journal-30', 'Journal every day for 30 days', 2, journal);
  const j365 = b.feat('journal-365', 'Journal every day for a year', 5, j30);
  b.feat('journal-decade', 'Keep a journal for 10 years', 8, j365);
  b.feat('gratitude', 'Write three good things daily for 30 days', 2, journal);
  b.feat('eulogy', 'Write the eulogy you\'d want to earn', 2, journal);
  b.feat('forgive', 'Forgive someone who hurt you', 4);
}

{
  const b = branch('spirit', 'Adventure');
  const sun = b.feat('sunrise', 'Watch a sunrise outdoors', 0);
  const h5 = b.feat('hike-5', 'Hike 5 miles in a day', 1, sun);
  const h10 = b.feat('hike-10', 'Hike 10 miles in a day', 2, h5);
  const h20 = b.feat('hike-20', 'Hike 20 miles in a day', 4, h10);
  const stars = b.feat('stars', 'Sleep under the stars', 1, sun);
  const solo = b.feat('solo-night', 'Spend a night alone in the wild', 4, stars);
  const trek = b.feat('trek', 'Complete a multi-day trek', 4, [h10, stars]);
  const thru5 = b.feat('thru-500', 'Walk a 500-mile trail end to end', 6, [trek, h20]);
  const thru = b.feat('thru-2000', 'Thru-hike a 2,000-mile trail', 8, thru5);
  b.feat('triple-crown', 'Complete the Triple Crown of hiking', 9, [thru, solo]);
  const peak = b.feat('peak', 'Stand on a summit', 2, h5);
  const p3 = b.feat('peak-3000', 'Summit a 3,000 m (10,000 ft) peak', 3, peak);
  const p4 = b.feat('peak-4000', 'Summit a 4,000 m (14,000 ft) peak', 4, p3);
  const p6 = b.feat('peak-6000', 'Summit a 6,000 m peak', 6, p4);
  const p7 = b.feat('peak-7000', 'Summit a 7,000 m peak', 8, p6);
  const p8 = b.feat('peak-8000', 'Summit an 8,000 m peak', 9, p7);
  const everest = b.feat('everest', 'Summit Everest', 9, p8);
  b.feat('seven-summits', 'Climb the Seven Summits', 10, everest);
  const scare = b.feat('scared', 'Do something that scares you', 1);
  b.feat('skydive', 'Jump out of a plane', 4, scare);
  const scuba = b.feat('scuba', 'Earn a scuba certification', 3, scare);
  b.feat('dives-100', 'Log 100 dives', 6, scuba);
  const pilot = b.feat('pilot', 'Earn a pilot\'s licence', 6, scare);
  b.feat('space', 'Go to space', 10, pilot);
  const crew = b.feat('crew', 'Crew on a sailboat', 2);
  const skipper = b.feat('skipper', 'Skipper a boat overnight', 4, crew);
  const ocean = b.feat('ocean', 'Cross an ocean under sail', 8, skipper);
  const circ = b.feat('circumnavigate', 'Sail around the world', 9, ocean);
  b.feat('solo-circumnavigate', 'Sail around the world alone', 10, circ);
}

{
  const b = branch('spirit', 'Travel');
  const one = b.feat('new-place', 'Travel somewhere you\'ve never been', 0);
  const c = b.ladder('countries', one, v => `Visit ${v} countries`, ['3', '5', '10', '20', '30', '50', '75', '100', '150', '195'], [1, 10],
    { ask: 'Countries visited', hint: '6', detail: '195 is every country in the world.' });
  const solo = b.feat('solo', 'Travel alone', 3, one);
  b.feat('abroad', 'Live abroad for a year', 6, solo);
  const cont = b.feat('continents', 'Set foot on all seven continents', 8, c.at('20'));
  b.feat('poles', 'Reach both poles', 10, cont);
  b.feat('pilgrimage', 'Walk a long pilgrimage route', 5, solo);
}

export const CORE_NODES: readonly AreteNode[] = nodes;
export const LADDERS: readonly LadderInfo[] = ladders;
export const LADDER_BY_ID: ReadonlyMap<string, LadderInfo> = new Map(ladders.map(l => [l.id, l]));
