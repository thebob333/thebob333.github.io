import { addDays, dateKeyOf, daysBetween, todayKey } from '@/lib/dates';
import { useEffect, useState } from 'react';
import { useGoals } from '@/hooks/useGoals';
import { useHabits } from '@/hooks/useHabits';
import { generateId } from '@/lib/storage';
import { Goal, calculateGoalProgress, calculatePhaseProgress, calculateTaskProgress, deriveTaskStatus, getDaysRemaining, getUrgencyClass, getUrgencyColor } from '@/types/goals';
import { getCurrentStreak, isHabitCompletedOn, getTodayKey } from '@/lib/habits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/app/ResponsiveDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, ChevronDown, ChevronRight, Trash2, Target, Copy, Sparkles, Clock, Upload, FileText, AlertCircle, Repeat, ToggleLeft, Flame, CheckCircle2, MessageSquare, Send, Bookmark, Archive, CalendarDays, ArrowUp, ArrowDown, Trophy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { ProgressRing } from '@/components/ProgressRing';
import { WeeklyFocus, FocusStar } from '@/components/WeeklyFocus';
import { PageHeader } from '@/components/app/PageHeader';
import { useSearchParams } from 'react-router-dom';
import { RowMenu } from '@/components/app/RowMenu';
import { RoundCheck } from '@/components/app/RoundCheck';
import { EditItemDialog, type EditTarget } from '@/components/goals/EditItemDialog';
import { Pencil, CheckCircle2 as DoneIcon } from 'lucide-react';

import { parseGoalPlan, applyPlanToGoal, type ParseResult } from '@/lib/goal-plan-parser';
import { spreadPhaseDeadlines } from '@/lib/goal-tree';
import type { EffortLevel, HabitEvolution } from '@/types/goals';

const statusColors: Record<string, string> = {
  not_started: 'bg-muted text-muted-foreground',
  in_progress: 'bg-primary/10 text-primary border border-primary/20',
  complete: 'bg-teal/10 text-teal border border-teal/20',
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  complete: 'Complete',
};

function DeadlineBadge({ deadline }: { deadline?: string }) {
  const days = getDaysRemaining(deadline);
  if (days === null) return null;
  const color = getUrgencyColor(days);
  return (
    <span className={`text-xs font-medium flex items-center gap-1 ${color}`}>
      <Clock className="h-3 w-3" />
      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
    </span>
  );
}

import type { GoalDomain } from '@/types/goals';

const domainConfig: Record<GoalDomain, { label: string; color: string }> = {
  PHYSICAL: { label: 'Physical', color: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30' },
  CREATIVE: { label: 'Creative', color: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30' },
  PROFESSIONAL: { label: 'Professional', color: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30' },
  INTELLECTUAL: { label: 'Intellectual', color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
  LIFESTYLE: { label: 'Lifestyle', color: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30' },
};

function DomainBadge({ domain }: { domain?: GoalDomain }) {
  if (!domain) return null;
  const cfg = domainConfig[domain];
  return <Badge variant="outline" className={`text-[11px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>;
}

const effortColors: Record<string, string> = {
  LOW: 'bg-success',
  MED: 'bg-warning',
  HIGH: 'bg-destructive',
};

function EffortDot({ effort }: { effort?: EffortLevel }) {
  if (!effort) return null;
  return <span className={`inline-block h-2 w-2 rounded-full ${effortColors[effort]} flex-shrink-0`} title={`${effort} effort`} />;
}

const evolutionColors: Record<string, string> = {
  NEW: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  CARRY: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  INCREASE: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  REPLACE: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
};

function EvolutionTag({ evolution }: { evolution?: HabitEvolution }) {
  if (!evolution) return null;
  return <Badge variant="outline" className={`text-[11px] px-1 py-0 ${evolutionColors[evolution]}`}>{evolution}</Badge>;
}

function isDeloadTask(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes('deload') || lower.includes('recovery');
}

export default function GoalsPage() {
  const {
    goals, addGoal, updateGoal, deleteGoal,
    addPhase, deletePhase,
    addTask, deleteTask,
    addToDo, toggleToDo, deleteToDo,
    addHabit, toggleHabit, deleteHabit,
    addNote, deleteNote,
    reorderPhases, reorderTasks, reorderTodos,
    archiveGoal, cloneGoal, saveAsTemplate, createFromTemplate,
    templates, deleteTemplate, restoreGoal, updateTask,
  } = useGoals();
  const [confirmDeleteGoal, setConfirmDeleteGoal] = useState<Goal | null>(null);
  // Arriving from Today's quick add / onboarding with ?new=1 opens the New Goal sheet.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowNewGoal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  /** Do a destructive edit inside a goal, offering a 5-second Undo that restores that goal. */
  const withUndo = (goalId: string, message: string, action: () => void) => {
    const snapshot = goals.find(g => g.id === goalId);
    action();
    toast.success(message, snapshot ? { action: { label: 'Undo', onClick: () => restoreGoal(snapshot) } } : undefined);
  };
  const { logs: habitLogs, toggleCheckIn } = useHabits();
  const today = getTodayKey();

  const [showNewGoal, setShowNewGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ title: '', description: '', endGoal: '', deadline: '', domain: '' as string });
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const [addPhaseGoalId, setAddPhaseGoalId] = useState<string | null>(null);
  const [newPhase, setNewPhase] = useState({ title: '', description: '', deadline: '' });
  const [addTaskTarget, setAddTaskTarget] = useState<{ goalId: string; phaseId: string } | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', deadline: '' });
  const [addTodoTarget, setAddTodoTarget] = useState<{ goalId: string; phaseId: string; taskId: string } | null>(null);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDeadline, setNewTodoDeadline] = useState('');
  const [addHabitTarget, setAddHabitTarget] = useState<{ goalId: string; phaseId: string; taskId: string } | null>(null);
  const [newHabit, setNewHabit] = useState({ title: '', frequency: 'daily', target: '' });
  // One draft per task, so typing a note in one task doesn't show up in every other one.
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [showTemplates, setShowTemplates] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const activeGoals = goals.filter(g => !g.archived);
  const archivedGoals = goals.filter(g => g.archived);
  const [promptGoal, setPromptGoal] = useState<Goal | null>(null);
  const [aiResponseText, setAiResponseText] = useState('');
  const [parsedResult, setParsedResult] = useState<ParseResult | null>(null);
  const [promptTab, setPromptTab] = useState('prompt');

  const toggle = (set: Set<string>, id: string, setter: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleCreateGoal = () => {
    if (!newGoal.title.trim()) return;
    addGoal(newGoal.title, newGoal.description, newGoal.endGoal, newGoal.deadline || undefined, (newGoal.domain as GoalDomain) || undefined);
    setNewGoal({ title: '', description: '', endGoal: '', deadline: '', domain: '' });
    setShowNewGoal(false);
    toast.success('Goal created!');
  };

  const handleAddPhase = () => {
    if (!addPhaseGoalId || !newPhase.title.trim()) return;
    addPhase(addPhaseGoalId, newPhase.title, newPhase.description, newPhase.deadline || undefined);
    setNewPhase({ title: '', description: '', deadline: '' });
    setAddPhaseGoalId(null);
    toast.success('Phase added!');
  };

  const handleAddTask = () => {
    if (!addTaskTarget || !newTask.title.trim()) return;
    addTask(addTaskTarget.goalId, addTaskTarget.phaseId, newTask.title, newTask.description, newTask.deadline || undefined);
    setNewTask({ title: '', description: '', deadline: '' });
    setAddTaskTarget(null);
  };

  const handleAddTodo = () => {
    if (!addTodoTarget || !newTodoTitle.trim()) return;
    addToDo(addTodoTarget.goalId, addTodoTarget.phaseId, addTodoTarget.taskId, newTodoTitle, newTodoDeadline || undefined);
    setNewTodoTitle('');
    setNewTodoDeadline('');
    setAddTodoTarget(null);
  };

  const handleSpreadDeadlines = (goalId: string) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.deadline || goal.phases.length === 0) return;
    // Heavier phases (more / harder to-dos) get proportionally more time.
    const updatedPhases = spreadPhaseDeadlines(goal.phases, todayKey(), dateKeyOf(goal.deadline), addDays, daysBetween);
    if (!updatedPhases) { toast.error('The goal deadline has already passed'); return; }
    const before = goal.phases;
    updateGoal(goalId, { phases: updatedPhases });
    toast.success(`Deadlines spread across ${goal.phases.length} phases by workload`, {
      action: { label: 'Undo', onClick: () => updateGoal(goalId, { phases: before }) },
    });
  };

  const handleAddHabit = () => {
    if (!addHabitTarget || !newHabit.title.trim()) return;
    addHabit(addHabitTarget.goalId, addHabitTarget.phaseId, addHabitTarget.taskId, newHabit.title, newHabit.frequency, newHabit.target || undefined);
    setNewHabit({ title: '', frequency: 'daily', target: '' });
    setAddHabitTarget(null);
    toast.success('Habit added!');
  };

  const generateAIPrompt = (goal: Goal) => {
    const phaseList = goal.phases.length > 0
      ? goal.phases.map((p, i) => `  - Phase ${i + 1}: "${p.title}" — ${p.description}${p.deadline ? ` (deadline: ${p.deadline})` : ''}`).join('\n')
      : null;
    const today = todayKey();
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
  };

  const copyPrompt = async (goal: Goal) => {
    try {
      await navigator.clipboard.writeText(generateAIPrompt(goal));
      toast.success('AI prompt copied to clipboard!');
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  const handleParseResponse = () => {
    const result = parseGoalPlan(aiResponseText);
    setParsedResult(result);
    if (result.phases.length === 0) {
      toast.error('No phases found — check the format and try again.');
    } else if (result.warnings.length > 0) {
      toast.warning(`Parsed ${result.phases.length} phase${result.phases.length !== 1 ? 's' : ''} with ${result.warnings.length} warning${result.warnings.length !== 1 ? 's' : ''} — review before importing`);
    } else {
      toast.success(`Parsed ${result.phases.length} phase${result.phases.length !== 1 ? 's' : ''}!`);
    }
  };

  const handleBulkImport = () => {
    if (!promptGoal || !parsedResult) return;
    const goal = goals.find(g => g.id === promptGoal.id);
    if (!goal) return;
    // Merges into same-named phases/tasks and skips duplicates, so re-importing is safe.
    const { goal: merged, stats } = applyPlanToGoal(goal, parsedResult, generateId);
    updateGoal(goal.id, { phases: merged.phases, adaptationProtocol: merged.adaptationProtocol });
    const parts = [
      stats.phases && `${stats.phases} phase${stats.phases !== 1 ? 's' : ''}`,
      stats.tasks && `${stats.tasks} task${stats.tasks !== 1 ? 's' : ''}`,
      stats.todos && `${stats.todos} to-do${stats.todos !== 1 ? 's' : ''}`,
      stats.habits && `${stats.habits} habit${stats.habits !== 1 ? 's' : ''}`,
    ].filter(Boolean);
    toast.success(parts.length ? `Added ${parts.join(', ')}` : 'Nothing new to add', {
      description: stats.skipped ? `${stats.skipped} item${stats.skipped !== 1 ? 's were' : ' was'} already in this goal and skipped.` : undefined,
    });
    setParsedResult(null);
    setAiResponseText('');
    setPromptGoal(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Goals"
        subtitle={
          <>
            {activeGoals.length} goal{activeGoals.length !== 1 ? 's' : ''} active
            {archivedGoals.length > 0 && (
              <button onClick={() => setShowArchived(!showArchived)} className="ml-2 text-primary hover:underline">
                {showArchived ? 'Hide' : 'Show'} {archivedGoals.length} archived
              </button>
            )}
          </>
        }
        actions={
          <>
            {templates.length > 0 && (
              <Button variant="outline" size="icon" className="h-10 w-10 sm:w-auto sm:px-3" onClick={() => setShowTemplates(true)} aria-label="Blueprints">
                <Bookmark className="h-4 w-4 sm:mr-2" /><span className="hidden sm:inline">Blueprints</span>
              </Button>
            )}
            <Button className="h-10 font-semibold" onClick={() => setShowNewGoal(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Goal
            </Button>
          </>
        }
      />
      <Dialog open={showNewGoal} onOpenChange={setShowNewGoal}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Create New Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Goal Title</label>
              <Input value={newGoal.title} onChange={e => setNewGoal({ ...newGoal, title: e.target.value })} placeholder="e.g., Learn Spanish" className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Description</label>
              <Textarea value={newGoal.description} onChange={e => setNewGoal({ ...newGoal, description: e.target.value })} placeholder="What does this goal involve?" className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">End Goal Vision</label>
              <Textarea value={newGoal.endGoal} onChange={e => setNewGoal({ ...newGoal, endGoal: e.target.value })} placeholder="What does success look like?" className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Deadline</label>
              <Input type="date" value={newGoal.deadline} onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })} className="mt-1" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Domain (optional)</label>
              <Select value={newGoal.domain} onValueChange={v => setNewGoal({ ...newGoal, domain: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a domain" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PHYSICAL">Physical</SelectItem>
                  <SelectItem value="CREATIVE">Creative</SelectItem>
                  <SelectItem value="PROFESSIONAL">Professional</SelectItem>
                  <SelectItem value="INTELLECTUAL">Intellectual</SelectItem>
                  <SelectItem value="LIFESTYLE">Lifestyle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreateGoal} className="w-full font-semibold">Create Goal</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weekly Focus */}
      <WeeklyFocus goals={goals} />

      {/* Goals List */}
      {activeGoals.length === 0 && archivedGoals.length === 0 ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
            <Target className="h-12 w-12 text-primary/30" />
            <div className="text-center">
              <p className="text-foreground font-semibold text-lg">No goals yet</p>
              <p className="text-muted-foreground text-sm mt-1 max-w-xs mx-auto">
                Goals are broken into Phases, Tasks, and To-Dos. Start with your first goal and build from there.
              </p>
            </div>
            <Button onClick={() => setShowNewGoal(true)} className="font-semibold mt-2">
              <Plus className="h-4 w-4 mr-2" /> Create Your First Goal
            </Button>
          </CardContent>
        </Card>
      ) : activeGoals.length === 0 && !showArchived ? (
        <Card className="border-dashed border-2 border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-10 space-y-3 text-center">
            <Archive className="h-10 w-10 text-primary/30" />
            <p className="text-foreground font-semibold">All your goals are archived</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowArchived(true)}>Show archived</Button>
              <Button onClick={() => setShowNewGoal(true)} className="font-semibold"><Plus className="h-4 w-4 mr-1" /> New goal</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        [...activeGoals, ...(showArchived ? archivedGoals : [])].map((goal) => {
          const progress = calculateGoalProgress(goal);
          const isExpanded = expandedGoals.has(goal.id);
          const goalDays = getDaysRemaining(goal.deadline);
          return (
            <Card key={goal.id} className={`shadow-sm ${getUrgencyClass(goalDays)} ${goal.archived ? 'opacity-60' : ''}`}>
              <Collapsible open={isExpanded} onOpenChange={() => toggle(expandedGoals, goal.id, setExpandedGoals)}>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-5 w-5 text-primary" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                        <div>
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{goal.title}</CardTitle>
                            <DomainBadge domain={goal.domain} />
                            <FocusStar goalId={goal.id} goals={goals} />
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-sm text-muted-foreground">{goal.description}</p>
                            <DeadlineBadge deadline={goal.deadline} />
                          </div>
                        </div>
                      </div>
                      <ProgressRing value={progress} size={48} strokeWidth={4} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    <div className="h-px bg-border" />
                    {/* End Goal */}
                    <div className="p-3 rounded-lg bg-accent/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-medium">End Goal Vision</p>
                      <p className="text-sm">{goal.endGoal}</p>
                    </div>

                    {/* Adaptation Protocol */}
                    {goal.adaptationProtocol && (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-accent/30 transition-colors">
                            <Info className="h-4 w-4 text-info" />
                            <span className="text-xs font-semibold text-info uppercase tracking-wider">Adaptation Protocol</span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid gap-2 ml-6 mt-1">
                            <div className="p-2.5 rounded-md bg-success/5 border border-success/20">
                              <p className="text-[11px] font-semibold text-success uppercase tracking-wider mb-0.5">If Ahead</p>
                              <p className="text-xs text-foreground/80">{goal.adaptationProtocol.ahead}</p>
                            </div>
                            <div className="p-2.5 rounded-md bg-warning/5 border border-warning/20">
                              <p className="text-[11px] font-semibold text-warning uppercase tracking-wider mb-0.5">If Behind</p>
                              <p className="text-xs text-foreground/80">{goal.adaptationProtocol.behind}</p>
                            </div>
                            <div className="p-2.5 rounded-md bg-destructive/5 border border-destructive/20">
                              <p className="text-[11px] font-semibold text-destructive uppercase tracking-wider mb-0.5">If Blocked</p>
                              <p className="text-xs text-foreground/80">{goal.adaptationProtocol.blocked}</p>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="h-10 min-w-0 flex-1 px-3 sm:flex-none" onClick={() => setAddPhaseGoalId(goal.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Add phase
                      </Button>
                      <Button variant="outline" className="h-10 min-w-0 flex-1 px-3 sm:flex-none" onClick={() => { setPromptGoal(goal); }}>
                        <Sparkles className="h-4 w-4 mr-1" /> Plan with AI
                      </Button>
                      <RowMenu
                        label={`More actions for ${goal.title}`}
                        className="ml-auto border"
                        items={[
                          { label: 'Edit goal', icon: Pencil, onSelect: () => setEditTarget({ kind: 'goal', goal }) },
                          ...(goal.deadline ? [{ label: 'Spread deadlines', icon: CalendarDays, onSelect: () => handleSpreadDeadlines(goal.id) }] : []),
                          { label: 'Duplicate goal', icon: Copy, onSelect: () => { cloneGoal(goal.id); toast.success('Goal duplicated'); } },
                          { label: 'Save as blueprint', icon: Bookmark, onSelect: () => { saveAsTemplate(goal.id); toast.success('Saved as a blueprint', { description: 'Reuse it any time from Blueprints.' }); } },
                          { label: goal.archived ? 'Restore goal' : 'Archive goal', icon: Archive, separated: true, onSelect: () => {
                            archiveGoal(goal.id);
                            toast.success(goal.archived ? 'Goal restored' : 'Goal archived', { action: { label: 'Undo', onClick: () => archiveGoal(goal.id) } });
                          } },
                          { label: 'Delete goal…', icon: Trash2, destructive: true, onSelect: () => setConfirmDeleteGoal(goal) },
                        ]}
                      />
                    </div>

                    {/* Phases */}
                    {goal.phases.map((phase, phaseIdx) => {
                      const phaseProgress = calculatePhaseProgress(phase);
                      const phaseExpanded = expandedPhases.has(phase.id);
                      return (
                        <div key={phase.id}>
                        <Collapsible open={phaseExpanded} onOpenChange={() => toggle(expandedPhases, phase.id, setExpandedPhases)}>
                          <div className="ml-1 border-l-2 border-primary/20 pl-2 sm:ml-4 sm:pl-4">
                            <CollapsibleTrigger asChild>
                              <div className="flex items-center justify-between gap-2 cursor-pointer hover:bg-accent/30 p-1.5 rounded-lg transition-colors">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  {phaseExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                  <span className="font-semibold">{phase.title}</span>
                                  <ProgressRing value={phaseProgress} size={28} strokeWidth={2.5} />
                                  <DeadlineBadge deadline={phase.deadline} />
                                </div>
                                <RowMenu
                                  label={`Actions for phase ${phase.title}`}
                                  items={[
                                    { label: 'Add task', icon: Plus, onSelect: () => setAddTaskTarget({ goalId: goal.id, phaseId: phase.id }) },
                                    { label: 'Edit phase', icon: Pencil, onSelect: () => setEditTarget({ kind: 'phase', goalId: goal.id, phase }) },
                                    { label: 'Move up', icon: ArrowUp, disabled: phaseIdx === 0, onSelect: () => reorderPhases(goal.id, phase.id, 'up') },
                                    { label: 'Move down', icon: ArrowDown, disabled: phaseIdx === goal.phases.length - 1, onSelect: () => reorderPhases(goal.id, phase.id, 'down') },
                                    { label: 'Delete phase', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo(goal.id, `Deleted phase "${phase.title}"`, () => deletePhase(goal.id, phase.id)) },
                                  ]}
                                />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {phase.tasks.map(task => {
                                const taskProgress = calculateTaskProgress(task);
                                const status = deriveTaskStatus(task);
                                const taskExpanded = expandedTasks.has(task.id);
                                return (
                                  <Collapsible key={task.id} open={taskExpanded} onOpenChange={() => toggle(expandedTasks, task.id, setExpandedTasks)}>
                                    <div className={`ml-1 border-l pl-2 mt-2 sm:ml-4 sm:pl-3 ${isDeloadTask(task.title) ? 'border-success/40' : 'border-border'}`}>
                                      <CollapsibleTrigger asChild>
                                        <div className={`flex items-center justify-between gap-2 cursor-pointer p-1.5 rounded-lg transition-colors ${isDeloadTask(task.title) ? 'bg-success/5 hover:bg-success/10' : 'hover:bg-accent/20'}`}>
                                          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                            {taskExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                            <span className={`text-sm ${isDeloadTask(task.title) ? 'text-success' : ''}`}>{task.title}</span>
                                            <Badge className={`text-xs ${statusColors[status]}`}>{statusLabels[status]} {taskProgress}%</Badge>
                                            <DeadlineBadge deadline={task.deadline} />
                                          </div>
                                          <RowMenu
                                            label={`Actions for task ${task.title}`}
                                            items={[
                                              ...(task.todos.length === 0 ? [{
                                                label: task.status === 'complete' ? 'Mark not done' : 'Mark done',
                                                icon: DoneIcon,
                                                onSelect: () => {
                                                  const next = task.status === 'complete' ? 'not_started' as const : 'complete' as const;
                                                  updateTask(goal.id, phase.id, task.id, { status: next });
                                                  toast.success(next === 'complete' ? `Done: ${task.title}` : 'Marked not done', { action: { label: 'Undo', onClick: () => updateTask(goal.id, phase.id, task.id, { status: task.status }) } });
                                                },
                                              }] : []),
                                              { label: 'Edit task', icon: Pencil, onSelect: () => setEditTarget({ kind: 'task', goalId: goal.id, phaseId: phase.id, task }) },
                                              { label: 'Add to-do', icon: Plus, separated: true, onSelect: () => setAddTodoTarget({ goalId: goal.id, phaseId: phase.id, taskId: task.id }) },
                                              { label: 'Add habit', icon: Repeat, onSelect: () => setAddHabitTarget({ goalId: goal.id, phaseId: phase.id, taskId: task.id }) },
                                              { label: 'Move up', icon: ArrowUp, separated: true, onSelect: () => reorderTasks(goal.id, phase.id, task.id, 'up') },
                                              { label: 'Move down', icon: ArrowDown, onSelect: () => reorderTasks(goal.id, phase.id, task.id, 'down') },
                                              { label: 'Delete task', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo(goal.id, `Deleted task "${task.title}"`, () => deleteTask(goal.id, phase.id, task.id)) },
                                            ]}
                                          />
                                        </div>
                                      </CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="ml-2 mt-1 space-y-0.5 sm:ml-5">
                                          {/* To-Dos */}
                                          {task.todos.map((todo, todoIdx) => (
                                            <div key={todo.id} className={`flex items-center gap-1 ${todo.isBenchmark ? 'bg-warning/5 rounded-md px-1.5 -mx-1.5' : ''}`}>
                                              <RoundCheck
                                                checked={todo.done}
                                                label={todo.title}
                                                onToggle={() => toggleToDo(goal.id, phase.id, task.id, todo.id)}
                                              />
                                              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
                                                {todo.isBenchmark && <Trophy className="h-3.5 w-3.5 text-warning flex-shrink-0" />}
                                                <EffortDot effort={todo.effort} />
                                                <span className={`text-sm ${todo.done ? 'line-through text-muted-foreground' : ''} ${todo.isBenchmark ? 'font-medium' : ''}`}>{todo.title}</span>
                                                <DeadlineBadge deadline={todo.deadline} />
                                              </div>
                                              <RowMenu
                                                label={`Actions for ${todo.title}`}
                                                items={[
                                                  { label: 'Edit to-do', icon: Pencil, onSelect: () => setEditTarget({ kind: 'todo', goalId: goal.id, phaseId: phase.id, taskId: task.id, todo }) },
                                                  { label: 'Move up', icon: ArrowUp, separated: true, disabled: todoIdx === 0, onSelect: () => reorderTodos(goal.id, phase.id, task.id, todo.id, 'up') },
                                                  { label: 'Move down', icon: ArrowDown, disabled: todoIdx === task.todos.length - 1, onSelect: () => reorderTodos(goal.id, phase.id, task.id, todo.id, 'down') },
                                                  { label: 'Delete to-do', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo(goal.id, 'To-do deleted', () => deleteToDo(goal.id, phase.id, task.id, todo.id)) },
                                                ]}
                                              />
                                            </div>
                                          ))}
                                          {task.todos.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">No to-dos yet</p>
                                          )}

                                          {/* Habits */}
                                          {(task.habits || []).length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-border/50">
                                              <p className="text-[11px] text-amber uppercase tracking-widest font-semibold mb-1 flex items-center gap-1">
                                                <Repeat className="h-3 w-3" /> Habits & Regimens
                                              </p>
                                              {(task.habits || []).map(habit => {
                                                const completed = isHabitCompletedOn(habit.id, today, habitLogs);
                                                const streak = getCurrentStreak(habit.id, habitLogs);
                                                return (
                                                <div key={habit.id} className="flex items-center gap-1">
                                                  {habit.active ? (
                                                    <RoundCheck checked={completed} label={habit.title} tone="habit" onToggle={() => toggleCheckIn(habit.id)} />
                                                  ) : (
                                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground" title="Paused">
                                                      <ToggleLeft className="h-4 w-4" />
                                                    </span>
                                                  )}
                                                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
                                                  <span className={`text-sm ${completed ? 'text-muted-foreground' : ''} ${!habit.active ? 'line-through text-muted-foreground' : ''}`}>{habit.title}</span>
                                                  <Badge variant="outline" className="text-[11px] px-1.5 py-0 bg-amber/10 border-amber/30 text-amber">{habit.frequency}</Badge>
                                                  {habit.target && <span className="text-[11px] text-muted-foreground">{habit.target}</span>}
                                                  <EvolutionTag evolution={habit.evolution} />
                                                  {streak > 0 && habit.active && (
                                                    <span className="text-[11px] font-medium text-amber flex items-center gap-0.5">
                                                      <Flame className="h-3 w-3" />{streak}d
                                                    </span>
                                                  )}
                                                  </div>
                                                  <RowMenu
                                                    label={`Actions for habit ${habit.title}`}
                                                    items={[
                                                      { label: 'Edit habit', icon: Pencil, onSelect: () => setEditTarget({ kind: 'habit', goalId: goal.id, phaseId: phase.id, taskId: task.id, habit }) },
                                                      { label: habit.active ? 'Pause habit' : 'Resume habit', icon: ToggleLeft, onSelect: () => toggleHabit(goal.id, phase.id, task.id, habit.id) },
                                                      { label: 'Delete habit', icon: Trash2, destructive: true, separated: true, onSelect: () => withUndo(goal.id, 'Habit deleted', () => deleteHabit(goal.id, phase.id, task.id, habit.id)) },
                                                    ]}
                                                  />
                                                </div>
                                                );
                                              })}
                                            </div>
                                          )}

                                          {/* Notes / Journal */}
                                          <div className="mt-2 pt-2 border-t border-border/50">
                                            <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold mb-1 flex items-center gap-1">
                                              <MessageSquare className="h-3 w-3" /> Notes
                                            </p>
                                            {(task.notes || []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(note => (
                                              <div key={note.id} className="flex items-start gap-2 group py-1">
                                                <div className="flex-1">
                                                  <p className="text-sm">{note.text}</p>
                                                  <p className="text-[11px] text-muted-foreground">
                                                    {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                  </p>
                                                </div>
                                                <RowMenu
                                                  label="Note actions"
                                                  items={[{ label: 'Delete note', icon: Trash2, destructive: true, onSelect: () => withUndo(goal.id, 'Note deleted', () => deleteNote(goal.id, phase.id, task.id, note.id)) }]}
                                                />
                                              </div>
                                            ))}
                                            <div className="flex gap-1 mt-1">
                                              <Input
                                                placeholder="Add a note..."
                                                value={noteDrafts[task.id] ?? ''}
                                                onChange={e => setNoteDrafts(d => ({ ...d, [task.id]: e.target.value }))}
                                                className="h-10 text-sm"
                                                enterKeyHint="send"
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter' && (noteDrafts[task.id] ?? '').trim()) {
                                                    addNote(goal.id, phase.id, task.id, noteDrafts[task.id].trim());
                                                    setNoteDrafts(d => ({ ...d, [task.id]: '' }));
                                                  }
                                                }}
                                              />
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-10 w-10 p-0"
                                                aria-label="Add note"
                                                disabled={!(noteDrafts[task.id] ?? '').trim()}
                                                onClick={() => {
                                                  if ((noteDrafts[task.id] ?? '').trim()) {
                                                    addNote(goal.id, phase.id, task.id, noteDrafts[task.id].trim());
                                                    setNoteDrafts(d => ({ ...d, [task.id]: '' }));
                                                  }
                                                }}
                                              >
                                                <Send className="h-3 w-3" />
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </CollapsibleContent>
                                    </div>
                                  </Collapsible>
                                );
                              })}
                              {phase.tasks.length === 0 && (
                                <p className="text-xs text-muted-foreground italic ml-4 mt-2">No tasks yet</p>
                              )}
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                        {phaseIdx < goal.phases.length - 1 && (
                          <div className="h-px bg-border/50 ml-4 my-1" />
                        )}
                        </div>
                      );
                    })}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })
      )}

      {/* Add Phase Dialog */}
      <Dialog open={!!addPhaseGoalId} onOpenChange={() => setAddPhaseGoalId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-bold">Add Phase</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Phase title" value={newPhase.title} onChange={e => setNewPhase({ ...newPhase, title: e.target.value })} />
            <Textarea placeholder="Description" value={newPhase.description} onChange={e => setNewPhase({ ...newPhase, description: e.target.value })} />
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Deadline</label>
              <Input type="date" value={newPhase.deadline} onChange={e => setNewPhase({ ...newPhase, deadline: e.target.value })} className="mt-1" />
            </div>
            <Button onClick={handleAddPhase} className="w-full font-semibold">Add Phase</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={!!addTaskTarget} onOpenChange={() => setAddTaskTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-bold">Add Task</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Task title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} />
            <Textarea placeholder="Description" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} />
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Deadline</label>
              <Input type="date" value={newTask.deadline} onChange={e => setNewTask({ ...newTask, deadline: e.target.value })} className="mt-1" />
            </div>
            <Button onClick={handleAddTask} className="w-full font-semibold">Add Task</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Todo Dialog */}
      <Dialog open={!!addTodoTarget} onOpenChange={() => setAddTodoTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-bold">Add To-Do</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="To-do item" value={newTodoTitle} onChange={e => setNewTodoTitle(e.target.value)} />
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Deadline (optional)</label>
              <Input type="date" value={newTodoDeadline} onChange={e => setNewTodoDeadline(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleAddTodo} className="w-full font-semibold">Add To-Do</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Habit Dialog */}
      <Dialog open={!!addHabitTarget} onOpenChange={() => setAddHabitTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Repeat className="h-5 w-5 text-amber" /> Add Habit
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Habit</label>
              <Input placeholder="e.g., Eat 200g protein" value={newHabit.title} onChange={e => setNewHabit({ ...newHabit, title: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Frequency</label>
                <Input placeholder="e.g., daily, 3x/week" value={newHabit.frequency} onChange={e => setNewHabit({ ...newHabit, frequency: e.target.value })} className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Target (optional)</label>
                <Input placeholder="e.g., 200g, 30 min" value={newHabit.target} onChange={e => setNewHabit({ ...newHabit, target: e.target.value })} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleAddHabit} className="w-full font-semibold">Add Habit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Prompt Dialog */}
      <Dialog open={!!promptGoal} onOpenChange={(open) => { if (!open) { setPromptGoal(null); setParsedResult(null); setAiResponseText(''); setPromptTab('prompt'); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">AI Goal Builder</DialogTitle>
          </DialogHeader>
          {promptGoal && (
            <Tabs value={promptTab} onValueChange={setPromptTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full">
                <TabsTrigger value="prompt" className="flex-1 gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> 1. Copy Prompt
                </TabsTrigger>
                <TabsTrigger value="import" className="flex-1 gap-1.5">
                  <Upload className="h-3.5 w-3.5" /> 2. Import Response
                </TabsTrigger>
              </TabsList>

              <TabsContent value="prompt" className="flex-1 overflow-auto space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Copy this prompt → paste into ChatGPT / Claude / Gemini → copy the response → switch to Import tab.
                </p>
                <div className="bg-accent/50 p-4 rounded-lg whitespace-pre-wrap max-h-72 overflow-auto font-mono text-xs">
                  {generateAIPrompt(promptGoal)}
                </div>
                <Button onClick={() => copyPrompt(promptGoal)} className="w-full font-semibold">
                  <Copy className="h-4 w-4 mr-2" /> Copy Prompt
                </Button>
              </TabsContent>

              <TabsContent value="import" className="flex-1 overflow-auto space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Paste the AI's response below. It should follow the PHASE / TASK / TODO format.
                </p>
                <Textarea
                  value={aiResponseText}
                  onChange={e => setAiResponseText(e.target.value)}
                  placeholder={`PHASE: Foundation | Research and planning | 2026-04-15\n  TASK: Research competitors | Analyze top 5 | 2026-04-01\n    TODO: List features | 2026-03-20\n    TODO: Write comparison | 2026-03-25`}
                  className="font-mono text-xs min-h-[120px]"
                />
                <Button
                  onClick={handleParseResponse}
                  disabled={!aiResponseText.trim()}
                  variant="outline"
                  className="w-full"
                >
                  Parse Response
                </Button>

                {parsedResult && parsedResult.warnings.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
                    {parsedResult.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3 flex-shrink-0" /> {w}
                      </p>
                    ))}
                  </div>
                )}

                {parsedResult && parsedResult.phases.length > 0 && (
                  <div className="bg-accent/30 rounded-lg p-3 space-y-3 max-h-60 overflow-auto">
                    <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Preview</p>
                    {parsedResult.phases.map((phase, pi) => (
                      <div key={pi} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-primary">▸ {phase.title}</span>
                          <Badge variant="outline" className="text-xs">{phase.deadline}</Badge>
                        </div>
                        {phase.tasks.map((task, ti) => (
                          <div key={ti} className="ml-4 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-teal font-medium">▸ {task.title}</span>
                              <span className="text-xs text-muted-foreground">{task.deadline}</span>
                            </div>
                            {task.todos.map((todo, tdi) => (
                              <div key={tdi} className="ml-4 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">☐ {todo.title}</span>
                                <span className="text-xs text-muted-foreground/60">{todo.deadline}</span>
                              </div>
                            ))}
                            {(task.habits || []).map((habit, hi) => (
                              <div key={`h${hi}`} className="ml-4 flex items-center gap-2">
                                <Repeat className="h-3 w-3 text-amber" />
                                <span className="text-xs text-amber">{habit.title}</span>
                                <span className="text-xs text-muted-foreground">{habit.frequency}</span>
                                {habit.target && <span className="text-xs text-muted-foreground/60">{habit.target}</span>}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {parsedResult && parsedResult.phases.length > 0 && (
                  <Button
                    onClick={handleBulkImport}
                    className="w-full font-semibold"
                    variant={parsedResult.warnings.length > 0 ? 'outline' : 'default'}
                  >
                    {parsedResult.warnings.length > 0
                      ? <AlertCircle className="h-4 w-4 mr-2 text-destructive" />
                      : <Upload className="h-4 w-4 mr-2" />
                    }
                    {parsedResult.warnings.length > 0 ? 'Import Anyway' : 'Import All'} — {parsedResult.phases.length} phases, {parsedResult.phases.reduce((s, p) => s + p.tasks.length, 0)} tasks, {parsedResult.phases.reduce((s, p) => s + p.tasks.reduce((s2, t) => s2 + t.todos.length, 0), 0)} todos, {parsedResult.phases.reduce((s, p) => s + p.tasks.reduce((s2, t) => s2 + (t.habits || []).length, 0), 0)} habits
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <EditItemDialog target={editTarget} onClose={() => setEditTarget(null)} />

      {/* Delete goal confirmation */}
      <Dialog open={!!confirmDeleteGoal} onOpenChange={o => !o && setConfirmDeleteGoal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{confirmDeleteGoal?.title}”?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the goal with all its phases, tasks, to-dos and habits. You can undo for a few seconds afterwards.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setConfirmDeleteGoal(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="h-11 flex-1 font-semibold"
              onClick={() => {
                const g = confirmDeleteGoal;
                setConfirmDeleteGoal(null);
                if (!g) return;
                deleteGoal(g.id);
                toast.success('Goal deleted', { action: { label: 'Undo', onClick: () => restoreGoal(g) } });
              }}
            >
              Delete goal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Templates Dialog */}
      <Dialog open={showTemplates} onOpenChange={setShowTemplates}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Bookmark className="h-5 w-5 text-violet" /> Goal Blueprints
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2 max-h-[60vh] overflow-auto">
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No blueprints yet. Save a goal as a blueprint to reuse its plan.</p>
            ) : (
              templates.map(tmpl => (
                <div key={tmpl.id} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{tmpl.name}</p>
                      <p className="text-xs text-muted-foreground">{tmpl.phases.length} phases, {tmpl.phases.reduce((s, p) => s + p.tasks.length, 0)} tasks</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => {
                        createFromTemplate(tmpl);
                        setShowTemplates(false);
                        toast.success('Goal created from blueprint!');
                      }}>
                        <Plus className="h-3 w-3 mr-1" /> Use
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                        deleteTemplate(tmpl.id);
                        toast.success('Blueprint deleted');
                      }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
