import { useMemo, useState } from 'react';
import { Check, ChevronRight, Clock, Link2, Search, Target, Trash2, User, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { FieldLabel } from '@/components/app/Chips';
import { Avatar } from '@/components/people/Avatar';
import { Button } from '@/components/ui/button';
import { useStore } from '@/hooks/useStore';
import { stores, type Contact, type TimeBlock } from '@/lib/storage';
import { getDaysRemaining } from '@/types/goals';
import { DAY_END_MIN, clampStart, fromTimeInput, toTimeInput } from '@/lib/plan-time';
import { cn } from '@/lib/utils';

export interface BacklogTodo {
  todoId: string;
  title: string;
  goalTitle: string;
  goalId?: string;
  phaseTitle?: string;
  taskTitle?: string;
  deadline?: string;
  effort?: string;
}

const DURATIONS = [15, 30, 45, 60, 90, 120];
const fmtDuration = (m: number) => (m < 60 ? `${m}m` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60}h`);
const startOf = (b: TimeBlock) => b.startHour * 60 + b.startMinute;

type Picker = null | 'todo' | 'person';

/** Everything about one Plan block, in a sheet with big touch targets. */
export function BlockSheet({ block, contacts, backlogTodos, todoDone, onUpdate, onDelete, onToggleTodo, onLogContact, onEditCategories, onClose }: {
  block: TimeBlock | null;
  contacts: Contact[];
  backlogTodos: BacklogTodo[];
  todoDone: boolean;
  onUpdate: (patch: Partial<TimeBlock>) => void;
  onDelete: () => void;
  onToggleTodo: () => void;
  onLogContact: (c: Contact) => void;
  onEditCategories: () => void;
  onClose: () => void;
}) {
  const categories = useStore(stores.BLOCK_CATEGORIES);
  const [picker, setPicker] = useState<Picker>(null);
  const [query, setQuery] = useState('');
  const person = block?.contactId ? contacts.find(c => c.id === block.contactId) : undefined;

  const todos = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? backlogTodos.filter(t => `${t.title} ${t.goalTitle}`.toLowerCase().includes(q)) : backlogTodos;
  }, [backlogTodos, query]);
  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? contacts.filter(c => c.name.toLowerCase().includes(q)) : contacts).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [contacts, query]);

  if (!block) return null;
  const close = () => { setPicker(null); setQuery(''); onClose(); };
  const openPicker = (p: Picker) => { setQuery(''); setPicker(p); };

  // Times before 5 AM mean after midnight — Plan's day runs until 3 AM.
  const setStart = (v: string) => {
    const mins = fromTimeInput(v);
    if (mins === null) return;
    const start = clampStart(mins, block.durationMinutes);
    onUpdate({ startHour: Math.floor(start / 60), startMinute: start % 60 });
  };
  const setEnd = (v: string) => {
    const mins = fromTimeInput(v);
    if (mins === null) return;
    const end = Math.min(DAY_END_MIN, mins);
    if (end - startOf(block) >= 1) onUpdate({ durationMinutes: end - startOf(block) });
  };
  const setDuration = (d: number) => onUpdate({ durationMinutes: Math.max(1, Math.min(d, DAY_END_MIN - startOf(block))) });

  const row = 'flex min-h-[52px] w-full items-center gap-3 px-4 text-left';

  return (
    <Dialog open onOpenChange={o => !o && close()}>
      <DialogContent className="max-w-md">
        {picker === null ? (
          <>
            <DialogHeader className="sr-only"><DialogTitle>Edit block</DialogTitle></DialogHeader>
            <div className="flex items-center gap-3">
              {block.todoId && (
                <button type="button" role="checkbox" aria-checked={todoDone} aria-label="Done" onClick={onToggleTodo}
                  className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[2.5px]', todoDone ? 'border-tasks bg-tasks text-white' : 'border-tasks/50')}>
                  {todoDone && <Check className="h-4 w-4" strokeWidth={3.5} />}
                </button>
              )}
              <input
                autoFocus={!block.title}
                value={block.title}
                onChange={e => onUpdate({ title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                placeholder="What's this time for?"
                className={cn('h-12 min-w-0 flex-1 bg-transparent text-title outline-none placeholder:text-muted-foreground/60', todoDone && 'text-muted-foreground line-through')}
              />
            </div>

            <div className="max-h-[60vh] space-y-5 overflow-y-auto pb-1">
              <div>
                <FieldLabel>When</FieldLabel>
                <div className="flex items-center gap-2">
                  <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <input type="time" step={60} value={toTimeInput(startOf(block))} onChange={e => setStart(e.target.value)} className="bg-transparent text-body font-semibold outline-none" aria-label="Start time" />
                  </label>
                  <span className="text-footnote text-muted-foreground">to</span>
                  <label className="flex h-11 items-center rounded-xl bg-secondary px-3">
                    <input type="time" step={60} value={toTimeInput(startOf(block) + block.durationMinutes)} onChange={e => setEnd(e.target.value)} className="bg-transparent text-body font-semibold outline-none" aria-label="End time" />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Length">
                  {DURATIONS.map(d => (
                    <button key={d} type="button" role="radio" aria-checked={block.durationMinutes === d} onClick={() => setDuration(d)}
                      className={cn('pressable h-9 rounded-full px-3.5 text-footnote font-semibold', block.durationMinutes === d ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
                      {fmtDuration(d)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-footnote font-semibold text-muted-foreground">Category</p>
                  <button type="button" onClick={onEditCategories} className="text-footnote font-semibold text-primary">Edit</button>
                </div>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
                  {categories.map(c => {
                    const on = c.id === block.categoryId;
                    return (
                      <button key={c.id} type="button" role="radio" aria-checked={on} onClick={() => onUpdate({ categoryId: c.id })}
                        className="pressable flex h-9 items-center gap-1.5 rounded-full px-3 text-footnote font-semibold"
                        style={on ? { backgroundColor: `hsl(${c.color})`, color: 'white' } : { backgroundColor: `hsl(${c.color} / 0.14)` }}>
                        {!on && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: `hsl(${c.color})` }} />}
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="list-group">
                {block.todoId ? (
                  <div className={row}>
                    <Target className="h-5 w-5 shrink-0 text-tasks" />
                    <span className="min-w-0 flex-1"><span className="block text-footnote text-muted-foreground">Goal to-do</span><span className="block truncate text-body font-medium">{block.title || 'Linked to-do'}</span></span>
                    <button type="button" aria-label="Unlink to-do" onClick={() => onUpdate({ todoId: undefined })} className="flex h-10 w-10 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button type="button" className={row} onClick={() => openPicker('todo')} disabled={backlogTodos.length === 0}>
                    <Link2 className="h-5 w-5 shrink-0 text-tasks" />
                    <span className="flex-1 text-body font-medium">{backlogTodos.length ? 'Link a goal to-do' : 'No open to-dos to link'}</span>
                    {backlogTodos.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
                  </button>
                )}
                {person ? (
                  <div className={row}>
                    <Avatar contact={person} size={28} />
                    <span className="min-w-0 flex-1"><span className="block text-footnote text-muted-foreground">With</span><span className="block truncate text-body font-medium">{person.name}</span></span>
                    <button type="button" onClick={() => onLogContact(person)} className="h-9 rounded-full bg-people/10 px-3 text-footnote font-semibold text-people">Log time</button>
                    <button type="button" aria-label="Unlink person" onClick={() => onUpdate({ contactId: undefined, title: block.title.replace(` w/ ${person.name}`, '').replace(`w/ ${person.name}`, '').trim() })} className="flex h-10 w-8 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <button type="button" className={row} onClick={() => openPicker('person')} disabled={contacts.length === 0}>
                    <User className="h-5 w-5 shrink-0 text-people" />
                    <span className="flex-1 text-body font-medium">{contacts.length ? 'Add a person' : 'Add people in the People tab first'}</span>
                    {contacts.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground/60" />}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="h-12 rounded-xl px-4 text-destructive" aria-label="Delete block" onClick={() => { onDelete(); close(); }}><Trash2 className="h-4 w-4" /></Button>
              <Button className="h-12 flex-1 rounded-xl text-body font-semibold" onClick={close}>Done</Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-title">{picker === 'todo' ? 'Link a to-do' : 'Add a person'}</DialogTitle>
            </DialogHeader>
            <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" />
            </label>
            <div className="list-group max-h-[50vh] overflow-y-auto">
              {picker === 'todo' ? todos.map(t => {
                const days = getDaysRemaining(t.deadline);
                return (
                  <button key={t.todoId} type="button" className={row} onClick={() => { onUpdate({ todoId: t.todoId, title: t.title }); setPicker(null); }}>
                    <span className="min-w-0 flex-1 py-2">
                      <span className="block truncate text-body font-medium">{t.title}</span>
                      <span className="block truncate text-footnote text-muted-foreground">{t.goalTitle}</span>
                    </span>
                    {days !== null && <span className={cn('text-footnote font-semibold', days < 0 ? 'text-destructive' : days <= 1 ? 'text-warning' : 'text-muted-foreground')}>{days < 0 ? `${-days}d late` : days === 0 ? 'Today' : `${days}d`}</span>}
                  </button>
                );
              }) : people.map(c => (
                <button key={c.id} type="button" className={row} onClick={() => {
                  onUpdate({ contactId: c.id, title: block.title ? `${block.title} w/ ${c.name}` : `w/ ${c.name}` });
                  setPicker(null);
                }}>
                  <Avatar contact={c} size={32} />
                  <span className="flex-1 truncate text-body font-medium">{c.name}</span>
                </button>
              ))}
              {(picker === 'todo' ? todos : people).length === 0 && <p className="px-4 py-6 text-center text-footnote text-muted-foreground">Nothing matches.</p>}
            </div>
            <Button variant="secondary" className="h-12 w-full rounded-xl text-body" onClick={() => setPicker(null)}>Back</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
