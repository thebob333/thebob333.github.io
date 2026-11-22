import { useEffect, useState } from 'react';
import { Check, Loader2, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, AiError } from '@/lib/ai/client';
import { CheckInOpening, CheckInPlan, parsePasted, schemaText, type Proposal } from '@/lib/ai/schemas';
import { CHECKIN_OPEN_TASK, CHECKIN_PLAN_TASK, COACH_SYSTEM, pastePrompt, weekFacts } from '@/lib/ai/prompts';
import { applyProposal } from '@/lib/ai/apply';
import { stores } from '@/lib/storage';
import { todayKey } from '@/lib/dates';
import { updateSettings } from '@/hooks/useSettings';
import { reviewWeekStart } from './WeeklyReview';
import { cn } from '@/lib/utils';

type Step = 'loading' | 'opening' | 'thinking' | 'result' | 'paste' | 'error';

const KIND_LABEL: Record<Proposal['kind'], string> = { practice: 'Change a practice', deadline: 'Move a date', pause: 'Pause a goal', step: 'Add a step', ifThen: 'If-then plan' };

/** Drop suggestions that point at goals you don't have (the coach can get an id wrong). */
const clean = (r: CheckInPlan): CheckInPlan => {
  const ids = new Set(stores.GOALS.get().map(g => g.id));
  return { ...r, proposals: r.proposals.filter(p => ids.has(p.goalId)).slice(0, 5), focusGoalIds: r.focusGoalIds.filter(id => ids.has(id)) };
};

const facts = () => weekFacts(stores.GOALS.get(), stores.HABIT_LOGS.get(), stores.METRICS.get(), stores.ADJUSTMENTS.get(), todayKey());

/** The 2-minute weekly check-in with the coach (docs/apex-blueprint.md §7.3). */
export function CheckInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const hasKey = !!useAiKey();
  const [step, setStep] = useState<Step>('loading');
  const [opening, setOpening] = useState<CheckInOpening | null>(null);
  const [answer, setAnswer] = useState('');
  const [note, setNote] = useState('');
  const [result, setResult] = useState<CheckInPlan | null>(null);
  const [decided, setDecided] = useState<Record<number, 'accepted' | 'skipped'>>({});
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setError(null);
    setStep('loading');
    try {
      const r = await askJSON({ system: COACH_SYSTEM, messages: [{ role: 'user', content: `${facts()}\n\n${CHECKIN_OPEN_TASK}` }], schema: CheckInOpening, effort: 'medium' });
      setOpening(r);
      setStep('opening');
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
      setStep('error');
    }
  };

  useEffect(() => {
    if (!open) return;
    setOpening(null); setAnswer(''); setNote(''); setResult(null); setDecided({}); setError(null);
    if (hasKey) start(); else setStep('paste');
    // Start fresh each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reply = async () => {
    if (!opening) return;
    setError(null);
    setStep('thinking');
    try {
      const r = await askJSON({
        system: COACH_SYSTEM,
        messages: [
          { role: 'user', content: `${facts()}\n\n${CHECKIN_OPEN_TASK}` },
          { role: 'assistant', content: JSON.stringify(opening) },
          { role: 'user', content: `${answer.trim() || '(no answer — use your judgment)'}\n\n${CHECKIN_PLAN_TASK}` },
        ],
        schema: CheckInPlan, effort: 'medium',
      });
      setResult(clean(r));
      setStep('result');
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
      setStep('opening');
    }
  };

  const decide = (i: number, p: Proposal, accept: boolean) => {
    if (accept) {
      const r = applyProposal(stores.GOALS.get(), p, todayKey());
      if (!r) { toast.error("That suggestion didn't match your goals anymore — skipped"); setDecided(d => ({ ...d, [i]: 'skipped' })); return; }
      const before = stores.GOALS.get();
      stores.GOALS.set(r.goals);
      toast.success(r.label, { action: { label: 'Undo', onClick: () => { stores.GOALS.set(before); setDecided(d => { const n = { ...d }; delete n[i]; return n; }); } } });
    }
    setDecided(d => ({ ...d, [i]: accept ? 'accepted' : 'skipped' }));
  };

  const finish = () => {
    if (result?.focusGoalIds.length) {
      const valid = new Set(stores.GOALS.get().map(g => g.id));
      const focus = result.focusGoalIds.filter(id => valid.has(id)).slice(0, 3);
      if (focus.length) stores.WEEKLY_FOCUS.set(focus);
    }
    updateSettings({ lastReviewWeek: reviewWeekStart(todayKey()) });
    toast.success('Check-in done', { description: result?.nextStep });
    onClose();
  };

  const goalTitle = (id: string) => stores.GOALS.get().find(g => g.id === id)?.title ?? 'A goal';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">Weekly check-in</DialogTitle>
          {step === 'paste' && <DialogDescription>Your coach looks at what actually happened and suggests changes. You decide.</DialogDescription>}
        </DialogHeader>

        <div className="-mx-1 max-h-[68vh] overflow-y-auto px-1 pb-1">
          {error && step !== 'error' && <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}

          {(step === 'loading' || step === 'thinking') && (
            <div className="flex flex-col items-center py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-body font-medium">{step === 'loading' ? 'Looking at your week…' : 'Working out what to change…'}</p>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-3 py-4 text-center">
              <p className="text-body">{error}</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="h-11 flex-1 rounded-xl" onClick={() => setStep('paste')}>Use the Claude app</Button>
                <Button className="h-11 flex-1 rounded-xl" onClick={start}>Try again</Button>
              </div>
            </div>
          )}

          {step === 'opening' && opening && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); reply(); }}>
              <p className="whitespace-pre-line text-body">{opening.message}</p>
              {opening.questions.map((q, i) => <p key={i} className="text-body font-semibold">{q}</p>)}
              <Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} className="rounded-xl" placeholder="Be honest — the plan changes to fit your life, not the other way round." />
              <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold">Send</Button>
            </form>
          )}

          {step === 'paste' && (
            <PasteFallback
              extra={<Textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className="rounded-xl" placeholder="How did the week go? What got in the way? (optional)" />}
              prompt={() => pastePrompt(`${CHECKIN_OPEN_TASK}\n\nThen: ${CHECKIN_PLAN_TASK}`, `${facts()}${note.trim() ? `\n\nFrom the user: ${note.trim()}` : ''}`, schemaText(CheckInPlan))}
              onReply={text => {
                try { setResult(clean(parsePasted(CheckInPlan, text))); setError(null); setStep('result'); } catch (e) { setError((e as Error).message); }
              }}
            />
          )}

          {step === 'result' && result && (
            <div className="space-y-4">
              <p className="whitespace-pre-line text-body">{result.message}</p>
              {result.proposals.length > 0 && (
                <div className="list-group">
                  {result.proposals.map((p, i) => {
                    const d = decided[i];
                    return (
                      <div key={i} className={cn('px-4 py-3', d === 'skipped' && 'opacity-50')}>
                        <p className="text-footnote font-semibold text-muted-foreground">{KIND_LABEL[p.kind]} · {goalTitle(p.goalId)}</p>
                        <p className="text-body font-medium">
                          {p.kind === 'practice' ? `${p.perWeek ? `${p.perWeek >= 7 ? 'Daily' : `${p.perWeek}×/week`}` : ''}${p.amount ? `${p.perWeek ? ', ' : ''}${p.amount} per session` : ''}`
                            : p.kind === 'deadline' ? `New target date: ${p.deadline}`
                              : p.kind === 'pause' ? 'Pause this goal for now'
                                : p.title}
                        </p>
                        <p className="mt-0.5 text-footnote text-muted-foreground">{p.reason}</p>
                        {d ? (
                          <p className={cn('mt-2 flex items-center gap-1 text-footnote font-semibold', d === 'accepted' ? 'text-success' : 'text-muted-foreground')}>
                            {d === 'accepted' ? <><Check className="h-3.5 w-3.5" /> Done</> : <><X className="h-3.5 w-3.5" /> Skipped</>}
                          </p>
                        ) : (
                          <div className="mt-2 flex gap-2">
                            <button type="button" onClick={() => decide(i, p, true)} className="pressable h-9 rounded-full bg-primary px-3.5 text-footnote font-semibold text-primary-foreground">Accept</button>
                            <button type="button" onClick={() => decide(i, p, false)} className="pressable h-9 rounded-full bg-secondary px-3.5 text-footnote font-semibold">Skip</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {result.focusGoalIds.length > 0 && (
                <p className="flex items-start gap-1.5 text-footnote text-muted-foreground">
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 fill-warning text-warning" />
                  Focus this week: {result.focusGoalIds.map(goalTitle).join(', ')}
                </p>
              )}
              <div className="rounded-2xl bg-primary/10 p-3">
                <p className="text-footnote font-semibold text-primary">Next step</p>
                <p className="text-body font-medium">{result.nextStep}</p>
              </div>
            </div>
          )}
        </div>

        {step === 'result' && <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={finish}>Finish check-in</Button>}
      </DialogContent>
    </Dialog>
  );
}
