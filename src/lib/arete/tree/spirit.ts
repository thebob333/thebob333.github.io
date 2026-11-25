/**
 * Spirit expansion: new disciplines, deeper lines and discipline guides.
 * Written with ./dsl.ts. Ids are permanent once shipped.
 */
import { branch } from './dsl';

// Stations from core.ts used as anchors.
const discipline = (id: string) => `spirit.discipline.${id}`;
const stillness = (id: string) => `spirit.stillness.${id}`;
const adventure = (id: string) => `spirit.adventure.${id}`;
const travel = (id: string) => `spirit.travel.${id}`;

// ── Discipline (deeper) ──
{
  const b = branch('spirit', 'Discipline');
  b.guide({
    how: 'Discipline is built by keeping tiny promises daily, then stretching the streak and the size of the promise. Routines that run on a fixed time and place last far longer than ones that rely on willpower.',
    stops: 'Missing one day and treating it as the end of the streak instead of starting again the next day.',
  });
  b.feat('quit-habit', 'Quit a habit you\'ve wanted to drop for years', 4, discipline('seven'));
  b.feat('deep-30', 'Do two hours of focused work daily for 30 days', 3, discipline('phone-free-morning'));
  const dry = b.feat('no-alcohol-30', 'Go 30 days without alcohol', 2);
  b.feat('no-alcohol-year', 'Go a year without alcohol', 5, dry);
}

// ── Stillness (deeper) ──
{
  const b = branch('spirit', 'Stillness');
  b.guide({
    how: 'Most people start with a few minutes of sitting or journaling a day, slowly lengthen it, and later try a silent retreat. Consistency matters far more than the length of any one sitting.',
    stops: 'Expecting a quiet mind at once and quitting when thoughts keep coming.',
  });
  b.feat('outdoor-hour', 'Sit outside for an hour with no phone', 1, stillness('five'));
  const teach = b.feat('teach', 'Teach someone else to meditate', 5, stillness('days@100'));
  b.feat('lead-group', 'Lead a weekly meditation group for a year', 6, teach);
}

// ── Adventure (deeper) ──
{
  const b = branch('spirit', 'Adventure');
  b.guide({
    how: 'Adventurers build up step by step: longer hikes, a first summit, nights outdoors, then multi-day trips and bigger mountains, learning the skills and safety for each before the next.',
    stops: 'Never finding the time, or jumping too far ahead and getting scared off.',
  });
  b.ladder('peaks', adventure('peak'), v => `Stand on ${v} summits`, ['5', '10', '25', '50', '100'], [2, 7], { name: 'Peaks climbed', extend: true });
  b.ladder('high-points', adventure('peak'), v => (v === '1' ? 'Stand on a country\'s highest point' : `Stand on the highest point of ${v} countries`),
    ['1', '10', '25', '50'], [3, 9], { name: 'Country high points' });
}

// ── Travel (deeper) ──
{
  const b = branch('spirit', 'Travel');
  b.guide({
    how: 'Most travellers start with short trips near home, then go further, alone, and for longer. Curiosity and a little saved every month take people further than a big budget.',
    stops: 'Waiting for the perfect time, money or travel companion.',
  });
  b.ladder('cities', travel('new-place'), v => `Visit ${v} cities`, ['10', '25', '50', '100'], [1, 5], { name: 'Cities', extend: true });
  b.ladder('heritage', travel('new-place'), v => `Visit ${v} UNESCO World Heritage Sites`, ['5', '25', '100', '500'], [1, 8], { name: 'World Heritage Sites' });
  b.ladder('continent-count', travel('new-place'), v => `Set foot on ${v} continents`, ['2', '4', '6'], [1, 7], { name: 'Continents' });
}

// ── Nature ──
{
  const b = branch('spirit', 'Nature');
  b.guide({
    how: 'People start by noticing what lives nearby and learning a few names, then spend more nights outside and travel to wilder places. Every species you know makes the next one easier to spot.',
    stops: 'Staying indoors out of habit: time outside rarely makes it onto the calendar.',
  });
  const names = b.feat('name-five', 'Name five trees or plants near your home', 0);
  const species = b.ladder('species', names, v => `Identify ${v} species in the wild`, ['10', '50', '100', '500', '1,000'], [1, 8],
    { name: 'Species identified', extend: true, ask: 'Species you can identify in the wild (rough)', hint: '20' });
  const citizen = b.feat('citizen-science', 'Log sightings for a citizen-science project', 2, species.at('10'));
  b.feat('new-species', 'Discover a species new to science', 8, citizen);
  const seasons = b.feat('seasons', 'Visit the same wild spot in all four seasons', 2, names);
  const restore = b.feat('restore', 'Help restore a piece of wild land', 4, seasons);
  const protect = b.feat('protect', 'Help protect a wild place for good', 7, restore);
  b.feat('new-reserve', 'Help create a new national park or reserve', 9, protect);
  const sky = b.feat('constellations', 'Find five constellations without an app', 1);
  b.feat('aurora', 'See the northern or southern lights', 3, sky);
  b.ladder('parks', null, v => `Visit ${v} national parks`, ['5', '10', '25'], [2, 6], { name: 'National parks', extend: true });
  const nights = b.ladder('nights', null, v => `Spend ${v} nights camping`, ['5', '25', '100', '365', '1,000'], [1, 8],
    { name: 'Nights camping', extend: true, ask: 'Nights you have spent camping (rough)', hint: '4' });
  b.feat('wild-30', 'Spend 30 days in a row in the wilderness', 7, nights.at('100'));
}

// ── Gardening ──
{
  const b = branch('spirit', 'Gardening');
  b.guide({
    how: 'Gardeners start with one pot or a few seeds, learn from what dies, then grow through a full season and save their own seed. Every year in the same soil teaches more than the last.',
    stops: 'Losing the first plants and deciding you just can\'t grow things.',
  });
  const herb = b.feat('herb', 'Keep a potted herb alive for a month', 0);
  const seed = b.feat('seed', 'Grow something from seed', 1, herb);
  const eat = b.feat('eat', 'Eat something you grew', 1, seed);
  b.ladder('crops', eat, v => `Grow ${v} kinds of food in one year`, ['5', '10', '25', '50'], [3, 7], { name: 'Crops grown', extend: true });
  const bed = b.feat('bed', 'Build a raised bed or garden plot', 2, seed);
  const season = b.feat('season', 'Keep a garden going through a full season', 3, bed);
  const saved = b.feat('save-seed', 'Save seed from your plants and regrow it', 3, season);
  b.feat('new-variety', 'Breed a new plant variety', 8, saved);
  const open = b.feat('open-garden', 'Open your garden to the public', 6, saved);
  b.feat('famous-garden', 'Create a garden people travel to see', 9, open);
  const month = b.feat('garden-month', 'Eat from your garden every day for a month', 4, season);
  const half = b.feat('half-veg', 'Grow half the vegetables you eat for a year', 6, month);
  b.feat('all-food', 'Grow nearly all your own food for a year', 8, half);
  const tree = b.feat('tree', 'Plant a tree', 0);
  b.ladder('trees', tree, v => `Plant ${v} trees`, ['10', '100', '1,000', '100,000'], [1, 8], { name: 'Trees planted', extend: true });
}

// ── Courage ──
{
  const b = branch('spirit', 'Courage');
  b.guide({
    how: 'Courage grows like a muscle: people name what scares them, face small versions on purpose and work up. Each fear faced makes the next one smaller.',
    stops: 'Waiting to feel brave before acting, when the feeling usually comes after.',
  });
  const fears = b.feat('name-fears', 'Write down three fears that hold you back', 0);
  b.ladder('faced', fears, v => `Face ${v} fears on purpose`, ['3', '10', '25', '50', '100'], [1, 6], { name: 'Fears faced', extend: true });
  const no = b.feat('say-no', 'Say no to something you\'d usually agree to', 0, fears);
  const talk = b.feat('hard-talk', 'Have a hard conversation you\'ve been avoiding', 2, no);
  const leap = b.feat('leap', 'Leave something safe to chase what matters', 5, talk);
  b.feat('bet-big', 'Bet your career on something you believe in', 6, leap);
  const stand = b.feat('stand-up', 'Stand up for someone being treated badly', 3, talk);
  const unpopular = b.feat('unpopular', 'Stand by an unpopular view you believe in', 5, stand);
  const speak = b.feat('speak-out', 'Speak out about wrongdoing at a personal cost', 7, unpopular);
  b.feat('history', 'Take a stand that changes history', 10, speak);
  const step = b.feat('step-in', 'Step in to help a stranger in an emergency', 4, stand, 'Call for help, give first aid, stay with them.');
  const life = b.feat('save-life', 'Save someone\'s life', 7, step);
  b.feat('bravery', 'Be honoured for bravery', 8, life);
  const alone = b.feat('eat-alone', 'Eat alone at a restaurant', 1, fears);
  const bad = b.feat('try-public', 'Try something in public you\'re bad at', 2, alone);
  b.feat('ask-30', 'Ask for a likely no every day for 30 days', 3, bad);
}

// ── Simplicity ──
{
  const b = branch('spirit', 'Simplicity');
  b.guide({
    how: 'People usually start with one drawer or one no-spend day, notice how little they miss, and keep going room by room. Over time the question shifts from what to remove to what is enough.',
    stops: 'Sentimental things and "just in case" thinking.',
  });
  const drawer = b.feat('drawer', 'Clear out one drawer completely', 0);
  b.ladder('let-go', drawer, v => `Give away or sell ${v} things you don't need`, ['50', '100', '500', '1,000'], [1, 5], { name: 'Things let go' });
  const room = b.feat('room', 'Declutter a whole room', 1, drawer);
  const home = b.feat('home', 'Declutter your whole home', 3, room);
  b.feat('downsize', 'Move to a smaller home on purpose', 5, home);
  const rule = b.feat('one-in-one-out', 'Follow a one-in, one-out rule for a year', 4, home);
  const car = b.feat('car-sized', 'Own only what fits in a car', 6, rule);
  const carry = b.feat('carry-year', 'Live a year with only what you can carry', 8, car);
  b.feat('renounce', 'Give away almost everything you own', 9, carry);
  const day = b.feat('no-spend-day', 'Have a day with no spending', 0);
  b.ladder('no-spend', day, v => `Go ${v} days buying only essentials`, ['7', '30', '90', '180', '365'], [1, 6], { name: 'No-spend streak', extend: true });
  b.feat('unsubscribe', 'Cancel every subscription you don\'t use', 0, day);
  const enough = b.feat('enough', 'Write down what enough means for you', 1, day);
  b.feat('enough-5', 'Live 5 years within your own idea of enough', 6, enough);
}

// ── Self-reliance ──
{
  const b = branch('spirit', 'Self-reliance');
  b.guide({
    how: 'Self-reliance builds from small fixes and short trips without a phone to real skills: map and compass, wilderness first aid, fire and shelter. Each skill is best learned with someone experienced first, then practised alone.',
    stops: 'It is easier to call someone or buy a new one, so the skills never get practised.',
  });
  const map = b.feat('paper-map', 'Read a paper map to get somewhere new', 0);
  b.feat('no-phone-city', 'Find your way round a new city without a phone', 2, map);
  const compass = b.feat('compass', 'Navigate with a map and compass', 2, map);
  const wild = b.feat('off-trail', 'Cross wild country off-trail by map and compass', 4, compass);
  b.feat('nav-week', 'Navigate a week in the wild with no electronics', 6, wild);
  const kit = b.feat('first-aid-kit', 'Put together a first-aid kit', 0);
  b.feat('ready-week', 'Get your home ready for a week without power', 2, kit);
  const wfa = b.feat('wilderness-first-aid', 'Earn a wilderness first-aid certificate', 3, kit);
  const wfr = b.feat('first-responder', 'Qualify as a wilderness first responder', 5, wfa);
  b.feat('search-rescue', 'Volunteer with a search-and-rescue team', 6, wfr);
  const fix = b.feat('fix', 'Fix something instead of replacing it', 0);
  const tyre = b.feat('tyre', 'Change a tyre by the roadside', 1, fix);
  const fixes = b.ladder('fixes', fix, v => `Fix ${v} broken things yourself`, ['10', '50', '100', '500'], [1, 6], { name: 'Things fixed', extend: true });
  const grid = b.feat('off-grid', 'Live off-grid for a month', 6, fixes.at('100'));
  b.feat('off-grid-year', 'Live off-grid for a year', 8, grid);
  const knots = b.feat('knots', 'Tie five useful knots from memory', 1);
  const fire = b.feat('fire', 'Light a safe campfire with a flint', 2, knots);
  const shelter = b.feat('shelter', 'Build a shelter and sleep in it', 4, fire);
  b.feat('wild-week', 'Live a week in the wild with only basic tools', 7, shelter);
}

// ── Faith and purpose ──
{
  const b = branch('spirit', 'Faith and purpose');
  b.guide({
    how: 'People usually begin by naming what they value, try a practice that fits them (prayer, meditation, study, rest or service), and keep it through good and bad seasons. Meaning tends to deepen through years of practice and service more than through one insight.',
    stops: 'Letting the practice slide when life gets busy, then feeling it is too late to start again.',
  });
  const values = b.feat('values', 'Write down your five core values', 0);
  b.feat('values-choice', 'Turn down something good that clashed with your values', 3, values);
  const purpose = b.feat('purpose', 'Write a one-line purpose for your life', 1, values);
  const work = b.feat('purpose-work', 'Spend your working days on your purpose', 5, purpose);
  b.feat('life-cause', 'Give your working life to a cause', 8, work);
  const kind = b.feat('quiet-kindness', 'Do a kind act no one will ever know about', 0, values);
  b.feat('serve-year', 'Serve others every week for a year as a practice', 4, kind);
  const tried = b.feat('try-practice', 'Try a spiritual or reflective practice for a week', 0);
  const p3 = b.feat('practice-3m', 'Keep a weekly practice for 3 months', 2, tried);
  b.feat('rest-day', 'Keep a weekly day of rest for a year', 4, p3);
  const p1 = b.feat('practice-year', 'Keep a weekly practice for a year', 4, p3);
  const p10 = b.feat('practice-decade', 'Keep a practice for 10 years', 7, p1);
  b.feat('practice-40', 'Keep a practice for 40 years', 9, p10);
  const lead = b.feat('lead-practice', 'Lead others in a practice you keep', 5, p1);
  const sought = b.feat('sought-out', 'Become someone people seek out for wisdom', 8, lead);
  const found = b.feat('found-community', 'Found a community of practice that outlives you', 9, sought);
  b.feat('inspire-millions', 'Inspire millions to live by what you teach', 10, found);
  const visit = b.feat('new-gathering', 'Visit a place of worship or reflection new to you', 1, tried);
  const three = b.feat('three-traditions', 'Learn the core ideas of three wisdom traditions', 2, visit);
  b.feat('study-text', 'Study a sacred or philosophical text cover to cover', 3, three);
  b.feat('pilgrimage', 'Make a pilgrimage to a place that matters to you', 3, visit);
}

// ── Play ──
{
  const b = branch('spirit', 'Play');
  b.guide({
    how: 'Play comes back by making room for it: trying new games and hobbies, keeping the ones that bring joy, and sharing them with others. Mastery is optional; showing up for fun is the point.',
    stops: 'Feeling that play has to be earned or be useful.',
  });
  const game = b.feat('play-game', 'Play a board or card game with friends', 0);
  const learn = b.feat('learn-game', 'Learn a new game and teach it to others', 1, game);
  b.ladder('games', learn, v => `Learn ${v} games well enough to teach them`, ['5', '10', '25'], [1, 4], { name: 'Games learned', extend: true });
  const enter = b.feat('tournament', 'Enter a tournament for a game you love', 2, learn);
  const win = b.feat('win-tournament', 'Win a tournament', 5, enter);
  b.feat('world-champion', 'Become a world champion at a game', 9, win);
  const design = b.feat('design-game', 'Design a game your friends ask to play again', 4, learn);
  const pub = b.feat('publish-game', 'Publish a game strangers buy', 6, design);
  b.feat('classic-game', 'Design a game played around the world', 9, pub);
  const hobby = b.feat('new-hobby', 'Try a hobby you\'ve never done', 0);
  b.ladder('hobbies', hobby, v => `Try ${v} new hobbies`, ['5', '10', '25', '50'], [1, 5], { name: 'Hobbies tried', extend: true });
  const year = b.feat('hobby-year', 'Stick with a new hobby for a year', 3, hobby);
  const decade = b.feat('hobby-decade', 'Keep a hobby going for 10 years', 5, year);
  b.feat('play-at-80', 'Keep playing every week into your eighties', 8, decade);
  const fun = b.feat('just-fun', 'Do something just for fun, with no goal', 0);
  const list = b.feat('joy-list', 'List 20 things that make you happy', 0, fun);
  b.feat('joy-month', 'Do something from your joy list daily for a month', 2, list);
}
