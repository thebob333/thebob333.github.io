import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Globe, Loader2, Repeat, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PasteFallback } from '@/components/ai/PasteFallback';
import { PathMap } from '@/components/path/PathMap';
import { useAiKey } from '@/lib/ai/device';
import { askJSON, research, AiError, type Research } from '@/lib/ai/client';
import { DayZeroPlan, IntakeQuestions, parsePasted, schemaText } from '@/lib/ai/schemas';
import {
  COACH_SYSTEM, DAY_ZERO_ARCHITECT_TASK, DAY_ZERO_QUESTIONS_TASK, DAY_ZERO_RETHINK_TASK, RESEARCH_SYSTEM, dayZeroContext, pastePrompt,
} from '@/lib/ai/prompts';
import { architect, goalStateText } from '@/lib/day-zero';
import { buildPath, pathDate } from '@/lib/path';
import { stores } from '@/lib/storage';
import { dateKeyOf, todayKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';
import { cn } from '@/lib/utils';

type Step = 'brief' | 'asking' | 'questions' | 'researching' | 'designing' | 'preview' | 'paste';

const HOURS = [2, 3, 5, 7, 10, 15, 20];
const EXAMPLES = ['Make an award-winning short film', 'Start a company that pays my rent', 'Run a marathon under 4 hours', 'Learn Japanese well enough to live in Tokyo'];
const DESIGN_STAGES = ['Mapping the stages…', 'Estimating honest effort…', 'Working out what depends on what…', 'Designing alternative routes…', 'Stress-testing the plan…', 'Scheduling it around your week…'];

/**
 * Day Zero: tell it something enormous; it asks a few questions, researches
 * how it's really done, designs 2–3 routes with dependencies and honest
 * effort, schedules the work, and keeps re-planning as reality intervenes.
 *
 * `goal` = redesign that goal (finished work is kept); otherwise a new goal.
 */
export function DayZeroSheet({ open, goal, onClose }: { open: boolean; goal?: Goal | null; onClose: () => void }) {
  const navigate = useNavigate();
  const hasKey = !!useAiKey();
  const rethink = !!goal?.architect;
  const [step, setStep] = useState<Step>('brief');
  const [brief, setBrief] = useState('');
  const [changed, setChanged] = useState('');
  const [hours, setHours] = useState(5);
  const [deadline, setDeadline] = useState('');
  const [questions, setQuestions] = useState<IntakeQuestions['questions']>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [searches, setSearches] = useState<string[]>([]);
  const [found, setFound] = useState<Research | null>(null);
  const [plan, setPlan] = useState<DayZeroPlan | null>(null);
  const [routeIndex, setRouteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const today = todayKey();

  // Fill from the goal each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setStep('brief'); setQuestions([]); setAnswers([]); setSearches([]); setFound(null); setPlan(null); setError(null); setChanged('');
    setBrief(goal ? (goal.architect?.brief || [goal.title, goal.why].filter(Boolean).join(' — ')) : '');
    setHours(goal?.hoursPerWeek ?? 5);
    setDeadline(goal?.deadline ? dateKeyOf(goal.deadline) : '');
  }, [open, goal]);

  // Rotating progress messages while designing.
  useEffect(() => {
    if (step !== 'designing') return;
    const id = setInterval(() => setTick(t => t + 1), 6000);
    return () => clearInterval(id);
  }, [step]);

  const qa = () => questions.map((q, i) => `Q: ${q.question}\nA: ${answers[i]?.trim() || '(skipped)'}`).join('\n\n');
  const context = () => dayZeroContext(brief, today, {
    hoursPerWeek: hours,
    deadline: deadline || undefined,
    qa: rethink ? (changed.trim() ? `What changed: ${changed.trim()}` : undefined) : qa() || undefined,
    existing: goal ? goalStateText(goal, today) : undefined,
  });
  const fail = (e: unknown, back: Step) => { setError(e instanceof AiError ? e.message : (e as Error)?.message || 'Something went wrong. Try again.'); setStep(back); };

  const start = async () => {
    if (!brief.trim()) return;
    setError(null);
    if (!hasKey) { setStep('paste'); return; }
    if (rethink) { void design(); return; }
    setStep('asking');
    try {
      const r = await askJSON({ system: COACH_SYSTEM, messages: [{ role: 'user', content: `${context()}\n\n${DAY_ZERO_QUESTIONS_TASK}` }], schema: IntakeQuestions, effort: 'low' });
      setQuestions(r.questions.slice(0, 4));
      setAnswers(r.questions.map(() => ''));
      setStep('questions');
    } catch (e) { fail(e, 'brief'); }
  };

  const design = async () => {
    setError(null);
    let notes = found;
    if (!rethink && !notes) {
      setStep('researching');
      setSearches([]);
      try {
        notes = await research(RESEARCH_SYSTEM, `${context()}\n\nResearch how people actually achieve this.`, q => setSearches(s => [...s, q]));
        setFound(notes);
      } catch {
        notes = null; // Research is a bonus: keep going without it.
      }
    }
    setStep('designing');
    setTick(0);
    try {
      const r = await askJSON({
        system: COACH_SYSTEM,
        messages: [{
          role: 'user',
          content: `${context()}\n\n${notes?.text ? `Research brief:\n${notes.text}\n\n` : ''}${rethink ? DAY_ZERO_RETHINK_TASK : DAY_ZERO_ARCHITECT_TASK}`,
        }],
        schema: DayZeroPlan, effort: 'high', maxTokens: 48000, stream: true,
      });
      if (!r.routes.length) throw new Error('The design came back empty. Try again.');
      setPlan(r);
      setRouteIndex(Math.min(Math.max(0, r.recommendedRoute), r.routes.length - 1));
      setStep('preview');
    } catch (e) { fail(e, rethink ? 'brief' : 'questions'); }
  };

  // Each route, built and scheduled, for the preview.
  const built = useMemo(() => {
    if (!plan) return [];
    return plan.routes.map((_, i) => {
      let n = 0;
      const g = architect(plan, { brief, hoursPerWeek: hours, deadline: deadline || undefined, today, now: new Date(), newId: () => `pv${i}_${++n}`, routeIndex: i }, goal ?? undefined);
      return { goal: g, path: buildPath(g, today) };
    });
  }, [plan, brief, hours, deadline, today, goal]);
  const chosen = built[routeIndex];

  const commit = () => {
    if (!plan) return;
    const g = architect(plan, {
      brief, hoursPerWeek: hours, deadline: deadline || undefined, sources: found?.sources, today, now: new Date(),
      newId: () => crypto.randomUUID(), routeIndex,
    }, goal ?? undefined);
    if (goal) {
      const before = goal;
      stores.GOALS.update(goals => goals.map(x => (x.id === goal.id ? g : x)));
      toast.success(rethink ? 'Plan rebuilt' : 'Path designed', { description: 'Finished work was kept.', action: { label: 'Undo', onClick: () => stores.GOALS.update(goals => goals.map(x => (x.id === before.id ? before : x))) } });
      onClose();
    } else {
      stores.GOALS.update(goals => [...goals, g]);
      toast.success('Day Zero complete', { description: `${g.title} — your path is ready.` });
      onClose();
      navigate(`/goals/${g.id}`);
    }
  };

  const busy = step === 'asking' || step === 'researching' || step === 'designing';
  const title = step === 'preview' ? (goal ? 'Your new path' : plan?.title || 'Your path') : rethink ? 'Rethink the plan' : 'Day Zero';

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-title">{title}</DialogTitle>
          {step === 'brief' && (
            <DialogDescription>
              {rethink ? 'Tell it what changed. It redesigns what\'s left and keeps everything you\'ve finished.'
                : goal ? 'It researches how this is really done, designs routes, and schedules the work around your week.'
                  : 'Tell it something enormous. It researches the path, maps every dependency, schedules the work — and re-plans when life happens.'}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="-mx-1 max-h-[68vh] overflow-y-auto px-1 pb-1">
          {error && <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive">{error}</p>}

          {step === 'brief' && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void start(); }}>
              {rethink ? (
                <Textarea autoFocus value={changed} onChange={e => setChanged(e.target.value)} rows={3} className="rounded-xl text-body"
                  placeholder="e.g. Lost my camera person, have more time in January, the festival moved its deadline…" />
              ) : (
                <>
                  <Textarea autoFocus={!goal} value={brief} onChange={e => setBrief(e.target.value)} rows={3} className="rounded-xl text-[17px] font-medium"
                    placeholder="What do you want to achieve?" />
                  {!brief && !goal && (
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES.map(x => <button key={x} type="button" onClick={() => setBrief(x)} className="pressable rounded-full bg-secondary px-3 py-1.5 text-footnote">{x}</button>)}
                    </div>
                  )}
                </>
              )}
              <div>
                <p className="mb-2 text-footnote font-semibold text-muted-foreground">Hours a week you can give it</p>
                <div className="flex flex-wrap gap-1.5">
                  {HOURS.map(h => (
                    <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)}
                      className={cn('pressable h-10 min-w-[48px] rounded-full px-3 text-body font-semibold tabular-nums', hours === h ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>{h}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-footnote font-semibold text-muted-foreground">Target date (optional)</p>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Button type="submit" disabled={!brief.trim()} className="h-12 w-full rounded-xl text-body font-semibold">
                <Sparkles className="mr-2 h-4 w-4" /> {rethink ? 'Rethink it' : hasKey ? 'Design my path' : 'Use the Claude app instead'}
              </Button>
              {!hasKey && <p className="text-center text-footnote text-muted-foreground">Add your key in Settings → AI coach to have it research and design in the app.</p>}
            </form>
          )}

          {busy && (
            <div className="flex flex-col items-center py-10 text-center">
              {step === 'researching' ? <Globe className="h-8 w-8 animate-pulse text-primary" /> : <Loader2 className="h-8 w-8 animate-spin text-primary" />}
              <p className="mt-3 text-body font-medium">
                {step === 'asking' ? 'Thinking about your goal…' : step === 'researching' ? 'Researching how people actually do this…' : DESIGN_STAGES[tick % DESIGN_STAGES.length]}
              </p>
              <p className="mt-1 text-footnote text-muted-foreground">{step === 'designing' ? 'A deep design takes a minute or two. Keep the app open.' : step === 'researching' ? 'Searching the web for real timelines and deadlines.' : 'A few seconds.'}</p>
              {step === 'researching' && searches.length > 0 && (
                <ul className="mt-4 w-full max-w-sm space-y-1 text-left">
                  {searches.slice(-5).map((q, i) => <li key={i} className="flex items-center gap-2 text-footnote text-muted-foreground"><Check className="h-3.5 w-3.5 shrink-0 text-success" /><span className="truncate">{q}</span></li>)}
                </ul>
              )}
            </div>
          )}

          {step === 'questions' && (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); void design(); }}>
              {questions.map((q, i) => (
                <label key={i} className="block">
                  <span className="mb-1.5 block text-body font-medium">{q.question}</span>
                  <Input value={answers[i] ?? ''} onChange={e => setAnswers(a => a.map((x, j) => (j === i ? e.target.value : x)))} placeholder={q.placeholder} className="h-11 rounded-xl" />
                </label>
              ))}
              <p className="text-footnote text-muted-foreground">Skip any you're not sure about.</p>
              <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold">Research and design <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </form>
          )}

          {step === 'paste' && (
            <PasteFallback
              prompt={() => pastePrompt(rethink ? DAY_ZERO_RETHINK_TASK : DAY_ZERO_ARCHITECT_TASK, context(), schemaText(DayZeroPlan))}
              onReply={text => {
                try {
                  const r = parsePasted(DayZeroPlan, text);
                  if (!r.routes.length) throw new Error('That reply had no routes. Try again.');
                  setPlan(r); setRouteIndex(Math.min(Math.max(0, r.recommendedRoute), r.routes.length - 1)); setError(null); setStep('preview');
                } catch (e) { setError((e as Error).message); }
              }}
            />
          )}

          {step === 'preview' && plan && chosen && (
            <div className="space-y-4">
              <p className="text-body">{plan.strategy}</p>
              {plan.research && (
                <p className="rounded-xl bg-secondary/70 px-3 py-2 text-footnote"><Globe className="mr-1 inline h-3.5 w-3.5 text-primary" />{plan.research}</p>
              )}

              {/* Routes */}
              <div className="space-y-2">
                {plan.routes.map((r, i) => {
                  const p = built[i]?.path;
                  const on = i === routeIndex;
                  return (
                    <button key={i} type="button" onClick={() => setRouteIndex(i)} aria-pressed={on}
                      className={cn('pressable w-full rounded-2xl p-3 text-left', on ? 'bg-primary/10 ring-2 ring-primary/60' : 'bg-secondary/70')}>
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-body font-semibold">{r.name}{i === plan.recommendedRoute && <span className="ml-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Recommended</span>}</span>
                        {p?.finish && <span className="shrink-0 text-footnote tabular-nums text-muted-foreground">{pathDate(p.finish, today)} · {Math.round(p.remainingHours)}h</span>}
                      </span>
                      <span className="mt-0.5 block text-footnote text-muted-foreground">{r.summary}</span>
                      {on && r.tradeoff && <span className="mt-0.5 block text-footnote">{r.tradeoff}</span>}
                    </button>
                  );
                })}
              </div>

              <div className="surface overflow-hidden py-2">
                <PathMap plan={chosen.path} today={today} />
              </div>
              {chosen.path.vsDeadline && chosen.path.deadline && (
                <p className={cn('text-footnote font-medium', chosen.path.vsDeadline === 'behind' || chosen.path.vsDeadline === 'at-risk' ? 'text-warning' : 'text-success')}>
                  {chosen.path.vsDeadline === 'behind' || chosen.path.vsDeadline === 'at-risk'
                    ? `At ${hours} h/week this likely lands after your ${pathDate(chosen.path.deadline, today)} target${chosen.path.neededHours ? ` — ${chosen.path.neededHours} h/week would make it` : ''}.`
                    : `Fits before your ${pathDate(chosen.path.deadline, today)} target.`}
                </p>
              )}

              <div className="rounded-2xl bg-primary/10 p-3">
                <p className="text-footnote font-semibold text-primary">First step — today</p>
                <p className="text-body font-medium">{plan.firstStep}</p>
              </div>

              {plan.risks.length > 0 && (
                <div className="list-group">
                  <p className="px-4 pt-2.5 text-footnote font-semibold text-muted-foreground">How this could fail — and the plan for it</p>
                  {plan.risks.map((r, i) => <p key={i} className="flex gap-2 px-4 py-2 text-footnote"><ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" /><span><b>{r.risk}</b> — {r.mitigation}</span></p>)}
                </div>
              )}
              {plan.routes[routeIndex]?.stages.some(s => s.practices.length) && (
                <div className="list-group">
                  <p className="px-4 pt-2.5 text-footnote font-semibold text-muted-foreground">Practices</p>
                  {plan.routes[routeIndex].stages.flatMap(s => s.practices).map((p, i) => (
                    <p key={i} className="flex gap-2 px-4 py-2 text-footnote"><Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-habits" /><span><b>{p.title}</b> · {p.perWeek >= 7 ? 'daily' : `${p.perWeek}×/week`} · easy version: {p.easyVersion}</span></p>
                  ))}
                </div>
              )}
              {found?.sources?.length ? <p className="text-footnote text-muted-foreground">Researched from {found.sources.length} source{found.sources.length === 1 ? '' : 's'} — listed under Strategy on the goal.</p> : null}
            </div>
          )}
        </div>

        {step === 'preview' && plan && (
          <div className="flex gap-2">
            <Button variant="secondary" className="h-12 rounded-xl px-4" onClick={() => setStep('brief')}>Back</Button>
            <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={commit}>
              {goal ? `Use "${plan.routes[routeIndex]?.name}"` : `Start on "${plan.routes[routeIndex]?.name}"`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
