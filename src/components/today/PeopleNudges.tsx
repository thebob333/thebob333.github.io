import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageSquare, Phone, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useContacts } from '@/hooks/useContacts';
import { useTodayKey } from '@/hooks/useToday';
import { daysBetween, dateKeyOf } from '@/lib/dates';
import { CheckRow } from './HabitCheckRow';
import { QuickLogSheet } from '@/components/people/QuickLogSheet';
import type { Contact } from '@/lib/storage';

const RING_RANK = { core: 0, close: 1, extended: 2, distant: 3 } as const;

/** People to reach out to and promises coming due — the "relationships" part of today. */
export function PeopleNudges() {
  const { contacts, activeCommitments, getStreakStatus, getDaysSinceLastInteraction, completeCommitment, uncompleteCommitment } = useContacts();
  const today = useTodayKey();
  const [logFor, setLogFor] = useState<Contact | null>(null);

  const withGoals = useMemo(() => contacts.filter(c => c.interactionGoalDays), [contacts]);
  const onTrack = withGoals.filter(c => getStreakStatus(c) === 'on-track').length;

  const reachOut = useMemo(() =>
    withGoals
      .map(c => ({ c, status: getStreakStatus(c), days: getDaysSinceLastInteraction(c.id) }))
      .filter(x => x.status === 'overdue' || x.status === 'due-soon')
      // Overdue first, then closest people, then longest gap.
      .sort((a, b) => Number(a.status !== 'overdue') - Number(b.status !== 'overdue')
        || (RING_RANK[a.c.circleRing] ?? 3) - (RING_RANK[b.c.circleRing] ?? 3)
        || (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 3),
  [withGoals, getStreakStatus, getDaysSinceLastInteraction]);

  const dueCommitments = useMemo(() =>
    activeCommitments
      .filter(c => c.dueDate && daysBetween(today, dateKeyOf(c.dueDate)) <= 2)
      .slice(0, 3),
  [activeCommitments, today]);

  const nameOf = (id: string) => contacts.find(c => c.id === id)?.name ?? 'Someone';

  if (reachOut.length === 0 && dueCommitments.length === 0) {
    if (withGoals.length === 0) return null;
    return (
      <Link to="/people" className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <Users className="h-5 w-5 text-success" />
        <p className="flex-1 text-sm"><span className="font-semibold">{withGoals.length === 1 ? 'Your connection is on track.' : `All ${withGoals.length} connections on track.`}</span> <span className="text-muted-foreground">Nice.</span></p>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <section className="rounded-2xl border bg-card p-4 shadow-sm" aria-label="People">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold"><Users className="h-4 w-4 text-primary" /> People</h2>
        {withGoals.length > 0 && <span className="text-xs text-muted-foreground">{onTrack}/{withGoals.length} on track</span>}
      </div>

      {reachOut.map(({ c, days, status }) => (
        <div key={c.id} className="flex min-h-[52px] items-center gap-3 border-b border-border/60 py-1 last:border-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {c.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-medium">{c.name}</p>
            <p className={`truncate text-xs ${status === 'overdue' ? 'text-destructive' : 'text-warning'}`}>
              {days === null ? 'Not in touch yet' : days === 0 ? 'Connected today' : `${days} day${days === 1 ? '' : 's'} since you connected`} · goal every {c.interactionGoalDays}d
            </p>
          </div>
          {c.phone && (
            <>
              <a href={`sms:${c.phone}`} aria-label={`Text ${c.name}`} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
                <MessageSquare className="h-4 w-4" />
              </a>
              <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
                <Phone className="h-4 w-4" />
              </a>
            </>
          )}
          <button type="button" onClick={() => setLogFor(c)} className="h-9 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground">
            Done
          </button>
        </div>
      ))}

      {dueCommitments.length > 0 && (
        <div className={reachOut.length ? 'mt-2 border-t pt-1' : ''}>
          {dueCommitments.map(k => {
            const d = daysBetween(today, dateKeyOf(k.dueDate!));
            return (
              <CheckRow
                key={k.id}
                tone="todo"
                done={false}
                title={k.text}
                context={`Promised to ${nameOf(k.contactId)}`}
                right={<span className={`text-xs font-semibold ${d < 0 ? 'text-destructive' : d === 0 ? 'text-primary' : 'text-muted-foreground'}`}>{d < 0 ? `${-d}d late` : d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `in ${d}d`}</span>}
                onToggle={() => {
                  const next = completeCommitment(k.id);
                  toast.success(next ? 'Done — next one scheduled' : 'Commitment done', { action: { label: 'Undo', onClick: () => uncompleteCommitment(k.id) } });
                }}
              />
            );
          })}
        </div>
      )}

      <QuickLogSheet contact={logFor} onClose={() => setLogFor(null)} />
    </section>
  );
}
