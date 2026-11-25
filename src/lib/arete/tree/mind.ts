/**
 * Mind expansion: new disciplines, deeper lines and discipline guides.
 * Written with ./dsl.ts. Ids are permanent once shipped.
 */
import { branch } from './dsl';

// ─────────────── Deeper lines on the core disciplines (see ./core.ts) ───────────────

{
  const b = branch('mind', 'Reading');
  b.guide({
    how: 'Read a little every day, mostly what you enjoy, and slowly stretch into longer and harder books. A reading list or a book club keeps it going.',
    stops: 'Forcing yourself through books you dislike until reading feels like homework.',
  });
  b.ladder('pages-year', 'mind.reading.one', v => `Read ${v} pages in a year`, ['2,500', '5,000', '10,000', '25,000'], [1, 7], { name: 'Pages a year' });
  b.feat('genres', 'Read a book from 10 different genres in a year', 3, 'mind.reading.year-12');
  b.feat('club', 'Stay in a book club for a year', 2, 'mind.reading.one');
  b.feat('translated', 'Read 10 books translated from other languages', 3, 'mind.reading.books@10');
  b.feat('cycle', 'Finish a novel cycle of seven volumes or more', 5, 'mind.reading.long');
}

{
  const b = branch('mind', 'Learning');
  b.guide({
    how: 'Study one thing at a time in short, regular sessions, testing yourself instead of rereading, then teach it. Credentials follow from finishing course after course.',
    stops: 'Starting lots of courses and finishing none of them.',
  });
  b.ladder('study-hours', 'mind.learning.course', v => `Spend ${v} hours in focused study`, ['100', '1,000', '5,000', '10,000'], [1, 7], { name: 'Study hours', extend: true });
  b.feat('spaced-100', 'Use spaced-repetition flashcards for 100 days', 2, 'mind.learning.course');
  b.feat('licence', 'Pass a professional licensing exam', 5, 'mind.learning.cert');
  b.feat('fellowship', 'Win a competitive research fellowship', 8, 'mind.learning.doctorate');
}

{
  const b = branch('mind', 'Languages');
  b.guide({
    how: 'Learn the most common words, then get hours of listening and reading you can mostly follow, and speak with real people early. Fluency is hundreds of hours of contact.',
    stops: 'Waiting to feel ready before speaking, so the language never leaves the app.',
  });
  b.ladder('words', 'mind.languages.100-words', v => `Know ${v} words in a foreign language`, ['500', '1,000', '2,500', '5,000', '10,000'], [1, 6],
    { name: 'Words known', ask: 'Words you know in your best foreign language', hint: '600' });
  b.ladder('hours', 'mind.languages.100-words', v => `Practise a language for ${v} hours`, ['100', '500', '1,000'], [1, 5], { name: 'Practice hours', extend: true });
  b.feat('exam-b2', 'Pass an official B2 language exam', 5, 'mind.languages.b2');
  b.feat('interpret', 'Interpret live between two languages', 7, 'mind.languages.c1');
}

{
  const b = branch('mind', 'Science');
  b.guide({
    how: 'Start with your own observations and small experiments, learn one field\'s basics properly, then read its papers and join real research through citizen science or a lab.',
    stops: 'The long climb of maths and method before you get to find anything new.',
  });
  const scope = b.feat('telescope', 'See Saturn\'s rings through a telescope', 0);
  const messier = b.feat('messier', 'Observe all 110 Messier objects', 5, scope);
  b.feat('comet', 'Discover a comet or asteroid', 8, messier);
  b.feat('citizen', 'Contribute to a citizen science project', 1);
  b.ladder('citations', 'mind.science.publish', v => `Have your research cited ${v} times`, ['100', '1,000', '10,000'], [6, 9], { name: 'Citations', extend: true });
  b.feat('grant', 'Win a research grant as lead scientist', 7, 'mind.science.publish');
}

{
  const b = branch('mind', 'Mental games');
  b.guide({
    how: 'Play a lot against slightly stronger opponents and go over your losses. Study (openings, endgames, memory systems) pays off once you play regularly.',
    stops: 'Plateaus from playing many fast games without ever studying the mistakes.',
  });
  b.feat('blindfold', 'Win a game of chess blindfold', 5, 'mind.mental-games.chess@1600');
  b.feat('world-champion', 'Become world chess champion', 10, 'mind.mental-games.chess@2700');
  const go = b.feat('go', 'Play a full game of go', 0);
  const dan = b.feat('go-dan', 'Reach amateur dan rank at go', 5, go);
  b.feat('go-pro', 'Become a professional go player', 8, dan);
  const bridge = b.feat('bridge', 'Learn to play bridge', 1);
  const master = b.feat('bridge-master', 'Earn a national bridge master rank', 6, bridge);
  b.feat('bridge-world', 'Win a world bridge championship', 9, master);
}

// ─────────────── New disciplines ───────────────

{
  const b = branch('mind', 'Mathematics');
  b.guide({
    how: 'Get fluent with arithmetic and algebra, then work through textbooks problem by problem. Real progress comes from struggling with problems, not reading solutions.',
    stops: 'Hitting a wall of abstraction, often proofs, and deciding you are "not a maths person".',
  });
  // In your head
  const times = b.feat('times-tables', 'Know your times tables up to 12 × 12', 0);
  const mental = b.ladder('mental', times, v => `Multiply two ${v}-digit numbers in your head`, ['2', '3', '4', '5'], [1, 7], { name: 'Mental maths' });
  b.feat('mental-world-cup', 'Compete at the Mental Calculation World Cup', 8, mental.last);
  // Algebra up to university maths
  const algebra = b.feat('algebra', 'Solve two equations with two unknowns', 1);
  const trig = b.feat('trig', 'Use trigonometry to find a height or distance', 2, algebra);
  const linalg = b.feat('linear-algebra', 'Learn linear algebra: vectors, matrices, eigenvalues', 4, [trig, 'mind.science.calculus']);
  const analysis = b.feat('analysis', 'Work through a real analysis course', 5, linalg);
  b.feat('quals', 'Pass a graduate qualifying exam in maths', 7, analysis);
  // Chance and data
  const odds = b.feat('odds', 'Work out the odds of rolling two sixes', 0);
  b.feat('stats-test', 'Run a statistical test on real data', 3, odds);
  // Competitions
  const contest = b.feat('contest', 'Enter a maths competition', 1);
  const national = b.feat('national-olympiad', 'Reach your national maths olympiad final', 6, contest);
  const imo = b.feat('imo', 'Compete at the International Mathematical Olympiad', 8, national);
  b.feat('imo-gold', 'Win a gold medal at the IMO', 9, imo);
  const putnam = b.feat('putnam-problem', 'Solve a Putnam problem inside the exam time', 4, contest);
  b.feat('putnam-fellow', 'Finish in the top five of the Putnam', 9, putnam);
  // Proof and research
  const irrational = b.feat('irrational', 'Follow the proof that √2 is irrational', 1);
  const induction = b.feat('induction', 'Write a proof by induction', 2, irrational);
  b.ladder('proofs', induction, v => `Solve ${v} proof problems on your own`, ['10', '50', '100', '500'], [2, 7], { name: 'Proofs', extend: true });
  const paper = b.feat('read-research', 'Read a maths research paper and follow it', 4, induction);
  const erdos = b.feat('erdos', 'Earn an Erdős number of 3 or less', 6, paper);
  const conjecture = b.feat('conjecture', 'Prove a named open conjecture', 9, erdos);
  b.feat('millennium', 'Solve a Millennium Prize Problem', 10, conjecture);
}

{
  const b = branch('mind', 'Programming');
  b.guide({
    how: 'Learn one language by building small things, then data structures and algorithms, then bigger systems. Most skill comes from finishing projects and reading other people\'s code.',
    stops: 'Tutorial loops: following along forever without building anything of your own.',
  });
  b.feat('fizzbuzz', 'Write FizzBuzz without looking it up', 1);
  // Algorithms
  const sort = b.feat('sort', 'Write a sorting algorithm from scratch', 1);
  b.ladder('problems', sort, v => `Solve ${v} algorithm problems`, ['10', '100', '250', '500', '1,000'], [1, 6], { name: 'Problems solved', extend: true });
  const ds = b.feat('data-structures', 'Build a hash map, a tree and a graph yourself', 2, sort);
  const path = b.feat('shortest-path', 'Implement a shortest-path algorithm', 3, ds);
  const algo = b.feat('new-algorithm', 'Invent an algorithm faster than the known best', 8, path);
  b.feat('turing', 'Win the Turing Award', 10, algo);
  // Contests
  const contest = b.feat('contest', 'Finish a timed programming contest', 2, sort);
  const rating = b.ladder('rating', contest, v => `Reach a contest rating of ${v}`, ['1400', '1600', '1900', '2100', '2400', '3000'], [2, 9],
    { name: 'Contest rating', detail: 'On the Codeforces scale: 1900 is candidate master, 2400 grandmaster.' });
  b.feat('icpc', 'Compete at the ICPC World Finals', 7, rating.at('2100'));
  // Systems
  const script = b.feat('automate', 'Automate a boring chore with a script', 1);
  const api = b.feat('api', 'Build something that talks to a web API', 2, script);
  const dist = b.feat('distributed', 'Build a system that runs across many machines', 5, api);
  b.feat('critical', 'Design a system millions of people rely on', 8, dist);
  // Under the hood
  const shell = b.feat('command-line', 'Work only from the command line for a day', 0);
  const git = b.feat('version-control', 'Use version control on every project', 1, shell);
  const compiler = b.feat('compiler', 'Write a compiler or interpreter', 5, git);
  b.feat('own-language', 'Create a programming language others use', 8, compiler);
  // Machine learning
  const ml = b.feat('ml', 'Train a machine-learning model on your own data', 3);
  const repro = b.feat('reproduce', 'Reproduce the results of a machine-learning paper', 5, ml);
  b.feat('state-of-art', 'Set a new state of the art on a known benchmark', 8, repro);
}

{
  const b = branch('mind', 'History');
  b.guide({
    how: 'Get a broad timeline first, then go deep on one period or place through books and primary sources. Visiting sites and tracing your own family make it stick.',
    stops: 'Memorising dates instead of following the people and causes behind them.',
  });
  const timeline = b.feat('timeline', 'Put 20 big events of world history in order', 0);
  const world = b.feat('world-history', 'Read a one-volume history of the world', 2, timeline);
  b.feat('centuries', 'Sum up each century since 1500 from memory', 3, world);
  // Books and sources
  const book = b.feat('book', 'Read a history book', 0);
  const books = b.ladder('books', book, v => `Read ${v} history books`, ['5', '10', '25', '50', '100'], [1, 6], { name: 'History books', extend: true });
  const period = b.feat('period', 'Know one period of history in real depth', 4, books.at('10'));
  b.feat('expert', 'Be invited to speak as an expert on a period', 6, period);
  const primary = b.feat('primary', 'Read a primary source over 1,000 years old', 2, book);
  b.feat('classical', 'Read a classical language like Latin or Sanskrit', 5, primary);
  const local = b.feat('local', 'Research and write up the history of your town', 4, primary);
  const pub = b.feat('publish', 'Publish a work of history', 6, local);
  const prize = b.feat('prize', 'Win a major prize for history writing', 8, pub);
  b.feat('standard-work', 'Write the standard history of a subject', 9, prize);
  // Your own roots
  const family = b.feat('family', 'Trace your family back four generations', 1);
  const tree = b.feat('family-tree', 'Build a family tree of 100 relatives', 3, family);
  b.feat('family-history', 'Write your family\'s history for the next generation', 5, tree);
  b.feat('oral-history', 'Record an elder telling their life story', 2, family);
  // Places and digs
  const museum = b.feat('museum', 'Spend a whole day in a history museum', 0);
  const site = b.feat('ancient-site', 'Visit an ancient site and learn its story', 1, museum);
  const dig = b.feat('dig', 'Volunteer on an archaeological dig', 4, site);
  const find = b.feat('artefact', 'Uncover an artefact on a dig', 5, dig);
  b.feat('discovery', 'Make a find that changes what we know of the past', 9, find);
}

{
  const b = branch('mind', 'Philosophy');
  b.guide({
    how: 'Read a good introduction, then the classics themselves, slowly and with other people. Writing out your own arguments and having them pushed on is where it deepens.',
    stops: 'Reading about philosophers instead of wrestling with the questions yourself.',
  });
  const intro = b.feat('intro', 'Read an introduction to philosophy', 0);
  const classic = b.feat('classic', 'Read a classic work of philosophy in full', 2, intro);
  b.ladder('works', classic, v => `Read ${v} works of philosophy`, ['5', '10', '25', '50', '100'], [2, 6], { name: 'Works read', extend: true });
  b.feat('hardest', 'Finish one of the famously hardest works', 4, classic);
  b.feat('traditions', 'Read a key text from five traditions', 4, classic, 'For example Greek, Chinese, Indian, Islamic and modern.');
  // Thinking clearly
  const fallacies = b.feat('fallacies', 'Spot 10 logical fallacies by name', 1);
  const steel = b.feat('steelman', 'State the best case for a view you reject', 2, fallacies);
  const changed = b.feat('changed-mind', 'Change your mind on a big question by argument', 3, steel);
  b.feat('own-ethics', 'Write out your own worked-out view of ethics', 4, changed);
  const logic = b.feat('logic', 'Finish a course in formal logic', 3, fallacies);
  b.feat('logic-proof', 'Prove a theorem in formal logic', 5, logic);
  // With others, then in print
  const group = b.feat('group', 'Join a philosophy discussion group', 1);
  b.feat('lead', 'Lead a philosophy discussion', 3, group);
  const essay = b.feat('essay', 'Write a philosophy essay and have it critiqued', 3, group);
  const journal = b.feat('journal', 'Publish in a philosophy journal', 6, essay);
  const book = b.feat('book', 'Publish a book of philosophy', 7, journal);
  const cited = b.feat('cited', 'Write work philosophers worldwide cite', 8, book);
  const system = b.feat('system', 'Develop a philosophy others study', 9, cited);
  b.feat('school', 'Found a school of thought that lasts a century', 10, system);
  // Living it
  const practice = b.feat('practice-30', 'Live by a philosophy\'s daily practice for 30 days', 2);
  b.feat('practice-year', 'Live by a philosophy\'s daily practice for a year', 5, practice);
}

{
  const b = branch('mind', 'Geography');
  b.guide({
    how: 'Learn the big shapes first (continents, oceans, your own country), then drill countries, capitals and flags with map quizzes. Getting out with a paper map makes it real.',
    stops: 'Drilling names without ever connecting them to the land, climate and people.',
  });
  const cont = b.feat('continents', 'Name every continent and ocean on a blank map', 0);
  const countries = b.ladder('countries', cont, v => `Place ${v} countries on a blank map`, ['25', '50', '100', '195'], [1, 5],
    { name: 'Countries on a map', ask: 'Countries you can place on a blank map', hint: '40', detail: '195 is every country in the world.' });
  const capitals = b.ladder('capitals', cont, v => `Name the capitals of ${v} countries`, ['25', '50', '100', '195'], [1, 5], { name: 'Capitals' });
  const flags = b.ladder('flags', cont, v => `Recognise the flags of ${v} countries`, ['25', '50', '100', '195'], [1, 5], { name: 'Flags' });
  b.feat('all-three', 'Know every country\'s place, capital and flag', 6, [countries.last, capitals.last, flags.last]);
  b.feat('sketch-world', 'Sketch a world map from memory with 50 countries', 4, countries.at('50'));
  b.feat('street-guess', 'Place a random street photo within 100 km', 3, flags.at('50'));
  const bee = b.feat('bee', 'Compete in a geography bee or quiz', 2, capitals.at('25'));
  const olympiad = b.feat('olympiad', 'Compete at the International Geography Olympiad', 6, bee);
  b.feat('olympiad-medal', 'Win a medal at the International Geography Olympiad', 8, olympiad);
  // Finding your way
  const compass = b.feat('compass', 'Find your way with a paper map and compass', 1);
  b.feat('orienteering', 'Finish an orienteering course', 2, compass);
  b.feat('north', 'Find north by the stars or the sun', 1, compass);
  // Making maps
  const gis = b.feat('gis', 'Make a map with GIS software', 3);
  const relied = b.feat('relied-map', 'Make a map other people rely on', 5, gis);
  b.feat('atlas', 'Make an atlas or map used in schools', 8, relied);
  const unmapped = b.feat('unmapped', 'Map a place nobody had mapped well', 7, relied);
  b.feat('named', 'Have a place on the map named after you', 9, unmapped);
}

{
  const b = branch('mind', 'Puzzles');
  b.guide({
    how: 'Do one kind of puzzle a little every day, learn its named techniques, then start timing yourself. Speed comes from patterns built over hundreds of solves.',
    stops: 'Looking up the answer the moment it gets hard, which skips the part that builds skill.',
  });
  const sudoku = b.feat('sudoku', 'Solve a sudoku with no help', 0);
  const st = b.ladder('sudoku-time', sudoku, v => `Solve a medium sudoku in ${v}`, ['30:00', '20:00', '15:00', '10:00', '5:00', '3:00'], [1, 7], { kind: 'time', name: 'Sudoku' });
  const wsc = b.feat('wsc', 'Compete at the World Sudoku Championship', 8, st.last);
  b.feat('wsc-win', 'Win the World Sudoku Championship', 10, wsc);
  // Crosswords
  const cross = b.feat('crossword', 'Finish a crossword with no help', 1);
  const ct = b.ladder('crossword-time', cross, v => `Finish a daily crossword in ${v}`, ['30:00', '20:00', '12:00', '8:00', '5:00'], [1, 6], { kind: 'time', name: 'Crossword' });
  b.feat('crossword-hard', 'Finish a hard weekend crossword with no help', 3, cross);
  const tourney = b.feat('crossword-tournament', 'Compete in a national crossword tournament', 5, ct.at('8:00'));
  b.feat('crossword-champion', 'Win a national crossword championship', 9, tourney);
  // Logic
  const grid = b.feat('logic-grid', 'Solve a logic grid puzzle', 0);
  const nono = b.feat('nonogram', 'Solve a large nonogram or kakuro', 2, grid);
  const hunt = b.feat('puzzle-hunt', 'Finish a team puzzle hunt', 3, nono);
  b.feat('hunt-win', 'Win a major puzzle hunt', 7, hunt);
  b.feat('wpc', 'Compete at the World Puzzle Championship', 8, nono);
  const make = b.feat('make', 'Design a puzzle someone else solves', 2, grid);
  b.feat('puzzle-book', 'Publish a book of your own puzzles', 6, make);
  // Rooms and pieces
  b.feat('escape-room', 'Get out of an escape room in time', 1);
  const jigsaw = b.feat('jigsaw', 'Finish a 1,000-piece jigsaw', 1);
  const speed = b.feat('jigsaw-speed', 'Finish a 500-piece jigsaw in under an hour', 5, jigsaw);
  b.feat('jigsaw-world', 'Compete at the World Jigsaw Puzzle Championship', 7, speed);
}

{
  const b = branch('mind', 'Psychology');
  b.guide({
    how: 'Notice and write down what you think and feel, learn the main findings about how minds work, and test them on yourself. Honest feedback from others shows what you cannot see.',
    stops: 'Collecting insights about yourself without ever changing a habit because of them.',
  });
  // Knowing yourself
  const entry = b.feat('journal', 'Write a journal entry about your day', 0);
  const days = b.ladder('journal-days', entry, v => `Keep a journal for ${v} days`, ['30', '100', '365', '1,000', '3,650'], [1, 7], { name: 'Journal days', extend: true });
  const review = b.feat('year-review', 'Write an honest review of your year', 2, days.at('30'));
  b.feat('reviews-10', 'Write a yearly review 10 years running', 6, review);
  const feedback = b.feat('feedback', 'Ask five people for honest feedback on you', 2);
  b.feat('blind-spot', 'Fix a blind spot others pointed out', 4, feedback);
  // Feelings and patterns
  const feel = b.feat('name-feelings', 'Name what you feel as it happens for a week', 1);
  const triggers = b.feat('triggers', 'Map what sets off your worst moods', 2, feel);
  b.feat('old-pattern', 'Break a pattern you\'ve had for years', 5, triggers);
  b.feat('therapy', 'Do 10 sessions of therapy or coaching', 2, feel);
  // The science of the mind
  const book = b.feat('book', 'Read a book on how the mind works', 0);
  b.feat('biases', 'Spot 10 cognitive biases in your own choices', 2, book);
  const course = b.feat('course', 'Finish an intro psychology course', 2, book);
  const study = b.feat('study', 'Run a small study on people and analyse it', 4, course);
  const pub = b.feat('publish', 'Publish psychology research', 6, study);
  const textbook = b.feat('textbook-finding', 'Make a finding that reaches the textbooks', 8, pub);
  b.feat('theory', 'Propose a theory of the mind that holds up', 9, textbook);
  // Helping minds
  const mhfa = b.feat('mental-first-aid', 'Take a mental health first aid course', 2);
  const therapist = b.feat('therapist', 'Qualify as a licensed therapist', 6, mhfa);
  b.feat('method', 'Create a therapy method others train in', 8, therapist);
  // Knowing what you know
  const predict = b.feat('predictions', 'Make 100 predictions and score your hit rate', 3);
  const calibrated = b.feat('calibrated', 'Stay well calibrated over 500 predictions', 5, predict);
  b.feat('superforecaster', 'Earn superforecaster status in a tournament', 7, calibrated);
}
