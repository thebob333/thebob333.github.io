import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { goalActions } from '@/hooks/useGoals';
import type { GoalDomain, GoalShape } from '@/types/goals';
import { DOMAINS, DOMAIN_STYLE } from '@/lib/goal-meta';
import { SHAPES } from '@/lib/goal-shapes';
import { cn } from '@/lib/utils';

/** Create a goal with just a title; everything else is optional. Opens the goal when done. */
export function NewGoalSheet({ open, onClose, onDayZero }: { open: boolean; onClose: () => void; onDayZero?: () => void }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [deadline, setDeadline] = useState('');
  const [domain, setDomain] = useState<GoalDomain | ''>('');
  const [shape, setShape] = useState<GoalShape>('build');

  const reset = () => { setTitle(''); setWhy(''); setDeadline(''); setDomain(''); setShape('build'); };

  const create = () => {
    if (!title.trim()) return;
    const g = goalActions.addGoal(title.trim(), '', '', deadline || undefined, domain || undefined, shape);
    if (why.trim()) goalActions.updateGoal(g.id, { why: why.trim() });
    reset();
    onClose();
    navigate(`/goals/${g.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title">New goal</DialogTitle>
          <DialogDescription>Start with the outcome. You'll break it down next.</DialogDescription>
        </DialogHeader>
        {onDayZero && (
          <button type="button" onClick={onDayZero} className="pressable flex w-full items-center gap-3 rounded-2xl bg-primary/10 p-3 text-left">
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="block text-body font-semibold">Let Day Zero design it</span>
              <span className="block text-footnote text-muted-foreground">Research, routes, dependencies and a schedule — from one sentence.</span>
            </span>
          </button>
        )}
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); create(); }}>
          <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Run a half marathon" className="h-12 rounded-xl text-[17px] font-medium" />
          <Textarea value={why} onChange={e => setWhy(e.target.value)} placeholder="Why does it matter to you? (optional)" rows={2} className="rounded-xl" />
          <div>
            <p className="mb-2 text-footnote font-semibold text-muted-foreground">What kind of goal?</p>
            <div className="grid grid-cols-2 gap-2">
              {SHAPES.map(sh => {
                const on = shape === sh.value;
                const Icon = sh.icon;
                return (
                  <button key={sh.value} type="button" aria-pressed={on} onClick={() => setShape(sh.value)}
                    className={cn('pressable flex flex-col items-start gap-1 rounded-xl p-3 text-left', on ? 'bg-primary text-primary-foreground' : 'bg-secondary', sh.value === 'become' && 'col-span-2')}>
                    <span className="flex items-center gap-1.5 text-body font-semibold"><Icon className="h-4 w-4" /> {sh.label}</span>
                    <span className={cn('text-footnote leading-snug', on ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{sh.examples}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-footnote font-semibold text-muted-foreground">Area of life</p>
            <div className="flex flex-wrap gap-2">
              {DOMAINS.map(d => (
                <button key={d} type="button" onClick={() => setDomain(domain === d ? '' : d)} aria-pressed={domain === d}
                  className="pressable h-9 rounded-full px-3.5 text-footnote font-semibold transition-colors"
                  style={domain === d ? { background: DOMAIN_STYLE[d].gradient, color: 'white' } : { backgroundColor: 'hsl(var(--secondary))' }}>
                  {DOMAIN_STYLE[d].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-footnote font-semibold text-muted-foreground">Target date (optional)</p>
            <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <Button type="submit" disabled={!title.trim()} className="h-12 w-full rounded-xl text-body font-semibold">Create goal</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
