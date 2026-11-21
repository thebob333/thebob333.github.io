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
import { ALL_MUSCLE_GROUPS, getExerciseLabel, isBuiltInExercise, type CustomExercise, type EquipmentType, type MuscleGroup } from '@/types/workout';
import { cn } from '@/lib/utils';

const EQUIPMENT: { value: EquipmentType; label: string }[] = [
  { value: 'barbell', label: 'Barbell' }, { value: 'dumbbell', label: 'Dumbbell' }, { value: 'cable', label: 'Cable' },
  { value: 'machine', label: 'Machine' }, { value: 'bodyweight', label: 'Bodyweight' }, { value: 'other', label: 'Other' },
];

interface Form {
  name: string; equipment: EquipmentType; muscles: MuscleGroup[];
  sets: string; repMin: string; repMax: string; weight: string; increment: string; target: string;
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
    });
    setAiOpen(false); setAiReply('');
    // Only when it opens — not on every store change while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exerciseId]);

  if (!f) return null;
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
              <NumberField label="Add each time" value={f.increment} onChange={increment => set({ increment })} suffix="lb" step={2.5} />
            </div>
            <p className="mt-2 text-footnote text-muted-foreground">When you hit the top of the rep range on every set, the next session goes up by this much.</p>
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
