import { useEffect, useState } from 'react';
import { Coffee, MessageSquare, PhoneCall, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contactActions } from '@/hooks/useContacts';
import { ENERGY_LEVELS } from '@/lib/people';
import { dateKeyOf, todayKey } from '@/lib/dates';
import type { Contact, Interaction, InteractionType } from '@/lib/storage';

const TYPES: { value: InteractionType; label: string; icon: typeof PhoneCall }[] = [
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'call', label: 'Call', icon: PhoneCall },
  { value: 'hangout', label: 'Hangout', icon: Coffee },
  { value: 'meeting', label: 'Meeting', icon: Users },
];
const DURATIONS = [{ value: 0, label: '—' }, { value: 15, label: '15m' }, { value: 30, label: '30m' }, { value: 60, label: '1h' }, { value: 120, label: '2h+' }];

/** Log (or edit) time with someone: type, when, how long, how it felt, a note. Two taps for the basics. */
export function LogInteractionSheet({ contact, interaction, onClose }: { contact: Contact | null; interaction?: Interaction | null; onClose: () => void }) {
  const [type, setType] = useState<InteractionType>('text');
  const [date, setDate] = useState(todayKey());
  const [minutes, setMinutes] = useState(0);
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!contact) return;
    setType(interaction?.type ?? 'text');
    setDate(interaction ? dateKeyOf(interaction.date) : todayKey());
    setMinutes(interaction?.durationMinutes ?? 0);
    setEnergy(interaction?.energyAfter ?? null);
    setNote(interaction?.note ?? '');
  }, [contact, interaction]);

  const save = () => {
    if (!contact) return;
    const today = todayKey();
    const day = date && date <= today ? date : today;
    const when = day === today
      ? (interaction && dateKeyOf(interaction.date) === today ? interaction.date : new Date().toISOString())
      : day;
    const fields = { type, date: when, durationMinutes: minutes || undefined, energyAfter: energy ?? undefined, note: note.trim() || undefined };
    if (interaction) {
      contactActions.updateInteraction(interaction.id, fields);
      toast.success('Saved');
    } else {
      const i = contactActions.addInteraction({ contactId: contact.id, ...fields });
      toast.success(`Logged ${type} with ${contact.name}`, { action: { label: 'Undo', onClick: () => contactActions.deleteInteraction(i.id) } });
    }
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-title">{interaction ? 'Edit' : 'Log time with'} {contact?.name}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} aria-pressed={type === t.value}
                className={`pressable flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl text-footnote font-semibold transition-colors ${type === t.value ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}>
                <t.icon className="h-5 w-5" /> {t.label}
              </button>
            ))}
          </div>
          <div>
            <FieldLabel>How did you feel after?</FieldLabel>
            <div className="flex justify-between">
              {ENERGY_LEVELS.map(e => (
                <button key={e.value} type="button" onClick={() => setEnergy(energy === e.value ? null : e.value)} aria-pressed={energy === e.value} aria-label={e.label}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-[26px] transition ${energy === e.value ? 'scale-110 bg-primary/15 ring-2 ring-primary' : 'opacity-60'}`}>
                  {e.emoji}
                </button>
              ))}
            </div>
          </div>
          <div><FieldLabel>How long</FieldLabel><Chips<number> label="Duration" value={minutes} onChange={setMinutes} options={DURATIONS} /></div>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <div><FieldLabel>When</FieldLabel><Input type="date" max={todayKey()} value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl" /></div>
            {date !== todayKey() && <Button type="button" variant="secondary" className="h-11 rounded-xl" onClick={() => setDate(todayKey())}>Today</Button>}
          </div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="What did you talk about? (optional)" className="h-11 rounded-xl" />
          <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={save}>{interaction ? 'Save' : 'Log it'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
