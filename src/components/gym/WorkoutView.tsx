import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, Check, ChevronRight, Dumbbell, Minus, MoreHorizontal, Pencil, Play, Plus, Trash2, TrendingUp, X, Footprints } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveWorkout, activeWorkoutActions, workoutActions } from '@/hooks/useWorkouts';
import { useWeeklyPlan } from '@/hooks/useWeeklyPlan';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { stores, generateId, type WorkoutTemplate } from '@/lib/storage';
import { dateKeyOf, dayOfWeek } from '@/lib/dates';
import { getExerciseHistory, getProgressionSuggestion } from '@/lib/progressive-overload';
import { getExerciseLabel, isBodyweightExercise, type CustomExercise, type ExerciseConfig, type WorkoutSession } from '@/types/workout';
import { RowMenu } from '@/components/app/RowMenu';
import { ListRow } from '@/components/app/ListRow';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SmartNudges } from '@/components/today/SmartNudges';
import { ExercisePicker } from './ExercisePicker';
import { ExerciseSheet } from './ExerciseSheet';
import { RestTimer } from './RestTimer';
import { SessionSummarySheet } from './SessionSummarySheet';
import { CardioSheet } from './CardioSheet';
import { buildSummary, type SessionSummary } from '@/lib/gym-stats';
import { SessionSheet } from './SessionSheet';
import { count, fmtLb, sessionVolume, splitLabel } from '@/lib/gym-format';

const SPLITS = ['push', 'pull', 'legs', 'upper', 'lower'];
const GRADIENT = 'linear-gradient(135deg, hsl(152 76% 38%) 0%, hsl(178 80% 34%) 100%)';
const REST_GRADIENT = 'linear-gradient(135deg, hsl(220 30% 46%) 0%, hsl(250 30% 52%) 100%)';

const target = (c?: ExerciseConfig, bodyweight = false) =>
  c ? `${c.targetSets} × ${c.repRangeMin}–${c.repRangeMax}${bodyweight ? (c.currentWeight ? ` · +${c.currentWeight} lb` : '') : ` · ${c.currentWeight} lb`}` : '';

function useElapsed(startedAt?: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return '';
  const mins = Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function WorkoutView({ customExercises, sessions, configs, onGoToProgram }: {
  customExercises: CustomExercise[];
  sessions: WorkoutSession[];
  configs: ExerciseConfig[];
  onGoToProgram: () => void;
}) {
  const active = useActiveWorkout();
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  return (
    <>
      {active
        ? <ActiveWorkout customExercises={customExercises} sessions={sessions} configs={configs} onFinished={setSummary} />
        : <WorkoutHome customExercises={customExercises} sessions={sessions} configs={configs} onGoToProgram={onGoToProgram} />}
      <SessionSummarySheet summary={summary} onClose={() => setSummary(null)} />
    </>
  );
}

// ─── Not training yet: today's workout, saved workouts, recent ───

function WorkoutHome({ customExercises, sessions, configs, onGoToProgram }: {
  customExercises: CustomExercise[]; sessions: WorkoutSession[]; configs: ExerciseConfig[]; onGoToProgram: () => void;
}) {
  const today = useTodayKey();
  const { days } = useWeeklyPlan();
  const hasPlan = useStore(stores.WEEKLY_PLAN) !== null;
  const templates = useStore(stores.TEMPLATES);
  const [openSession, setOpenSession] = useState<WorkoutSession | null>(null);
  const [cardioOpen, setCardioOpen] = useState(false);
  const todayIdx = (dayOfWeek(today) + 6) % 7;
  const plan = hasPlan ? days[todayIdx] : null;
  const sorted = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date)), [sessions]);
  const doneToday = sorted.filter(s => dateKeyOf(s.date) === today);
  const label = (id: string) => getExerciseLabel(id, customExercises);
  const weekday = new Date().toLocaleDateString(undefined, { weekday: 'long' });

  const startPlan = () => {
    if (!plan) return;
    activeWorkoutActions.load(plan.splitDay, []);
    plan.exercises.forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
  };
  const startEmpty = () => activeWorkoutActions.load(plan && plan.splitDay !== 'rest' ? plan.splitDay : 'push', []);
  const startTemplate = (t: WorkoutTemplate) => {
    activeWorkoutActions.load(t.splitDay, t.exercises.map(e => {
      const c = configs.find(x => x.exercise === e.exercise);
      return { exercise: e.exercise, sets: Array.from({ length: e.sets }, () => ({ reps: e.reps || c?.repRangeMin || 8, weight: c?.currentWeight ?? e.weight, rpe: 3 })) };
    }));
  };
  const deleteTemplate = (t: WorkoutTemplate) => {
    stores.TEMPLATES.update(prev => prev.filter(x => x.id !== t.id));
    toast.success('Saved workout deleted', { action: { label: 'Undo', onClick: () => stores.TEMPLATES.update(prev => (prev.some(x => x.id === t.id) ? prev : [...prev, t])) } });
  };

  const heroBtn = 'pressable flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-headline';

  let hero: React.ReactNode;
  if (doneToday.length > 0) {
    const s = doneToday[0];
    hero = (
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: GRADIENT }}>
        <p className="text-footnote font-semibold uppercase tracking-wide text-white/80">Today · done</p>
        <h2 className="mt-1 flex items-center gap-2 text-[30px] font-bold leading-tight tracking-tight"><Check className="h-7 w-7" strokeWidth={3} /> {splitLabel(s.splitDay)} day logged</h2>
        <p className="mt-1 text-body text-white/85">{count(s.exercises.length, 'exercise')} · {fmtLb(sessionVolume(s))} lb moved</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={() => setOpenSession(s)} className={`${heroBtn} flex-1 bg-white text-neutral-900`}>See workout</button>
          <button type="button" onClick={startEmpty} className={`${heroBtn} bg-white/20`}>Another</button>
        </div>
      </div>
    );
  } else if (!plan) {
    hero = (
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: GRADIENT }}>
        <Dumbbell className="h-8 w-8" />
        <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-tight">Plan your training week.</h2>
        <p className="mt-1 text-body text-white/85">Pick what you train each day and TELOS sets up every workout — and raises the weights as you get stronger.</p>
        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onGoToProgram} className={`${heroBtn} flex-1 bg-white text-neutral-900`}>Plan my week</button>
          <button type="button" onClick={startEmpty} className={`${heroBtn} bg-white/20`}>Just lift</button>
        </div>
      </div>
    );
  } else if (plan.splitDay === 'rest') {
    hero = (
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: REST_GRADIENT }}>
        <p className="text-footnote font-semibold uppercase tracking-wide text-white/80">{weekday}</p>
        <h2 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">Rest day</h2>
        <p className="mt-1 text-body text-white/85">Recovery is where you get stronger. Walk, stretch, sleep well.</p>
        <button type="button" onClick={startEmpty} className={`${heroBtn} mt-5 w-full bg-white/20`}>Train anyway</button>
      </div>
    );
  } else {
    hero = (
      <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: GRADIENT }}>
        <p className="text-footnote font-semibold uppercase tracking-wide text-white/80">Today · {weekday}</p>
        <h2 className="mt-1 text-[32px] font-bold leading-tight tracking-tight">{splitLabel(plan.splitDay)} day</h2>
        {plan.exercises.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {plan.exercises.map(ex => (
              <li key={ex} className="flex items-baseline justify-between gap-3 text-body">
                <span className="truncate font-semibold">{label(ex)}</span>
                <span className="shrink-0 tabular-nums text-white/80">{target(configs.find(c => c.exercise === ex), isBodyweightExercise(ex, customExercises))}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body text-white/85">No exercises planned yet — add them as you go, or set them in Program.</p>
        )}
        <button type="button" onClick={plan.exercises.length ? startPlan : startEmpty} className={`${heroBtn} mt-5 w-full bg-white text-neutral-900`}>
          <Play className="h-4 w-4 fill-current" /> Start workout
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {hero}
      <SmartNudges today={today} kinds={['deload', 'fatigue']} />

      <section className="space-y-2">
        <h2 className="section-label">Saved workouts</h2>
        <div className="list-group">
          {templates.map(t => (
            <ListRow
              key={t.id}
              onClick={() => startTemplate(t)}
              title={t.name}
              subtitle={`${splitLabel(t.splitDay)} · ${t.exercises.map(e => label(e.exercise)).join(', ')}`}
              trailing={<>
                <span className="rounded-full bg-move/10 px-3 py-1 text-footnote font-semibold text-move">Start</span>
                <RowMenu label={`Actions for ${t.name}`} items={[{ label: 'Delete', icon: Trash2, destructive: true, onSelect: () => deleteTemplate(t) }]} />
              </>}
            />
          ))}
          <ListRow onClick={startEmpty} leading={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary"><Plus className="h-4 w-4" /></span>} title="Empty workout" subtitle={templates.length ? undefined : 'Tip: save a workout while logging to reuse it here'} />
          <ListRow onClick={() => setCardioOpen(true)} leading={<span className="flex h-8 w-8 items-center justify-center rounded-full bg-move/10 text-move"><Footprints className="h-4 w-4" /></span>} title="Log a run or cardio" subtitle="Distance, time and pace" />
        </div>
      </section>

      {sorted.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">Recent</h2>
          <div className="list-group">
            {sorted.slice(0, 3).map(s => (
              <ListRow key={s.id} chevron onClick={() => setOpenSession(s)}
                title={`${splitLabel(s.splitDay)} day`}
                subtitle={`${new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${count(s.exercises.length, 'exercise')} · ${fmtLb(sessionVolume(s))} lb`} />
            ))}
          </div>
        </section>
      )}

      <SessionSheet session={openSession} customExercises={customExercises} onClose={() => setOpenSession(null)} />
      <CardioSheet open={cardioOpen} onClose={() => setCardioOpen(false)} />
    </div>
  );
}

// ─── Logging ───

function ActiveWorkout({ customExercises, sessions, configs, onFinished }: {
  customExercises: CustomExercise[]; sessions: WorkoutSession[]; configs: ExerciseConfig[]; onFinished: (s: SessionSummary) => void;
}) {
  const w = useActiveWorkout()!;
  const elapsed = useElapsed(w.startedAt);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editExercise, setEditExercise] = useState<string | null>(null);
  const [saveName, setSaveName] = useState<string | null>(null);
  const label = (id: string) => getExerciseLabel(id, customExercises);
  const setCount = w.exercises.reduce((n, e) => n + e.sets.length, 0);

  const finish = () => {
    if (w.exercises.length === 0 || setCount === 0) { toast.error('Add at least one set first'); return; }
    const before = stores.SESSIONS.get();
    const configsBefore = stores.EXERCISE_CONFIGS.get();
    const session = activeWorkoutActions.finish(customExercises, { quiet: true });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (session) onFinished(buildSummary(session, before, configsBefore, stores.EXERCISE_CONFIGS.get(), customExercises, w.startedAt));
  };
  const discard = () => {
    const draft = w;
    activeWorkoutActions.discard();
    toast('Workout discarded', { action: { label: 'Undo', onClick: () => stores.ACTIVE_WORKOUT.set(draft) } });
  };
  const saveTemplate = () => {
    const name = (saveName ?? '').trim();
    if (!name) return;
    const t: WorkoutTemplate = {
      id: generateId(), name, splitDay: w.splitDay,
      exercises: w.exercises.map(e => ({ exercise: e.exercise, sets: e.sets.length, weight: e.sets[0]?.weight || 0, reps: e.sets[0]?.reps || 0 })),
    };
    stores.TEMPLATES.update(prev => [...prev, t]);
    setSaveName(null);
    toast.success(`Saved “${name}”`);
  };

  return (
    <div className="space-y-4">
      {/* Session header */}
      <div className="flex items-center gap-3 rounded-[24px] p-4 text-white" style={{ background: GRADIENT }}>
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
        </span>
        <div className="min-w-0 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 text-title">
              {splitLabel(w.splitDay)} day <ChevronRight className="h-4 w-4 rotate-90 opacity-80" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {SPLITS.map(s => <DropdownMenuItem key={s} className="h-10 text-body" onSelect={() => activeWorkoutActions.setSplitDay(s)}>{splitLabel(s)}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-footnote text-white/85">{elapsed || 'Just started'} · {count(w.exercises.length, 'exercise')} · {count(setCount, 'set')}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="Workout options" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"><MoreHorizontal className="h-5 w-5" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[12rem]">
            <DropdownMenuItem className="h-10 gap-2 text-body" onSelect={() => setSaveName('')}><Bookmark className="h-4 w-4" /> Save as a workout</DropdownMenuItem>
            <DropdownMenuItem className="h-10 gap-2 text-body text-destructive focus:text-destructive" onSelect={discard}><Trash2 className="h-4 w-4" /> Discard workout</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {w.exercises.map(ex => {
        const bw = isBodyweightExercise(ex.exercise, customExercises);
        const config = configs.find(c => c.exercise === ex.exercise);
        const suggestion = config ? getProgressionSuggestion(config, getExerciseHistory(sessions, ex.exercise), { bodyweight: bw }) : null;
        const canDeload = !!suggestion && (suggestion.type === 'deload' || suggestion.type === 'fatigue_warning')
          && suggestion.suggestedWeight !== undefined && !!config && suggestion.suggestedWeight < config.currentWeight;
        const tone = suggestion?.type === 'increase_weight' || suggestion?.type === 'increase_reps' ? 'text-move'
          : suggestion?.type === 'deload' ? 'text-destructive' : suggestion?.type === 'fatigue_warning' ? 'text-warning' : 'text-muted-foreground';
        const Icon = suggestion?.type === 'increase_weight' || suggestion?.type === 'increase_reps' ? ArrowUp
          : suggestion?.type === 'deload' ? ArrowDown : suggestion?.type === 'fatigue_warning' ? TrendingUp : Minus;

        return (
          <section key={ex.id} className="surface overflow-hidden">
            <div className="flex items-start gap-2 px-4 pt-3.5">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-headline">{label(ex.exercise)}</h3>
                {suggestion && (
                  <p className={`mt-0.5 text-footnote ${tone}`}>
                    <Icon className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />{suggestion.message.replace(/\s*\(e1RM[^)]*\)/i, '')}
                    {canDeload && (
                      <button type="button" className="ml-1.5 font-semibold underline underline-offset-2" onClick={() => {
                        workoutActions.applyDeload(ex.exercise, suggestion.suggestedWeight!);
                        ex.sets.forEach((_, i) => activeWorkoutActions.updateSet(ex.id, i, 'weight', suggestion.suggestedWeight!));
                        toast.success(`${label(ex.exercise)} set to ${suggestion.suggestedWeight} lb`);
                      }}>Apply</button>
                    )}
                  </p>
                )}
              </div>
              <RowMenu label={`Actions for ${label(ex.exercise)}`} items={[
                { label: 'Targets & settings', icon: Pencil, onSelect: () => setEditExercise(ex.exercise) },
                { label: 'Remove from workout', icon: Trash2, destructive: true, separated: true, onSelect: () => activeWorkoutActions.removeExercise(ex.id) },
              ]} />
            </div>

            <div className="mt-2 grid grid-cols-[28px_1fr_1fr_60px_32px] items-center gap-2 px-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Set</span><span className="text-center">{bw ? '+ lb' : 'lb'}</span><span className="text-center">Reps</span><span className="text-center">Effort</span><span />
            </div>
            <div className="mt-1 space-y-1.5 px-4">
              {ex.sets.map((s, i) => (
                <div key={i} className="grid grid-cols-[28px_1fr_1fr_60px_32px] items-center gap-2">
                  <span className="text-headline text-move">{i + 1}</span>
                  <input type="number" inputMode="decimal" aria-label={`Set ${i + 1} weight`} value={s.weight || ''} placeholder="0"
                    onChange={e => activeWorkoutActions.updateSet(ex.id, i, 'weight', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="h-11 w-full rounded-xl bg-secondary text-center text-headline tabular-nums outline-none focus:ring-2 focus:ring-move/50" />
                  <input type="number" inputMode="numeric" aria-label={`Set ${i + 1} reps`} value={s.reps || ''} placeholder="0"
                    onChange={e => activeWorkoutActions.updateSet(ex.id, i, 'reps', e.target.value === '' ? 0 : Number(e.target.value))}
                    className="h-11 w-full rounded-xl bg-secondary text-center text-headline tabular-nums outline-none focus:ring-2 focus:ring-move/50" />
                  {/* Shows just the number; the phone's picker shows what each level means. */}
                  <label className="relative flex h-11 items-center justify-center rounded-xl bg-secondary text-headline tabular-nums focus-within:ring-2 focus-within:ring-move/50">
                    {s.rpe || 3}
                    <select aria-label={`Set ${i + 1} effort`} value={s.rpe || 3} onChange={e => activeWorkoutActions.updateSet(ex.id, i, 'rpe', Number(e.target.value))}
                      className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0">
                      <option value={1}>1 — easy</option><option value={2}>2 — comfortable</option><option value={3}>3 — solid</option><option value={4}>4 — hard</option><option value={5}>5 — all-out</option>
                    </select>
                  </label>
                  <button type="button" aria-label={`Remove set ${i + 1}`} onClick={() => activeWorkoutActions.removeSet(ex.id, i)} className="flex h-11 items-center justify-center text-muted-foreground/70">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => activeWorkoutActions.addSet(ex.id)} className="mt-2 flex h-12 w-full items-center justify-center gap-1.5 border-t border-border/70 text-body font-semibold text-move">
              <Plus className="h-4 w-4" /> Add set
            </button>
          </section>
        );
      })}

      <button type="button" onClick={() => setPickerOpen(true)} className="pressable flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-move/40 text-headline text-move">
        <Plus className="h-5 w-5" /> Add exercise
      </button>

      {w.exercises.length > 0 && (
        <Textarea value={w.notes} onChange={e => activeWorkoutActions.setNotes(e.target.value)} placeholder="Notes — how did it feel?" className="min-h-[72px] rounded-2xl border-0 bg-card text-body shadow-[0_0_0_1px_hsl(var(--border)/0.7)]" />
      )}
      {w.exercises.length > 0 && <p className="px-1 text-footnote text-muted-foreground">Effort: 1 = easy, 3 = solid, 5 = nothing left. Tap Finish and TELOS plans your next session.</p>}

      {/* Always-reachable rest timer + finish, just above the tab bar */}
      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 -mx-1 flex gap-2 rounded-[22px] bg-background/85 p-1 backdrop-blur-xl md:bottom-4">
        <RestTimer />
        <Button onClick={finish} className="h-12 flex-1 rounded-2xl bg-move text-headline text-white hover:bg-move/90">Finish workout</Button>
      </div>

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} customExercises={customExercises}
        exclude={w.exercises.map(e => e.exercise)} onPick={id => activeWorkoutActions.addExercise(id, customExercises)} onCreateCustom={() => setCreateOpen(true)} />
      <ExerciseSheet open={createOpen} exerciseId={null} onClose={() => setCreateOpen(false)} onCreated={id => activeWorkoutActions.addExercise(id)} />
      <ExerciseSheet open={!!editExercise} exerciseId={editExercise} onClose={() => setEditExercise(null)} />

      <Dialog open={saveName !== null} onOpenChange={o => !o && setSaveName(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-title">Save this workout</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); saveTemplate(); }}>
            <Input autoFocus value={saveName ?? ''} onChange={e => setSaveName(e.target.value)} placeholder="Name, e.g. Push A" className="h-12 rounded-xl text-body" />
            <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold" disabled={!saveName?.trim()}>Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
