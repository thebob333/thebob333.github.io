# Project Apex: Product Blueprint

*The next version of TELOS. Written 2026-11-22 from the founder interview. This is the reference for everything we build next; update it when decisions change.*

---

## 1. Product thesis

**TELOS gets you what you want done, no matter how seemingly hard.**

Most plans don't fail because the goal was wrong or the person lacked willpower. They fail in the gap between the plan and the actual week: you slip, the plan stops matching your life, fixing it feels like more work than quitting, and the goal quietly dies.

So the core of Apex is not a planner. It's an **adaptive goal engine**:

- Any goal becomes a plan **shaped for that kind of goal**.
- The plan is treated as a hypothesis. Every week it's compared with what actually happened, and the load is reset, the way the Gym already raises or eases your weights.
- **Slipping is an adjustment, not a failure.** The plan bends instead of breaking.
- Opening the app always shows **one clear next step**.

## 2. Who it's for

- Harrison, plus a couple of friends.
- Each person has a **separate, private copy** on their own phone. No accounts, no server, no shared data.
- iPhone first, as a home-screen web app at thebob333.github.io.

## 3. What makes it different

| Typical goal / AI coach apps | TELOS (Apex) |
|---|---|
| One kind of plan for every goal | Five goal shapes, each planned and measured its own way |
| Missed tasks pile up and turn red | Nothing piles up: the plan eases off, then restarts you |
| Streaks that shame you when broken | Consistency over time ("4 of the last 5 weeks"), plus a minimum version for bad weeks |
| AI chat that sounds confident | Changes made by clear rules you can see and undo; forecasts only when your own data supports them |
| You maintain the system | The engine maintains it; you approve the big moves |

## 4. Founder decisions

**Confirmed:**
- For Harrison and a couple of friends, as separate private copies.
- Apex is the next version of TELOS.
- The main failure to beat is plan → slip → give up.
- Wants careful long-term structure *and* a plan that adapts by itself.
- Opening the app shows one clear next step.
- When you slip, the plan gets lighter automatically and the app tells you afterward, with Undo.
- Must support any goal, from tying a tie to becoming president or reaching nirvana.
- AI uses your own key, stored only on your phone, never usable by anyone else.
- Coach pushback is set per goal. Its job is to get the goal done, however hard it looks.
- **People is removed.** Today, Plan, Goals and Gym stay, and become more capable, professional and streamlined.

**Decided by Claude (delegated):**
- **The autopilot rule:** change things automatically when the change is small, can be undone, and stays inside the app. Ask first when it changes a commitment (deadline, scope, the goal itself) or touches the outside world. Always tell; always allow Undo.
- **What counts as a slip:** two planned sessions missed in a row, or under half of a week's plan, makes the next week lighter. A week or more with nothing logged triggers a restart week.
- **Five goal shapes** (section 5).
- **No invented odds.** Forecasts appear only when your own track record supports them, and always as ranges.

## 5. The five goal shapes

| Shape | Examples | What the plan looks like | How progress is measured |
|---|---|---|---|
| **Do once** | Tie a tie, renew passport | A short guided checklist, often one session | Done or not done |
| **Get better** | 5K, bench press, guitar, Spanish | Training sessions with rising targets (the Gym engine, generalised) | A number trending toward a target, plus a finish-date range |
| **Build** | Start a company, write a book | Stages (milestones) and the next few concrete steps; re-planned around what you learn | Stages reached, open questions answered, pace of progress |
| **Keep up** | Meditate, sleep by 11, call grandma | A rhythm with a target and a minimum version | Consistency over recent weeks, never streaks |
| **Become** | President, nirvana, "a great dad" | A direction: stepping stones made of the other four shapes | The things you control, plus a regular reflection |

Big goals mix shapes. "Become president" might hold a law degree (build), public speaking (get better), weekly networking (keep up) and winning a local seat (build). You can always change a goal's shape.

**Coach pushback, set per goal:**
- **Gentle:** encourages and never questions the goal.
- **Honest** (default): asks why, flags unrealistic timelines and notices avoidance; the decision is yours.
- **Relentless:** names excuses directly and keeps you on the hook.

In every mode the coach **never talks you out of a goal for being hard**. It challenges the *path* (timeline, approach, load), not your ambition.

## 6. The core experience

**Tabs: Today · Plan · Goals · Gym** (People removed). Settings stays behind the gear icon.

### Today: "what do I do now?"
- **The Now card** shows the single best next step. It's chosen by the engine, not by whatever is oldest.
- **Then:** the rest of today, short and ordered.
- **Adjustments:** calm notices of what the engine changed and why, each with Undo. Example: "Eased running to 2×/week after a busy week."
- **Weekly check-in card** on your check-in day, which takes about two minutes.
- **Restart week banner** after time away: one small step to get going again.

### Goals: "the whole picture, shaped per goal"
- A list of active goals, each with its shape, a one-line status and its next step.
- **The goal screen adapts to the shape:**
  - *Get better:* a trend chart, current load, and a finish-date range when it's earned.
  - *Build:* a path of stages with the next few steps.
  - *Keep up:* a consistency view and the minimum version.
  - *Do once:* a checklist.
  - *Become:* a compass view with stepping stones and the things you control.
- **Per-goal settings:** shape, why it matters, pushback level, deadline, minimum versions, and pause or drop.
- **Ask the coach** about any goal ("I'm stuck", "find a better approach"), with "Add to plan" buttons on the answers.

### Plan: "when does it happen?"
- The time-blocking day from 5 AM to 3 AM, with minute-precise blocks (already built).
- The engine **suggests** times for goal sessions in your free time ("Run 20 min at 7:00? ✓"). It fills automatically only what's marked automatic, and **never moves blocks you placed yourself**.

### Gym: "the flagship get-better engine"
- Keeps the current Workout / Progress / Program design.
- **Upgrades:**
  - running and cardio logging (distance, time, pace), so a 5K goal trains here
  - a session summary when you finish (records, volume versus last time, a preview of next session)
  - estimated one-rep-max trends
  - weekly volume per muscle
  - lighter weeks applied automatically under the autopilot rule
- Fitness goals in Goals link to Gym, so the gym engine and the goal engine are one system.

## 7. The intelligent systems

The rule: **predictable things are done by code; judgment is done by AI.** The week-to-week adaptation must work offline, instantly and the same way every time, so it's deterministic code. The AI handles what needs understanding: turning a goal into a plan, the weekly conversation, and getting unstuck.

### 7.1 Adaptation engine (code, offline)
Every recurring item (a "practice") has a target, a minimum version, a current level and a progression rule. Once a week, and at once after a clear slip:

| What happened | What the engine does |
|---|---|
| Hit about 90% or more of the plan, and it felt manageable | Step up one notch (more reps, minutes, sessions or weight) |
| Between 50% and 90% | Hold steady |
| Under 50%, or 2 misses in a row | Ease off one notch, never below the minimum version |
| A week or more with nothing logged | Restart week: minimum versions only, then build back up |
| Eased off 3 weeks running | Flag for the check-in: "Is this the right approach?" |

Every change goes in an **adjustments log** with the reason and an Undo. Deadlines and goal scope are never changed automatically; those are proposals.

### 7.2 Goal intake (AI)
1. You type or dictate a goal (the iPhone keyboard's mic works in any text box).
2. The coach asks **2–5 sharp questions**: fewer for small goals, more for big ones. For example: deadline, current level, time per week, what's stopped you before.
3. It returns a plan **as structured data**, not loose text. That includes:
   - the shape or shapes
   - stages
   - practices with a starting load and step size
   - one-off steps with time estimates
   - a minimum version for each practice
   - two or three if-then plans for likely obstacles ("If I miss a morning run, I'll do 10 minutes after work")
   - the first next step
4. You see a preview, edit if needed, and accept.

### 7.3 Weekly check-in (AI, about 2 minutes)
- The app prepares the facts first: planned versus done, what the engine already adjusted, and any trends or forecasts.
- The coach reviews them with you in your chosen pushback style. It asks what got in the way, turns that into an if-then plan, and proposes the bigger moves that need your yes: a new deadline, a smaller scope, a different approach, pausing or dropping.
- It ends with **this week's focus** and the first next step.

### 7.4 Pace and forecasts (code)
- **Your optimism factor:** when you log the minutes something took, the app compares that with the estimate and quietly corrects future estimates ("You usually take about 1.4× your estimate").
- **Finish-date ranges:** for *get better* goals from the trend of your metric, and for *build* goals from how fast you complete stages.
- They appear only after about 3 weeks of data, and always as a range. *Become* goals never get odds.

### 7.5 Next-step chooser (code)
It ranks today's candidates in this order:
1. something scheduled for now
2. the most important step of a goal that's falling behind
3. today's practices, at their minimum version on a heavy day
4. easy one-offs

It shows the top one on the Now card.

### 7.6 Quick capture (AI)
Type or dictate a brain dump: "ran 2 miles, need to email the lawyer Friday, bought the guitar". The coach turns it into actions (log practice, new step with a date, a note) and shows **one card to confirm**.

## 8. AI setup and security

- You create a pay-per-use account at console.anthropic.com, set a **monthly spending cap**, and create a key.
- You paste the key into **Settings → AI on your phone**. It's stored on that phone only:
  - never in the app's public code
  - never in backups
  - never sent anywhere except to Anthropic when the AI is used
- **Model:** Claude Opus 5.5, the best current model. Estimated cost for your use is **about $2–6 a month** (a weekly check-in plus a few quick captures a day), and your cap guarantees a ceiling.
- **Friends** add their own key, or use the **copy-paste fallback**: the app writes the prompt, you paste it into your own Claude app, then paste the reply back. That's the same import path, at no cost.
- **Risks, stated honestly:** someone with your unlocked phone could use the key. You can revoke it at console.anthropic.com in seconds, and the cap limits any damage.
- **Privacy:** goal data stays on the phone. When the AI helps, only the details needed for that request are sent.

## 9. Data model changes (technical)

The current tree is Goal → Phase → Task → ToDo | Habit. It evolves into:

- **Goal** gains:
  - `shape`, `why`, `pushback` (`gentle` | `honest` | `relentless`)
  - `targetDate`, `successDefinition`
  - `status` (`active` | `paused` | `achieved` | `dropped`)
  - an optional `metric` (name, unit, start, target, direction)
  - `indicators` (for *become* goals)
- **Phase** is shown as **Stage** in the interface (same type underneath).
- **Habit** becomes a **Practice** with load: `target` (count / minutes / reps per period), `minimum`, `level`, `step`, `max`, and `progression` (`auto` | `ask`).
- **ToDo** is shown as **Step**, with optional `estimateMin` / `actualMin`.
- **New stores:**
  - `metricLog` (date, value)
  - `adjustments` (goal, item, date, kind, from, to, reason, auto, undone)
  - `checkIns` (weekly records: plan versus actual, notes, decisions)
- **Device-only:** the AI key (`telos_ai_key`). It is never in `KEYS`, so it's never backed up.
- **Removed:** contacts, interactions, commitments and relationship goals (People).
- **Migration v6:** adds shapes and defaults (existing habits get targets derived from their frequency) and removes the People keys. A safety copy is taken first, as with every migration. A test covers it, per CLAUDE.md.

## 10. Design direction

Keep the current bold, simple, iPhone-style system, and push it to a more **professional and calm** standard:
- Colour means progress. Missed items are shown muted, never in alarm red.
- Every automatic change is visible, explained in one sentence, and can be undone.
- Each shape has its own clear visual: trend with a forecast band, stage path, consistency ring, checklist, compass.
- Fewer, stronger screens. The removal of People is part of the streamlining.

## 11. How we'll know it works

| Measure | Target |
|---|---|
| Goals still active 4 weeks after their first slip | Most of them |
| Weekly check-in completed | Most weeks |
| Consistency recovering in the 2 weeks after an ease-off | Yes, on average |
| Actual finish dates inside the forecast range | About 8 in 10 |
| Time from "new goal" to first next step | Under 2 minutes |
| AI cost | Under your cap, every month |
| The real test | Harrison finishes a goal of a type he's given up on before |

## 12. Build order

**Phase A: the recovery engine (no AI needed, works offline)**
1. Remove People everywhere: the tab, the person screens, Today items, Plan person links, Quick Add, sample data, backup and migration.
2. Data model v6: shapes, practices with load and minimum versions, metrics, the adjustments log, check-in records, plus the migration and tests.
3. The adaptation engine, with thorough tests: step up, hold, ease off, restart week, the 3-week flag.
4. Today: engine-chosen Now card, adjustment notices with Undo, restart-week banner.
5. Goals: shape-aware goal screens and per-goal settings (shape, why, pushback, minimum versions, pause or drop).

**Phase B: the AI coach**
1. Settings → AI: the key stored only on the phone, a usage meter, and remove/test buttons.
2. Goal intake conversation, then a structured plan, preview and import.
3. The weekly check-in conversation.
4. The copy-paste fallback for both.

**Phase C: pace, capture and Gym**
1. Optimism factor and finish-date ranges.
2. Quick capture.
3. Plan suggestions for goal sessions.
4. Gym upgrades: running and cardio, session summary, one-rep-max trends, volume per muscle, automatic lighter weeks.
5. "Ask the coach" on each goal, with "Add to plan".

**Later (the ambitious long term)**
- Research help for learning goals (the coach finds and ranks resources).
- Deeper reflection for *become* goals.
- An optional native iPhone app (widgets, Siri, Apple Health, Lock Screen).
- Optional encrypted sync between your own devices.

## 13. Risks and how we handle them

| Risk | Handling |
|---|---|
| The phone talks to Claude directly | Confirm Anthropic's browser-access support before Phase B; key on the device only; spending cap; one-tap revoke |
| All data lives on one phone | Backup files (already built), automatic safety copies, and a backup reminder |
| AI plans of uneven quality | Structured output, a preview before import, and approval for big changes; the week-to-week is handled by code, not AI |
| A goal gets the wrong shape | You can change the shape anytime; the coach explains its pick |
| Too much complexity | Five shapes, one engine, four tabs; anything new must fit one of them |
| Removing People breaks something | One clean pass across all 15 affected files, then full tests and a check of every screen |

## 14. Open assumptions to test with real use

- That weekly is the right check-in rhythm (default Sunday evening, adjustable).
- That five shapes cover every goal. We'll test with real ones: a 5K, a skill, a build project, a *become* goal.
- That "Honest" is the right default pushback.
- That the cost estimate holds in practice. A usage meter in Settings will show it.
