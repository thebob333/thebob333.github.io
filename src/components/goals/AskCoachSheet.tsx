import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, AiError } from '@/lib/ai/client';
import { CoachAnswer, parsePasted, schemaText, type Proposal } from '@/lib/ai/schemas';
import { ASK_TASK, COACH_SYSTEM, goalFacts, pastePrompt } from '@/lib/ai/prompts';
import { applyProposal } from '@/lib/ai/apply';
import { stores } from '@/lib/storage';
import { todayKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';

const SUGGESTED = ["I'm stuck — what should I do next?", 'Is my timeline realistic?', 'Find me a better approach'];

/** Ask the coach anything about one goal; useful answers come with "Add to plan" buttons. */
export function AskCoachSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const hasKey = !!useAiKey();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [paste, setPaste] = useState(false);
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  if (!goal) return null;

  const close = () => { setQuestion(''); setBusy(false); setPaste(false); setAnswer(null); setAdded([]); setError(null); onClose(); };
  const ctx = () => `${goalFacts(stores.GOALS.get().find(g => g.id === goal.id) ?? goal, stores.HABIT_LOGS.get(), stores.METRICS.get(), stores.ADJUSTMENTS.get(), todayKey())}\n\nTheir question: ${question.trim()}`;

  const ask = async () => {
    if (!question.trim()) return;
    setError(null);
    setBusy(true);
    try {
      setAnswer(await askJSON({ system: COACH_SYSTEM, messages: [{ role: 'user', content: `Today is ${todayKey()}.\n${ctx()}\n\n${ASK_TASK}` }], schema: CoachAnswer, effort: 'medium' }));
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const add = (i: number, p: Proposal) => {
    const before = stores.GOALS.get();
    const r = applyProposal(before, { ...p, goalId: goal.id }, todayKey());
    if (!r) { toast.error("That suggestion didn't fit this goal"); return; }
    stores.GOALS.set(r.goals);
    setAdded(a => [...a, i]);
    toast.success(r.label, { action: { label: 'Undo', onClick: () => { stores.GOALS.set(before); setAdded(a => a.filter(x => x !== i)); } } });
  };

  const what = (p: Proposal) => p.kind === 'practice' ? `${p.perWeek ? (p.perWeek >= 7 ? 'Daily' : `${p.perWeek}×/week`) : ''}${p.amount ? ` · ${p.amount} per session` : ''}`
    : p.kind === 'deadline' ? `New target date: ${p.deadline}` : p.kind === 'pause' ? 'Pause this goal' : p.title;

  return (
    <Dialog open onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-title">Ask the coach</DialogTitle></DialogHeader>
        <div className="-mx-1 max-h-[66vh] overflow-y-auto px-1 pb-1">
          {error && <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}
          {!answer && !paste && (
            <div className="space-y-3">
              <p className="text-footnote text-muted-foreground">About “{goal.title}”. The coach sees your plan, practices and progress.</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map(s => <button key={s} type="button" onClick={() => setQuestion(s)} className="pressable rounded-full bg-secondary px-3 py-2 text-footnote font-semibold">{s}</button>)}
              </div>
              <Textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} className="rounded-xl" placeholder="Ask anything about this goal…" />
              {busy ? (
                <div className="flex items-center justify-center gap-2 py-3 text-body"><Loader2 className="h-5 w-5 animate-spin text-primary" /> Thinking…</div>
              ) : hasKey ? (
                <Button className="h-12 w-full rounded-xl text-body font-semibold" disabled={!question.trim()} onClick={ask}>Ask</Button>
              ) : (
                <Button className="h-12 w-full rounded-xl text-body font-semibold" disabled={!question.trim()} onClick={() => setPaste(true)}>Continue with the Claude app</Button>
              )}
            </div>
          )}
          {paste && !answer && (
            <PasteFallback prompt={() => pastePrompt(ASK_TASK, `Today is ${todayKey()}.\n${ctx()}`, schemaText(CoachAnswer))}
              onReply={t => { try { setAnswer(parsePasted(CoachAnswer, t)); setError(null); } catch (e) { setError((e as Error).message); } }} />
          )}
          {answer && (
            <div className="space-y-4">
              <p className="whitespace-pre-line text-body">{answer.answer}</p>
              {answer.proposals.length > 0 && (
                <div className="list-group">
                  {answer.proposals.map((p, i) => (
                    <div key={i} className="flex items-start gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-medium">{what(p)}</p>
                        <p className="text-footnote text-muted-foreground">{p.reason}</p>
                      </div>
                      {added.includes(i)
                        ? <span className="flex h-9 items-center gap-1 text-footnote font-semibold text-success"><Check className="h-4 w-4" /> Added</span>
                        : <button type="button" onClick={() => add(i, p)} className="pressable h-9 shrink-0 rounded-full bg-primary px-3 text-footnote font-semibold text-primary-foreground">Add to plan</button>}
                    </div>
                  ))}
                </div>
              )}
              <Button variant="secondary" className="h-11 w-full rounded-xl" onClick={() => { setAnswer(null); setPaste(false); setQuestion(''); setAdded([]); }}>Ask something else</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
