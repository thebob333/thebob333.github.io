import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Activity, Coffee, Mail, MessageSquare, Pencil, Phone, PhoneCall, Plus, Repeat, Trash2, Users, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useContacts, contactActions } from '@/hooks/useContacts';
import { useTodayKey } from '@/hooks/useToday';
import { PageHeader } from '@/components/app/PageHeader';
import { RowMenu } from '@/components/app/RowMenu';
import { CheckCircle } from '@/components/app/ListRow';
import { Avatar } from '@/components/people/Avatar';
import { ContactFormSheet } from '@/components/people/ContactFormSheet';
import { LogInteractionSheet } from '@/components/people/LogInteractionSheet';
import { CommitmentSheet } from '@/components/people/CommitmentSheet';
import { RelationshipGoals } from '@/components/people/RelationshipGoals';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { INTERACTION_LABELS, checkInLabel, energyEmoji, lastSeenText, relationshipLabel, ringInfo } from '@/lib/people';
import { dateKeyOf, daysBetween } from '@/lib/dates';
import type { Commitment, Interaction, InteractionType } from '@/lib/storage';

const TYPE_ICON: Record<InteractionType, LucideIcon> = { text: MessageSquare, call: PhoneCall, hangout: Coffee, meeting: Users };

function dueChip(due: string | undefined, today: string) {
  if (!due) return null;
  const d = daysBetween(today, dateKeyOf(due));
  if (d < 0) return <span className="text-footnote font-semibold text-destructive">{-d}d late</span>;
  if (d === 0) return <span className="text-footnote font-semibold text-primary">Today</span>;
  return <span className="text-footnote text-muted-foreground">{d === 1 ? 'Tomorrow' : `in ${d}d`}</span>;
}

export default function PersonDetailPage() {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const today = useTodayKey();
  const { contacts, getInteractionsForContact, getCommitmentsForContact, getDaysSinceLastInteraction, getStreakStatus, completeCommitment, uncompleteCommitment } = useContacts();
  const [editOpen, setEditOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [editInteraction, setEditInteraction] = useState<Interaction | null>(null);
  const [promiseOpen, setPromiseOpen] = useState(false);
  const [editPromise, setEditPromise] = useState<Commitment | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const c = contacts.find(x => x.id === contactId);
  if (!c) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <PageHeader title="Not found" back="/people" />
        <p className="text-body text-muted-foreground">This person may have been removed.</p>
      </div>
    );
  }

  const days = getDaysSinceLastInteraction(c.id);
  const status = getStreakStatus(c);
  const history = getInteractionsForContact(c.id);
  const promises = getCommitmentsForContact(c.id);
  const open = promises.filter(p => !p.completedAt).sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));
  const kept = promises.filter(p => p.completedAt).slice(0, 3);
  const goal = c.interactionGoalDays;
  const pctToDue = goal && days !== null ? Math.min(1, days / goal) : goal ? 1 : 0;
  const statusColor = status === 'overdue' ? 'hsl(var(--destructive))' : status === 'due-soon' ? 'hsl(var(--warning))' : 'hsl(var(--people))';

  const action = (label: string, icon: React.ReactNode, onClick?: () => void, href?: string) => {
    const cls = 'pressable flex flex-1 flex-col items-center gap-1.5 rounded-2xl bg-card py-3 text-footnote font-semibold text-primary shadow-[0_0_0_1px_hsl(var(--border)/0.7)] disabled:opacity-40';
    const inner = <><span className="flex h-6 items-center">{icon}</span>{label}</>;
    return href
      ? <a href={href} className={cls}>{inner}</a>
      : <button type="button" onClick={onClick} className={cls}>{inner}</button>;
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-24">
      <PageHeader
        title=""
        back="/people"
        actions={
          <RowMenu label="Person actions" className="h-9 w-9 rounded-full bg-secondary md:h-9 md:w-9" items={[
            { label: 'Edit', icon: Pencil, onSelect: () => setEditOpen(true) },
            { label: 'Remove…', icon: Trash2, destructive: true, separated: true, onSelect: () => setConfirmDelete(true) },
          ]} />
        }
      />

      {/* Identity */}
      <div className="-mt-2 flex flex-col items-center text-center">
        <Avatar contact={c} size={92} />
        <h1 className="mt-3 text-large-title">{c.name}</h1>
        <p className="text-body text-muted-foreground">{relationshipLabel(c.relationship)} · {ringInfo(c.circleRing).label} circle</p>
      </div>

      <div className="flex gap-2">
        {action('Log', <Activity className="h-5 w-5" />, () => { setEditInteraction(null); setLogOpen(true); })}
        {c.phone && action('Text', <MessageSquare className="h-5 w-5" />, undefined, `sms:${c.phone}`)}
        {c.phone && action('Call', <Phone className="h-5 w-5" />, undefined, `tel:${c.phone}`)}
        {c.email && action('Email', <Mail className="h-5 w-5" />, undefined, `mailto:${c.email}`)}
      </div>

      {/* Connection status */}
      <section className="surface p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-headline">{lastSeenText(days)}</p>
          {goal ? <p className="text-footnote text-muted-foreground">Goal: {checkInLabel(goal)}</p> : (
            <button type="button" onClick={() => setEditOpen(true)} className="text-footnote font-semibold text-primary">Set a check-in goal</button>
          )}
        </div>
        {goal ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.max(4, pctToDue * 100)}%`, backgroundColor: statusColor }} />
            </div>
            <p className="mt-2 text-footnote" style={{ color: status === 'on-track' ? undefined : statusColor }}>
              {status === 'overdue' ? 'Time to reach out.' : status === 'due-soon' ? 'Reach out in the next few days.' : days === null ? 'Say hi to get started.' : (() => { const left = Math.max(0, goal - days); return left === 0 ? 'Check in again today.' : `You're on track — next check-in in about ${left} day${left === 1 ? '' : 's'}.`; })()}
            </p>
          </>
        ) : null}
        {c.plan && <p className="mt-3 border-t pt-3 text-body">“{c.plan}”</p>}
      </section>

      {/* Promises */}
      <section className="space-y-2">
        <div className="flex items-end justify-between">
          <h2 className="section-label">Promises</h2>
          <button type="button" onClick={() => { setEditPromise(null); setPromiseOpen(true); }} className="mb-1 mr-1 flex items-center gap-1 text-body font-semibold text-primary"><Plus className="h-4 w-4" /> Add</button>
        </div>
        {open.length + kept.length === 0 ? (
          <p className="px-1 text-footnote text-muted-foreground">Things you've said you'll do for {c.name.split(' ')[0]} — they show up on Today when due.</p>
        ) : (
          <div className="list-group">
            {[...open, ...kept].map(p => (
              <div key={p.id} className={`flex min-h-[56px] items-center gap-3 px-4 py-1.5 ${p.completedAt ? 'opacity-60' : ''}`}>
                <CheckCircle done={!!p.completedAt} color="hsl(var(--people))" label={p.text} onToggle={() => {
                  if (p.completedAt) { uncompleteCommitment(p.id); return; }
                  const next = completeCommitment(p.id);
                  toast.success(next ? 'Done — next one scheduled' : 'Promise kept', { action: { label: 'Undo', onClick: () => uncompleteCommitment(p.id) } });
                }} />
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-body font-medium ${p.completedAt ? 'line-through' : ''}`}>{p.text}</p>
                  {p.recurring && <p className="flex items-center gap-1 text-footnote text-muted-foreground"><Repeat className="h-3 w-3" /> {p.recurring === 'biweekly' ? 'every 2 weeks' : p.recurring}</p>}
                </div>
                {!p.completedAt && dueChip(p.dueDate, today)}
                <RowMenu label="Promise actions" items={[
                  { label: 'Edit', icon: Pencil, onSelect: () => { setEditPromise(p); setPromiseOpen(true); } },
                  { label: 'Delete', icon: Trash2, destructive: true, separated: true, onSelect: () => {
                    contactActions.deleteCommitment(p.id);
                    toast.success('Promise deleted', { action: { label: 'Undo', onClick: () => contactActions.restoreCommitment(p) } });
                  } },
                ]} />
              </div>
            ))}
          </div>
        )}
      </section>

      <RelationshipGoals contactId={c.id} />

      {/* History */}
      <section className="space-y-2">
        <h2 className="section-label">History</h2>
        {history.length === 0 ? (
          <p className="px-1 text-footnote text-muted-foreground">No interactions yet. Tap Log after you talk.</p>
        ) : (
          <div className="list-group">
            {history.slice(0, 20).map(i => (
              <div key={i.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-people/10 text-people">{(() => { const Icon = TYPE_ICON[i.type] ?? Users; return <Icon className="h-4 w-4" />; })()}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-medium">{INTERACTION_LABELS[i.type]}{i.durationMinutes ? ` · ${i.durationMinutes}m` : ''}{i.energyAfter ? ` ${energyEmoji(i.energyAfter)}` : ''}</p>
                  <p className="truncate text-footnote text-muted-foreground">
                    {new Date(dateKeyOf(i.date) + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{i.note ? ` · ${i.note}` : ''}
                  </p>
                </div>
                <RowMenu label="Interaction actions" items={[
                  { label: 'Edit', icon: Pencil, onSelect: () => { setEditInteraction(i); setLogOpen(true); } },
                  { label: 'Delete', icon: Trash2, destructive: true, separated: true, onSelect: () => {
                    contactActions.deleteInteraction(i.id);
                    toast.success('Deleted', { action: { label: 'Undo', onClick: () => contactActions.restoreInteraction(i) } });
                  } },
                ]} />
              </div>
            ))}
          </div>
        )}
      </section>

      {c.notes && (
        <section className="space-y-2">
          <h2 className="section-label">Notes</h2>
          <p className="surface whitespace-pre-wrap p-4 text-body">{c.notes}</p>
        </section>
      )}

      <ContactFormSheet open={editOpen} contact={c} onClose={() => setEditOpen(false)} />
      <LogInteractionSheet contact={logOpen ? c : null} interaction={editInteraction} onClose={() => { setLogOpen(false); setEditInteraction(null); }} />
      <CommitmentSheet contact={promiseOpen ? c : null} commitment={editPromise} onClose={() => { setPromiseOpen(false); setEditPromise(null); }} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-title">Remove {c.name}?</DialogTitle></DialogHeader>
          <p className="text-body text-muted-foreground">Their history and promises are removed too. You can undo for a few seconds afterwards.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" className="h-12 flex-1 rounded-xl font-semibold" onClick={() => {
              const snap = contactActions.snapshotContact(c.id);
              setConfirmDelete(false);
              navigate('/people');
              contactActions.deleteContact(c.id);
              toast.success(`${c.name} removed`, { action: { label: 'Undo', onClick: () => contactActions.restoreContact(snap) } });
            }}>Remove</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
