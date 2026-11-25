/**
 * Interchange stations: achievements that need progress on lines in more than
 * one discipline or area — where lines meet on the map. Each sits on the line
 * of its first requirement and is drawn as a capsule, with transfers to the
 * others. Ids are permanent.
 */
import { branch } from './dsl';

const X = 'Crossroads';
const guide = {
  how: 'Interchanges join two or more lines: you get there by progressing on each of them, often years apart.',
  stops: 'Most people specialise; keeping a second line alive alongside the first is the hard part.',
};

// ─── Led by Body ───────────────────────────────────────────────────────────
{
  const b = branch('body', X);
  b.guide(guide);
  b.feat('marathon-abroad', 'Run a marathon in another country', 5, ['body.running.marathon', 'spirit.travel.countries@5']);
  b.feat('iron-and-ink', 'Finish a marathon and publish a book', 6, ['body.running.marathon', 'craft.writing.book']);
  b.feat('fast-and-sharp', 'Run a sub-4 marathon and reach 1800 in chess', 6, ['body.running.marathon-time@4-00-00', 'mind.mental-games.chess@1800']);
  b.feat('strong-scholar', 'Deadlift twice your bodyweight and earn a doctorate', 7, ['body.strength.deadlift@2', 'mind.learning.doctorate']);
  b.feat('run-club', 'Start a running club that meets for a year', 4, ['body.running.5k', 'bonds.friendship.group-year']);
  b.feat('youth-coach', 'Coach a youth team for a full season', 3, ['body.sport.season', 'bonds.leadership.captain']);
  b.feat('open-water-trek', 'Swim open water on a multi-day trek', 5, ['body.swimming.open-water', 'spirit.adventure.trek']);
  b.feat('ride-and-write', 'Cycle across a country and publish its story', 6, ['body.cycling.across-country', 'craft.writing.published']);
  b.feat('well-rested', 'Sleep well and walk 10,000 steps daily for 100 days', 4, ['body.health.steps-100', 'body.health.sleep-100', 'spirit.discipline.cold-30']);
}

// ─── Led by Mind ───────────────────────────────────────────────────────────
{
  const b = branch('mind', X);
  b.guide(guide);
  b.feat('scholar-athlete', 'Earn a degree while playing a full season of sport', 4, ['mind.learning.bachelor', 'body.sport.season']);
  b.feat('worldly', 'Speak two foreign languages and visit 30 countries', 7, ['mind.languages.second', 'spirit.travel.countries@30']);
  b.feat('research-to-book', 'Turn your research into a book for everyone', 7, ['mind.science.publish', 'craft.writing.book']);
  b.feat('lab-to-company', 'Found a company built on your own invention', 7, ['mind.science.patent', 'wealth.business.hire']);
  b.feat('well-read-teacher', 'Read 100 books and teach a class on what you learned', 4, ['mind.reading.books@100', 'mind.learning.teach']);
  b.feat('field-science', 'Run an experiment in the wild, far from home', 5, ['mind.science.experiment', 'spirit.adventure.solo-night']);
  b.feat('course-creator', 'Teach 100 students a skill you built yourself', 5, ['mind.learning.course-100', 'craft.building.ship']);
}

// ─── Led by Craft ──────────────────────────────────────────────────────────
{
  const b = branch('craft', X);
  b.guide(guide);
  b.feat('app-to-business', 'Turn an app you built into a paying business', 4, ['craft.building.ship', 'wealth.business.first-dollar']);
  b.feat('cookbook', 'Publish a cookbook of your own recipes', 6, ['craft.cooking.recipes@50', 'craft.writing.book']);
  b.feat('festival-abroad', 'Screen your film at a festival abroad', 5, ['craft.film.festival', 'spirit.travel.countries@5']);
  b.feat('art-for-good', 'Raise $10,000 for a cause with your art', 4, ['craft.visual-art.sell', 'bonds.service.given@10-000']);
  b.feat('tour-abroad', 'Take your music on tour in another country', 5, ['craft.music.gig', 'spirit.travel.countries@5']);
  b.feat('supper-club', 'Run a supper club for friends for a year', 4, ['craft.cooking.dinner', 'bonds.friendship.group-year']);
  b.feat('documentary', 'Make a short documentary about a cause you serve', 3, ['craft.film.short', 'bonds.service.donate']);
  b.feat('maker-with-reach', 'Present something 10,000 people use, on stage', 6, ['craft.building.users@10-000', 'bonds.voice.talk-50']);
}

// ─── Led by Wealth ─────────────────────────────────────────────────────────
{
  const b = branch('wealth', X);
  b.guide(guide);
  b.feat('free-and-roaming', 'Reach financial independence and live abroad for a year', 8, ['wealth.money.fi', 'spirit.travel.abroad']);
  b.feat('steady-giver', 'Give to causes every year for five years', 3, ['wealth.career.income@50k', 'bonds.service.donate']);
  b.feat('founder-mentor', 'Mentor 10 founders after building your own company', 6, ['wealth.business.hire', 'bonds.leadership.mentor-10']);
  b.feat('money-teacher', 'Teach a money skills class from your own budget', 4, ['wealth.money.budget-12', 'mind.learning.teach']);
  b.feat('company-for-good', 'Build a company that helps 100,000 people', 7, ['wealth.business.team@100', 'bonds.service.helped@100-000']);
  b.feat('debt-free-manager', 'Be debt-free while managing a team', 5, ['wealth.money.debt-free', 'wealth.career.manager']);
  b.feat('creator-business', 'Turn an audience of 10,000 into a business', 5, ['bonds.voice.audience@10-000', 'wealth.business.first-dollar']);
}

// ─── Led by Bonds ──────────────────────────────────────────────────────────
{
  const b = branch('bonds', X);
  b.guide(guide);
  b.feat('family-trek', 'Complete a multi-day trek with your family', 4, ['bonds.love-and-family.dinner', 'spirit.adventure.trek']);
  b.feat('book-keynote', 'Give a keynote about your book', 7, ['bonds.voice.keynote', 'craft.writing.book']);
  b.feat('host-musician', 'Host an evening where you perform for friends', 3, ['bonds.friendship.host', 'craft.music.perform']);
  b.feat('first-responder', 'Lead a group safely through a night in the wild', 4, ['bonds.service.cpr', 'spirit.adventure.solo-night']);
  b.feat('release-party', 'Throw a release party for your own music', 4, ['craft.music.release', 'bonds.friendship.host']);
}

// ─── Led by Spirit ─────────────────────────────────────────────────────────
{
  const b = branch('spirit', X);
  b.guide(guide);
  b.feat('summit-sit', 'Meditate on a summit at sunrise', 2, ['spirit.adventure.peak', 'spirit.stillness.five']);
  b.feat('pilgrim-writer', 'Walk a pilgrimage and publish what you found', 5, ['spirit.travel.pilgrimage', 'craft.writing.published']);
  b.feat('cold-and-calm', 'Cold showers and meditation for 100 days', 4, ['spirit.stillness.days@100', 'spirit.discipline.cold-30']);
  b.feat('silent-and-written', 'Write daily for 100 days, then sit a 10-day retreat', 6, ['spirit.stillness.retreat-10', 'craft.writing.daily-100']);
  b.feat('solo-world', 'Travel alone in a country whose language you speak', 5, ['spirit.travel.solo', 'mind.languages.b2']);
  b.feat('seven-and-seven', 'Climb the Seven Summits and run a marathon on every continent', 10, ['spirit.adventure.seven-summits', 'body.running.continents']);
  b.feat('summit-author', 'Climb Everest and write the book of it', 10, ['spirit.adventure.everest', 'craft.writing.book']);
  b.feat('renaissance-life', 'Publish a book, run a marathon, speak a second language and build a company', 8,
    ['craft.writing.book', 'body.running.marathon', 'mind.languages.b2', 'wealth.business.hire'], 'Four lines, one life.');
}
