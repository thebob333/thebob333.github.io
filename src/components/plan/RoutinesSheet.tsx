import { useState } from 'react';
import { Clock, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useStore } from '@/hooks/useStore';
import { DAY_END_MIN, formatClock, fromTimeInput, toTimeInput } from '@/lib/plan-time';
import { DEFAULT_CATEGORIES, generateId, stores, type RepeatableBlock, type RepeatPattern } from '@/lib/storage';
import { cn } from '@/lib/utils';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PATTERNS: { value: RepeatPattern; label: string }[] = [
  { value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' }, { value: 'custom', label: 'Pick days' },
];
const DURATIONS = [15, 30, 45, 60, 90, 120];

const fmtTime = (h: number, m: number) => formatClock(h * 60 + m);
const fmtDuration = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);
const repeatText = (r: RepeatableBlock) => (r.repeatPattern === 'custom'
  ? (r.customDays?.length ? DAYS.filter(d => r.customDays!.includes(d)).map(d => d.slice(0, 3)).join(', ') : 'No days')
  : PATTERNS.find(p => p.value === r.repeatPattern)?.label ?? '');

/** Routines: blocks that fill in your Plan automatically on the days you pick. */
export function RoutinesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const routines = useStore(stores.REPEATABLE_BLOCKS);
  const categories = useStore(stores.BLOCK_CATEGORIES);
  const [form, setForm] = useState<RepeatableBlock | null>(null);
  const isNew = !!form && !routines.some(r => r.id === form.id);
  const cat = (id: string) => categories.find(c => c.id === id) || DEFAULT_CATEGORIES[0];

  const close = () => { setForm(null); onClose(); };
  const startNew = () => setForm({
    id: generateId(), title: '', categoryId: categories[0]?.id || 'workout',
    startHour: 7, startMinute: 0, durationMinutes: 30, repeatPattern: 'weekdays', customDays: [], enabled: true,
  });
  const set = (patch: Partial<RepeatableBlock>) => setForm(f => ({ ...f!, ...patch }));

  const save = () => {
    if (!form) return;
    if (!form.title.trim()) { toast.error('Give it a name'); return; }
    const startMin = form.startHour * 60 + form.startMinute;
    const maxDuration = DAY_END_MIN - startMin;
    if (maxDuration <= 0) { toast.error('Pick a start time before 3 AM'); return; }
    const saved = { ...form, title: form.title.trim(), durationMinutes: Math.min(form.durationMinutes, maxDuration) };
    if (saved.durationMinutes < form.durationMinutes) toast(`Shortened to ${saved.durationMinutes} min so it ends by 3 AM`);
    stores.REPEATABLE_BLOCKS.update(prev => (prev.some(r => r.id === saved.id) ? prev.map(r => (r.id === saved.id ? saved : r)) : [...prev, saved]));
    toast.success(isNew ? 'Routine added' : 'Routine saved', isNew ? { description: 'It fills in your Plan on the days you picked.' } : undefined);
    setForm(null);
  };

  const remove = (r: RepeatableBlock) => {
    stores.REPEATABLE_BLOCKS.update(prev => prev.filter(x => x.id !== r.id));
    setForm(null);
    toast.success('Routine removed', { action: { label: 'Undo', onClick: () => stores.REPEATABLE_BLOCKS.update(prev => (prev.some(x => x.id === r.id) ? prev : [...prev, r])) } });
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        {!form ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-title">Routines</DialogTitle>
              <DialogDescription>Things you do on a schedule — like “Gym 7–8 AM on weekdays”. They fill in your Plan for you.</DialogDescription>
            </DialogHeader>
            {routines.length > 0 && (
              <div className="list-group max-h-[50vh] overflow-y-auto">
                {routines.map(r => (
                  <div key={r.id} className={cn('flex min-h-[60px] items-center gap-3 pl-4 pr-3', !r.enabled && 'opacity-55')}>
                    <button type="button" onClick={() => setForm({ ...r })} className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${cat(r.categoryId).color})` }} />
                      <span className="min-w-0">
                        <span className="block truncate text-body font-semibold">{r.title}</span>
                        <span className="block truncate text-footnote text-muted-foreground">{fmtTime(r.startHour, r.startMinute)} · {fmtDuration(r.durationMinutes)} · {repeatText(r)}</span>
                      </span>
                    </button>
                    <Switch checked={r.enabled} aria-label={r.enabled ? `Pause ${r.title}` : `Turn on ${r.title}`}
                      onCheckedChange={() => stores.REPEATABLE_BLOCKS.update(prev => prev.map(x => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)))} />
                  </div>
                ))}
              </div>
            )}
            <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={startNew}><Plus className="mr-1.5 h-4 w-4" /> New routine</Button>
          </>
        ) : (
          <>
            <DialogHeader className="sr-only"><DialogTitle>{isNew ? 'New routine' : 'Edit routine'}</DialogTitle></DialogHeader>
            <div className="flex items-center gap-3">
              <Repeat className="h-5 w-5 shrink-0 text-primary" />
              <input autoFocus={isNew} value={form.title} onChange={e => set({ title: e.target.value })} placeholder="Name, e.g. Morning gym"
                className="h-12 min-w-0 flex-1 bg-transparent text-title outline-none placeholder:text-muted-foreground/60" />
            </div>
            <div className="max-h-[60vh] space-y-5 overflow-y-auto pb-1">
              <div>
                <FieldLabel>Repeats</FieldLabel>
                <Chips<RepeatPattern> label="Repeats" options={PATTERNS} value={form.repeatPattern} onChange={repeatPattern => set({ repeatPattern })} />
                {form.repeatPattern === 'custom' && (
                  <div className="mt-2 flex gap-1.5">
                    {DAYS.map(d => {
                      const on = form.customDays?.includes(d);
                      return (
                        <button key={d} type="button" aria-pressed={on} aria-label={d}
                          onClick={() => set({ customDays: on ? form.customDays.filter(x => x !== d) : [...(form.customDays ?? []), d] })}
                          className={cn('pressable h-10 flex-1 rounded-xl text-footnote font-semibold', on ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                          {d.slice(0, 1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <FieldLabel>Time</FieldLabel>
                <label className="inline-flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <input type="time" step={60} aria-label="Start time"
                    value={toTimeInput(form.startHour * 60 + form.startMinute)}
                    onChange={e => { const mins = fromTimeInput(e.target.value); if (mins !== null) set({ startHour: Math.floor(Math.min(mins, DAY_END_MIN - 1) / 60), startMinute: Math.min(mins, DAY_END_MIN - 1) % 60 }); }}
                    className="bg-transparent text-body font-semibold outline-none" />
                </label>
                <div className="mt-2">
                  <Chips<number> label="Length" options={DURATIONS.map(d => ({ value: d, label: fmtDuration(d) }))} value={form.durationMinutes} onChange={durationMinutes => set({ durationMinutes })} />
                </div>
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => {
                    const on = c.id === form.categoryId;
                    return (
                      <button key={c.id} type="button" aria-pressed={on} onClick={() => set({ categoryId: c.id })}
                        className="pressable flex h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold"
                        style={on ? { backgroundColor: `hsl(${c.color})`, color: 'white' } : { backgroundColor: `hsl(${c.color} / 0.14)` }}>
                        {!on && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${c.color})` }} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isNew && <Button variant="secondary" className="h-12 rounded-xl px-4 text-destructive" aria-label="Remove routine" onClick={() => remove(form)}><Trash2 className="h-4 w-4" /></Button>}
              <Button variant="secondary" className="h-12 rounded-xl px-5 text-body" onClick={() => setForm(null)}>Cancel</Button>
              <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={save}>{isNew ? 'Add routine' : 'Save'}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
