import { useState } from 'react';
import { AlertCircle, Check, ClipboardCopy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { goalActions } from '@/hooks/useGoals';
import { stores, generateId } from '@/lib/storage';
import type { Goal } from '@/types/goals';
import { buildGoalPrompt } from '@/lib/goal-ai-prompt';
import { applyPlanToGoal, parseGoalPlan, type ParseResult } from '@/lib/goal-plan-parser';

/** "Plan with AI": copy a ready-made prompt, paste the AI's reply, review, import. */
export function AIPlanSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [reply, setReply] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);

  const close = () => { setCopied(false); setReply(''); setParsed(null); onClose(); };

  const copy = async () => {
    if (!goal) return;
    try {
      await navigator.clipboard.writeText(buildGoalPrompt(goal));
      setCopied(true);
      toast.success('Prompt copied', { description: 'Paste it into ChatGPT, Claude or Gemini.' });
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  };

  const onReplyChange = (text: string) => {
    setReply(text);
    setParsed(text.trim() ? parseGoalPlan(text) : null);
  };

  const doImport = () => {
    if (!goal || !parsed) return;
    const latest = stores.GOALS.get().find(g => g.id === goal.id) ?? goal;
    const { goal: merged, stats } = applyPlanToGoal(latest, parsed, generateId);
    goalActions.updateGoal(goal.id, { phases: merged.phases, adaptationProtocol: merged.adaptationProtocol });
    toast.success(`Plan added — ${stats.tasks} tasks, ${stats.todos} to-dos, ${stats.habits} habits`, {
      description: stats.skipped ? `${stats.skipped} already existed and were skipped.` : undefined,
      action: { label: 'Undo', onClick: () => goalActions.restoreGoal(latest) },
    });
    close();
  };

  const counts = parsed && {
    phases: parsed.phases.length,
    tasks: parsed.phases.reduce((s, p) => s + p.tasks.length, 0),
    todos: parsed.phases.reduce((s, p) => s + p.tasks.reduce((a, t) => a + t.todos.length, 0), 0),
    habits: parsed.phases.reduce((s, p) => s + p.tasks.reduce((a, t) => a + t.habits.length, 0), 0),
  };

  return (
    <Dialog open={!!goal} onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-title"><Sparkles className="h-5 w-5 text-primary" /> Plan with AI</DialogTitle>
          <DialogDescription>Get a complete plan — phases, to-dos and habits — in about a minute.</DialogDescription>
        </DialogHeader>

        <ol className="space-y-5">
          <li>
            <p className="mb-2 text-headline">1. Copy the prompt</p>
            <Button onClick={copy} className="h-12 w-full rounded-xl text-body font-semibold" variant={copied ? 'secondary' : 'default'}>
              {copied ? <><Check className="mr-2 h-4 w-4" /> Copied — now paste it into your AI</> : <><ClipboardCopy className="mr-2 h-4 w-4" /> Copy prompt</>}
            </Button>
          </li>
          <li>
            <p className="mb-2 text-headline">2. Paste the AI's reply</p>
            <Textarea value={reply} onChange={e => onReplyChange(e.target.value)} placeholder="Paste the whole reply here…" className="min-h-[140px] rounded-xl font-mono text-[13px]" />
          </li>
          {parsed && counts && (
            <li>
              <p className="mb-2 text-headline">3. Review & add</p>
              {counts.phases > 0 ? (
                <div className="surface p-4">
                  <div className="grid grid-cols-4 text-center">
                    {[['Phases', counts.phases], ['Tasks', counts.tasks], ['To-dos', counts.todos], ['Habits', counts.habits]].map(([l, n]) => (
                      <div key={l as string}><p className="text-title tabular-nums">{n}</p><p className="text-footnote text-muted-foreground">{l}</p></div>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-1 border-t pt-3 text-footnote text-muted-foreground">
                    {parsed.phases.map((p, i) => <li key={i} className="truncate"><span className="font-semibold text-foreground">{p.title}</span> · {p.tasks.map(t => t.title).join(', ') || 'no tasks'}</li>)}
                  </ul>
                </div>
              ) : null}
              {parsed.warnings.length > 0 && (
                <div className="mt-2 rounded-xl bg-destructive/10 p-3 text-footnote text-destructive">
                  {parsed.warnings.slice(0, 4).map((w, i) => <p key={i} className="flex gap-1.5"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{w}</p>)}
                </div>
              )}
              <Button onClick={doImport} disabled={counts.phases === 0} className="mt-3 h-12 w-full rounded-xl text-body font-semibold">
                Add to “{goal?.title}”
              </Button>
            </li>
          )}
        </ol>
      </DialogContent>
    </Dialog>
  );
}
