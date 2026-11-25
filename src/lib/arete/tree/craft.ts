/**
 * Craft expansion: new disciplines, deeper lines and discipline guides.
 * Written with ./dsl.ts. Ids are permanent once shipped.
 */
import { branch } from './dsl';

// ─────────────── Deeper lines on the core disciplines (see ./core.ts) ───────────────

{
  const b = branch('craft', 'Writing');
  b.guide({
    how: 'Write a little every day, finish short pieces before long ones, and get feedback from real readers. Writers improve by finishing many drafts, not by perfecting one.',
    stops: 'Rewriting the opening forever instead of finishing a draft.',
  });
  b.ladder('words', 'craft.writing.500', v => `Write ${v} words in your life`, ['10,000', '100,000', '500,000', '1M'], [1, 7],
    { name: 'Words written', extend: true, ask: 'Words you\'ve written in your life (rough)', hint: '20,000' });
  const poem = b.feat('poem-pub', 'Get a poem published', 3, 'craft.writing.500');
  const poems = b.feat('poetry-book', 'Publish a collection of poems', 6, poem);
  b.feat('laureate', 'Be named a poet laureate', 9, poems);
  b.feat('essay', 'Publish an essay in a major magazine', 6, 'craft.writing.published');
}

{
  const b = branch('craft', 'Music');
  b.guide({
    how: 'Practise a little every day with a teacher or a clear method, learn songs you love, then play with and for other people. Theory and ear training speed things up after the first year.',
    stops: 'Quitting in the frustrating early months, before the instrument starts to feel good.',
  });
  b.ladder('grades', 'craft.music.song', v => `Pass a ${v.toLowerCase()} exam on an instrument`,
    ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8'], [1, 6], { name: 'Grades' });
  b.ladder('songs-written', 'craft.music.write-song', v => `Write ${v} songs`, ['10', '50', '100'], [4, 7], { name: 'Songs written', extend: true });
}

{
  const b = branch('craft', 'Visual art');
  b.guide({
    how: 'Draw from life constantly, copy work you admire, and finish pieces rather than polishing sketches. Showing and selling come after a body of finished work.',
    stops: 'Comparing early work with finished masters and deciding you have no talent.',
  });
  b.ladder('pieces', 'craft.visual-art.ten', v => `Finish ${v} pieces of art`, ['25', '100', '250', '500'], [2, 7], { name: 'Pieces finished', extend: true });
  const oil = b.feat('oil', 'Finish an oil painting', 2, 'craft.visual-art.drawing');
  b.feat('mural', 'Paint a mural on a public wall', 5, oil);
  b.feat('graphic-novel', 'Publish a graphic novel', 6, 'craft.visual-art.drawing');
}

{
  const b = branch('craft', 'Film');
  b.guide({
    how: 'Make lots of very short films with whatever camera you have, then longer ones with a small crew. Festivals and bigger projects come from a reel of finished work.',
    stops: 'Waiting for better gear or a bigger budget before shooting anything.',
  });
  b.ladder('shorts', 'craft.film.short', v => `Finish ${v} short films`, ['5', '10', '25'], [4, 6], { name: 'Shorts made', extend: true });
  const script = b.feat('script', 'Write a short film script', 1, 'craft.film.1min');
  b.feat('screenplay', 'Finish a feature-length screenplay', 4, script);
  b.feat('48h', 'Make a film in a 48-hour film challenge', 3, 'craft.film.1min');
  b.feat('top-festival', 'Premiere a film at Cannes, Venice or Sundance', 8, 'craft.film.award');
}

{
  const b = branch('craft', 'Building');
  b.guide({
    how: 'Build small things you actually need, ship them, then take on bigger projects and other people\'s code. Each finished build teaches more than any tutorial.',
    stops: 'Abandoning projects at 90%, when the last details get boring.',
  });
  b.ladder('apps', 'craft.building.ship', v => `Ship ${v} apps or sites`, ['5', '10', '25'], [4, 6], { name: 'Apps shipped', extend: true });
  b.ladder('merged', 'craft.building.open-source', v => `Get ${v} contributions merged into open source`, ['10', '100', '500', '1,000'], [3, 7],
    { name: 'Contributions', extend: true });
  b.feat('pcb', 'Design a circuit board and have it made', 4, 'craft.building.circuit');
}

{
  const b = branch('craft', 'Cooking');
  b.guide({
    how: 'Cook the same few dishes until you can make them without a recipe, then branch into new techniques and cuisines. Cooking for other people pushes you fastest.',
    stops: 'Sticking to the same handful of meals once they feel safe.',
  });
  b.ladder('cuisines', 'craft.cooking.meal', v => `Cook ${v} cuisines well enough to host a dinner`, ['2', '5', '10', '20'], [2, 7],
    { name: 'Cuisines', ask: 'Cuisines you can cook a full dinner from', hint: '2' });
  const cake = b.feat('cake', 'Bake a layer cake from scratch', 1, 'craft.cooking.meal');
  b.feat('croissant', 'Laminate dough and bake croissants', 4, cake);
  b.feat('ferment', 'Ferment your own kimchi or sauerkraut', 2, 'craft.cooking.meal');
  b.feat('competition', 'Win a cooking competition', 5, 'craft.cooking.tasting');
}

{
  const b = branch('craft', 'Dance');
  b.guide({
    how: 'Take regular classes in one style and drill the basics until they are automatic, then go social or perform. Competitions and choreography come after years in a style.',
    stops: 'Being too embarrassed to dance badly in public first.',
  });
  b.feat('party', 'Dance a whole song at a party', 0);
  b.feat('salsa', 'Dance a full salsa song with a partner', 2, 'craft.dance.social');
  const ballet = b.feat('ballet', 'Take a year of ballet classes', 3, 'craft.dance.routine');
  const pointe = b.feat('pointe', 'Dance en pointe', 6, ballet);
  b.feat('company', 'Dance in a ballet company', 8, pointe);
  const breaking = b.feat('breaking', 'Land a breaking power move', 4, 'craft.dance.routine');
  b.feat('battle', 'Win a dance battle', 5, breaking);
  const win = b.feat('win', 'Win a dance competition', 6, 'craft.dance.compete');
  const national = b.feat('national', 'Win a national dance title', 7, win);
  b.feat('world', 'Win a world dance championship', 9, national);
  const choreo = b.feat('choreograph', 'Choreograph a dance for a group', 4, 'craft.dance.perform');
  b.feat('choreo-pro', 'Choreograph a professional show', 7, choreo);
}

// ─────────────── New disciplines ───────────────

{
  const b = branch('craft', 'Photography');
  b.guide({
    how: 'Shoot every day, learn exposure in manual mode, then study and edit your own photos critically. A clear subject or project matters more than gear.',
    stops: 'Buying new gear in place of taking more pictures.',
  });
  const manual = b.feat('manual', 'Shoot a photo in full manual mode', 1);
  const lens = b.feat('one-lens', 'Shoot with one fixed lens for a month', 2, manual);
  const film = b.feat('film', 'Shoot and develop a roll of film', 3, lens);
  b.feat('darkroom', 'Make a print in a darkroom', 4, film);
  const days = b.ladder('photo-a-day', manual, v => `Take a photo every day for ${v} days`, ['30', '100', '365', '1,000'], [1, 6], { name: 'Photo a day', extend: true });
  b.feat('exhibit', 'Show your photos in an exhibition', 5, days.at('365'));
  // People, then a living
  const stranger = b.feat('stranger', 'Photograph a stranger, with their permission', 2);
  b.feat('street-series', 'Shoot a street photo series of 20', 3, stranger);
  const paid = b.feat('paid', 'Get paid for a photo shoot', 3, stranger);
  const wedding = b.feat('wedding', 'Shoot a wedding as lead photographer', 4, paid);
  const living = b.feat('living', 'Earn your living from photography', 6, wedding);
  const cover = b.feat('cover', 'Shoot a cover for a major magazine', 7, living);
  b.feat('world-press', 'Win World Press Photo of the Year', 9, cover);
  // Nature and the sky
  const golden = b.feat('golden-hour', 'Shoot a landscape at golden hour', 1);
  b.feat('milky-way', 'Photograph the Milky Way', 3, golden);
  const wild = b.feat('wildlife', 'Photograph a wild animal in sharp focus', 3, golden);
  b.feat('wildlife-award', 'Win a major wildlife photography award', 8, wild);
  // Editing and books
  const edit = b.feat('edit-raw', 'Edit a raw photo from start to finish', 1);
  const zine = b.feat('zine', 'Make a photo zine', 3, edit);
  const book = b.feat('photo-book', 'Publish a photo book', 6, zine);
  b.feat('monograph', 'Publish a monograph with a major art press', 8, book);
}

{
  const b = branch('craft', 'Woodworking');
  b.guide({
    how: 'Start with simple boxes and shelves using a few hand tools, then learn sharpening and joinery. Each piece builds the accuracy for the next.',
    stops: 'Spending on a full workshop before finishing a first project.',
  });
  const saw = b.feat('saw', 'Cut a straight line with a hand saw', 0);
  const box = b.feat('box', 'Build a simple box', 1, saw);
  b.ladder('projects', box, v => `Finish ${v} woodworking projects`, ['5', '10', '50', '100'], [1, 6], { name: 'Projects', extend: true });
  const dovetail = b.feat('dovetail', 'Cut a dovetail joint by hand', 3, box);
  const noMetal = b.feat('no-metal', 'Build a piece with no nails or screws', 4, dovetail);
  const chair = b.feat('chair', 'Build a chair you can sit on', 5, noMetal);
  b.feat('chairs-6', 'Build a matching set of six chairs', 6, chair);
  b.feat('museum', 'Make a piece a museum collects', 9, chair);
  b.feat('sharpen', 'Sharpen a chisel until it shaves hair', 2, saw);
  // Carving and turning
  const spoon = b.feat('spoon', 'Carve a wooden spoon', 1);
  b.feat('bowl', 'Turn a bowl on a lathe', 3, spoon);
  const figure = b.feat('figure', 'Carve a figure in wood', 4, spoon);
  b.feat('instrument', 'Build a stringed instrument that plays in tune', 7, figure);
  // Bigger builds
  const shelf = b.feat('shelf', 'Build and hang a shelf', 1);
  const table = b.feat('table', 'Build a dining table', 4, shelf);
  b.feat('cabinet', 'Build a cabinet with doors and drawers', 5, table);
  b.feat('boat', 'Build a wooden boat that floats', 6, table);
  // Selling
  const sell = b.feat('sell', 'Sell a piece you built', 3, box);
  const commission = b.feat('commission', 'Build a piece on commission', 4, sell);
  const shop = b.feat('shop', 'Earn your living as a woodworker', 6, commission);
  b.feat('apprentice', 'Train an apprentice to work on their own', 7, shop);
}

{
  const b = branch('craft', 'Game design');
  b.guide({
    how: 'Make tiny games quickly, playtest them with real people and cut what is not fun. Game jams and small releases build the skill faster than one big dream project.',
    stops: 'Starting a huge dream game and never finishing it.',
  });
  const rule = b.feat('house-rule', 'Invent a house rule your group keeps using', 0);
  const card = b.feat('card-game', 'Design a card or board game and play it', 1, rule);
  const playtest = b.feat('playtest', 'Playtest your game with 10 different groups', 3, card);
  const print = b.feat('print-run', 'Print a game other people buy', 5, playtest);
  const signed = b.feat('signed', 'Get a game signed by a publisher', 6, print);
  const award = b.feat('board-award', 'Win a major board game award', 8, signed);
  b.feat('classic', 'Design a game still played a generation later', 10, award);
  // Video games
  const first = b.feat('first-game', 'Make a playable video game', 2);
  b.feat('jam', 'Finish a game jam', 3, first);
  const release = b.feat('release', 'Release a game to the public', 4, first);
  const players = b.ladder('players', release, v => `${v} people play a game you made`, ['100', '1,000', '10,000', '100,000', '1M'], [4, 8], { name: 'Players', extend: true });
  b.feat('goty', 'Win Game of the Year at a major awards show', 9, players.last);
  b.feat('living', 'Earn your living from games you made', 6, release);
  const team = b.feat('lead-team', 'Lead a team that ships a game', 6, release);
  b.feat('series', 'Create a game series with three entries', 8, team);
  // Levels, mods and tables
  const level = b.feat('level', 'Build a level in a game editor', 1);
  b.feat('mod', 'Publish a mod other people download', 3, level);
  const session = b.feat('run-session', 'Run a tabletop role-playing session', 1);
  const campaign = b.feat('campaign', 'Run a campaign for a whole year', 4, session);
  b.feat('adventure', 'Publish an adventure others run', 5, campaign);
}

{
  const b = branch('craft', 'Pottery and ceramics');
  b.guide({
    how: 'Take a class with wheel time, then throw lots of pots and keep the lessons rather than the pots. Glazes and firing take years of testing to master.',
    stops: 'Losing pieces in the kiln and taking it as failure, when it is a normal part of the craft.',
  });
  const pinch = b.feat('pinch-pot', 'Make a pinch pot', 0);
  const coil = b.feat('coil-pot', 'Build a coil pot', 1, pinch);
  b.feat('slab-box', 'Build a lidded box from clay slabs', 2, coil);
  const glaze = b.feat('glaze', 'Glaze and fire a piece of your own', 1, pinch);
  b.feat('glaze-recipe', 'Mix a glaze from your own recipe', 4, glaze);
  const kiln = b.feat('fire-kiln', 'Load and fire a kiln yourself', 4, glaze);
  b.feat('build-kiln', 'Build your own kiln', 6, kiln);
  // The wheel
  const centre = b.feat('centre', 'Centre clay on the wheel', 1);
  b.ladder('pots', centre, v => `Throw ${v} pots`, ['10', '100', '500', '1,000'], [1, 6], { name: 'Pots thrown', extend: true });
  const cyl = b.feat('cylinder', 'Throw a cylinder 15 cm tall', 2, centre);
  b.feat('tall', 'Throw a cylinder 40 cm tall', 4, cyl);
  const mug = b.feat('mug', 'Throw a mug and pull its handle', 2, cyl);
  const set = b.feat('bowl-set', 'Throw a matching set of six bowls', 3, mug);
  const teapot = b.feat('teapot', 'Throw a teapot that pours cleanly', 5, set);
  b.feat('porcelain', 'Throw a porcelain bowl thin enough to glow', 6, teapot);
  // Selling and showing
  const market = b.feat('market', 'Sell your pots at a market', 3, mug);
  const stocked = b.feat('stocked', 'Get your work stocked in a shop', 4, market);
  const studio = b.feat('studio', 'Run your own pottery studio', 6, stocked);
  const solo = b.feat('solo-show', 'Have a solo ceramics exhibition', 7, studio);
  const museum = b.feat('museum', 'Have a piece in a museum collection', 9, solo);
  b.feat('living-treasure', 'Be named a living national treasure for craft', 10, museum);
}

{
  const b = branch('craft', 'Fashion and sewing');
  b.guide({
    how: 'Start with repairs and simple projects, then follow patterns, then alter and draft your own. Getting the fit right is the skill that takes longest.',
    stops: 'Choosing a complicated first project that ends in frustration.',
  });
  const button = b.feat('button', 'Sew on a button', 0);
  const hem = b.feat('hem', 'Hem a pair of trousers by hand', 1, button);
  b.feat('alter', 'Alter a garment so it fits you', 2, hem);
  // Machine and patterns
  const machine = b.feat('machine', 'Sew a straight seam on a machine', 1);
  const pattern = b.feat('pattern', 'Make a garment from a printed pattern', 2, machine);
  b.ladder('garments', pattern, v => `Make ${v} garments`, ['5', '10', '50', '100'], [2, 6], { name: 'Garments made', extend: true });
  const outfit = b.feat('outfit', 'Wear a whole outfit you made', 4, pattern);
  const coat = b.feat('coat', 'Make a lined coat', 5, outfit);
  b.feat('suit', 'Make a tailored suit', 6, coat);
  const draft = b.feat('draft', 'Draft your own pattern from measurements', 4, pattern);
  // Design
  const sketch = b.feat('sketch', 'Sketch a design for an outfit', 0);
  const collection = b.feat('collection', 'Design and make a collection of 8 looks', 5, [sketch, draft]);
  const runway = b.feat('runway', 'Show a collection on a runway', 6, collection);
  const week = b.feat('fashion-week', 'Show at a major fashion week', 8, runway);
  b.feat('fashion-award', 'Win a major fashion design award', 9, week);
  // Knitting
  const knit = b.feat('knit', 'Knit a scarf', 1);
  const sweater = b.feat('sweater', 'Knit a sweater that fits', 3, knit);
  b.feat('colourwork', 'Knit a colourwork garment', 4, sweater);
  // A label of your own
  const commission = b.feat('commission', 'Make clothes for someone on commission', 4, outfit);
  const label = b.feat('label', 'Start a clothing label that sells', 6, commission);
  b.feat('label-stores', 'Get your label into 10 stores', 7, label);
}

{
  const b = branch('craft', 'Theatre and comedy');
  b.guide({
    how: 'Get on stage as often as you can: open mics, classes, community shows. Most of the craft is learned in front of a live audience.',
    stops: 'Fear of bombing, which keeps people from getting the stage time they need.',
  });
  // Stand-up
  const joke = b.feat('joke', 'Write a joke that makes strangers laugh', 1);
  const mic = b.feat('open-mic', 'Do five minutes at an open mic', 2, joke);
  const sets = b.ladder('sets', mic, v => `Do ${v} stand-up sets`, ['10', '100', '500', '1,000'], [2, 7], { name: 'Sets', extend: true });
  const paid = b.feat('paid-set', 'Get paid for a comedy set', 4, sets.first);
  const headline = b.feat('headline', 'Headline a comedy club', 6, paid);
  const special = b.feat('special', 'Record a stand-up special', 7, headline);
  const tour = b.feat('theatre-tour', 'Sell out a theatre tour', 8, special);
  b.feat('arena', 'Sell out an arena with stand-up', 9, tour);
  // Improv
  const improv = b.feat('improv', 'Take an improv class', 1);
  const show = b.feat('improv-show', 'Perform in an improv show', 2, improv);
  b.feat('improv-team', 'Play on an improv team for a year', 4, show);
  // Acting
  const read = b.feat('read-play', 'Read a whole play aloud with friends', 0);
  const audition = b.feat('audition', 'Audition for a play', 1, read);
  const cast = b.feat('cast', 'Get cast in a play', 2, audition);
  const pro = b.feat('pro-production', 'Act in a professional production', 6, cast);
  const big = b.feat('broadway', 'Perform on Broadway or in the West End', 8, pro);
  b.feat('tony', 'Win a Tony or Olivier Award', 9, big);
  // Making shows
  const crew = b.feat('crew', 'Work backstage on a show', 1);
  b.feat('direct', 'Direct a play', 4, crew);
  const play = b.feat('write-play', 'Write a one-act play', 3, read);
  const staged = b.feat('staged', 'Get a play you wrote staged', 5, play);
  b.feat('playwright-prize', 'Win a major playwriting prize', 9, staged);
}

{
  const b = branch('craft', 'Video and podcasting');
  b.guide({
    how: 'Publish on a steady schedule, study what keeps people watching or listening, and improve one thing each episode. Audiences grow slowly, then quickly.',
    stops: 'Quitting after a few months of small audiences, just before the work starts to compound.',
  });
  // A channel
  const channel = b.feat('channel', 'Post a video every week for a month', 2);
  const subs = b.ladder('subscribers', channel, v => `Reach ${v} subscribers`, ['100', '1,000', '10,000', '100,000', '1M', '10M'], [2, 9], { name: 'Subscribers', extend: true });
  const money = b.feat('monetise', 'Earn money from your channel', 4, subs.at('1,000'));
  const living = b.feat('living', 'Earn your living from video', 6, money);
  b.feat('network', 'Run a network of channels or shows', 8, living);
  // Making it
  const edit = b.feat('edit', 'Edit a video with cuts, music and titles', 1);
  b.feat('documentary', 'Make a documentary video over 30 minutes', 4, edit);
  const live = b.feat('live', 'Host a live stream for an hour', 2, edit);
  b.feat('live-1k', 'Host a live stream with 1,000 watching', 6, live);
  // A podcast
  const ep = b.feat('episode', 'Record and publish a podcast episode', 1);
  b.ladder('episodes', ep, v => `Publish ${v} podcast episodes`, ['10', '50', '100', '500'], [2, 6], { name: 'Episodes', extend: true });
  const dl = b.ladder('downloads', ep, v => `${v} downloads of your podcast`, ['1,000', '10,000', '100,000', '1M'], [2, 7], { name: 'Downloads', extend: true });
  const chart = b.feat('chart', 'Reach a national podcast top-10 chart', 7, dl.last);
  b.feat('podcast-award', 'Win a major podcast award', 8, chart);
}
