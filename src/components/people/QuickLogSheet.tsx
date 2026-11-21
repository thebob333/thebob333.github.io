import { useEffect, useState } from 'react';
import { Coffee, MessageSquare, PhoneCall, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contactActions } from '@/hooks/useContacts';
import { ENERGY_LEVELS } from '@/lib/people';
import type { Contact, InteractionType } from '@/lib/storage';

const TYPES: { value: InteractionType; label: string; icon: typeof PhoneCall }[] = [
  { value: 'text', label: 'Text', icon: MessageSquare },
  { value: 'call', label: 'Call', icon: PhoneCall },
  { value: 'hangout', label: 'Hangout', icon: Coffee },
  { value: 'meeting', label: 'Meeting', icon: Users },
];

/** Log time with someone in two taps — used from Today and the Plan. */
export function QuickLogSheet({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const [type, setType] = useState<InteractionType>('text');
  const [energy, setEnergy] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  useEffect(() => { if (contact) { setType('text'); setEnergy(null); setNote(''); } }, [contact]);

  const save = () => {
    if (!contact) return;
    const i = contactActions.addInteraction({ contactId: contact.id, type, energyAfter: energy ?? undefined, note: note.trim() || undefined });
    toast.success(`Logged ${type} with ${contact.name}`, { action: { label: 'Undo', onClick: () => contactActions.deleteInteraction(i.id) } });
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Log time with {contact?.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setType(t.value)} aria-pressed={type === t.value}
                className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium ${type === t.value ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground'}`}>
                <t.icon className="h-5 w-5" /> {t.label}
              </button>
            ))}
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">How did you feel after? (optional)</p>
            <div className="flex justify-between">
              {ENERGY_LEVELS.map(e => (
                <button key={e.value} type="button" onClick={() => setEnergy(energy === e.value ? null : e.value)} aria-pressed={energy === e.value} aria-label={e.label}
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl transition ${energy === e.value ? 'bg-primary/15 ring-2 ring-primary' : 'opacity-70'}`}>
                  {e.emoji}
                </button>
              ))}
            </div>
          </div>
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="h-10" />
          <Button className="h-11 w-full font-semibold" onClick={save}>Log it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
