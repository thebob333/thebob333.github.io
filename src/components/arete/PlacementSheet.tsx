import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { areteActions, areteBodyweight } from '@/hooks/useArete';
import { AREAS, LADDERS } from '@/lib/arete/tree';

/**
 * Quick placement: nobody starts life at zero. Answer what you know (fastest
 * mile, books read, countries visited…) and everything you've already reached
 * unlocks at once.
 */
export function PlacementSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const filled = Object.values(answers).filter(v => v.trim()).length;

  const save = () => {
    areteActions.place(answers);
    setAnswers({});
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">Where are you already?</DialogTitle>
          <DialogDescription>Fill in what you know and skip the rest. Everything you've already reached unlocks at once. Rough answers are fine.</DialogDescription>
        </DialogHeader>
        <form className="-mx-1 max-h-[60vh] space-y-5 overflow-y-auto px-1 pb-1" onSubmit={e => { e.preventDefault(); save(); }}>
          {AREAS.map(area => {
            const list = LADDERS.filter(l => l.area === area.id && l.ask);
            if (!list.length) return null;
            return (
              <fieldset key={area.id} className="space-y-2">
                <legend className="text-footnote font-bold uppercase tracking-wide" style={{ color: `hsl(${area.hue})` }}>{area.name}</legend>
                {list.map(l => (
                  <label key={l.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-body">{l.ask}</span>
                    <input value={answers[l.id] ?? ''} onChange={e => setAnswers(a => ({ ...a, [l.id]: e.target.value }))} placeholder={l.hint}
                      inputMode={l.kind === 'time' ? 'text' : 'decimal'} aria-label={l.ask}
                      className="h-11 w-28 shrink-0 rounded-xl bg-secondary px-3 text-right text-body font-semibold tabular-nums outline-none placeholder:font-normal placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/50" />
                  </label>
                ))}
                {area.id === 'body' && <p className="text-footnote text-muted-foreground">Lifts are compared with your bodyweight from Settings ({areteBodyweight()} lb). Times like 7:42 or 1:58:00.</p>}
              </fieldset>
            );
          })}
        </form>
        <Button className="h-12 w-full rounded-xl text-body font-semibold" disabled={!filled} onClick={save}>
          {filled ? `Unlock what I've earned (${filled} answer${filled === 1 ? '' : 's'})` : 'Answer at least one'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
