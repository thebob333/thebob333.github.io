/**
 * Bonds expansion: new disciplines, deeper lines and discipline guides.
 * Written with ./dsl.ts. Ids are permanent once shipped.
 */
import { branch } from './dsl';

// Stations from core.ts used as anchors.
const friendship = (id: string) => `bonds.friendship.${id}`;
const family = (id: string) => `bonds.love-and-family.${id}`;
const leadership = (id: string) => `bonds.leadership.${id}`;
const service = (id: string) => `bonds.service.${id}`;
const voice = (id: string) => `bonds.voice.${id}`;

// ── Friendship (deeper) ──
{
  const b = branch('bonds', 'Friendship');
  b.guide({
    how: 'Friendships grow from showing up again and again: reaching out first, making plans, and being there when it counts. Close friends as an adult usually come from repeated time together, not one big moment.',
    stops: 'Waiting for the other person to reach out first.',
  });
  b.ladder('close', friendship('reach-out'), v => `Have ${v} close friend${v === '1' ? '' : 's'} you could call in a crisis`, ['1', '3', '5', '10', '15'], [1, 6],
    { name: 'Close friends', ask: 'Close friends you could call in a crisis', hint: '3' });
  b.feat('birthdays', 'Remember every close friend\'s birthday for a year', 2, friendship('thanks'));
  b.feat('visit-far', 'Travel to see a friend who lives far away', 2, friendship('reach-out'));
  b.feat('friend-trip', 'Take a trip with a friend of 10+ years', 5, friendship('decade'));
}

// ── Love and family (deeper) ──
{
  const b = branch('bonds', 'Love and family');
  b.guide({
    how: 'Close relationships deepen through small daily attention, honest talk when things are hard, and repairing quickly after a fight. Family ties strengthen with shared rituals kept over years.',
    stops: 'Letting resentment build up instead of talking about it early.',
  });
  b.feat('letters', 'Write a letter to someone in your family', 1);
  b.feat('date-year', 'Have a date night every month for a year', 3, family('year'));
  b.feat('three-gen', 'Take a trip with three generations of your family', 4, family('dinner'));
}

// ── Leadership (deeper) ──
{
  const b = branch('bonds', 'Leadership');
  b.guide({
    how: 'People learn to lead by running small things first (a meeting, a project, a club), asking for honest feedback, and slowly taking on more people and harder moments.',
    stops: 'Avoiding hard conversations, so problems in the team grow quietly.',
  });
  b.feat('feedback', 'Ask the people you lead for honest feedback', 2, leadership('meeting'));
  b.ladder('teams', leadership('captain'), v => `Lead ${v} different teams`, ['2', '3', '5', '10'], [4, 7], { name: 'Teams led', extend: true });
  b.feat('successor', 'Train someone to take over from you', 5, leadership('captain'));
  b.feat('crisis', 'Lead a group through a crisis', 6, leadership('captain'));
}

// ── Service (deeper) ──
{
  const b = branch('bonds', 'Service');
  b.guide({
    how: 'Most people start with one-off volunteering, find a cause that fits, then give regularly and bring their real skills to it. Over years that grows into leading or founding something.',
    stops: 'Life getting busy, so giving stays occasional instead of becoming a habit.',
  });
  b.feat('weekly-year', 'Volunteer every week for a year', 4, service('hour'));
  b.feat('pro-bono', 'Give your professional skills free to a cause', 3, service('hour'));
  const organ = b.feat('organ', 'Register as an organ donor', 0);
  const marrow = b.feat('marrow', 'Join a stem cell or bone marrow register', 1, organ);
  b.feat('marrow-give', 'Donate stem cells or marrow to a stranger', 6, marrow);
}

// ── Voice (deeper) ──
{
  const b = branch('bonds', 'Voice');
  b.guide({
    how: 'Speakers grow by talking often to small rooms, getting feedback, and slowly facing bigger audiences. A following comes from sharing useful work in public, steadily, for years.',
    stops: 'Fear of being judged, so people never give the first talk or post the first piece.',
  });
  b.ladder('talks', voice('talk-5'), v => `Give ${v} talks`, ['5', '10', '25', '50', '100', '500'], [3, 8], { name: 'Talks given', extend: true });
  const toast = b.feat('toast', 'Give a toast at a wedding or celebration', 1, voice('speak-up'));
  b.feat('eulogy', 'Give a eulogy', 3, toast);
  b.feat('interviewed', 'Be interviewed on a podcast, radio or TV', 4, voice('publish'));
}

// ── Parenting and mentoring ──
{
  const b = branch('bonds', 'Parenting and mentoring');
  b.guide({
    how: 'Whether as a parent, relative, coach or mentor, people grow into it by showing up for a young person regularly, teaching small skills, and listening more than they lecture. Trust built over years matters most.',
    stops: 'Not having the time, so the visits and lessons stay occasional.',
  });
  const read = b.feat('read-aloud', 'Read a story aloud to a child', 0);
  const ready = b.feat('ready', 'Talk through what kind of parent you want to be', 1, read);
  const first = b.feat('first-year', 'Get through a baby\'s first year', 4, ready);
  const school = b.feat('school-years', 'See a child through primary school', 5, first);
  const teen = b.feat('teen', 'Stay close to a child through the teenage years', 6, school);
  const grown = b.feat('grown-friends', 'Be friends with your grown-up children', 8, [teen, family('raise')]);
  b.feat('grandchildren', 'Be close to your grandchildren', 8, grown);
  const foster = b.feat('foster', 'Foster a child', 6, ready);
  b.feat('foster-10', 'Foster 10 children over the years', 8, foster);
  b.feat('adopt', 'Adopt a child', 6, ready);
  b.feat('bedtime', 'Read bedtime stories every night for a year', 3, read);
  b.feat('school-help', 'Volunteer at a child\'s school', 2, read);
  const skill = b.feat('teach-skill', 'Teach a child to ride a bike or swim', 1, read);
  b.feat('money-lesson', 'Teach a child how to save money', 2, skill);
  b.feat('driving', 'Teach a young person to drive', 3, skill);
  const coach = b.feat('coach-youth', 'Coach a youth team for a season', 3, skill);
  b.feat('coach-10', 'Coach young people for 10 seasons', 6, coach);
  const tutor = b.feat('tutor-year', 'Tutor a young person through a school year', 3, skill);
  const teacher = b.feat('teacher', 'Teach a class of children for a year', 4, tutor);
  b.feat('teacher-25', 'Teach children for 25 years', 7, teacher);
  b.feat('first-graduate', 'Help someone be first in their family to graduate', 6, tutor);
  b.feat('fund-study', 'Pay for a young person\'s education', 6, tutor);
  const mentor = b.feat('mentor-year', 'Mentor a young person for a year', 3, skill);
  b.ladder('mentored', mentor, v => `Mentor ${v} young people`, ['3', '10', '25', '100', '500'], [4, 9], { name: 'Young people mentored', extend: true });
  b.feat('first-job', 'Help a young person land their first job', 4, mentor);
  const program = b.feat('youth-program', 'Start a programme for young people', 6, mentor);
  const thousand = b.feat('youth-1000', 'Grow a youth programme to reach 1,000 kids', 8, program);
  b.feat('method', 'Create a way of teaching children the world adopts', 10, thousand);
}

// ── Community ──
{
  const b = branch('bonds', 'Community');
  b.guide({
    how: 'Community starts with knowing your neighbours and joining something local, then helping organise it. People who keep showing up end up running events, founding groups and changing their town.',
    stops: 'Assuming someone else will organise it.',
  });
  const names = b.feat('neighbour-names', 'Learn the names of five neighbours', 0);
  b.feat('neighbour-help', 'Help a neighbour with something practical', 0, names);
  const meal = b.feat('neighbour-meal', 'Share a meal with a neighbour', 1, names);
  b.feat('street-party', 'Organise a street party or block gathering', 3, meal);
  const chat = b.feat('group-chat', 'Start a group chat for your street or building', 1, names);
  const share = b.feat('tool-share', 'Set up a tool or book swap for your street', 3, chat);
  const space = b.feat('shared-space', 'Create a shared space for your neighbourhood', 6, share);
  b.feat('landmark', 'Build something your town is known for', 9, space);
  const first = b.feat('first-event', 'Organise a local event anyone can join', 2, chat);
  b.feat('fundraise', 'Raise $1,000 for a local cause', 3, first);
  const events = b.ladder('events', first, v => `Organise ${v} community events`, ['5', '10', '25', '50', '100', '500'], [3, 8],
    { name: 'Events organised', extend: true });
  const big = b.feat('event-500', 'Organise an event for 500 people', 5, events.at('10'));
  b.feat('festival', 'Start a festival that runs every year', 7, big);
  const meeting = b.feat('town-meeting', 'Go to a local council or town meeting', 1);
  const speak = b.feat('speak-council', 'Speak at a local council meeting', 2, meeting);
  b.feat('committee', 'Serve on a local board or committee', 4, speak);
  b.feat('local-change', 'Win a change for your neighbourhood', 5, speak);
  const join = b.feat('join-club', 'Join a club or local group', 0);
  const role = b.feat('club-role', 'Take on a role in a club, like treasurer', 3, join);
  const found = b.feat('found-club', 'Found a club that meets for a year', 4, role);
  b.ladder('clubs', found, v => `Found ${v} groups that last a year`, ['2', '3', '5', '10'], [5, 8], { name: 'Clubs founded', extend: true });
  b.feat('club-100', 'Grow a club to 100 members', 6, found);
  const outlives = b.feat('club-outlives', 'Found a group that outlives your time leading it', 7, found);
  b.feat('movement', 'Start a movement that spreads to 100 towns', 9, outlives);
}

// ── Hosting ──
{
  const b = branch('bonds', 'Hosting');
  b.guide({
    how: 'Hosts start small (coffee, a simple dinner), then host more often and for more people, and turn the best gatherings into traditions that run for years.',
    stops: 'Waiting until the home, the cooking or the timing feels perfect.',
  });
  const coffee = b.feat('coffee', 'Invite someone over for coffee', 0);
  const dinner = b.feat('dinner', 'Cook dinner for friends at your place', 1, coffee);
  b.ladder('dinners', dinner, v => `Host ${v} dinners`, ['5', '10', '25', '50', '100', '250', '500'], [1, 7],
    { name: 'Dinners hosted', extend: true, ask: 'Dinners you have hosted (rough)', hint: '6' });
  b.feat('mixers', 'Host a dinner where guests meet for the first time', 3, dinner);
  b.feat('surprise', 'Throw a surprise party that stays a surprise', 3, dinner);
  b.feat('holiday', 'Host a holiday meal for your family', 3, dinner);
  const twelve = b.feat('twelve', 'Host a dinner for 12', 3, dinner);
  b.feat('weekend', 'Host a weekend away for a group', 4, twelve);
  const fifty = b.feat('fifty', 'Host a party for 50 people', 4, twelve);
  const wedding = b.feat('celebration', 'Host a wedding or big celebration', 6, fifty);
  b.feat('feast-500', 'Feed 500 people at one gathering', 8, wedding);
  const night = b.feat('regular-night', 'Start a regular game or supper night', 2, dinner);
  const nightYear = b.feat('regular-year', 'Keep a regular night going for a year', 4, night);
  b.feat('regular-decade', 'Keep a regular night going for 10 years', 7, nightYear);
  const salon = b.feat('salon', 'Run a salon or talk night people ask to join', 6, nightYear);
  b.feat('world-table', 'Host gatherings people cross the world to attend', 9, salon);
  const tradition = b.feat('tradition', 'Start a yearly tradition with friends or family', 2, dinner);
  const t5 = b.feat('tradition-5', 'Keep a tradition going for 5 years', 4, tradition);
  const t25 = b.feat('tradition-25', 'Keep a tradition going for 25 years', 7, t5);
  b.feat('tradition-passed', 'Pass a tradition on to the next generation', 8, t25);
  const stay = b.feat('overnight', 'Have a guest stay the night', 1, coffee);
  b.feat('traveller', 'Host a traveller from another country', 3, stay);
  const month = b.feat('host-month', 'Host someone who needs a place for a month', 5, stay);
  b.feat('refuge', 'Open your home to someone fleeing danger', 7, month);
  b.feat('welcome-new', 'Welcome someone new into your friend group', 2, coffee);
}

// ── Networking ──
{
  const b = branch('bonds', 'Networking');
  b.guide({
    how: 'A network grows from meeting people, following up, and helping before asking. Over years, the introductions you make for others become the reason people take your call.',
    stops: 'Only reaching out when you need something, so contacts go cold.',
  });
  const hello = b.feat('introduce-self', 'Introduce yourself to someone new at an event', 0);
  const follow = b.feat('follow-up', 'Follow up with someone you met within a week', 0, hello);
  const contacts = b.ladder('contacts', follow, v => `Have ${v} people who'd take your call`, ['10', '25', '50', '100', '250', '500', '1,000'], [1, 7],
    { name: 'People you can call', extend: true });
  const countries = b.feat('ten-countries', 'Have people you can call in 10 countries', 6, contacts.at('100'));
  b.feat('fifty-countries', 'Build a network that spans 50 countries', 9, countries);
  const coffee = b.feat('coffee-chat', 'Ask someone you admire for a coffee chat', 1, follow);
  b.feat('coffee-12', 'Have a coffee chat every month for a year', 3, coffee);
  const senior = b.feat('reply', 'Get a reply from someone far more senior', 2, coffee);
  b.feat('hero', 'Meet someone you\'ve admired for years', 4, senior);
  const intro = b.feat('introduce', 'Introduce two people who should know each other', 1, hello);
  const intros = b.ladder('intros', intro, v => `Make ${v} introductions that helped`, ['10', '25', '50', '100', '1,000'], [2, 7],
    { name: 'Introductions made', extend: true });
  b.feat('connector', 'Be known as the person who knows everyone', 6, intros.at('50'));
  const job = b.feat('intro-job', 'Make an introduction that lands someone a job', 3, intro);
  b.feat('intro-business', 'Introduce two people who start something together', 5, job);
  b.feat('intro-couple', 'Introduce a couple who end up together', 4, intro);
  b.feat('give-first', 'Help 10 people without asking for anything back', 3, intro);
  const alone = b.feat('event-alone', 'Go to an event where you know nobody', 1, hello);
  const ten = b.feat('ten-new', 'Meet 10 new people at one event', 2, alone);
  const meetup = b.feat('host-meetup', 'Host a meetup for people in your field', 4, ten);
  const hundred = b.feat('meetup-100', 'Grow a meetup to 100 regulars', 6, meetup);
  b.feat('gathering', 'Found a gathering that shapes an industry', 8, hundred);
}
