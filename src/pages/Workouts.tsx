import { useEffect, useMemo, useState } from 'react';
import { useWorkouts, useActiveWorkout, activeWorkoutActions, workoutActions } from '@/hooks/useWorkouts';
import { EXERCISE_LABELS, SetLog, SplitDay, CustomExercise, getExerciseLabel, isBuiltInExercise, isBodyweightExercise, EquipmentType, MuscleGroup, ALL_MUSCLE_GROUPS } from '@/types/workout';
import { getProgressionSuggestion, getExerciseHistory, getPersonalRecords, getWeeklyVolume, calculateVolumeLoad } from '@/lib/progressive-overload';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Dumbbell, TrendingUp, Trophy, Timer, Plus, Trash2, ArrowUp, ArrowDown, Minus, ChevronDown, ChevronRight, History, Save, FileText, Sparkles, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { stores, generateId, WorkoutTemplate } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { PageHeader } from '@/components/app/PageHeader';
import { WeeklySplitEditor } from '@/components/gym/WeeklySplitEditor';

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable',
  machine: 'Machine', bodyweight: 'Bodyweight', other: 'Other',
};

/** Timestamp-based so it stays accurate when the phone locks; cleans up on unmount. */
function RestTimer() {
  const [seconds, setSeconds] = useState(90);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= endsAt) {
        setEndsAt(null);
        toast.success('Rest complete — time to lift! 💪');
        navigator.vibrate?.(200);
      }
    };
    tick();
    const id = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [endsAt]);

  const running = endsAt !== null;
  const left = running ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : seconds;
  const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Timer className="h-4 w-4 text-primary" /> Rest Timer
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {[60, 90, 120, 180].map(p => (
            <Button key={p} size="sm" variant={seconds === p && !running ? 'default' : 'outline'} className="h-9 px-2.5 text-xs" disabled={running} onClick={() => setSeconds(p)}>
              {fmt(p)}
            </Button>
          ))}
          <Button size="sm" className="h-9 min-w-[72px] font-semibold tabular-nums" variant={running ? 'secondary' : 'default'} onClick={() => (running ? setEndsAt(null) : setEndsAt(Date.now() + seconds * 1000))}>
            {running ? fmt(left) : 'Start'}
          </Button>
        </div>
        {running && <p className="mt-2 text-xs text-muted-foreground">Tap the timer to stop it.</p>}
      </CardContent>
    </Card>
  );
}

export default function WorkoutsPage() {
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const activeCustom = useMemo(() => customExercises.filter(e => !e.archived), [customExercises]);
  const { sessions, configs, deleteSession, updateConfig, addConfig } = useWorkouts(customExercises);
  const isBodyweight = (id: string) => isBodyweightExercise(id, customExercises);
  const prs = useMemo(() => getPersonalRecords(sessions, id => isBodyweightExercise(id, customExercises)), [sessions, customExercises]);
  const weeklyVolume = useMemo(() => getWeeklyVolume(sessions), [sessions]);

  // Includes archived exercises so old sessions keep their names.
  const label = (id: string) => getExerciseLabel(id, customExercises);

  // Combined exercise options: built-in + active custom
  const allExerciseOptions: { id: string; label: string }[] = [
    ...Object.entries(EXERCISE_LABELS).map(([id, name]) => ({ id, label: name })),
    ...activeCustom.map(e => ({ id: e.id, label: e.name })),
  ];

  // Custom exercise management
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showAIConfig, setShowAIConfig] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExEquipment, setNewExEquipment] = useState<EquipmentType>('barbell');
  const [newExMuscles, setNewExMuscles] = useState<MuscleGroup[]>([]);
  const [newExWeight, setNewExWeight] = useState(45);
  const [newExSets, setNewExSets] = useState(3);
  const [newExRepMin, setNewExRepMin] = useState(8);
  const [newExRepMax, setNewExRepMax] = useState(12);
  const [newExIncrement, setNewExIncrement] = useState(5);

  const handleAddCustomExercise = () => {
    if (!newExName.trim()) return;
    const id = `custom_${newExName.trim().toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    const exercise: CustomExercise = {
      id, name: newExName.trim(), equipment: newExEquipment,
      muscleGroups: newExMuscles,
    };
    stores.CUSTOM_EXERCISES.update(prev => [...prev, exercise]);
    addConfig({
      exercise: id, targetSets: newExSets,
      repRangeMin: newExRepMin, repRangeMax: newExRepMax,
      currentWeight: newExWeight, weightIncrement: newExIncrement,
    });
    setShowAddCustom(false);
    setNewExName(''); setNewExMuscles([]); setNewExWeight(45);
    setNewExSets(3); setNewExRepMin(8); setNewExRepMax(12); setNewExIncrement(5);
    toast.success(`Added "${exercise.name}"`);
  };

  // Archive rather than delete, so past sessions and PRs keep the exercise's name.
  const handleDeleteCustomExercise = (id: string) => {
    stores.CUSTOM_EXERCISES.update(prev => prev.map(e => (e.id === id ? { ...e, archived: true } : e)));
    toast.success('Exercise removed', {
      description: 'Your past sessions with it are kept.',
      action: { label: 'Undo', onClick: () => stores.CUSTOM_EXERCISES.update(prev => prev.map(e => (e.id === id ? { ...e, archived: false } : e))) },
    });
  };

  const toggleMuscle = (m: MuscleGroup) => {
    setNewExMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  // AI config generator
  const [aiConfigResponse, setAiConfigResponse] = useState('');

  const generateAIConfigPrompt = () => {
    const settings = stores.SETTINGS.get();
    const name = newExName.trim() || '[EXERCISE NAME]';
    const equipment = EQUIPMENT_LABELS[newExEquipment];
    const muscles = newExMuscles.length > 0 ? newExMuscles.join(', ') : '(not specified)';
    return `You are an expert strength and conditioning coach.

I need an optimal progressive overload configuration for a new exercise.

EXERCISE: ${name}
EQUIPMENT: ${equipment}
MUSCLE GROUPS: ${muscles}
MY BODYWEIGHT: ${settings.bodyweight} lbs

Based on this exercise and my bodyweight, provide the ideal training configuration.

Consider:
- Appropriate starting weight for an intermediate lifter at ${settings.bodyweight} lbs
- Optimal rep range for hypertrophy and strength progression
- Correct set count for this movement type
- Appropriate weight increment that avoids stalling (smaller for isolation/upper body, larger for compound/lower body)

OUTPUT FORMAT — Use this EXACT format, one value per line:
SETS: [number]
REP_MIN: [number]
REP_MAX: [number]
WEIGHT: [number in lbs]
INCREMENT: [number in lbs]
EQUIPMENT: [barbell|dumbbell|cable|machine|bodyweight|other]
MUSCLES: [comma-separated from: chest,back,shoulders,biceps,triceps,quads,hamstrings,glutes,calves,core,forearms,traps]

RULES:
- Output ONLY the config lines, no explanations
- Weight should be per-hand for dumbbells
- Increment should be realistic (1.25-2.5 for isolation, 5-10 for compounds)
- Rep range should be 6-12 for hypertrophy, 3-6 for strength, 12-20 for endurance`;
  };

  const copyAIConfigPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generateAIConfigPrompt());
      toast.success('AI prompt copied to clipboard!');
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  const parseAIConfigResponse = () => {
    const lines = aiConfigResponse.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      const setsMatch = trimmed.match(/^SETS:\s*(\d+)/i);
      if (setsMatch) setNewExSets(parseInt(setsMatch[1]));
      const repMinMatch = trimmed.match(/^REP_MIN:\s*(\d+)/i);
      if (repMinMatch) setNewExRepMin(parseInt(repMinMatch[1]));
      const repMaxMatch = trimmed.match(/^REP_MAX:\s*(\d+)/i);
      if (repMaxMatch) setNewExRepMax(parseInt(repMaxMatch[1]));
      const weightMatch = trimmed.match(/^WEIGHT:\s*([\d.]+)/i);
      if (weightMatch) setNewExWeight(parseFloat(weightMatch[1]));
      const incMatch = trimmed.match(/^INCREMENT:\s*([\d.]+)/i);
      if (incMatch) setNewExIncrement(parseFloat(incMatch[1]));
      const eqMatch = trimmed.match(/^EQUIPMENT:\s*(\w+)/i);
      if (eqMatch && ['barbell','dumbbell','cable','machine','bodyweight','other'].includes(eqMatch[1].toLowerCase())) {
        setNewExEquipment(eqMatch[1].toLowerCase() as EquipmentType);
      }
      const muscleMatch = trimmed.match(/^MUSCLES:\s*(.+)/i);
      if (muscleMatch) {
        const parsed = muscleMatch[1].split(',').map(m => m.trim().toLowerCase()).filter(m =>
          ALL_MUSCLE_GROUPS.includes(m as MuscleGroup)
        ) as MuscleGroup[];
        if (parsed.length > 0) setNewExMuscles(parsed);
      }
    }
    toast.success('Config imported from AI response!');
    setAiConfigResponse('');
  };

  // The workout in progress is saved continuously, so leaving the page or
  // closing the app never loses it.
  const active = useActiveWorkout();
  const [tab, setTab] = useState('session');
  const splitDay = (active?.splitDay ?? 'push') as SplitDay;
  const sessionExercises = active?.exercises ?? [];
  const sessionNotes = active?.notes ?? '';
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const templates = useStore(stores.TEMPLATES);
  const [templateName, setTemplateName] = useState<string | null>(null);

  const toggleSession = (id: string) => {
    const next = new Set(expandedSessions);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSessions(next);
  };

  const logSession = () => {
    if (sessionExercises.length === 0) { toast.error('Add at least one exercise!'); return; }
    if (sessionExercises.every(e => e.sets.length === 0)) { toast.error('Add at least one set!'); return; }
    activeWorkoutActions.finish(customExercises);
    toast.success('Session logged! 🔥');
  };

  const saveAsTemplate = (name: string) => {
    if (sessionExercises.length === 0 || !name.trim()) return;
    const template: WorkoutTemplate = {
      id: generateId(), name: name.trim(), splitDay,
      exercises: sessionExercises.map(e => ({
        exercise: e.exercise, sets: e.sets.length, weight: e.sets[0]?.weight || 0, reps: e.sets[0]?.reps || 0,
      })),
    };
    stores.TEMPLATES.update(prev => [...prev, template]);
    setTemplateName(null);
    toast.success(`Saved "${template.name}"`);
  };

  const loadFromTemplate = (template: WorkoutTemplate) => {
    const exercises = template.exercises.map(e => {
      const config = configs.find(c => c.exercise === e.exercise);
      return {
        exercise: e.exercise,
        sets: Array.from({ length: e.sets }, () => ({
          reps: e.reps || config?.repRangeMin || 6, weight: config?.currentWeight ?? e.weight, rpe: 3,
        })),
      };
    });
    activeWorkoutActions.load(template.splitDay, exercises);
    toast.success(`Loaded "${template.name}"`);
  };

  const deleteTemplate = (id: string) => {
    const removed = templates.find(t => t.id === id);
    stores.TEMPLATES.update(prev => prev.filter(t => t.id !== id));
    toast.success('Saved workout deleted', removed ? {
      action: { label: 'Undo', onClick: () => stores.TEMPLATES.update(prev => (prev.some(t => t.id === id) ? prev : [...prev, removed])) },
    } : undefined);
  };

  const handleDeleteSession = (id: string) => {
    const removed = sessions.find(x => x.id === id);
    deleteSession(id);
    toast.success('Session deleted', removed ? { action: { label: 'Undo', onClick: () => workoutActions.restoreSession(removed) } } : undefined);
  };

  const [selectedExercise, setSelectedExercise] = useState<string>('squat');
  const selectedIsBodyweight = isBodyweight(selectedExercise);
  const chartData = useMemo(() => getExerciseHistory(sessions, selectedExercise)
    .filter(h => h.sets.length > 0)
    .slice().reverse().map(h => ({
      date: new Date(h.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      weight: selectedIsBodyweight ? Math.max(...h.sets.map(s => s.reps)) : Math.max(...h.sets.map(s => s.weight)),
      volume: calculateVolumeLoad(h.sets),
    })), [sessions, selectedExercise, selectedIsBodyweight]);

  const sortedSessions = useMemo(() => [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [sessions]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader title="Gym" subtitle="Log lifts · the app plans your next session" />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        {/* Two rows of clearly labelled tabs instead of a hidden sideways-scrolling strip */}
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 p-1">
          <TabsTrigger value="session" className="h-9 text-xs">Log</TabsTrigger>
          <TabsTrigger value="split" className="h-9 text-xs">Split</TabsTrigger>
          <TabsTrigger value="templates" className="h-9 text-xs">Saved</TabsTrigger>
          <TabsTrigger value="history" className="h-9 text-xs">History</TabsTrigger>
          <TabsTrigger value="progress" className="h-9 text-xs">Progress</TabsTrigger>
          <TabsTrigger value="prs" className="h-9 text-xs">PRs</TabsTrigger>
          <TabsTrigger value="config" className="col-span-2 h-9 text-xs">Exercises & targets</TabsTrigger>
        </TabsList>

        <TabsContent value="split" className="space-y-4">
          <WeeklySplitEditor
            customExercises={activeCustom}
            onStartDay={(splitDay, exercises) => {
              activeWorkoutActions.load(splitDay, []);
              exercises.forEach(ex => activeWorkoutActions.addExercise(ex, customExercises));
              setTab('session');
              toast.success(`${splitDay.charAt(0).toUpperCase() + splitDay.slice(1)} day loaded`);
            }}
          />
        </TabsContent>

        {/* LOG SESSION TAB */}
        <TabsContent value="session" className="space-y-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Split Day</label>
              <Select value={splitDay} onValueChange={(v) => activeWorkoutActions.setSplitDay(v)}>
                <SelectTrigger className="w-32 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['push', 'pull', 'legs', 'upper', 'lower'].map(s => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Add Exercise</label>
              {/* Controlled + reset after each pick, so the same exercise can be added again. */}
              <Select value="" onValueChange={(v) => v && activeWorkoutActions.addExercise(v, customExercises)}>
                <SelectTrigger className="w-48 mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {allExerciseOptions.map(({ id, label: name }) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <RestTimer />
          </div>

          {sessionExercises.map((ex) => {
            const config = configs.find(c => c.exercise === ex.exercise);
            const recentHistory = getExerciseHistory(sessions, ex.exercise);
            const suggestion = config ? getProgressionSuggestion(config, recentHistory, { bodyweight: isBodyweight(ex.exercise) }) : null;
            const canApplyDeload = !!suggestion && (suggestion.type === 'deload' || suggestion.type === 'fatigue_warning')
              && suggestion.suggestedWeight !== undefined && config && suggestion.suggestedWeight < config.currentWeight;

            return (
              <Card key={ex.id} className="shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      {label(ex.exercise)}
                    </CardTitle>
                    <Button size="sm" variant="ghost" className="text-destructive" aria-label={`Remove ${label(ex.exercise)}`} onClick={() => activeWorkoutActions.removeExercise(ex.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {suggestion && (
                    <div className={`text-xs p-2 rounded-lg mt-2 border ${
                      suggestion.type === 'increase_weight' ? 'bg-teal/10 text-teal border-teal/20' :
                      suggestion.type === 'deload' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                      suggestion.type === 'fatigue_warning' ? 'bg-amber/10 text-amber border-amber/20' :
                      'bg-primary/10 text-primary border-primary/20'
                    }`}>
                      {suggestion.type === 'increase_weight' && <ArrowUp className="h-3 w-3 inline mr-1" />}
                      {suggestion.type === 'deload' && <ArrowDown className="h-3 w-3 inline mr-1" />}
                      {suggestion.type === 'fatigue_warning' && <TrendingUp className="h-3 w-3 inline mr-1" />}
                      {suggestion.type === 'hold' && <Minus className="h-3 w-3 inline mr-1" />}
                      {suggestion.type === 'increase_reps' && <ArrowUp className="h-3 w-3 inline mr-1" />}
                      {suggestion.message}
                      {canApplyDeload && (
                        <button
                          type="button"
                          className="ml-1 font-semibold underline underline-offset-2"
                          onClick={() => {
                            workoutActions.applyDeload(ex.exercise, suggestion.suggestedWeight!);
                            ex.sets.forEach((_, i) => activeWorkoutActions.updateSet(ex.id, i, 'weight', suggestion.suggestedWeight!));
                            toast.success(`${label(ex.exercise)} set to ${suggestion.suggestedWeight} lbs`);
                          }}
                        >
                          Apply
                        </button>
                      )}
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">
                      <span>Set</span><span>{isBodyweight(ex.exercise) ? '+ lbs' : 'Weight'}</span><span>Reps</span><span>Effort</span><span />
                    </div>
                    {ex.sets.map((set, setIdx) => (
                      <div key={setIdx} className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-2 items-center">
                        <span className="text-sm flex items-center font-bold text-primary">{setIdx + 1}</span>
                        <Input type="number" inputMode="decimal" aria-label={`Set ${setIdx + 1} weight`} value={set.weight || ''} onChange={e => activeWorkoutActions.updateSet(ex.id, setIdx, 'weight', e.target.value === '' ? 0 : Number(e.target.value))} className="h-10" />
                        <Input type="number" inputMode="numeric" aria-label={`Set ${setIdx + 1} reps`} value={set.reps || ''} onChange={e => activeWorkoutActions.updateSet(ex.id, setIdx, 'reps', e.target.value === '' ? 0 : Number(e.target.value))} className="h-10" />
                        <Input type="number" inputMode="numeric" aria-label={`Set ${setIdx + 1} effort, 1 to 5`} value={set.rpe || ''} onChange={e => activeWorkoutActions.updateSet(ex.id, setIdx, 'rpe', e.target.value === '' ? 0 : Number(e.target.value))} onBlur={e => { const v = Number(e.target.value); activeWorkoutActions.updateSet(ex.id, setIdx, 'rpe', Math.min(5, Math.max(1, v || 3))); }} className="h-10" min={1} max={5} />
                        <button type="button" aria-label={`Remove set ${setIdx + 1}`} onClick={() => activeWorkoutActions.removeSet(ex.id, setIdx)} className="flex h-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-full text-xs" onClick={() => activeWorkoutActions.addSet(ex.id)}>
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add set
                    </Button>
                    <p className="text-[11px] text-muted-foreground">Effort: 1 = easy, 3 = solid, 5 = all-out.</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {sessionExercises.length > 0 && (
            <div className="space-y-3">
              <Card className="shadow-sm">
                <CardContent className="pt-4">
                  <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <FileText className="h-3 w-3" /> Session Notes
                  </label>
                  <Textarea className="mt-1 h-20 text-xs" placeholder="How did it feel? Any pain? Energy level?" value={sessionNotes} onChange={e => activeWorkoutActions.setNotes(e.target.value)} />
                </CardContent>
              </Card>
              <div className="flex gap-3">
                <Button onClick={logSession} className="flex-1 font-bold text-lg py-6">
                  Log Session
                </Button>
                <Button onClick={() => setTemplateName('')} variant="outline" className="h-auto">
                  <Save className="h-4 w-4 mr-1" /> Save
                </Button>
              </div>
              {templateName !== null && (
                <form className="flex gap-2" onSubmit={e => { e.preventDefault(); saveAsTemplate(templateName); }}>
                  <Input autoFocus value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Name this workout, e.g. Push A" className="h-11 text-base" />
                  <Button type="submit" className="h-11" disabled={!templateName.trim()}>Save</Button>
                  <Button type="button" variant="ghost" className="h-11" onClick={() => setTemplateName(null)}>Cancel</Button>
                </form>
              )}
              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => {
                  const draft = active;
                  activeWorkoutActions.discard();
                  toast('Workout discarded', { action: draft ? { label: 'Undo', onClick: () => stores.ACTIVE_WORKOUT.set(draft) } : undefined });
                }}
              >
                Discard this workout
              </button>
            </div>
          )}

          {sessionExercises.length === 0 && (
            <Card className="border-dashed border-2 border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Dumbbell className="h-16 w-16 text-primary/30 mb-4" />
                <p className="text-muted-foreground text-lg">Select exercises above to begin</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="space-y-4">
          {templates.length === 0 ? (
            <Card className="border-dashed border-2 border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Save className="h-16 w-16 text-primary/30 mb-4" />
                <p className="text-muted-foreground text-lg">No saved workouts yet</p>
                <p className="text-xs text-muted-foreground mt-1">Build a workout on the Log tab and tap Save</p>
              </CardContent>
            </Card>
          ) : (
            templates.map((t) => (
              <Card key={t.id} className="shadow-sm">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold">{t.name}</p>
                      <Badge variant="outline" className="text-xs capitalize mt-1">{t.splitDay}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { loadFromTemplate(t); setTab('session'); }} className="h-9 text-xs font-semibold">
                        Start
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {t.exercises.map((e, j) => (
                      <Badge key={j} variant="outline" className="text-xs">
                        {label(e.exercise)} · {e.sets}×{e.reps}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          {sortedSessions.length === 0 ? (
            <Card className="border-dashed border-2 border-primary/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <History className="h-16 w-16 text-primary/30 mb-4" />
                <p className="text-muted-foreground text-lg">No sessions logged yet</p>
              </CardContent>
            </Card>
          ) : (
            sortedSessions.map((session) => {
              const isExpanded = expandedSessions.has(session.id);
              const totalVolume = session.exercises.reduce((sum, ex) => sum + calculateVolumeLoad(ex.sets), 0);
              return (
                <Card key={session.id} className="shadow-sm">
                  <Collapsible open={isExpanded} onOpenChange={() => toggleSession(session.id)}>
                    <CollapsibleTrigger asChild>
                      <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                                <Badge variant="outline" className="text-xs capitalize">{session.splitDay}</Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {session.exercises.length} exercise{session.exercises.length !== 1 ? 's' : ''} · {totalVolume.toLocaleString()} lbs volume
                              </p>
                            </div>
                          </div>
                          <Button size="sm" variant="ghost" className="text-destructive h-7" aria-label="Delete session" onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="h-px bg-border mb-3" />
                        {session.notes && (
                          <div className="text-xs text-muted-foreground mb-3 p-2 bg-accent/50 rounded-lg border border-border flex items-start gap-1.5">
                            <FileText className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            {session.notes}
                          </div>
                        )}
                        <div className="space-y-3">
                          {session.exercises.map((ex, exIdx) => (
                            <div key={exIdx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Dumbbell className="h-3.5 w-3.5 text-primary" />
                                <span className="font-semibold text-sm">{label(ex.exercise)}</span>
                                <span className="text-xs text-muted-foreground ml-auto">{calculateVolumeLoad(ex.sets)} lbs</span>
                              </div>
                              <div className="ml-6 space-y-0.5">
                                {ex.sets.map((set, sIdx) => (
                                  <div key={sIdx} className="text-xs text-muted-foreground font-mono flex gap-4">
                                    <span>Set {sIdx + 1}:</span>
                                    <span>{set.weight} lbs × {set.reps}</span>
                                    <span className="text-primary/60">RPE {set.rpe}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* PROGRESS TAB */}
        <TabsContent value="progress" className="space-y-4">
          <div className="flex gap-4 items-end">
            <div>
              <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Exercise</label>
              <Select value={selectedExercise} onValueChange={setSelectedExercise}>
                <SelectTrigger className="w-48 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {allExerciseOptions.map(({ id, label: name }) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> {selectedIsBodyweight ? 'Best Reps' : 'Weight Progression'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 88%)" />
                    <XAxis dataKey="date" stroke="hsl(220 10% 45%)" fontSize={11} />
                    <YAxis stroke="hsl(220 10% 45%)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(0 0% 100%)', border: '1px solid hsl(220 15% 88%)', borderRadius: '8px', fontFamily: 'Inter' }} />
                    <Line type="monotone" dataKey="weight" stroke="hsl(220 60% 30%)" strokeWidth={3} dot={{ fill: 'hsl(220 60% 30%)', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data yet. Log your first session!</p>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-coral" /> Weekly Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyVolume.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={weeklyVolume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 88%)" />
                    <XAxis dataKey="week" stroke="hsl(220 10% 45%)" fontSize={11} />
                    <YAxis stroke="hsl(220 10% 45%)" fontSize={11} />
                    <Tooltip contentStyle={{ background: 'hsl(0 0% 100%)', border: '1px solid hsl(220 15% 88%)', borderRadius: '8px', fontFamily: 'Inter' }} />
                    <Bar dataKey="volume" fill="hsl(12 80% 65%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data yet</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRs TAB */}
        <TabsContent value="prs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prs.length > 0 ? prs.map(pr => (
              <Card key={pr.exercise} className="shadow-sm border-coral/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-coral" />
                    <div>
                      <p className="font-semibold text-lg">{label(pr.exercise)}</p>
                      <p className="text-3xl font-bold text-primary">
                        {isBodyweight(pr.exercise) ? `${pr.reps} reps${pr.weight ? ` +${pr.weight}` : ''}` : `${pr.weight} × ${pr.reps}`}
                      </p>
                      <p className="text-xs text-muted-foreground">Vol: {pr.volumeLoad} lbs · {new Date(pr.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )) : (
              <Card className="border-dashed border-2 border-coral/20 col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Trophy className="h-16 w-16 text-coral/30 mb-4" />
                  <p className="text-muted-foreground text-lg">No PRs yet. Start lifting!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* CONFIG TAB */}
        <TabsContent value="config" className="space-y-4">
          {configs.filter(c => !customExercises.find(e => e.id === c.exercise)?.archived).map(config => {
            const isCustom = !isBuiltInExercise(config.exercise);
            const customEx = isCustom ? customExercises.find(e => e.id === config.exercise) : null;
            return (
              <Card key={config.exercise} className="shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{label(config.exercise)}</h3>
                      {customEx && (
                        <Badge variant="outline" className="text-xs capitalize">{customEx.equipment}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{config.targetSets} × {config.repRangeMin}-{config.repRangeMax}</Badge>
                      {isCustom && (
                        <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => handleDeleteCustomExercise(config.exercise)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {customEx && customEx.muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {customEx.muscleGroups.map(m => (
                        <Badge key={m} variant="outline" className="text-[10px] capitalize">{m}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Sets</label>
                      <Input type="number" inputMode="numeric" value={config.targetSets || ''} onChange={e => updateConfig(config.exercise, { targetSets: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => workoutActions.sanitizeConfig(config.exercise)} className="h-8 mt-1" min={1} max={10} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Weight</label>
                      <Input type="number" inputMode="decimal" value={config.currentWeight || ''} onChange={e => updateConfig(config.exercise, { currentWeight: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => workoutActions.sanitizeConfig(config.exercise)} className="h-8 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Increment</label>
                      <Input type="number" inputMode="decimal" value={config.weightIncrement || ''} onChange={e => updateConfig(config.exercise, { weightIncrement: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => workoutActions.sanitizeConfig(config.exercise)} className="h-8 mt-1" step={2.5} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Rep Min</label>
                      <Input type="number" inputMode="numeric" value={config.repRangeMin || ''} onChange={e => updateConfig(config.exercise, { repRangeMin: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => workoutActions.sanitizeConfig(config.exercise)} className="h-8 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Rep Max</label>
                      <Input type="number" inputMode="numeric" value={config.repRangeMax || ''} onChange={e => updateConfig(config.exercise, { repRangeMax: e.target.value === '' ? 0 : Number(e.target.value) })} onBlur={() => workoutActions.sanitizeConfig(config.exercise)} className="h-8 mt-1" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Add Custom Exercise */}
          <Dialog open={showAddCustom} onOpenChange={setShowAddCustom}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full border-dashed border-2 border-primary/20 py-8 text-primary hover:bg-primary/5">
                <Plus className="h-5 w-5 mr-2" /> Add Custom Exercise
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold">New Custom Exercise</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Exercise Name</label>
                  <Input value={newExName} onChange={e => setNewExName(e.target.value)} placeholder="e.g., Incline DB Press" className="mt-1" />
                </div>

                <div>
                  <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Equipment</label>
                  <Select value={newExEquipment} onValueChange={(v) => setNewExEquipment(v as EquipmentType)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(EQUIPMENT_LABELS).map(([key, name]) => (
                        <SelectItem key={key} value={key}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Muscle Groups</label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {ALL_MUSCLE_GROUPS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => toggleMuscle(m)}
                        className={`px-2.5 py-1 rounded text-xs capitalize border transition-all ${
                          newExMuscles.includes(m)
                            ? 'bg-primary/15 border-primary/40 text-primary font-medium'
                            : 'border-border text-muted-foreground hover:border-primary/20'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Config Generator */}
                {!showAIConfig ? (
                  <Button variant="outline" size="sm" className="w-full text-xs gap-1.5 border-dashed" onClick={() => setShowAIConfig(true)}>
                    <Sparkles className="h-3.5 w-3.5" /> Generate Config with AI
                  </Button>
                ) : (
                  <div className="border border-border/30 rounded-lg p-3 space-y-3 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">
                        1. Copy the prompt below and paste it into ChatGPT, Claude, etc.
                        <br/>2. Paste the response back and click "Apply".
                      </p>
                      <button onClick={() => setShowAIConfig(false)} className="p-1 rounded hover:bg-accent/50 text-muted-foreground flex-shrink-0 ml-2">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1.5" onClick={copyAIConfigPrompt}>
                      <Copy className="h-3 w-3" /> Copy AI Prompt
                    </Button>
                    <Textarea
                      value={aiConfigResponse}
                      onChange={e => setAiConfigResponse(e.target.value)}
                      placeholder={`Paste AI response here...\n\nSETS: 3\nREP_MIN: 8\nREP_MAX: 12\nWEIGHT: 30\nINCREMENT: 2.5\nEQUIPMENT: dumbbell\nMUSCLES: chest,shoulders,triceps`}
                      className="font-mono text-xs min-h-[80px]"
                    />
                    <Button size="sm" onClick={parseAIConfigResponse} disabled={!aiConfigResponse.trim()} className="w-full text-xs gap-1.5 font-semibold">
                      <Sparkles className="h-3 w-3" /> Apply AI Config
                    </Button>
                  </div>
                )}

                <div className="border-t pt-4">
                  <label className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Starting Config</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Starting Weight</label>
                      <Input type="number" inputMode="decimal" value={newExWeight || ''} onChange={e => setNewExWeight(e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Sets</label>
                      <Input type="number" inputMode="numeric" value={newExSets || ''} onChange={e => setNewExSets(e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 mt-0.5" min={1} max={10} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Increment</label>
                      <Input type="number" inputMode="decimal" value={newExIncrement || ''} onChange={e => setNewExIncrement(e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 mt-0.5" step={2.5} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Rep Min</label>
                      <Input type="number" inputMode="numeric" value={newExRepMin || ''} onChange={e => setNewExRepMin(e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 mt-0.5" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">Rep Max</label>
                      <Input type="number" inputMode="numeric" value={newExRepMax || ''} onChange={e => setNewExRepMax(e.target.value === '' ? 0 : Number(e.target.value))} className="h-8 mt-0.5" />
                    </div>
                  </div>
                </div>

                <Button onClick={handleAddCustomExercise} disabled={!newExName.trim()} className="w-full font-semibold">
                  <Plus className="h-4 w-4 mr-2" /> Add Exercise
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
