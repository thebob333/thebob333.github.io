import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** A tiny "name + optional date" sheet (add phase, add task). */
export function QuickFormSheet({ open, title, placeholder, cta, onSubmit, onClose }: {
  open: boolean; title: string; placeholder: string; cta: string;
  onSubmit: (name: string, deadline?: string) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  useEffect(() => { if (open) { setName(''); setDate(''); } }, [open]);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle className="text-title">{title}</DialogTitle></DialogHeader>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (name.trim()) { onSubmit(name.trim(), date || undefined); onClose(); } }}>
          <Input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} className="h-12 rounded-xl text-[17px]" />
          <div>
            <p className="mb-1.5 text-footnote font-semibold text-muted-foreground">Deadline (optional)</p>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={!name.trim()} className="h-12 w-full rounded-xl text-body font-semibold">{cta}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
