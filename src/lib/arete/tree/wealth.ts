/**
 * Wealth expansion: new disciplines, deeper lines and discipline guides.
 * Written with ./dsl.ts. Ids are permanent once shipped.
 *
 * Money stations are milestones, never advice: nothing here tells anyone what to buy.
 */
import { branch } from './dsl';

// Stations from core.ts used as anchors.
const money = (id: string) => `wealth.money.${id}`;
const career = (id: string) => `wealth.career.${id}`;
const business = (id: string) => `wealth.business.${id}`;

// ── Money (deeper) ──
{
  const b = branch('wealth', 'Money');
  b.guide({
    how: 'Most people start by tracking spending and building a small cushion, then clear expensive debt and save a steady share of every paycheck. Wealth comes from that habit held for decades more than from any single move.',
    stops: 'Spending that rises with every raise, so the gap that builds wealth never opens.',
  });
  b.ladder('savings-rate', money('budget-3'), v => `Save ${v} of your income for a year`, ['10%', '20%', '30%', '50%', '70%'], [2, 6],
    { name: 'Savings rate', ask: 'Share of your income you save (%)', hint: '10' });
  b.feat('will', 'Write a will', 1);
  b.feat('cushion-24', 'Save two years of living costs', 6, money('cushion@12-months'));
  b.feat('fi-half', 'Have investments that cover half your costs', 6, money('net-worth@250k'));
  b.feat('fi-40', 'Reach financial independence before 40', 9, money('fi'));
}

// ── Career (deeper) ──
{
  const b = branch('wealth', 'Career');
  b.guide({
    how: 'Careers usually grow by doing the job well, taking on a bit more than asked, and then leading projects and people. Each move up comes from trust built in the role before it.',
    stops: 'Waiting to be noticed instead of asking for the next step.',
  });
  b.ladder('promotions', career('raise'), v => `Earn ${v} promotions`, ['2', '3', '5', '8'], [3, 6], { name: 'Promotions', extend: true });
  const cert = b.feat('cert', 'Earn a professional certification', 2, career('job'));
  b.feat('certs-3', 'Hold three professional certifications', 4, cert);
  b.feat('licence', 'Earn a licence to practise a profession', 5, cert, 'For example medicine, law, engineering or a skilled trade.');
  b.feat('board', 'Sit on a company board', 8, career('executive'));
}

// ── Business (deeper) ──
{
  const b = branch('wealth', 'Business');
  b.guide({
    how: 'Most businesses start as one person selling one thing to a few customers, then grow by keeping those customers happy and finding more like them. Hiring comes after the work outgrows you.',
    stops: 'Building for months without asking anyone to pay.',
  });
  b.ladder('customers', business('first-dollar'), v => `Serve ${v} paying customers`, ['100', '1,000', '10,000', '100,000', '1M'], [3, 9],
    { name: 'Customers', extend: true });
  const launch = b.feat('launch', 'Launch a product people pay for', 2, business('first-dollar'));
  b.ladder('launched', launch, v => `Launch ${v} products`, ['3', '10', '25'], [4, 7], { name: 'Products launched', extend: true });
  const profit = b.feat('profit-year', 'Run a business at a profit for a full year', 4, business('register'));
  b.feat('decade', 'Keep a business going for 10 years', 6, profit);
}

// ── Investing ──
{
  const b = branch('wealth', 'Investing');
  b.guide({
    how: 'People usually learn the basics first (compound growth, fees, risk), start small with money they won\'t need for years, then mostly keep adding and wait. Understanding grows faster than the money does at first.',
    stops: 'Selling in a panic when markets fall, or chasing whatever just went up.',
  });
  const compound = b.feat('compound', 'Explain compound growth in your own words', 0);
  const index = b.feat('index-funds', 'Explain how an index fund works', 0, compound);
  const fees = b.feat('fees', 'Find the fees on everything you invest in', 1, index);
  const real = b.feat('real-returns', 'Explain returns after inflation and fees', 2, fees);
  const value = b.feat('valuation', 'Value a company from its annual report', 4, real);
  const angel = b.feat('angel', 'Back a private startup as an early investor', 5, value);
  const fund = b.feat('fund', 'Run an investment fund for others', 7, value);
  const billion = b.feat('fund-billion', 'Manage $1 billion for others', 9, fund);
  const risk = b.feat('risk', 'Write down how big a loss you could live with', 1, compound);
  b.feat('scam', 'Spot and walk away from an investment scam', 1, risk);
  const plan = b.feat('plan', 'Write an investing plan with your own rules', 2, risk);
  b.feat('hold-fall', 'Stick to your plan through a 20% market fall', 4, plan);
  const record = b.feat('track-record', 'Track your real returns honestly for 5 years', 4, plan);
  b.feat('legend', 'Beat the market for 30 years, on the record', 10, [billion, record]);
  const account = b.feat('account', 'Open an investment or retirement account', 1, index);
  b.ladder('portfolio', account, v => `Grow your investments to ${v}`, ['$1k', '$10k', '$100k', '$1M', '$10M'], [1, 8], { name: 'Portfolio', extend: true });
  b.ladder('years', account, v => `Stay invested for ${v} year${v === '1' ? '' : 's'}`, ['1', '5', '10', '20', '40'], [1, 7],
    { name: 'Years invested', ask: 'Years you have been investing', hint: '2' });
  b.ladder('income', account, v => `Earn ${v} a year from your investments`, ['$100', '$1k', '$10k', '$100k', '$1M'], [1, 9],
    { name: 'Investment income', extend: true });
}

// ── Real estate ──
{
  const b = branch('wealth', 'Real estate');
  b.guide({
    how: 'Most people learn how leases and mortgages work, save a deposit, buy one property and learn to run it well before adding more. Every unit after the first is easier.',
    stops: 'Saving the first deposit, and the fear of taking on a large loan.',
  });
  const mortgage = b.feat('mortgage', 'Explain how a mortgage works', 0);
  const tour = b.feat('tour-10', 'Tour 10 properties and compare them', 1, mortgage);
  const market = b.feat('market', 'Track prices in one neighbourhood for a year', 2, tour);
  const licence = b.feat('licence', 'Earn a real-estate licence', 3, market);
  b.feat('agent-25', 'Help 25 families buy or sell a home', 6, licence);
  const inspect = b.feat('inspection', 'Read a full home inspection report', 1, tour);
  const reno = b.feat('renovate', 'Renovate a property and add to its value', 4, inspect);
  b.feat('flip', 'Buy, fix up and sell a property at a profit', 5, reno);
  const build = b.feat('build', 'Build a house from the ground up', 7, reno);
  const develop = b.feat('develop', 'Develop a building with 10 or more homes', 8, build);
  b.feat('tower', 'Develop a tower that changes a skyline', 9, develop);
  const deposit = b.feat('deposit', 'Save a deposit for a property', 3, mortgage);
  const land = b.feat('land', 'Own a piece of land', 4, deposit);
  b.feat('farm', 'Own a working farm or forest', 7, land);
  const rental = b.feat('first-rental', 'Own your first rental property', 5, deposit);
  const units = b.ladder('units', rental, v => `Own ${v} rental units`, ['2', '5', '10', '25', '50', '100', '1,000'], [5, 9],
    { name: 'Rental units', extend: true });
  b.feat('commercial', 'Own a commercial property', 7, units.at('5'));
  const flow = b.feat('cash-flow', 'Earn positive cash flow from a rental for a year', 5, rental);
  b.ladder('rent', flow, v => `Earn ${v} a month in rent after costs`, ['$500', '$2k', '$5k', '$20k', '$100k'], [5, 9],
    { name: 'Rental income', extend: true });
}

// ── Sales and negotiation ──
{
  const b = branch('wealth', 'Sales and negotiation');
  b.guide({
    how: 'People get better by doing many small sales and negotiations, hearing no often, and learning to ask and listen before they pitch. Bigger deals follow trust and a track record.',
    stops: 'Fear of rejection: most people stop asking after the first few noes.',
  });
  b.feat('sell-own', 'Sell something you own to a stranger', 0);
  const pitch = b.feat('pitch', 'Pitch an idea in under a minute', 0);
  const cold = b.feat('cold-50', 'Make 50 cold calls or emails in a day', 2, pitch);
  b.feat('noes-100', 'Hear no 100 times and keep asking', 3, cold);
  const close = b.feat('first-close', 'Close a sale for your work', 1, pitch);
  const deals = b.ladder('deals', close, v => `Close ${v} deals`, ['10', '50', '100', '500', '1,000'], [2, 7], { name: 'Deals closed', extend: true });
  b.ladder('biggest', close, v => `Close a single deal worth ${v}`, ['$1k', '$10k', '$100k', '$1M', '$10M', '$100M', '$1B'], [2, 10],
    { name: 'Biggest deal', extend: true });
  const target = b.feat('target-year', 'Hit your sales target four quarters running', 4, deals.at('50'));
  const top = b.feat('top-seller', 'Be the top seller on your team for a year', 5, target);
  b.feat('sales-team', 'Build and lead a sales team', 6, top);
  const haggle = b.feat('haggle', 'Haggle a better price at a market', 0);
  b.feat('lower-bill', 'Negotiate a lower bill by phone', 1, haggle);
  const limit = b.feat('walk-away-point', 'Set your walk-away point before you negotiate', 1, haggle);
  const walk = b.feat('walk-away', 'Walk away from a deal that wasn\'t right', 2, limit);
  b.feat('both-glad', 'Settle a dispute so both sides leave glad', 3, walk);
  const contract = b.feat('contract', 'Negotiate the terms of a contract yourself', 4, walk);
  const multi = b.feat('multi-party', 'Negotiate a deal between three or more parties', 6, contract);
  b.feat('merger', 'Negotiate a merger between two companies', 8, multi);
  b.feat('peace', 'Help broker a peace agreement', 10, multi);
}

// ── Craft of work ──
{
  const b = branch('wealth', 'Craft of work');
  b.guide({
    how: 'Skill at work grows through deliberate practice with honest feedback, then by going deep on one speciality and finally teaching it. Credentials mark the way, but the work is the proof.',
    stops: 'Settling at good enough and repeating the same year of work instead of stretching.',
  });
  const list = b.feat('skill-list', 'List the skills your work needs most', 0);
  const feedback = b.feat('feedback', 'Ask for honest feedback on your work', 0, list);
  b.feat('mentor', 'Find a mentor in your field', 2, feedback);
  b.ladder('hours', list, v => `Practise your craft for ${v} hours`, ['100', '1,000', '2,500', '5,000', '10,000', '20,000'], [1, 7],
    { name: 'Hours of practice', extend: true });
  const course = b.feat('course', 'Finish a course that makes you better at your job', 1, list);
  const tool = b.feat('new-tool', 'Learn a new tool that changes how you work', 1, course);
  b.feat('reskill', 'Learn a whole new skill set mid-career', 5, tool);
  b.ladder('skills', course, v => `Have ${v} skills people would pay you for`, ['2', '3', '5', '10'], [2, 6], { name: 'Paid skills', extend: true });
  const apprentice = b.feat('apprentice', 'Finish an apprenticeship or training programme', 3, course);
  const qualified = b.feat('qualified', 'Become fully qualified in a trade or profession', 4, apprentice);
  const master = b.feat('master', 'Earn master status in your trade or craft', 6, qualified, 'For example a master electrician, chef or carpenter.');
  const deep = b.feat('speciality', 'Go deep on one speciality for a year', 3, course);
  const hard = b.feat('hard-problem', 'Solve a problem at work nobody else could', 4, deep);
  const advise = b.feat('advise', 'Be paid to advise others in your speciality', 5, hard);
  const port = b.feat('portfolio', 'Build a portfolio of your best work', 2, course);
  const award = b.feat('award', 'Win an award from your profession', 5, port);
  b.feat('top-honour', 'Win your field\'s highest honour', 9, award);
  const teach = b.feat('teach', 'Teach your craft to a beginner', 3, port);
  const ten = b.feat('train-10', 'Train 10 people who now do the job well', 5, teach);
  b.feat('school', 'Found a school or programme for your craft', 8, ten);
  const manual = b.feat('write-guide', 'Write the guide others in your field learn from', 7, teach);
  b.feat('new-method', 'Invent a method your whole field adopts', 9, manual);
}

// ── Side income ──
{
  const b = branch('wealth', 'Side income');
  b.guide({
    how: 'Most side income starts with one small paid job or one thing you made, then grows by repeating what sold and adding a second stream. Products that sell while you sleep usually come after services that sell your time.',
    stops: 'Running out of time and energy after the day job, so the project stalls before its first sale.',
  });
  const ideas = b.feat('ideas', 'List three ways you could earn on the side', 0);
  const gig = b.feat('gig', 'Finish a paid gig or freelance job', 1, ideas);
  const side = b.ladder('monthly', gig, v => `Earn ${v} a month on the side`, ['$100', '$500', '$1k', '$2.5k', '$5k', '$10k', '$25k'], [1, 7],
    { name: 'Side income', extend: true });
  const year = b.feat('every-month', 'Earn side income every month for a year', 3, gig);
  b.feat('full-time', 'Turn your side income into your full-time work', 6, [year, side.at('$5k')]);
  const bill = b.feat('pay-bill', 'Pay a monthly bill from side income alone', 2, gig);
  b.feat('pay-home', 'Cover your rent or mortgage from side income', 5, bill);
  b.ladder('streams', gig, v => `Run ${v} income streams at once`, ['2', '3', '5', '7'], [2, 6], { name: 'Income streams', extend: true });
  const tutor = b.feat('tutor', 'Teach or tutor someone for money', 1, ideas);
  const made = b.feat('sell-made', 'Sell something you made', 1, ideas);
  const shop = b.feat('online-shop', 'Open an online shop', 2, made);
  b.feat('reviews-50', 'Earn 50 five-star reviews from buyers', 4, shop);
  const digital = b.feat('digital', 'Sell a digital product you made', 2, made);
  b.feat('digital-100', 'Sell 100 copies of a digital product', 4, digital);
  b.feat('workshop', 'Sell a course or workshop you teach', 4, digital);
  b.ladder('subscribers', digital, v => `Have ${v} paying subscribers`, ['10', '100', '1,000', '10,000', '100,000'], [2, 9],
    { name: 'Subscribers', extend: true });
}
