import { useState } from 'react';
import { Check, Loader2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, AiError } from '@/lib/ai/client';
import { Capture, parsePasted, schemaText, type CaptureAction } from '@/lib/ai/schemas';
import { CAPTURE_TASK, captureContext, pastePrompt } from '@/lib/ai/prompts';
import { captureEffect } from '@/lib/ai/apply';
import { habitActions } from '@/hooks/useHabits';
import { metricActions } from '@/hooks/useMetrics';
import { stores } from '@/lib/storage';
import { todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

type Step = 'write' | 'thinking' | 'review' | 'paste';

/**
 * Brain dump: type or dictate (the keyboard mic works here) everything at once —
 * "ran 2 miles, email the lawyer Friday, bench felt heavy" — and confirm the
 * actions the coach finds. Nothing changes until you tap Apply.
 */
export function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasKey = !!useAiKey();
  const [step, setStep] = useState<Step>('write');
  const [text, setText] = useState('');
  const [result, setResult] = useState<Capture | null>(null);
  const [picked, setPicked] = useState<boolean[]>([]);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setStep('write'); setText(''); setResult(null); setPicked([]); setError(null); onClose(); };
  const ctx = () => captureContext(stores.GOALS.get(), todayKey());
  const show = (r: Capture) => {
    const goals = stores.GOALS.get();
    const actions = r.actions.filter(a => captureEffect(goals, a, todayKey()) !== null);
    setResult({ ...r, actions });
    setPicked(actions.map(() => true));
    setStep('review');
  };

  const run = async () => {
    if (!text.trim()) return;
    setError(null);
    setStep('thinking');
    try {
      show(await askJSON({ system: 'You turn quick notes into actions on the user\'s goals. Be literal; never invent things they did not say.', messages: [{ role: 'user', content: `${ctx()}\n\nTheir note:\n"""${text.trim()}"""\n\n${CAPTURE_TASK}` }], schema: Capture, effort: 'low' }));
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
      setStep('write');
    }
  };

  const apply = () => {
    if (!result) return;
    const today = todayKey();
    let n = 0;
    result.actions.forEach((a: CaptureAction, i) => {
      if (!picked[i]) return;
      const eff = captureEffect(stores.GOALS.get(), a, today);
      if (!eff) return;
      n++;
      if (eff.type === 'goals') stores.GOALS.set(eff.goals);
      else if (eff.type === 'checkin') habitActions.checkIn(eff.habitId, undefined, today);
      else metricActions.log(eff.goalId, eff.value, today);
    });
    toast.success(n ? `${n} thing${n === 1 ? '' : 's'} updated` : 'Nothing changed');
    close();
  };

  const goalTitle = (id: string) => stores.GOALS.get().find(g => g.id === id)?.title ?? '';

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">Brain dump</DialogTitle>
          {step === 'write' && <DialogDescription>Say what you did and what's on your mind. The coach sorts it into your goals.</DialogDescription>}
        </DialogHeader>
        <div className="-mx-1 max-h-[66vh] overflow-y-auto px-1 pb-1">
          {error && <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}
          {step === 'write' && (
            <div className="space-y-3">
              <Textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={5} className="rounded-xl text-body"
                placeholder="e.g. ran 3 miles in 28:30, meditated, need to email the lawyer Friday, knee a bit sore" />
              <p className="flex items-center gap-1.5 text-footnote text-muted-foreground"><Mic className="h-3.5 w-3.5" /> Tap the microphone on your keyboard to talk instead of type.</p>
              {hasKey
                ? <Button className="h-12 w-full rounded-xl text-body font-semibold" disabled={!text.trim()} onClick={run}>Sort it out</Button>
                : <Button className="h-12 w-full rounded-xl text-body font-semibold" disabled={!text.trim()} onClick={() => setStep('paste')}>Continue with the Claude app</Button>}
            </div>
          )}
          {step === 'thinking' && (
            <div className="flex flex-col items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="mt-3 text-body font-medium">Sorting it out…</p></div>
          )}
          {step === 'paste' && (
            <PasteFallback
              prompt={() => pastePrompt(CAPTURE_TASK, `${ctx()}\n\nTheir note:\n"""${text.trim()}"""`, schemaText(Capture))}
              onReply={t => { try { show(parsePasted(Capture, t)); setError(null); } catch (e) { setError((e as Error).message); } }}
            />
          )}
          {step === 'review' && result && (
            <div className="space-y-3">
              {result.actions.length === 0 ? (
                <p className="text-body text-muted-foreground">Nothing in that matched your goals.</p>
              ) : (
                <div className="list-group">
                  {result.actions.map((a, i) => (
                    <button key={i} type="button" onClick={() => setPicked(p => p.map((x, j) => (j === i ? !x : x)))} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2', picked[i] ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>
                        {picked[i] && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-body font-medium">{a.summary}</span>
                        <span className="block text-footnote text-muted-foreground">{goalTitle(a.goalId)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {result.unmatched.length > 0 && <p className="text-footnote text-muted-foreground">Didn't match a goal: {result.unmatched.join('; ')}</p>}
            </div>
          )}
        </div>
        {step === 'review' && result && (
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 rounded-xl px-4" onClick={() => setStep('write')}>Back</Button>
            <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={apply} disabled={!picked.some(Boolean)}>Apply</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
