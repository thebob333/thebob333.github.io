/**
 * The prompt for "Plan with AI": paste it into ChatGPT / Claude / Gemini and
 * paste the reply back — `parseGoalPlan` turns the reply into phases, tasks,
 * to-dos and habits.
 */
import type { Goal } from '@/types/goals';
import { todayKey } from '@/lib/dates';

export function buildGoalPrompt(goal: Goal, today: string = todayKey()): string {
    const phaseList = goal.phases.length > 0
      ? goal.phases.map((p, i) => `  - Phase ${i + 1}: "${p.title}" — ${p.description}${p.deadline ? ` (deadline: ${p.deadline})` : ''}`).join('\n')
      : null;
    const deadline = goal.deadline || '(no deadline set)';

    return `You are an expert project planner, systems designer, and skill coach.

Your job is to convert goals into structured execution plans with realistic progression and atomic actions.

The plan must be practical, logically ordered, and deeply thought out.

GOAL: "${goal.title}"
DESCRIPTION: ${goal.description}
END GOAL VISION: ${goal.endGoal}
TODAY'S DATE: ${today}
DEADLINE: ${deadline}

EXISTING PHASES:
${phaseList || `  - Phase 1: "Foundation" — Research, planning, and initial setup — lay the groundwork.
  - Phase 2: "Development" — Build core skills, systems, and habits — do the main work.
  - Phase 3: "Refinement" — Optimize, iterate, and fix gaps — sharpen what you've built.
  - Phase 4: "Mastery" — Sustain, teach, and push limits — own the outcome.`}

═══════════════════════════════════════
STEP 0 — GOAL CLASSIFICATION
═══════════════════════════════════════

Before asking any questions, classify the goal into one of these domains:

- PHYSICAL (fitness, sport, body composition, endurance, martial arts)
- CREATIVE (music, art, writing, design, content creation)
- PROFESSIONAL (career, business, certifications, income)
- INTELLECTUAL (learning, languages, academic, technical skills)
- LIFESTYLE (habits, relationships, finance, organization, wellness)

This classification determines:
1. Which intake questions to ask (Step 1)
2. How to weight phase durations (Step 2)
3. Which support pillars to include (nutrition, recovery, tools, etc.)
4. What benchmark checkpoints look like

State the classification before asking questions.

═══════════════════════════════════════
STEP 1 — DOMAIN-SPECIFIC INFORMATION GATHERING
═══════════════════════════════════════

Ask questions tailored to the goal's domain. Do NOT ask generic filler questions. Every question must directly impact plan design.

ALWAYS ASK (all domains):
- Current skill level or experience with this specific goal
- Available time per week (be specific: hours per day, days per week)
- Hard constraints (injuries, budget limits, schedule locks, family obligations)
- Ambition level: casual, serious, or elite-level pursuit
- Access to coaching, mentorship, or community

PHYSICAL DOMAIN — also ask:
- Current baseline numbers (distances, times, weights, body metrics)
- Injury history and current physical limitations
- Access to facilities (gym, pool, track, open water, etc.)
- Equipment owned vs. needed
- Current nutrition habits (rough protein intake, meal frequency)
- Sleep quality and average hours
- Prior training history (years, sports, consistency)

CREATIVE DOMAIN — also ask:
- Current portfolio or body of work (even if informal)
- Tools/software/instruments owned
- Inspiration sources or target style
- Whether output is for personal satisfaction or public/commercial use

PROFESSIONAL DOMAIN — also ask:
- Current role and years of experience
- Target role, income, or milestone
- Industry and market conditions
- Existing network or connections
- Certifications or credentials needed

INTELLECTUAL DOMAIN — also ask:
- Learning style preference (reading, video, hands-on, tutored)
- Prior attempts at this or related topics
- Available learning resources (courses, books, subscriptions)
- Whether there's a formal assessment (exam, certification, portfolio)

LIFESTYLE DOMAIN — also ask:
- What triggered this goal now
- Prior attempts and why they failed
- Support system (partner, friends, accountability)
- Environmental factors (living situation, work schedule)

Wait for the user's answers before continuing.
Do NOT generate the plan yet.

═══════════════════════════════════════
STEP 2 — PLAN DESIGN
═══════════════════════════════════════

After receiving answers, generate the full plan.

PHASE WEIGHTING — Phases do NOT need to be equal length. Weight them based on the goal domain:
- PHYSICAL goals: Foundation 15%, Development 50%, Refinement 25%, Mastery 10%
- CREATIVE goals: Foundation 10%, Development 40%, Refinement 35%, Mastery 15%
- PROFESSIONAL goals: Foundation 20%, Development 35%, Refinement 30%, Mastery 15%
- INTELLECTUAL goals: Foundation 15%, Development 45%, Refinement 25%, Mastery 15%
- LIFESTYLE goals: Foundation 20%, Development 40%, Refinement 25%, Mastery 15%

Adjust based on experience level — beginners need longer Foundation, advanced users can compress it.

PROGRESSION MODEL:
1. Understanding / knowledge
2. Prerequisite skills or preparation
3. Guided or assisted attempts
4. First successful completion
5. Repetition and consistency
6. Variation and adaptation
7. Performance mastery

SUPPORT PILLARS — Based on goal domain, include relevant support systems as habits:
- PHYSICAL: Nutrition, sleep, recovery/mobility, mental prep
- CREATIVE: Inspiration intake, feedback loops, tool mastery, creative rest
- PROFESSIONAL: Networking, personal branding, skill stacking, mentorship
- INTELLECTUAL: Spaced repetition, practice testing, note systems, teaching others
- LIFESTYLE: Environment design, accountability, tracking, reward systems

═══════════════════════════════════════
BENCHMARK CHECKPOINTS
═══════════════════════════════════════

Every phase must include at least ONE benchmark checkpoint — a specific test or measurement that proves progress. Benchmarks are formatted as TODOs that start with "Benchmark —".

Examples:
- PHYSICAL: "Benchmark — Complete a timed 5K run, target sub-30 minutes"
- CREATIVE: "Benchmark — Record and share a 60-second performance clip for peer feedback"
- PROFESSIONAL: "Benchmark — Complete a mock interview and score 7+/10 on rubric"

═══════════════════════════════════════
RECOVERY AND ADAPTATION PROTOCOL
═══════════════════════════════════════

PHYSICAL GOALS — Include deload/recovery periods every 3-4 weeks as a TASK with reduced-intensity TODOs.

ALL GOALS — Include an adaptation note at the end:
- IF AHEAD OF SCHEDULE: Guidance on how to compress or add stretch goals
- IF BEHIND SCHEDULE: Which tasks to prioritize and which to cut
- IF INJURED/BLOCKED: Alternative actions that maintain momentum

═══════════════════════════════════════
TODO RULES
═══════════════════════════════════════

TODO items must:
- Be completable in a single uninterrupted session (5–60 minutes)
- Represent one concrete action
- NOT represent habits or ongoing routines
- Include an effort tag: [LOW], [MED], or [HIGH]

Format: TODO: Task title | YYYY-MM-DD | [EFFORT]

═══════════════════════════════════════
HABIT RULES
═══════════════════════════════════════

HABIT items represent ongoing routines tied to a task:
- Must be specific, measurable recurring actions
- Include frequency, target, and evolution marker

HABIT EVOLUTION — For each task, mark habits as:
- [NEW] — introduced for the first time
- [CARRY] — continues unchanged from previous task
- [INCREASE] — increases in volume/intensity (state new target)
- [REPLACE] — swapped for a more advanced version

Format: HABIT: title | frequency | target | [EVOLUTION]

═══════════════════════════════════════
TASK RULES
═══════════════════════════════════════

Tasks must:
- Represent measurable capability milestones
- Include numbers or clear success criteria
- Include both one-off TODOs AND ongoing HABITs

═══════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════

You MUST use this exact format:

PHASE: Phase Title | Phase description | YYYY-MM-DD
  TASK: Task Title | Task description | YYYY-MM-DD
    TODO: Todo item title | YYYY-MM-DD | [EFFORT]
    TODO: Benchmark — Description of test | YYYY-MM-DD | [HIGH]
    HABIT: Habit title | frequency | target | [EVOLUTION MARKER]
  TASK: Another Task | Description here | YYYY-MM-DD
    TODO: Another item | YYYY-MM-DD | [MED]
    HABIT: Evolved habit | daily | 45 minutes | [INCREASE from 30 min]

ADAPTATION PROTOCOL:
  IF AHEAD: [specific guidance]
  IF BEHIND: [specific guidance]
  IF BLOCKED: [specific alternative actions]

RULES:
- Lines must start with PHASE:, TASK:, TODO:, or HABIT:
- Use | (pipe) to separate fields
- TODO effort tags MUST be [LOW], [MED], or [HIGH]
- HABIT lines have 4 fields: title | frequency | target | [evolution marker]
- Benchmark TODOs start with "Benchmark —"
- Do NOT add explanations or commentary outside the format
- Output ONLY the plan followed by the ADAPTATION PROTOCOL`;
  }
