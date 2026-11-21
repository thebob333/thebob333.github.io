import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { contactActions } from '@/hooks/useContacts';
import { CHECK_IN_OPTIONS, INFLUENCES, RELATIONSHIPS, RINGS } from '@/lib/people';
import type { CircleRing, Contact, InfluenceTag, RelationshipTag } from '@/lib/storage';

interface Form {
  name: string; phone: string; email: string;
  relationship: RelationshipTag; circleRing: CircleRing; influenceTag: InfluenceTag;
  goalDays: number; customDays: string; plan: string; notes: string;
}

const blank = (): Form => ({ name: '', phone: '', email: '', relationship: 'friend', circleRing: 'close', influenceTag: 'neutral', goalDays: 14, customDays: '', plan: '', notes: '' });

function fromContact(c: Contact): Form {
  const preset = CHECK_IN_OPTIONS.some(o => o.days === (c.interactionGoalDays ?? 0));
  return {
    name: c.name, phone: c.phone ?? '', email: c.email ?? '',
    relationship: c.relationship, circleRing: c.circleRing, influenceTag: c.influenceTag,
    goalDays: preset ? (c.interactionGoalDays ?? 0) : -1, customDays: preset ? '' : String(c.interactionGoalDays ?? ''),
    plan: c.plan ?? '', notes: c.notes ?? '',
  };
}

/** Add or edit a person. Only the name is required. */
export function ContactFormSheet({ open, contact, onClose, onCreated }: {
  open: boolean; contact?: Contact | null; onClose: () => void; onCreated?: (c: Contact) => void;
}) {
  const [f, setF] = useState<Form>(blank);
  useEffect(() => { if (open) setF(contact ? fromContact(contact) : blank()); }, [open, contact]);
  const set = (patch: Partial<Form>) => setF(prev => ({ ...prev, ...patch }));

  const save = () => {
    if (!f.name.trim()) return;
    const days = f.goalDays === -1 ? Number(f.customDays) || undefined : f.goalDays || undefined;
    const data = {
      name: f.name.trim(), phone: f.phone.trim() || undefined, email: f.email.trim() || undefined,
      relationship: f.relationship, circleRing: f.circleRing, influenceTag: f.influenceTag,
      interactionGoalDays: days, plan: f.plan.trim(), notes: f.notes.trim(),
    };
    if (contact) {
      contactActions.updateContact(contact.id, data);
      toast.success('Saved');
    } else {
      const c = contactActions.addContact(data);
      toast.success(`${c.name} added`);
      onCreated?.(c);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">{contact ? 'Edit person' : 'Add person'}</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={e => { e.preventDefault(); save(); }}>
          <div className="list-group">
            <Input autoFocus={!contact} value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Name" className="h-12 rounded-none border-0 bg-transparent px-4 text-[17px] font-medium shadow-none focus-visible:ring-0" />
            <Input value={f.phone} onChange={e => set({ phone: e.target.value })} placeholder="Phone" type="tel" inputMode="tel" className="h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0" />
            <Input value={f.email} onChange={e => set({ email: e.target.value })} placeholder="Email" type="email" inputMode="email" className="h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-0" />
          </div>
          <div><FieldLabel>Check in</FieldLabel>
            <Chips label="Check-in goal" value={f.goalDays} onChange={v => set({ goalDays: v })}
              options={[...CHECK_IN_OPTIONS.map(o => ({ value: o.days, label: o.label })), { value: -1, label: 'Custom' }]} />
            {f.goalDays === -1 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-body">Every</span>
                <Input value={f.customDays} onChange={e => set({ customDays: e.target.value.replace(/\D/g, '') })} inputMode="numeric" className="h-10 w-20 rounded-xl" />
                <span className="text-body">days</span>
              </div>
            )}
          </div>
          <div><FieldLabel>Circle</FieldLabel>
            <Chips label="Circle" value={f.circleRing} onChange={v => set({ circleRing: v })} options={RINGS.map(r => ({ value: r.value, label: r.label, hint: r.hint }))} />
          </div>
          <div><FieldLabel>Relationship</FieldLabel>
            <Chips label="Relationship" value={f.relationship} onChange={v => set({ relationship: v })} options={RELATIONSHIPS} />
          </div>
          <div><FieldLabel>How they leave you feeling</FieldLabel>
            <Chips label="Influence" value={f.influenceTag} onChange={v => set({ influenceTag: v })} options={INFLUENCES} />
          </div>
          <div><FieldLabel>Your plan for this relationship</FieldLabel>
            <Textarea value={f.plan} onChange={e => set({ plan: e.target.value })} placeholder="e.g. Monthly dinner, call on Sundays" rows={2} className="rounded-xl" />
          </div>
          <div><FieldLabel>Notes</FieldLabel>
            <Textarea value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder="Birthday, kids' names, what they're working on…" rows={3} className="rounded-xl" />
          </div>
          <Button type="submit" disabled={!f.name.trim()} className="h-12 w-full rounded-xl text-body font-semibold">{contact ? 'Save' : 'Add person'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
