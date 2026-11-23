import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';
import { cardioActions } from '@/hooks/useCardio';
import { stores } from '@/lib/storage';
import { isActiveGoal } from '@/lib/goal-shapes';
import { CARDIO_LABELS, paceText, type CardioKind, type DistanceUnit } from '@/types/workout';

const KINDS = (Object.keys(CARDIO_LABELS) as CardioKind[]).map(k => ({ value: k, label: CARDIO_LABELS[k] }));

/** Log a run, walk, ride, swim or row: distance, time, pace — and optionally feed a "get better" goal. */
export function CardioSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const goals = useStore(stores.GOALS);
  const last = useStore(stores.CARDIO).at(-1);
  const [kind, setKind] = useState<CardioKind>(last?.kind ?? 'run');
  const [unit, setUnit] = useState<DistanceUnit>(last?.unit ?? 'mi');
  const [distance, setDistance] = useState('');
  const [h, setH] = useState('');
  const [m, setM] = useState('');
  const [s, setS] = useState('');
  const [note, setNote] = useState('');
  const [goalId, setGoalId] = useState('');

  // Timed "get better" goals (e.g. 5K time in minutes) can take this run's time.
  const timedGoals = useMemo(() => goals.filter(g => isActiveGoal(g) && g.shape === 'better' && g.metric && /^min/i.test(g.metric.unit)), [goals]);
  const seconds = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
  const dist = Number(distance) > 0 ? Number(distance) : undefined;
  const pace = paceText({ distance: dist, seconds, unit });

  const reset = () => { setDistance(''); setH(''); setM(''); setS(''); setNote(''); setGoalId(''); };
  const save = () => {
    if (!seconds) return;
    cardioActions.add({ date: new Date().toISOString(), kind, distance: dist, unit, seconds, note: note.trim() || undefined }, goalId || undefined);
    reset();
    onClose();
  };

  const box = 'h-12 w-full min-w-0 rounded-xl bg-secondary px-3 text-center text-headline tabular-nums outline-none';
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">Log cardio</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={e => { e.preventDefault(); save(); }}>
          <Chips<CardioKind> label="Activity" options={KINDS} value={kind} onChange={setKind} />
          <div>
            <FieldLabel>Distance (optional)</FieldLabel>
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" step="any" value={distance} onChange={e => setDistance(e.target.value)} placeholder="3.1" className={box} aria-label="Distance" />
              <Chips<DistanceUnit> label="Unit" options={[{ value: 'mi', label: 'mi' }, { value: 'km', label: 'km' }]} value={unit} onChange={setUnit} />
            </div>
          </div>
          <div>
            <FieldLabel>Time</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" inputMode="numeric" value={h} onChange={e => setH(e.target.value)} placeholder="h" className={box} aria-label="Hours" />
              <input type="number" inputMode="numeric" value={m} onChange={e => setM(e.target.value)} placeholder="min" className={box} aria-label="Minutes" />
              <input type="number" inputMode="numeric" value={s} onChange={e => setS(e.target.value)} placeholder="sec" className={box} aria-label="Seconds" />
            </div>
            {pace && <p className="mt-2 text-footnote font-semibold text-move">Pace {pace}</p>}
          </div>
          {timedGoals.length > 0 && (
            <div>
              <FieldLabel>Also count toward a goal?</FieldLabel>
              <Chips<string> label="Goal" value={goalId} onChange={setGoalId}
                options={[{ value: '', label: 'No' }, ...timedGoals.map(g => ({ value: g.id, label: g.title }))]} />
              {goalId && <p className="mt-1.5 text-footnote text-muted-foreground">Logs {seconds ? `${Math.round((seconds / 60) * 10) / 10} min` : 'the time'} as today's {timedGoals.find(g => g.id === goalId)!.metric!.name}.</p>}
            </div>
          )}
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional) — how did it feel?" className="h-11 w-full rounded-xl bg-secondary px-3 text-body outline-none placeholder:text-muted-foreground" />
          <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold" disabled={!seconds}>Save</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
