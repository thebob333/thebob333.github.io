import { useMemo, useState } from 'react';
import { MessageSquare, Phone } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { ListRow } from '@/components/app/ListRow';
import { QuickLogSheet } from '@/components/people/QuickLogSheet';
import type { Contact } from '@/lib/storage';

const RING_RANK = { core: 0, close: 1, extended: 2, distant: 3 } as const;

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full text-footnote font-semibold"
      style={{ backgroundColor: 'color-mix(in srgb, hsl(var(--people)) 14%, transparent)', color: 'hsl(var(--people))' }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/** People due a check-in, closest first, with one-tap text/call and "Done". */
export function PeopleNudges() {
  const { contacts, getStreakStatus, getDaysSinceLastInteraction } = useContacts();
  const [logFor, setLogFor] = useState<Contact | null>(null);

  const reachOut = useMemo(() =>
    contacts
      .filter(c => c.interactionGoalDays)
      .map(c => ({ c, status: getStreakStatus(c), days: getDaysSinceLastInteraction(c.id) }))
      .filter(x => x.status === 'overdue' || x.status === 'due-soon')
      .sort((a, b) => Number(a.status !== 'overdue') - Number(b.status !== 'overdue')
        || (RING_RANK[a.c.circleRing] ?? 3) - (RING_RANK[b.c.circleRing] ?? 3)
        || (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 3),
  [contacts, getStreakStatus, getDaysSinceLastInteraction]);

  if (reachOut.length === 0) return null;

  return (
    <section aria-label="Reach out" className="space-y-2">
      <h2 className="section-label">Reach out</h2>
      <div className="list-group">
        {reachOut.map(({ c, days, status }) => (
          <ListRow
            key={c.id}
            leading={<Avatar name={c.name} />}
            title={c.name}
            subtitle={
              <span className={status === 'overdue' ? 'text-destructive' : ''}>
                {days === null ? 'Not in touch yet' : days === 0 ? 'Connected today' : `${days} day${days === 1 ? '' : 's'} since you connected`}
              </span>
            }
            trailing={
              <>
                {c.phone && (
                  <>
                    <a href={`sms:${c.phone}`} aria-label={`Text ${c.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"><MessageSquare className="h-4 w-4" /></a>
                    <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-foreground"><Phone className="h-4 w-4" /></a>
                  </>
                )}
                <button type="button" onClick={() => setLogFor(c)} className="pressable h-8 rounded-full px-3 text-footnote font-semibold text-white" style={{ backgroundColor: 'hsl(var(--people))' }}>
                  Done
                </button>
              </>
            }
          />
        ))}
      </div>
      <QuickLogSheet contact={logFor} onClose={() => setLogFor(null)} />
    </section>
  );
}
