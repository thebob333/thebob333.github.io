import { useState } from 'react';
import { ArrowRight, Loader2, Repeat, Sparkles, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, AiError } from '@/lib/ai/client';
import { GoalPlan, IntakeQuestions, parsePasted, schemaText } from '@/lib/ai/schemas';
import { COACH_SYSTEM, INTAKE_PLAN_TASK, INTAKE_QUESTIONS_TASK, intakeContext, pastePrompt } from '@/lib/ai/prompts';
import { applyPlan } from '@/lib/ai/apply';
import { shapeInfo } from '@/lib/goal-shapes';
import { stores } from '@/lib/storage';
import { todayKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';

type Step = 'start' | 'asking' | 'questions' | 'planning' | 'preview' | 'paste';

/**
 * "Plan with the coach": 2–5 sharp questions, then a plan shaped for the goal
 * (stages, steps, practices with easy versions, if-then plans, a first step).
 * Nothing is added until you review it.
 */
export function CoachPlanSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const hasKey = !!useAiKey();
  const [step, setStep] = useState<Step>('start');
  const [questions, setQuestions] = useState<IntakeQuestions['questions']>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [plan, setPlan] = useState<GoalPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;
  const close = () => { setStep('start'); setQuestions([]); setAnswers([]); setNotes(''); setPlan(null); setError(null); onClose(); };
  const ctx = intakeContext(goal, todayKey());
  const fail = (e: unknown, back: Step) => { setError(e instanceof AiError ? e.message : 'Something went wrong. Try again.'); setStep(back); };

  const ask = async () => {
    setError(null);
    setStep('asking');
    try {
      const r = await askJSON({ system: COACH_SYSTEM, messages: [{ role: 'user', content: `${ctx}\n\n${INTAKE_QUESTIONS_TASK}` }], schema: IntakeQuestions, effort: 'low' });
      setQuestions(r.questions.slice(0, 5));
      setAnswers(r.questions.map(() => ''));
      setStep('questions');
    } catch (e) { fail(e, 'start'); }
  };

  const makePlan = async () => {
    setError(null);
    setStep('planning');
    const qa = questions.map((q, i) => `Q: ${q.question}\nA: ${answers[i]?.trim() || '(skipped)'}`).join('\n\n');
    try {
      const r = await askJSON({
        system: COACH_SYSTEM,
        messages: [{ role: 'user', content: `${ctx}\n\nThe user's answers:\n${qa}\n\n${INTAKE_PLAN_TASK}` }],
        schema: GoalPlan, effort: 'high',
      });
      setPlan(r);
      setStep('preview');
    } catch (e) { fail(e, 'questions'); }
  };

  const doImport = () => {
    if (!plan) return;
    const today = todayKey();
    stores.GOALS.update(goals => goals.map(g => (g.id === goal.id ? applyPlan(g, plan, today) : g)));
    const practices = plan.stages.reduce((n, s) => n + s.practices.length, 0);
    const steps = plan.stages.reduce((n, s) => n + s.steps.length, 0);
    toast.success('Plan added', { description: `${plan.stages.length} stage${plan.stages.length === 1 ? '' : 's'} · ${steps} step${steps === 1 ? '' : 's'} · ${practices} practice${practices === 1 ? '' : 's'}` });
    close();
  };

  const title = step === 'preview' ? 'Your plan' : 'Plan with the coach';

  return (
    <Dialog open onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">{title}</DialogTitle>
          {step === 'start' && <DialogDescription>A few quick questions, then a plan built for this kind of goal. You review it before anything is added.</DialogDescription>}
        </DialogHeader>

        <div className="-mx-1 max-h-[66vh] overflow-y-auto px-1 pb-1">
          {error && <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}

          {step === 'start' && (
            <div className="space-y-3">
              <div className="surface p-4">
                <p className="text-footnote font-semibold text-muted-foreground">Goal</p>
                <p className="text-headline">{goal.title}</p>
                <p className="mt-0.5 text-footnote text-muted-foreground">{shapeInfo(goal.shape).label} · {goal.pushback ?? 'honest'} coach</p>
              </div>
              {hasKey ? (
                <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={ask}><Sparkles className="mr-2 h-4 w-4" /> Start</Button>
              ) : (
                <Button className="h-12 w-full rounded-xl text-body font-semibold" onClick={() => setStep('paste')}>Use the Claude app instead</Button>
              )}
            </div>
          )}

          {(step === 'asking' || step === 'planning') && (
            <div className="flex flex-col items-center py-10 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-3 text-body font-medium">{step === 'asking' ? 'Thinking about your goal…' : 'Building your plan…'}</p>
              <p className="mt-1 text-footnote text-muted-foreground">{step === 'planning' ? 'This can take up to a minute.' : 'A few seconds.'}</p>
            </div>
          )}

          {step === 'questions' && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); makePlan(); }}>
              {questions.map((q, i) => (
                <label key={i} className="block">
                  <span className="mb-1.5 block text-body font-medium">{q.question}</span>
                  <Input value={answers[i] ?? ''} onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={q.placeholder} className="h-11 rounded-xl" />
                </label>
              ))}
              <p className="text-footnote text-muted-foreground">Skip any you're not sure about.</p>
              <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold">Make my plan <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </form>
          )}

          {step === 'paste' && (
            <PasteFallback
              extra={<Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="rounded-xl" placeholder="Anything the coach should know? Current level, time per week, what's stopped you before…" />}
              prompt={() => pastePrompt(INTAKE_PLAN_TASK, `${ctx}${notes.trim() ? `\n\nFrom the user: ${notes.trim()}` : ''}`, schemaText(GoalPlan))}
              onReply={text => {
                try { setPlan(parsePasted(GoalPlan, text)); setError(null); setStep('preview'); } catch (e) { setError((e as Error).message); }
              }}
            />
          )}

          {step === 'preview' && plan && (
            <div className="space-y-4">
              <p className="text-body">{plan.summary}</p>
              <div className="rounded-2xl bg-primary/10 p-3">
                <p className="text-footnote font-semibold text-primary">First step — today</p>
                <p className="text-body font-medium">{plan.firstStep}</p>
              </div>
              {plan.metric && <p className="text-footnote text-muted-foreground">Measuring: <b className="text-foreground">{plan.metric.name}</b>{plan.metric.target != null ? ` → ${plan.metric.target} ${plan.metric.unit}` : ''}</p>}
              {plan.stages.map((st, i) => (
                <div key={i} className="list-group">
                  <div className="px-4 py-2.5">
                    <p className="text-headline">{st.title} <span className="text-footnote font-normal text-muted-foreground">· ~{st.weeks} wk</span></p>
                    <p className="text-footnote text-muted-foreground">{st.description}</p>
                  </div>
                  {st.practices.map((p, j) => (
                    <div key={`p${j}`} className="flex items-start gap-2.5 px-4 py-2.5">
                      <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-habits" />
                      <div className="min-w-0">
                        <p className="text-body font-medium">{p.title} · {p.perWeek >= 7 ? 'daily' : `${p.perWeek}×/week`}{p.amount ? ` · ${p.amount} ${p.unit ?? ''}` : ''}</p>
                        <p className="text-footnote text-muted-foreground">Builds to {p.buildToPerWeek >= 7 ? 'daily' : `${p.buildToPerWeek}×/week`} · easy version: {p.easyVersion}</p>
                      </div>
                    </div>
                  ))}
                  {st.steps.map((s, j) => (
                    <div key={`s${j}`} className="flex items-start gap-2.5 px-4 py-2.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-tasks" />
                      <p className="min-w-0 text-body">{s.title}{s.dueInDays != null ? <span className="text-footnote text-muted-foreground"> · in {s.dueInDays}d</span> : ''}</p>
                    </div>
                  ))}
                </div>
              ))}
              {plan.ifThen.length > 0 && (
                <div className="list-group">
                  <p className="px-4 pt-2.5 text-footnote font-semibold text-muted-foreground">When things get in the way</p>
                  {plan.ifThen.map((t, i) => <p key={i} className="flex gap-2 px-4 py-2 text-body"><Zap className="mt-1 h-3.5 w-3.5 shrink-0 text-warning" />{t}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        {step === 'preview' && plan && (
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 rounded-xl px-4" onClick={() => setStep(hasKey ? 'questions' : 'paste')}>Back</Button>
            <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={doImport}>Add to my goal</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
