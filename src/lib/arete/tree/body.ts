/**
 * Body expansion: seven new disciplines, deeper lines for the existing ones,
 * and a guide for every Body discipline. Written with ./dsl.ts; `after`
 * anchors reuse ids from ./core.ts. Ids are permanent once shipped: never
 * rename or reuse one.
 */
import { branch, type LadderOpts } from './dsl';

/** "0:56" → "56 seconds"; a minute or more stays as written ("1:05"). */
const secs = (v: string) => (v.startsWith('0:') ? `${Number(v.slice(2))} seconds` : v);
/** "1 min" → "1 minute", "20 min" → "20 minutes". */
const mins = (v: string) => {
  const n = v.replace(/\s*min$/, '');
  return `${n} minute${n === '1' ? '' : 's'}`;
};
const bw: LadderOpts = { kind: 'bwx', detail: 'One clean rep. × means times your own bodyweight.' };

// ═════════════════════ Existing disciplines: guides and deeper lines ═════════════════════

{
  const b = branch('body', 'Running');
  b.guide({
    how: 'Most people go from run-walking to an easy 5K, then add distance slowly (about 10% a week) with one faster session a week. A race on the calendar gives the training a point.',
    stops: 'Doing too much too soon: most runners stop because of an overuse injury, not a lack of will.',
  });
  const sprint = b.feat('sprint', 'Sprint 100 metres all out', 0);
  b.ladder('100m-time', sprint, v => `Run 100 m in ${secs(v)}`, ['0:20', '0:16', '0:14', '0:13', '0:12', '0:11', '0:10'], [0, 9],
    { kind: 'time', name: '100 m' });
  b.ladder('400m-time', sprint, v => `Run 400 m in ${secs(v)}`, ['1:30', '1:15', '1:05', '1:00', '0:54', '0:48', '0:44'], [0, 9],
    { kind: 'time', name: '400 m' });
  b.ladder('1500m-time', 'body.running.mile', v => `Run 1,500 m in ${v}`, ['8:00', '7:00', '6:00', '5:00', '4:30', '4:00', '3:35'], [1, 9],
    { kind: 'time', name: '1,500 m' });
  const trail = b.feat('trail', 'Finish a trail race', 2, 'body.running.5k');
  const vert = b.ladder('vertical', trail, v => `Climb ${v} on foot in one day`, ['1,000 m', '2,000 m', '3,000 m', '5,000 m', '8,848 m'], [2, 8],
    { name: 'Vertical gain', detail: 'Total climbing in one outing, running or hiking. 8,848 m is the height of Everest.' });
  const sky = b.feat('mountain-marathon', 'Finish a mountain marathon', 5, [trail, 'body.running.marathon', vert.at('2,000 m')]);
  b.feat('utmb', 'Finish the Ultra-Trail du Mont-Blanc', 8, [sky, 'body.running.100-mile'], '171 km and about 10,000 m of climbing around Mont Blanc.');
}

{
  const b = branch('body', 'Strength');
  b.guide({
    how: 'Learn a few big lifts with good form, then add a little weight or a rep each week for as long as that keeps working. Most of the gains come in the first two years of steady training.',
    stops: 'Missed weeks and ego lifting: skipping sessions, or adding weight faster than form allows.',
  });
  const month = 'body.strength.month';
  b.ladder('front-squat', month, v => `Front squat ${v} bodyweight`, ['1×', '1.25×', '1.5×', '1.75×', '2×'], [3, 8], { ...bw, name: 'Front squat' });
  const oly = b.feat('olympic-lifts', 'Learn the snatch and the clean from a coach', 1, month);
  b.ladder('power-clean', oly, v => `Power clean ${v} bodyweight`, ['1×', '1.25×', '1.5×', '1.75×'], [3, 8], { ...bw, name: 'Power clean' });
  const snatch = b.ladder('snatch', oly, v => `Snatch ${v} bodyweight`, ['0.75×', '1×', '1.25×', '1.5×', '2×'], [3, 9], { ...bw, name: 'Snatch' });
  b.feat('lifting-meet', 'Compete in an Olympic weightlifting meet', 5, snatch.at('1×'));
  const kb = b.feat('kettlebell', 'Do 20 kettlebell swings with good form', 0);
  b.ladder('kb-swings', kb, v => `Do ${v} kettlebell swings without stopping`, ['50', '100', '250', '500'], [1, 6], { name: 'Kettlebell swings' });
  b.ladder('farmers-carry', month, v => `Farmer's carry ${v} bodyweight for 30 m`, ['0.5×', '1×', '1.5×', '2×'], [1, 6],
    { kind: 'bwx', name: 'Farmer\'s carry', detail: 'Both hands together, 30 metres without putting it down. × means times your bodyweight.' });
  b.ladder('plank', 'body.strength.pushup', v => `Hold a plank for ${mins(v)}`, ['1 min', '2 min', '3 min', '5 min', '10 min'], [0, 5],
    { name: 'Plank', ask: 'Longest plank (minutes)', hint: '2' });
  b.ladder('dead-hang', 'body.strength.hang', v => `Dead hang for ${mins(v)}`, ['1 min', '2 min', '3 min', '5 min', '10 min'], [1, 9], { name: 'Dead hang' });
}

{
  const b = branch('body', 'Movement');
  b.guide({
    how: 'A few minutes of stretching and skill practice most days beats one long session a week. Flexibility, balance and tricks come back at any age, just slowly.',
    stops: 'Progress is slow and hard to see, so people quit before the first big change shows.',
  });
  const cart = b.feat('cartwheel', 'Do a cartwheel', 1);
  b.feat('kip-up', 'Do a kip-up', 3, cart);
  const bhs = b.feat('back-handspring', 'Do a back handspring', 5, [cart, 'body.movement.bridge'], 'Learn it with a coach and a spotter.');
  const flip = b.feat('backflip', 'Do a standing backflip', 6, bhs, 'Learn it with a coach and a spotter.');
  b.feat('full-twist', 'Land a standing full-twisting backflip', 8, flip);
  const slack = b.feat('slackline', 'Balance on a slackline for 30 seconds', 1);
  b.feat('slackline-30m', 'Walk 30 metres on a slackline', 4, slack);
  const rope = b.feat('jump-rope', 'Skip rope 100 times without tripping', 0);
  const du = b.feat('double-unders', 'Do 50 double-unders in a row', 3, rope);
  b.feat('triple-unders', 'Do 10 triple-unders in a row', 6, du);
  b.feat('sit-rise', 'Sit down and stand up with no hands', 1, 'body.movement.deep-squat');
}

{
  const b = branch('body', 'Swimming');
  b.guide({
    how: 'Most adults start with lessons to fix breathing and body position, then swim two or three times a week, adding lengths a little at a time. Speed comes from technique far more than effort.',
    stops: 'Breathing: people who never get comfortable breathing to the side tire after a length or two and give up.',
  });
  const s25 = 'body.swimming.25';
  b.ladder('100-free', 'body.swimming.distance@100-m', v => `Swim 100 m freestyle in ${secs(v)}`,
    ['2:30', '2:00', '1:40', '1:20', '1:10', '1:00', '0:52', '0:47'], [1, 9], { kind: 'time', name: '100 m free' });
  b.ladder('1500-free', 'body.swimming.distance@1-500-m', v => `Swim 1,500 m freestyle in ${v}`,
    ['35:00', '30:00', '25:00', '21:00', '18:00', '16:00', '14:40'], [4, 10], { kind: 'time', name: '1,500 m free' });
  const back = b.feat('backstroke', 'Swim 25 m backstroke', 0, s25);
  const breast = b.feat('breaststroke', 'Swim 25 m breaststroke', 0, s25);
  const fly = b.feat('butterfly', 'Swim 25 m butterfly', 3, breast);
  b.feat('100-im', 'Swim a 100 m individual medley', 4, [fly, back]);
  const meet = b.feat('swim-meet', 'Race in a swim meet', 3, 'body.swimming.distance@200-m');
  b.feat('nationals', 'Swim at a national championship', 7, meet);
}

{
  const b = branch('body', 'Cycling');
  b.guide({
    how: 'Ride often, mostly at an easy pace you could chat at, and stretch one ride a week a little longer. Power and speed come with a year or two of steady riding plus some hard intervals.',
    stops: 'Traffic fear and bad weather: people who find quiet routes, or ride indoors in winter, keep going.',
  });
  b.ladder('ftp', 'body.cycling.10', v => `Hold ${v} watts per kg for an hour`, ['2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6'], [1, 9],
    { name: 'FTP (W/kg)', detail: 'Functional threshold power: about the most you can hold for an hour, divided by your bodyweight in kg.' });
  b.ladder('40k-tt', 'body.cycling.ride@25', v => `Ride a 40 km time trial in ${v}`, ['1:30:00', '1:10:00', '1:00:00', '55:00', '50:00', '46:00'], [1, 9],
    { kind: 'time', name: '40 km TT' });
  b.ladder('climbing', 'body.cycling.10', v => `Climb ${v} by bike in one ride`, ['1,000 m', '2,000 m', '3,000 m', '5,000 m', '8,848 m'], [2, 7],
    { name: 'Bike climbing', detail: 'Total climbing in a single ride. 8,848 m is the height of Everest.' });
  const race = b.feat('race', 'Finish a bike race', 3, 'body.cycling.ride@25');
  const win = b.feat('race-win', 'Win a bike race', 5, race);
  const tdf = b.feat('tour', 'Ride the Tour de France', 9, win);
  b.feat('tour-win', 'Win the Tour de France', 10, tdf);
}

branch('body', 'Triathlon').guide({
  how: 'Start with a sprint triathlon once you can swim 400 m, ride 20 km and run 5 km, then step up one distance a season. Most of the time goes into the weakest of the three.',
  stops: 'The swim: open-water nerves keep more people out of triathlon than anything else.',
});

{
  const b = branch('body', 'Health');
  b.guide({
    how: 'Small daily habits added one at a time (walking, then sleep, then food), each held for a month or two before the next.',
    stops: 'Trying to change everything at once, then dropping it all after one bad week.',
  });
  b.ladder('vo2max', 'body.health.walk', v => `Reach a VO2 max of ${v}`, ['35', '40', '45', '50', '55', '60', '65', '70', '80'], [1, 9],
    { name: 'VO2 max', ask: 'VO2 max (from a sports watch or a test)', hint: '42', detail: 'Millilitres of oxygen per kg per minute, from a lab test or a sports watch estimate.' });
  b.feat('sleep-365', 'Sleep 7+ hours every night for a year', 6, 'body.health.sleep-100');
  const veg = b.feat('veg-week', 'Eat 5 portions of fruit and veg a day for a week', 1, 'body.health.whole-food-week');
  const veg30 = b.feat('veg-30', 'Eat 5 portions of fruit and veg a day for 30 days', 3, veg);
  b.feat('veg-365', 'Eat 5 portions of fruit and veg a day for a year', 6, veg30);
  const smoke = b.feat('smoke-free-30', 'Stay smoke-free for 30 days after quitting', 3);
  b.feat('smoke-free-365', 'Stay smoke-free for a year after quitting', 5, smoke);
}

{
  const b = branch('body', 'Sport');
  b.guide({
    how: 'Join a club or team, train with people a little better than you, and compete in whatever league fits your level. Good coaching speeds everything up.',
    stops: 'Losing the group: moves, injuries and busy schedules break up the team people played with.',
  });
  const top = b.feat('outdoor-climb', 'Top-rope a climb outdoors', 1, 'body.sport.climb');
  const lead = b.feat('lead-climb', 'Lead a sport climb', 3, top);
  const f7a = b.feat('sport-7a', 'Climb a 7a (5.11d) sport route', 5, lead);
  const f8a = b.feat('sport-8a', 'Climb an 8a (5.13b) sport route', 7, f7a);
  b.feat('sport-9a', 'Climb a 9a (5.14d) sport route', 9, f8a);
  const multi = b.feat('multi-pitch', 'Climb a multi-pitch route', 4, lead);
  b.feat('big-wall', 'Climb a big wall like El Capitan', 7, multi);
}

// ═════════════════════════════════ New disciplines ═════════════════════════════════

{
  const b = branch('body', 'Combat sports');
  b.guide({
    how: 'Train two or three classes a week at a good gym, spar or roll lightly from the first months, and compete once the basics feel automatic. Belts and titles take years of steady attendance.',
    stops: 'Injuries and ego: going too hard in sparring, getting hurt, and not coming back.',
  });
  // Boxing
  const box = b.feat('boxing', 'Take a boxing class', 0);
  const bag = b.feat('heavy-bag', 'Hit a heavy bag for 3 rounds of 3 minutes', 1, box);
  const spar = b.feat('box-spar', 'Spar 3 rounds of boxing', 2, bag);
  const boxWin = b.feat('box-win', 'Win an amateur boxing bout', 4, spar);
  const boxTitle = b.feat('box-title', 'Win a regional amateur boxing title', 6, boxWin);
  const boxPro = b.feat('box-pro', 'Win a professional boxing fight', 7, boxTitle);
  b.feat('box-world', 'Win a professional boxing world title', 9, boxPro);
  // Brazilian jiu-jitsu
  const bjj = b.feat('bjj', 'Take a Brazilian jiu-jitsu class', 0);
  const sub = b.feat('bjj-sub', 'Submit a training partner in a live roll', 2, bjj);
  const blue = b.feat('bjj-blue', 'Earn a blue belt in jiu-jitsu', 3, sub);
  const purple = b.feat('bjj-purple', 'Earn a purple belt in jiu-jitsu', 5, blue);
  const brown = b.feat('bjj-brown', 'Earn a brown belt in jiu-jitsu', 6, purple);
  const black = b.feat('bjj-black', 'Earn a black belt in jiu-jitsu', 7, brown);
  const match = b.feat('bjj-match', 'Win a match at a jiu-jitsu tournament', 3, sub);
  const gold = b.feat('bjj-gold', 'Win your division at a jiu-jitsu tournament', 4, match);
  b.feat('bjj-worlds', 'Win a black belt world jiu-jitsu title', 9, [black, gold]);
  // Wrestling
  const wr = b.feat('wrestling', 'Finish a wrestling practice', 0);
  const td = b.feat('takedown', 'Score a takedown in live wrestling', 1, wr);
  const season = b.feat('wrestling-season', 'Wrestle a full school or club season', 3, td);
  const state = b.feat('wrestling-state', 'Win a state or regional wrestling title', 6, season);
  const wnat = b.feat('wrestling-national', 'Win a national wrestling title', 8, state);
  b.feat('wrestling-world', 'Win an Olympic or world wrestling medal', 9, wnat);
  // Judo
  const judo = b.feat('judo', 'Take a judo class', 0);
  const fall = b.feat('breakfall', 'Learn to breakfall safely', 1, judo);
  b.feat('judo-black', 'Earn a black belt in judo', 6, fall);
  // Fencing
  const fence = b.feat('fencing', 'Take a fencing lesson', 0);
  const bout = b.feat('fencing-bout', 'Fence a bout to 5 touches', 1, fence);
  const fmedal = b.feat('fencing-medal', 'Medal at a fencing tournament', 4, bout);
  const fnat = b.feat('fencing-national', 'Fence at a national championship', 6, fmedal);
  b.feat('fencing-world', 'Fence at a World Cup or World Championships', 8, fnat);
  // Kickboxing and MMA
  const kick = b.feat('kickboxing', 'Take a kickboxing or Muay Thai class', 0);
  const kfight = b.feat('kick-win', 'Win an amateur kickboxing or Muay Thai bout', 4, kick);
  const mma = b.feat('mma', 'Win an amateur MMA bout', 5, [kfight, td, sub]);
  const mmaPro = b.feat('mma-pro', 'Win a professional MMA fight', 7, mma);
  b.feat('mma-title', 'Win a major MMA world title', 9, mmaPro);
}

{
  const b = branch('body', 'Water sports');
  b.guide({
    how: 'Take lessons, then get out often in easy, safe conditions and step up one notch at a time: bigger waves, faster rivers, deeper dives. Hours on the water matter more than gear.',
    stops: 'Access and conditions: living far from good water, and days that rarely line up.',
  });
  // Surfing
  const surf = b.feat('surf-lesson', 'Take a surf lesson', 0);
  const pop = b.feat('surf-stand', 'Stand up on a surfboard on a wave', 1, surf);
  const green = b.feat('surf-green', 'Catch an unbroken wave on your own', 2, pop);
  const over = b.feat('surf-overhead', 'Surf an overhead wave', 4, green);
  const barrel = b.feat('surf-barrel', 'Ride inside the barrel of a wave', 6, over);
  b.feat('surf-big', 'Surf a 20-foot wave', 8, barrel, 'Big-wave surfing takes years of training, a safety team and a partner.');
  const heat = b.feat('surf-heat', 'Win a heat in a surf contest', 4, green);
  b.feat('surf-tour', 'Qualify for the world surfing championship tour', 9, [heat, barrel]);
  // Kayaking
  const kayak = b.feat('kayak', 'Paddle a kayak for an hour', 0);
  const roll = b.feat('kayak-roll', 'Roll a kayak back upright', 3, kayak);
  const c3 = b.feat('class-3', 'Paddle a Class III rapid', 4, roll);
  const c4 = b.feat('class-4', 'Paddle a Class IV river', 5, c3);
  b.feat('class-5', 'Paddle a Class V river', 7, c4, 'With experienced paddlers and safety cover.');
  const k20 = b.feat('kayak-20', 'Paddle 20 miles in one day', 3, kayak);
  b.feat('river-length', 'Paddle the length of a major river', 8, k20, 'For example the Mississippi, the Danube or the Yukon.');
  // Paddleboarding
  const sup = b.feat('sup', 'Stand on a paddleboard for 10 minutes', 0);
  const supRace = b.feat('sup-race', 'Finish a paddleboard race', 3, sup);
  b.feat('sup-crossing', 'Paddleboard across an ocean channel', 7, supRace, 'For example Molokai to Oahu, 32 miles.');
  // Freediving
  const fd = b.feat('freediving', 'Take a freediving course', 1, null, 'Always dive with a trained buddy, never alone.');
  b.ladder('freedive', fd, v => `Freedive to ${v}`, ['10 m', '20 m', '30 m', '40 m', '60 m', '100 m'], [1, 9],
    { name: 'Freedive depth', detail: 'On one breath, trained and with a buddy watching. Never alone.' });
  // Open water
  const ow = b.feat('open-water', 'Swim for 15 minutes in a lake or the sea', 1);
  const owRace = b.feat('ow-race', 'Finish an open-water swim race', 3, ow);
  const ow10 = b.feat('ow-10k', 'Finish a 10 km open-water race', 6, [owRace, 'body.swimming.distance@5-km']);
  b.feat('triple-crown', 'Complete the Triple Crown of open-water swimming', 9, [ow10, 'body.swimming.channel'],
    'The English Channel, the Catalina Channel and around Manhattan.');
}

{
  const b = branch('body', 'Winter sports');
  b.guide({
    how: 'A few lessons, then as many days on snow or ice as you can get, moving up one slope or skill at a time. Most progress comes in bursts, one trip or season at a time.',
    stops: 'Cost and distance: lift tickets, gear and travel limit most people to a few days a year.',
  });
  // Skiing
  const ski = b.feat('ski', 'Ski down a beginner (green) slope', 0);
  const blue = b.feat('ski-blue', 'Ski a blue run without falling', 1, ski);
  const black = b.feat('ski-black', 'Ski a black run', 3, blue);
  b.feat('ski-double-black', 'Ski a double-black run', 5, black);
  b.feat('ski-touring', 'Climb a mountain on skis and ski down', 4, black, 'With a guide or avalanche training.');
  const race = b.feat('ski-race', 'Finish a ski race', 3, blue);
  const wc = b.feat('world-cup', 'Race in an alpine skiing World Cup', 8, race);
  b.feat('world-cup-win', 'Win a World Cup ski race', 9, wc);
  const xc = b.feat('xc-10k', 'Cross-country ski 10 km', 2, ski);
  const xc50 = b.feat('xc-50k', 'Finish a 50 km cross-country ski race', 5, xc);
  b.feat('vasaloppet', 'Finish the Vasaloppet (90 km)', 6, xc50);
  // Snowboarding
  const sb = b.feat('snowboard', 'Ride a beginner slope on a snowboard', 0);
  const sbBlue = b.feat('sb-blue', 'Snowboard a blue run without falling', 1, sb);
  const jump = b.feat('sb-jump', 'Land a jump in the terrain park', 3, sbBlue);
  const s360 = b.feat('sb-360', 'Land a 360 on a snowboard', 5, jump);
  const s720 = b.feat('sb-720', 'Land a 720 on a snowboard', 7, s360);
  b.feat('sb-pro', 'Ride in a professional snowboard contest', 8, s720);
  // Skating
  const skate = b.feat('skate', 'Skate a lap of the rink without holding on', 0);
  const backward = b.feat('skate-backward', 'Skate backward for a full lap', 1, skate);
  b.feat('hockey-stop', 'Do a hockey stop both ways', 2, skate);
  const j1 = b.feat('jump-single', 'Land a single jump on skates', 3, backward);
  const j2 = b.feat('jump-double', 'Land a double jump on skates', 5, j1);
  const j3 = b.feat('jump-triple', 'Land a triple jump on skates', 7, j2);
  b.feat('jump-quad', 'Land a quadruple jump on skates', 9, j3);
  // Ice climbing
  const ice = b.feat('ice-toprope', 'Top-rope a frozen waterfall with a guide', 2);
  const wi3 = b.feat('ice-wi3', 'Lead a WI3 ice climb', 4, ice);
  const wi5 = b.feat('ice-wi5', 'Lead a WI5 ice climb', 6, wi3);
  b.feat('ice-wi6', 'Lead a WI6 ice climb', 7, wi5);
}

{
  const b = branch('body', 'Yoga');
  b.guide({
    how: 'Short sessions most days build strength, balance and flexibility; harder poses come one at a time, ideally with a teacher. Many go on to teacher training after a few years.',
    stops: 'Pushing into pain or comparing with others, instead of practising often and gently.',
  });
  const dog = b.feat('down-dog', 'Hold downward dog for 1 minute', 0);
  const crow = b.feat('crow', 'Hold crow pose for 10 seconds', 2, dog);
  const head = b.feat('headstand', 'Hold a supported headstand for 1 minute', 3, crow, 'Learn it from a teacher first.');
  const forearm = b.feat('forearm-stand', 'Hold a forearm stand for 10 seconds', 5, head);
  const wheel = b.feat('wheel', 'Push up into wheel pose', 3, dog);
  const pigeon = b.feat('king-pigeon', 'Hold full king pigeon pose', 6, wheel);
  b.feat('scorpion', 'Hold scorpion pose', 7, [forearm, pigeon]);
  const primary = b.feat('primary-series', 'Practise the full Ashtanga primary series', 4, crow);
  const second = b.feat('second-series', 'Practise the full Ashtanga second series', 6, [primary, wheel]);
  b.feat('third-series', 'Practise the Ashtanga third series', 8, [second, forearm]);
  const streak = b.ladder('streak', dog, v => `Practise yoga ${v} days in a row`, ['7', '30', '100', '365', '1,000', '3,650'], [1, 8],
    { name: 'Yoga streak', extend: true });
  const ytt = b.feat('ytt-200', 'Complete a 200-hour yoga teacher training', 4, streak.at('100'));
  const taught = b.ladder('taught', ytt, v => `Teach ${v} yoga classes`, ['10', '100', '500', '1,000', '5,000'], [4, 8],
    { name: 'Classes taught', extend: true });
  const y500 = b.feat('ytt-500', 'Complete a 500-hour yoga teacher training', 6, taught.at('100'));
  const retreat = b.feat('retreat', 'Lead a yoga retreat', 6, taught.at('100'));
  const studio = b.feat('studio', 'Open your own yoga studio', 7, retreat);
  b.feat('train-teachers', 'Train 100 new yoga teachers', 8, [y500, studio]);
}

{
  const b = branch('body', 'Rowing');
  b.guide({
    how: 'Learn the stroke order (legs, then body, then arms), build steady metres on the rowing machine and add one hard session a week. On the water, a learn-to-row course leads into club crews and regattas.',
    stops: 'Pulling with the arms and back instead of the legs, which caps speed and strains the lower back.',
  });
  const erg = b.feat('erg', 'Row for 10 minutes on a rowing machine', 0);
  b.ladder('2k', erg, v => `Row 2,000 m in ${v}`, ['10:00', '9:00', '8:20', '7:45', '7:20', '7:00', '6:40', '6:20', '6:00', '5:50'], [0, 9],
    { kind: 'time', name: '2K row', ask: 'Fastest 2,000 m on a rowing machine', hint: '8:10' });
  const k5 = b.feat('erg-5k', 'Row 5,000 m without stopping', 1, erg);
  const full = b.feat('erg-marathon', 'Row a full marathon (42,195 m)', 4, k5);
  b.feat('erg-100k', 'Row 100 km in one go', 7, full);
  b.ladder('metres', erg, v => `Row ${v} metres in your life`, ['100,000', '500,000', '1,000,000', '5,000,000', '10,000,000'], [1, 6],
    { name: 'Metres rowed', extend: true });
  const learn = b.feat('learn-to-row', 'Finish a learn-to-row course on the water', 1);
  const single = b.feat('single', 'Row a single scull 2 km without capsizing', 2, learn);
  const crew = b.feat('regatta', 'Race in a crew at a regatta', 3, learn);
  const win = b.feat('regatta-win', 'Win a race at a regatta', 4, crew);
  b.feat('henley', 'Race at Henley Royal Regatta', 7, win);
  const nat = b.feat('national', 'Win a national rowing title', 7, win);
  b.feat('olympics', 'Row at the Olympic Games', 9, nat);
  b.feat('ocean', 'Row across an ocean', 8, [single, full]);
}

{
  const b = branch('body', 'Racket sports');
  b.guide({
    how: 'Take lessons early to learn clean strokes, then play lots of matches against people slightly better than you. Club leagues, ladders and ratings show the progress.',
    stops: 'Finding regular partners and court time at the right level.',
  });
  // Tennis
  const rally = b.feat('tennis', 'Rally 10 shots in a row at tennis', 0);
  const match = b.feat('tennis-match', 'Play a full tennis match', 1, rally);
  const utr = b.ladder('utr', match, v => `Reach a UTR tennis rating of ${v}`, ['2', '4', '6', '8', '10', '12', '14', '16'], [1, 9],
    { name: 'Tennis UTR', detail: 'Universal Tennis Rating, the worldwide 1–16 scale.' });
  b.feat('tennis-tourney', 'Win a tennis tournament', 4, utr.at('6'));
  const pro = b.feat('tennis-pro', 'Earn a professional tennis ranking', 7, utr.at('12'));
  const slam = b.feat('grand-slam', 'Win a Grand Slam singles title', 9, [pro, utr.at('14')]);
  b.feat('world-no1', 'Reach world number one in tennis', 10, slam);
  // Squash
  const sq = b.feat('squash', 'Play a game of squash', 0);
  const sqWin = b.feat('squash-tourney', 'Win a squash tournament', 5, sq);
  b.feat('squash-ranked', 'Earn a world squash ranking', 7, sqWin);
  // Badminton
  const bad = b.feat('badminton', 'Rally 20 shots in a row at badminton', 0);
  const badWin = b.feat('badminton-tourney', 'Win a badminton tournament', 5, bad);
  b.feat('badminton-national', 'Play in a national badminton championship', 7, badWin);
  // Table tennis
  const tt = b.feat('table-tennis', 'Rally 50 shots in a row at table tennis', 1);
  const ttLeague = b.feat('tt-league', 'Play a season in a table tennis league', 3, tt);
  const ttWin = b.feat('tt-tourney', 'Win a table tennis tournament', 5, ttLeague);
  b.feat('tt-national', 'Play in a national table tennis championship', 7, ttWin);
  // Pickleball
  const pb = b.feat('pickleball', 'Play a game of pickleball', 0);
  const pbMedal = b.feat('pickleball-medal', 'Medal at a pickleball tournament', 3, pb);
  b.feat('pickleball-pro', 'Win a pro pickleball tournament', 8, pbMedal);
}

{
  const b = branch('body', 'Ball sports');
  b.guide({
    how: 'Ball skills grow from thousands of repetitions: a few minutes of juggling, shooting or swinging most days beats an occasional long session. A coach catches bad habits early.',
    stops: 'Only ever practising in games: without solo practice, skills level off fast.',
  });
  // Football
  const keepy = b.feat('keepy-up', 'Keep a football up 5 times without it landing', 0);
  b.ladder('juggles', keepy, v => `Juggle a football ${v} times in a row`, ['10', '25', '50', '100', '250', '500', '1,000'], [1, 7],
    { name: 'Football juggles', extend: true });
  // Basketball
  const hoop = b.feat('free-throw', 'Make a free throw', 0);
  const ft = b.ladder('free-throws', hoop, v => `Make ${v} of 100 free throws`, ['50', '60', '70', '80', '90', '95'], [1, 7], { name: 'Free throws' });
  b.feat('threes-10', 'Make 10 three-pointers in a row', 5, ft.at('80'));
  b.feat('dunk', 'Dunk a basketball', 5, hoop);
  // Golf
  const golf = b.feat('golf-round', 'Play a full 18-hole round of golf', 1);
  const b100 = b.feat('break-100', 'Break 100 on a full golf course', 2, golf);
  const b90 = b.feat('break-90', 'Break 90 on a full golf course', 3, b100);
  const b80 = b.feat('break-80', 'Break 80 on a full golf course', 5, b90);
  const par = b.feat('golf-par', 'Shoot par or better on a full course', 6, b80);
  const scratch = b.feat('scratch', 'Reach a scratch (0) golf handicap', 7, par);
  const gpro = b.feat('golf-pro', 'Play in a professional golf tour event', 8, scratch);
  b.feat('golf-major', 'Win a golf major', 9, gpro);
  // Throwing
  const toss = b.feat('catch', 'Throw and catch a ball 50 times without a drop', 0);
  b.ladder('throw-speed', toss, v => `Throw a baseball ${v} mph`, ['50', '60', '70', '80', '90', '100'], [1, 9],
    { name: 'Throw speed', detail: 'Measured with a radar gun, after a proper warm-up.' });
}
