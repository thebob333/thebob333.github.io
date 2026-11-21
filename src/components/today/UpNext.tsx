import { useState } from 'react';
import { ChevronDown, Dumbbell, Flame, HandHeart, Sparkles } from 'lucide-react';
import { ListRow, CheckCircle, IconBadge } from '@/components/app/ListRow';

export type UpNextItem =
  | { kind: 'workout'; id: string; title: string; subtitle?: string; done: boolean; onStart: () => void; resume?: boolean }
  | { kind: 'todo'; id: string; title: string; subtitle?: string; days: number | null; done: boolean; onToggle: () => void }
  | { kind: 'habit'; id: string; title: string; subtitle?: string; streak: number; done: boolean; onToggle: () => void }
  | { kind: 'commitment'; id: string; title: string; subtitle?: string; days: number | null; done: boolean; onToggle: () => void };

const C = {
  habit: 'hsl(var(--habits))',
  todo: 'hsl(var(--tasks))',
  workout: 'hsl(var(--move))',
  commitment: 'hsl(var(--people))',
};

function Due({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-footnote font-semibold text-destructive">{-days}d late</span>;
  if (days === 0) return <span className="text-footnote font-medium text-muted-foreground">Today</span>;
  if (days === 1) return <span className="text-footnote text-muted-foreground">Tomorrow</span>;
  return <span className="text-footnote text-muted-foreground">in {days}d</span>;
}

function Row({ item }: { item: UpNextItem }) {
  if (item.kind === 'workout') {
    return (
      <ListRow
        leading={<IconBadge color={C.workout}><Dumbbell className="h-4 w-4" /></IconBadge>}
        title={item.title}
        subtitle={item.subtitle}
        muted={item.done}
        trailing={!item.done && (
          <button type="button" onClick={item.onStart} className="pressable h-8 rounded-full px-3.5 text-footnote font-semibold text-white" style={{ backgroundColor: C.workout }}>
            {item.resume ? 'Resume' : 'Start'}
          </button>
        )}
      />
    );
  }
  const color = C[item.kind];
  return (
    <ListRow
      onClick={item.onToggle}
      leading={<CheckCircle done={item.done} color={color} onToggle={item.onToggle} label={item.title} />}
      title={item.title}
      subtitle={item.subtitle}
      muted={item.done}
      trailing={
        item.kind === 'habit'
          ? item.streak > 0 && <span className="flex items-center gap-0.5 text-footnote font-semibold" style={{ color: C.habit }}><Flame className="h-3.5 w-3.5" />{item.streak}</span>
          : item.kind === 'commitment'
            ? <span className="flex items-center gap-1"><HandHeart className="h-3.5 w-3.5 text-muted-foreground" /><Due days={item.days} /></span>
            : !item.done && <Due days={item.days} />
      }
    />
  );
}

function Disclosure({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="flex h-11 w-full items-center justify-between px-1 text-footnote font-semibold text-muted-foreground">
        {label} · {count}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="list-group">{children}</div>}
    </div>
  );
}

/** Everything to do today in one list, in a sensible order; finished items fold away. */
export function UpNext({ items, later }: { items: UpNextItem[]; later: UpNextItem[] }) {
  const open = items.filter(i => !i.done);
  const done = items.filter(i => i.done);

  return (
    <section aria-label="Up next" className="space-y-2">
      <h2 className="section-label">Up next</h2>
      {open.length > 0 ? (
        <div className="list-group">{open.map(i => <Row key={i.kind + i.id} item={i} />)}</div>
      ) : (
        <div className="surface flex items-center gap-3 p-4">
          <IconBadge color="hsl(var(--habits))"><Sparkles className="h-4 w-4" /></IconBadge>
          <div>
            <p className="text-body font-semibold">{items.length ? 'All done for today' : 'Nothing scheduled today'}</p>
            <p className="text-footnote text-muted-foreground">{items.length ? 'Enjoy it — you earned it.' : 'Add a goal or a to-do with the + button.'}</p>
          </div>
        </div>
      )}
      <Disclosure label="Completed" count={done.length}>{done.map(i => <Row key={i.kind + i.id} item={i} />)}</Disclosure>
      <Disclosure label="Later this week" count={later.length}>{later.map(i => <Row key={i.kind + i.id} item={i} />)}</Disclosure>
    </section>
  );
}
