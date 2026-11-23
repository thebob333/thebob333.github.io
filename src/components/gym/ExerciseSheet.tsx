import { useEffect, useState } from 'react';
import { ChevronDown, Copy, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { workoutActions } from '@/hooks/useWorkouts';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { suggestedCustomTarget } from '@/lib/strength-standards';
import { DEFAULTS, getExerciseHistory, liftInsight, prescribeWeight, progressionOptions, roundTo, settingsOf, volumeAdvice } from '@/lib/progressive-overload';
import { muscleSets, primaryMuscle } from '@/lib/gym-stats';
import { addDays, todayKey } from '@/lib/dates';
import { ALL_MUSCLE_GROUPS, getExerciseLabel, isBodyweightExercise, isBuiltInExercise, type CustomExercise, type EquipmentType, type MuscleGroup } from '@/types/workout';
import { cn } from '@/lib/utils';

const EQUIPMENT: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' }, { value: 'dumbbell', label: 'Dumbbell' }, { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' }, { value: 'bodyweight', label: 'Bodyweight' }, { value: 'other', label: 'Other' },
];

interface Form {
  name: string; equipment: EquipmentType; muscles: MuscleGroup[];
  sets: string; repMin: string; repMax: string; weight: string; increment: string; target: string;
  style: 'double' | 'linear'; targetRir: number; deloadPercent: number; stallSessions: number;
  scheme: 'straight' | 'topset'; backoffPercent: number;
}

function NumberField({ label, value, onChange, suffix, step }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; step?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-footnote font-semibold text-muted-foreground">{label}</span>
      <span className="flex h-12 items-center rounded-xl bg-secondary px-3">
        <input type="number" inputMode="decimal" step={step} value={value} onChange={e => onChange(e.target.value)} className="h-full w-full min-w-0 bg-transparent text-body font-semibold tabular-nums outline-none" />
        {suffix && <span className="text-footnote text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

function aiPrompt(f: Form, bodyweight: number) {
  return `You are an expert strength coach. Give me a progressive overload setup for this exercise.

EXERCISE: ${f.name.trim() || '[EXERCISE NAME]'}
EQUIPMENT: ${f.equipment}
MUSCLES: ${f.muscles.join(', ') || '(not specified)'}
MY BODYWEIGHT: ${bodyweight} lbs

Reply with ONLY these lines:
SETS: [number]
REP_MIN: [number]
REP_MAX: [number]
WEIGHT: [starting weight in lbs, per hand for dumbbells]
INCREMENT: [lbs; 1.25-2.5 for isolation, 5-10 for compounds]
EQUIPMENT: [barbell|dumbbell|cable|machine|bodyweight|other]
MUSCLES: [comma-separated from: ${ALL_MUSCLE_GROUPS.join(',')}]`;
}

/**
 * Edit an exercise's targets (any exercise) and, for custom ones, its name,
 * equipment, muscles and strength goal. `exerciseId === null` creates a new custom exercise.
 */
export function ExerciseSheet({ open, exerciseId, onClose, onCreated }: {
  open: boolean;
  exerciseId: string | null;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const customExercises = useStore(stores.CUSTOM_EXERCISES);
  const settings = useStore(stores.SETTINGS);
  const configs = useStore(stores.EXERCISE_CONFIGS);
  const sessions = useStore(stores.SESSIONS);
  const creating = exerciseId === null;
  const isCustom = creating || !isBuiltInExercise(exerciseId);
  const [f, setF] = useState<Form | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiReply, setAiReply] = useState('');

  // Fill the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const cfg = exerciseId ? configs.find(c => c.exercise === exerciseId) : undefined;
    const ce = exerciseId ? customExercises.find(e => e.id === exerciseId) : undefined;
    const t = exerciseId ? settings.goldTargets[exerciseId] : undefined;
    setF({
      name: ce?.name ?? '', equipment: ce?.equipment ?? 'barbell', muscles: ce?.muscleGroups ?? [],
      sets: String(cfg?.targetSets ?? 3), repMin: String(cfg?.repRangeMin ?? 8), repMax: String(cfg?.repRangeMax ?? 12),
      weight: String(cfg?.currentWeight ?? 45), increment: String(cfg?.weightIncrement ?? 5), target: t ? String(t) : '',
      ...(cfg ? settingsOf(cfg) : DEFAULTS),
    });
    setAiOpen(false); setAiReply('');
    // Only when it opens — not on every store change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exerciseId]);

  if (!f) return null;
  const step = Number(f.increment) > 0 ? Number(f.increment) : 5;
  const opts = exerciseId ? progressionOptions(exerciseId, customExercises, settings.bodyweight) : {};
  const history = exerciseId ? getExerciseHistory(sessions, exerciseId) : [];
  const insight = exerciseId ? liftInsight(history.slice(0, 12), opts) : null;
  const e1rm = insight && (!opts.bodyweight || insight.bodyLoad > 0) ? Math.round(insight.current) : 0;
  const body = insight?.bodyLoad ?? 0;
  // For bodyweight moves the range is the weight to add on top of you.
  const range = (reps: number) => Math.max(0, prescribeWeight(e1rm, reps, f.targetRir, step, insight?.calib ?? 1) - roundTo(body, step));
  const numbers = e1rm > 0 ? { e1rm, high: range(Number(f.repMax) || 12), low: range(Number(f.repMin) || 8) } : null;
  const cfgNow = exerciseId ? configs.find(c => c.exercise === exerciseId) : undefined;
  const muscle = exerciseId ? primaryMuscle(exerciseId, customExercises) : null;
  const weekly = muscle ? muscleSets(sessions, customExercises, addDays(todayKey(), -6))[muscle] ?? 0 : null;
  const advice = cfgNow && muscle ? volumeAdvice({ ...cfgNow, targetSets: Number(f.sets) || cfgNow.targetSets }, history, weekly, muscle, opts) : null;
  const set = (patch: Partial<Form>) => setF(prev => ({ ...prev!, ...patch }));
  const suggested = suggestedCustomTarget(f.equipment, settings.bodyweight);
  const bodyweightLift = f.equipment === 'bodyweight';
  const title = creating ? 'New exercise' : getExerciseLabel(exerciseId, customExercises);

  const applyAi = () => {
    const get = (k: string) => aiReply.match(new RegExp(`^\\s*${k}:\\s*(.+)$`, 'im'))?.[1].trim();
    const num = (k: string) => { const v = parseFloat(get(k) ?? ''); return Number.isFinite(v) ? String(v) : undefined; };
    const eq = get('EQUIPMENT')?.toLowerCase();
    const muscles = (get('MUSCLES') ?? '').split(',').map(m => m.trim().toLowerCase()).filter((m): m is MuscleGroup => (ALL_MUSCLE_GROUPS as string[]).includes(m));
    set({
      sets: num('SETS') ?? f.sets, repMin: num('REP_MIN') ?? f.repMin, repMax: num('REP_MAX') ?? f.repMax,
      weight: num('WEIGHT') ?? f.weight, increment: num('INCREMENT') ?? f.increment,
      ...(EQUIPMENT.some(e => e.value === eq) ? { equipment: eq as EquipmentType } : {}),
      ...(muscles.length ? { muscles } : {}),
    });
    setAiReply(''); setAiOpen(false);
    toast.success('Filled in from the AI reply');
  };

  const save = () => {
    if (isCustom && !f.name.trim()) { toast.error('Give it a name'); return; }
    const n = (v: string, d: number) => { const x = Number(v); return Number.isFinite(x) && v.trim() !== '' ? x : d; };
    const fields = {
      targetSets: Math.max(1, Math.round(n(f.sets, 3))),
      repRangeMin: Math.max(1, Math.round(n(f.repMin, 8))),
      repRangeMax: Math.max(1, Math.round(n(f.repMax, 12))),
      currentWeight: Math.max(0, n(f.weight, 0)),
      weightIncrement: Math.max(0, n(f.increment, 5)),
      style: f.style, targetRir: f.targetRir, deloadPercent: f.deloadPercent, stallSessions: f.stallSessions,
      scheme: f.scheme, backoffPercent: f.backoffPercent,
    };
    if (fields.repRangeMax < fields.repRangeMin) fields.repRangeMax = fields.repRangeMin;

    let id = exerciseId;
    if (creating) {
      id = `custom_${f.name.trim().toLowerCase().replace(/\W+/g, '_')}_${Date.now()}`;
      const ex: CustomExercise = { id, name: f.name.trim(), equipment: f.equipment, muscleGroups: f.muscles };
      stores.CUSTOM_EXERCISES.update(prev => [...prev, ex]);
    } else if (isCustom) {
      stores.CUSTOM_EXERCISES.update(prev => prev.map(e => (e.id === id ? { ...e, name: f.name.trim(), equipment: f.equipment, muscleGroups: f.muscles } : e)));
    }
    if (stores.EXERCISE_CONFIGS.get().some(c => c.exercise === id)) workoutActions.updateConfig(id!, fields);
    else workoutActions.addConfig({ exercise: id!, ...fields });

    if (isCustom) {
      const t = Number(f.target);
      stores.SETTINGS.update(s => {
        const goldTargets = { ...s.goldTargets };
        if (f.target.trim() && Number.isFinite(t) && t > 0) goldTargets[id!] = t;
        else delete goldTargets[id!];
        return { ...s, goldTargets };
      });
    }
    toast.success(creating ? `Added ${f.name.trim()}` : 'Saved');
    onClose();
    if (creating) onCreated?.(id!);
  };

  const remove = () => {
    const id = exerciseId!;
    stores.CUSTOM_EXERCISES.update(prev => prev.map(e => (e.id === id ? { ...e, archived: true } : e)));
    onClose();
    toast.success('Exercise removed', {
      description: 'Past sessions with it are kept.',
      action: { label: 'Undo', onClick: () => stores.CUSTOM_EXERCISES.update(prev => prev.map(e => (e.id === id ? { ...e, archived: false } : e))) },
    });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">{title}</DialogTitle></DialogHeader>
        <div className="-mx-1 max-h-[65vh] space-y-5 overflow-y-auto px-1 pb-1 pt-1">
          {isCustom && (
            <>
              <Input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Name, e.g. Incline dumbbell press" className="h-12 rounded-xl text-body" autoFocus={creating} />
              <div><FieldLabel>Equipment</FieldLabel><Chips<EquipmentType> label="Equipment" options={EQUIPMENT} value={f.equipment} onChange={equipment => set({ equipment })} /></div>
              <div>
                <FieldLabel>Muscles worked</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ALL_MUSCLE_GROUPS.map(m => {
                    const on = f.muscles.includes(m);
                    return (
                      <button key={m} type="button" aria-pressed={on} onClick={() => set({ muscles: on ? f.muscles.filter(x => x !== m) : [...f.muscles, m] })}
                        className={cn('pressable h-9 rounded-full px-3.5 text-footnote font-semibold capitalize', on ? 'bg-move text-white' : 'bg-secondary text-foreground')}>
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            <FieldLabel>Targets</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Sets" value={f.sets} onChange={sets => set({ sets })} />
              <NumberField label="Reps from" value={f.repMin} onChange={repMin => set({ repMin })} />
              <NumberField label="Reps to" value={f.repMax} onChange={repMax => set({ repMax })} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <NumberField label={bodyweightLift ? 'Added weight' : 'Working weight'} value={f.weight} onChange={weight => set({ weight })} suffix="lb" />
              <NumberField label="Smallest jump" value={f.increment} onChange={increment => set({ increment })} suffix="lb" step={2.5} />
            </div>
            <p className="mt-2 text-footnote text-muted-foreground">Your smallest jump — e.g. 5 lb with 2.5 lb plates, 2.5 lb with microplates. TELOS may jump more when you're new to a lift.</p>
          </div>

          {numbers && insight && (
            <div className="space-y-1.5 rounded-2xl bg-secondary/60 p-3">
              <p className="text-footnote font-semibold text-muted-foreground">Your numbers</p>
              <p className="text-body">Estimated max: <b className="tabular-nums">{numbers.e1rm} lb</b>{body > 0 && <span className="text-footnote text-muted-foreground"> (incl. ~{Math.round(body)} lb of you)</span>}</p>
              <p className="text-footnote text-muted-foreground">
                For {f.repMin}–{f.repMax} reps leaving ~{f.targetRir} in the tank: <b className="text-foreground tabular-nums">{body > 0 ? (numbers.low > 0 ? `+${numbers.high}–${numbers.low} lb` : 'bodyweight') : `${numbers.high}–${numbers.low} lb`}</b>.
              </p>
              {insight.perWeek !== null && (
                <p className="text-footnote text-muted-foreground">
                  Trend: <b className={cn('tabular-nums', insight.plateau ? 'text-warning' : insight.perWeek > 0.002 ? 'text-success' : 'text-foreground')}>
                    {insight.plateau ? 'flat for 3+ weeks' : `${insight.perWeek >= 0 ? '+' : '−'}${Math.abs(insight.perWeek * 100).toFixed(1)}% a week`}
                  </b>{insight.plateau ? ' — time to change something (rep range, a set, or a lighter week).' : ' over the last month.'}
                </p>
              )}
              {Math.abs(insight.calib - 1) >= 0.05 && (
                <p className="text-footnote text-muted-foreground">
                  Tuned to you: you get {insight.calib < 1 ? 'more' : 'fewer'} reps than average at a given weight, so estimates are adjusted.
                </p>
              )}
              {Number(f.weight) > 0 && Number(f.weight) > numbers.low + 2 * step && (
                <p className="text-footnote font-medium text-warning">Your working weight looks heavy for this rep range.</p>
              )}
              <p className="text-[11px] leading-4 text-muted-foreground">Counts reps left in the tank, uses the coaches' reps-to-%-of-max chart, and learns from your own sets over time.</p>
            </div>
          )}

          {advice && muscle && (
            <div className="flex items-start gap-3 rounded-2xl bg-secondary/60 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-footnote font-semibold text-muted-foreground">Weekly sets · <span className="capitalize">{muscle}</span>: {weekly} this week</p>
                <p className="text-footnote">{advice.message}</p>
              </div>
              <button type="button" className="h-9 shrink-0 rounded-full bg-card px-3 text-footnote font-semibold" onClick={() => set({ sets: String(advice.targetSets) })}>
                {advice.type === 'add_set' ? 'Add set' : 'Drop set'}
              </button>
            </div>
          )}

          <div>
            <FieldLabel>How it progresses</FieldLabel>
            <Chips<'double' | 'linear'> label="Progression" value={f.style} onChange={style => set({ style })}
              options={[{ value: 'double', label: 'Reps, then weight' }, { value: 'linear', label: 'Weight every session' }]} />
            <p className="mt-1.5 text-footnote text-muted-foreground">
              {f.style === 'double'
                ? `Add reps until every set hits ${f.repMax}, then add weight and start again at ${f.repMin}. Steady and sustainable — best for most people.`
                : `Every time all sets hit ${f.repMin}, add weight. Fastest while you're new to a lift; switch to "Reps, then weight" when it stalls.`}
              {' '}Jumps are about 5% of the weight while you're new, shrinking to 2.5% and then 1.5% as you get stronger — never less than your smallest jump. If that's over 10% (light dumbbells), you earn it with 2 extra reps first.
            </p>
          </div>

          {!bodyweightLift && (
            <div>
              <FieldLabel>Sets</FieldLabel>
              <Chips<'straight' | 'topset'> label="Set scheme" value={f.scheme} onChange={scheme => set({ scheme })}
                options={[{ value: 'straight', label: 'All the same weight' }, { value: 'topset', label: 'Top set + back-offs' }]} />
              {f.scheme === 'topset' && (
                <div className="mt-2">
                  <Chips<number> label="Back-off size" value={f.backoffPercent} onChange={backoffPercent => set({ backoffPercent })}
                    options={[5, 10, 15, 20].map(v => ({ value: v, label: `${v}% lighter` }))} />
                </div>
              )}
              <p className="mt-1.5 text-footnote text-muted-foreground">
                {f.scheme === 'topset'
                  ? `One heavy set at ${Number(f.weight) || 0} lb, then the rest at ${roundTo((Number(f.weight) || 0) * (1 - f.backoffPercent / 100), step)} lb. Progress is judged on the top set — strength from the heavy set, extra practice with less fatigue.`
                  : 'Every set at your working weight. Simple and effective.'}
              </p>
            </div>
          )}

          <div>
            <FieldLabel>How hard to push</FieldLabel>
            <Chips<number> label="Reps left in the tank" value={f.targetRir} onChange={targetRir => set({ targetRir })}
              options={[{ value: 0, label: 'To failure' }, { value: 1, label: '1 left' }, { value: 2, label: '2 left' }, { value: 3, label: '3 left' }]} />
            <p className="mt-1.5 text-footnote text-muted-foreground">Reps you leave in the tank on each set. 1–2 builds strength and size with less fatigue; to failure is hardest to recover from.</p>
          </div>

          <div>
            <FieldLabel>When it stalls</FieldLabel>
            <div className="space-y-2">
              <Chips<number> label="Lighter week size" value={f.deloadPercent} onChange={deloadPercent => set({ deloadPercent })}
                options={[5, 10, 15].map(v => ({ value: v, label: `${v}% lighter` }))} />
              <Chips<number> label="Stall sensitivity" value={f.stallSessions} onChange={stallSessions => set({ stallSessions })}
                options={[{ value: 1, label: 'After 1 tough session' }, { value: 2, label: 'After 2 of 3' }, { value: 3, label: 'After 3 in a row' }]} />
            </div>
            <p className="mt-1.5 text-footnote text-muted-foreground">A "tough session" means missing {f.repMin} reps on a set. Then the weight drops for a week and builds back up — usually past where you stalled.</p>
          </div>

          {isCustom && (
            <div>
              <NumberField label={`Strength goal (${bodyweightLift ? 'reps' : 'lb'})`} value={f.target} onChange={target => set({ target })} />
              <p className="mt-1 text-footnote text-muted-foreground">Fills in your strength map. Leave blank to use {suggested} {bodyweightLift ? 'reps' : 'lb'}.</p>
            </div>
          )}

          {isCustom && (
            <div className="rounded-2xl bg-secondary/60 p-3">
              <button type="button" onClick={() => setAiOpen(o => !o)} className="flex w-full items-center gap-2 text-body font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Fill in with AI
                <ChevronDown className={cn('ml-auto h-4 w-4 text-muted-foreground transition-transform', aiOpen && 'rotate-180')} />
              </button>
              {aiOpen && (
                <div className="mt-3 space-y-2">
                  <p className="text-footnote text-muted-foreground">Copy the prompt into ChatGPT or Claude, then paste the reply here.</p>
                  <Button variant="secondary" className="h-11 w-full rounded-xl bg-card" onClick={async () => {
                    try { await navigator.clipboard.writeText(aiPrompt(f, settings.bodyweight)); toast.success('Prompt copied'); }
                    catch { toast.error("Couldn't copy — your browser blocked it"); }
                  }}><Copy className="mr-2 h-4 w-4" /> Copy prompt</Button>
                  <Textarea value={aiReply} onChange={e => setAiReply(e.target.value)} placeholder="Paste the reply…" className="min-h-[90px] rounded-xl bg-card font-mono text-footnote" />
                  <Button className="h-11 w-full rounded-xl" disabled={!aiReply.trim()} onClick={applyAi}>Use this</Button>
                </div>
              )}
            </div>
          )}
        </div>

        <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={save}>{creating ? 'Add exercise' : 'Save'}</Button>
        {isCustom && !creating && (
          <button type="button" onClick={remove} className="flex h-10 items-center justify-center gap-1.5 text-body font-medium text-destructive">
            <Trash2 className="h-4 w-4" /> Remove exercise
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
