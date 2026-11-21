import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Plus, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useContacts } from '@/hooks/useContacts';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import { ListRow } from '@/components/app/ListRow';
import { Avatar } from '@/components/people/Avatar';
import { ContactFormSheet } from '@/components/people/ContactFormSheet';
import { LogInteractionSheet } from '@/components/people/LogInteractionSheet';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import InnerCircleMap from '@/components/InnerCircleMap';
import InsightsPanel from '@/components/InsightsPanel';
import { RINGS, lastSeenText, relationshipLabel } from '@/lib/people';
import {
  findDuplicates, importedToContacts, isContactPickerSupported, parseVCard, pickContactsFromPhone, readVCardFile,
  type ImportedContact,
} from '@/lib/contact-import';
import type { Contact } from '@/lib/storage';
import { cn } from '@/lib/utils';

type View = 'people' | 'circle' | 'insights';

export default function PeoplePage() {
  const navigate = useNavigate();
  const { contacts, interactions, getStreakStatus, getDaysSinceLastInteraction, addContacts } = useContacts();
  const [view, setView] = useState<View>('people');
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [logFor, setLogFor] = useState<Contact | null>(null);
  const [preview, setPreview] = useState<{ unique: ImportedContact[]; duplicates: ImportedContact[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => [c.name, c.notes, c.plan, c.phone, c.email].some(v => (v || '').toLowerCase().includes(q)));
  }, [contacts, query]);

  const dueCount = contacts.filter(c => ['overdue', 'due-soon'].includes(getStreakStatus(c))).length;

  // ─── Import ───
  const startImport = async () => {
    if (isContactPickerSupported()) {
      try {
        const picked = await pickContactsFromPhone();
        if (picked.length) setPreview(findDuplicates(picked, contacts));
        return;
      } catch { /* fall back to a file */ }
    }
    fileRef.current?.click();
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = parseVCard(await readVCardFile(file));
      if (parsed.length === 0) { toast.error('No contacts found in that file'); return; }
      setPreview(findDuplicates(parsed, contacts));
    } catch {
      toast.error("Couldn't read that file");
    }
  };
  const confirmImport = () => {
    if (!preview?.unique.length) return;
    const saved = addContacts(importedToContacts(preview.unique));
    toast.success(`Imported ${saved.length} ${saved.length === 1 ? 'person' : 'people'}`, { description: 'They start in your Distant circle — move people closer any time.' });
    setPreview(null);
  };

  const row = (c: Contact) => {
    const status = getStreakStatus(c);
    const days = getDaysSinceLastInteraction(c.id);
    return (
      <ListRow
        key={c.id}
        onClick={() => navigate(`/people/${c.id}`)}
        chevron
        leading={<Avatar contact={c} size={40} />}
        title={c.name}
        subtitle={`${relationshipLabel(c.relationship)} · ${lastSeenText(days)}`}
        trailing={
          status === 'overdue' ? <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-destructive">Overdue</span>
            : status === 'due-soon' ? <span className="rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-warning">Due</span>
              : null
        }
      />
    );
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-24">
      <PageHeader
        title="People"
        subtitle={contacts.length ? (dueCount ? `${dueCount} ${dueCount === 1 ? 'person' : 'people'} to check in with` : 'Everyone is up to date') : undefined}
        actions={
          <>
            <HeaderButton label="Import contacts" onClick={startImport}><Download className="h-[18px] w-[18px]" /></HeaderButton>
            <HeaderButton label="Add person" primary onClick={() => setAddOpen(true)}><Plus className="h-5 w-5" /></HeaderButton>
          </>
        }
      />
      <input ref={fileRef} type="file" accept=".vcf,.vcard,text/vcard,text/x-vcard" className="hidden" onChange={onFile} />

      {contacts.length === 0 ? (
        <div className="relative overflow-hidden rounded-[28px] p-6 text-white" style={{ background: 'linear-gradient(135deg, hsl(192 95% 42%), hsl(236 90% 62%))' }}>
          <Users className="h-8 w-8" />
          <h2 className="mt-3 text-[26px] font-bold leading-tight tracking-tight">Stay close to your people.</h2>
          <p className="mt-1 text-body text-white/85">Add the people who matter and TELOS reminds you when it's time to reach out.</p>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => setAddOpen(true)} className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-headline text-neutral-900"><UserPlus className="h-4 w-4" /> Add someone</button>
            <button type="button" onClick={startImport} className="pressable h-12 rounded-2xl bg-white/20 px-4 text-body font-semibold">Import</button>
          </div>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="People views" className="grid grid-cols-3 rounded-xl bg-secondary p-1">
            {([['people', 'People'], ['circle', 'Circle'], ['insights', 'Insights']] as [View, string][]).map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={cn('h-9 rounded-lg text-footnote font-semibold transition-colors', view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                {label}
              </button>
            ))}
          </div>

          {view === 'people' && (
            <>
              <label className="flex h-11 items-center gap-2 rounded-xl bg-secondary px-3">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" />
              </label>
              {RINGS.map(ring => {
                const people = filtered.filter(c => c.circleRing === ring.value).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                if (!people.length) return null;
                return (
                  <section key={ring.value} className="space-y-2">
                    <h2 className="flex items-baseline gap-2 px-1">
                      <span className="text-[20px] font-bold tracking-tight">{ring.label}</span>
                      <span className="text-footnote text-muted-foreground">{people.length}</span>
                    </h2>
                    <div className="list-group">{people.map(row)}</div>
                  </section>
                );
              })}
              {filtered.length === 0 && <p className="py-8 text-center text-body text-muted-foreground">No one matches “{query}”.</p>}
            </>
          )}

          {view === 'circle' && (
            <div className="surface p-3">
              <InnerCircleMap
                contacts={contacts}
                streakStatus={getStreakStatus}
                daysSince={getDaysSinceLastInteraction}
                onLogInteraction={id => setLogFor(contacts.find(c => c.id === id) ?? null)}
                onEdit={c => navigate(`/people/${c.id}`)}
              />
            </div>
          )}

          {view === 'insights' && (
            <InsightsPanel
              contacts={contacts}
              interactions={interactions}
              streakStatus={getStreakStatus}
              daysSince={getDaysSinceLastInteraction}
              onLogInteraction={id => setLogFor(contacts.find(c => c.id === id) ?? null)}
            />
          )}
        </>
      )}

      <ContactFormSheet open={addOpen} onClose={() => setAddOpen(false)} onCreated={c => navigate(`/people/${c.id}`)} />
      <LogInteractionSheet contact={logFor} onClose={() => setLogFor(null)} />

      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Import {preview?.unique.length ?? 0} {preview?.unique.length === 1 ? 'person' : 'people'}</DialogTitle>
            <DialogDescription>
              {preview?.duplicates.length ? `${preview.duplicates.length} already in TELOS will be skipped. ` : ''}Everyone starts in your Distant circle.
            </DialogDescription>
          </DialogHeader>
          {preview && preview.unique.length > 0 && (
            <div className="list-group max-h-[45vh] overflow-y-auto">
              {preview.unique.map((c, i) => (
                <ListRow key={i} leading={<Avatar contact={{ name: c.name, circleRing: 'distant' }} size={34} />} title={c.name} subtitle={c.phone || c.email} />
              ))}
            </div>
          )}
          <Button className="mt-2 h-12 w-full rounded-xl text-body font-semibold" disabled={!preview?.unique.length} onClick={confirmImport}>
            Import
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
