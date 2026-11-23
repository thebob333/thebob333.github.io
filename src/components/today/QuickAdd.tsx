import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, CheckSquare, Dumbbell, Mic, Plus, Sparkles, Target } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoals, goalActions } from '@/hooks/useGoals';
import { todayKey } from '@/lib/dates';

type View = 'menu' | 'todo';

/** One button for the things you do most: add a to-do, start a workout, start a goal. */
export function QuickAdd({ onStartWorkout, onReview, onCheckIn, onCapture }: { onStartWorkout: () => void; onReview: () => void; onCheckIn: () => void; onCapture: () => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('menu');
  const navigate = useNavigate();
  const { goals } = useGoals();

  // Every task you could add a to-do to, labelled with its goal.
  const tasks = useMemo(() => goals.filter(g => !g.archived).flatMap(g =>
    g.phases.flatMap(p => p.tasks.map(t => ({ key: `${g.id}|${p.id}|${t.id}`, label: `${g.title} · ${t.title}`, done: t.status === 'complete' }))),
  ).filter(t => !t.done), [goals]);
  const [taskKey, setTaskKey] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(todayKey());

  const close = () => { setOpen(false); setTimeout(() => setView('menu'), 200); };

  const addTodo = () => {
    const key = taskKey || tasks[0]?.key;
    if (!key || !title.trim()) return;
    const [g, p, t] = key.split('|');
    goalActions.addToDo(g, p, t, title.trim(), due || undefined);
    toast.success('To-do added', { description: due === todayKey() ? 'It’s on today’s checklist.' : undefined });
    setTitle('');
    close();
  };

  const item = (icon: React.ReactNode, label: string, hint: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl border bg-background p-3 text-left active:bg-accent">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      <span className="min-w-0"><span className="block text-[15px] font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></span>
    </button>
  );

  return (
    <>
      {/* Portal so the page's entrance animation can't offset a fixed button. */}
      {createPortal(
        <button
          type="button"
          aria-label="Quick add"
          onClick={() => setOpen(true)}
          className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 md:bottom-8 md:right-8"
          style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
        >
          <Plus className="h-6 w-6" />
        </button>,
        document.body,
      )}

      <Dialog open={open} onOpenChange={o => (o ? setOpen(true) : close())}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{view === 'todo' ? 'Add a to-do' : 'Quick add'}</DialogTitle>
          </DialogHeader>

          {view === 'menu' && (
            <div className="space-y-2">
              {item(<Mic className="h-5 w-5" />, 'Brain dump', 'Say what you did; it updates your goals', () => { close(); onCapture(); })}
              {tasks.length > 0 && item(<CheckSquare className="h-5 w-5" />, 'Add a to-do', 'Goes into one of your goals', () => setView('todo'))}
              {item(<Dumbbell className="h-5 w-5" />, 'Start today’s workout', 'Exercises filled in for you', () => { close(); onStartWorkout(); })}
              {item(<Target className="h-5 w-5" />, 'New goal', 'Turn something big into a plan', () => { close(); navigate('/goals?new=1'); })}
              {item(<Sparkles className="h-5 w-5" />, 'Weekly check-in', 'Your coach reviews the week and adjusts', () => { close(); onCheckIn(); })}
              {item(<CalendarCheck className="h-5 w-5" />, 'Week in numbers', 'Practices, workouts, records, focus', () => { close(); onReview(); })}
            </div>
          )}

          {view === 'todo' && (
            <form className="space-y-3" onSubmit={e => { e.preventDefault(); addTodo(); }}>
              <Input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="What needs doing?" className="h-11" />
              <Select value={taskKey || tasks[0]?.key} onValueChange={setTaskKey}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Which goal?" /></SelectTrigger>
                <SelectContent>{tasks.map(t => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={due} onChange={e => setDue(e.target.value)} className="h-11" aria-label="Due date" />
                {due && <Button type="button" variant="ghost" className="h-11" onClick={() => setDue('')}>No date</Button>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setView('menu')}>Back</Button>
                <Button type="submit" className="h-11 flex-1 font-semibold" disabled={!title.trim()}>Add</Button>
              </div>
            </form>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
