import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Chips, FieldLabel } from '@/components/app/Chips';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contactActions } from '@/hooks/useContacts';
import type { Commitment, Contact } from '@/lib/storage';

type Repeat = '' | 'weekly' | 'biweekly' | 'monthly';

/** A promise you made to someone — optionally due on a date and repeating. */
export function CommitmentSheet({ contact, commitment, onClose }: { contact: Contact | null; commitment?: Commitment | null; onClose: () => void }) {
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const [repeat, setRepeat] = useState<Repeat>('');
  useEffect(() => {
    if (!contact) return;
    setText(commitment?.text ?? '');
    setDue(commitment?.dueDate ?? '');
    setRepeat((commitment?.recurring ?? '') as Repeat);
  }, [contact, commitment]);

  const save = () => {
    if (!contact || !text.trim()) return;
    const fields = { text: text.trim(), dueDate: due || undefined, recurring: repeat || undefined };
    if (commitment) contactActions.updateCommitment(commitment.id, fields);
    else contactActions.addCommitment({ contactId: contact.id, ...fields });
    toast.success(commitment ? 'Saved' : 'Promise added');
    onClose();
  };

  return (
    <Dialog open={!!contact} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-title">{commitment ? 'Edit promise' : `Promise to ${contact?.name}`}</DialogTitle></DialogHeader>
        <form className="space-y-5" onSubmit={e => { e.preventDefault(); save(); }}>
          <Input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Send them the book" className="h-12 rounded-xl text-[17px]" />
          <div><FieldLabel>Due</FieldLabel><Input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-11 rounded-xl" /></div>
          <div><FieldLabel>Repeat</FieldLabel>
            <Chips<Repeat> label="Repeat" value={repeat} onChange={setRepeat} options={[{ value: '', label: 'Once' }, { value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: '2 weeks' }, { value: 'monthly', label: 'Monthly' }]} />
          </div>
          <Button type="submit" disabled={!text.trim()} className="h-12 w-full rounded-xl text-body font-semibold">{commitment ? 'Save' : 'Add promise'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
