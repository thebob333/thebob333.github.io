import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { contactActions } from '@/hooks/useContacts';
import { CheckCircle } from '@/components/app/ListRow';
import { RowMenu } from '@/components/app/RowMenu';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/** Things you want to build with this person ("plan a trip together", "meet monthly"). */
export function RelationshipGoals({ contactId }: { contactId: string }) {
  const all = useStore(stores.RELATIONSHIP_GOALS);
  const goals = useMemo(
    () => all.filter(g => g.contactId === contactId).sort((a, b) => Number(!!a.completedAt) - Number(!!b.completedAt)),
    [all, contactId],
  );
  const [draft, setDraft] = useState('');

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    contactActions.addRelationshipGoal({ contactId, text });
    setDraft('');
  };

  const toggle = (id: string, done: boolean) => {
    stores.RELATIONSHIP_GOALS.update(list => list.map(g => (g.id === id ? { ...g, completedAt: done ? undefined : new Date().toISOString() } : g)));
  };

  const remove = (id: string) => {
    const removed = all.find(g => g.id === id);
    contactActions.deleteRelationshipGoal(id);
    if (removed) toast.success('Goal removed', { action: { label: 'Undo', onClick: () => stores.RELATIONSHIP_GOALS.update(l => [removed, ...l]) } });
  };

  return (
    <section className="space-y-2" onClick={e => e.stopPropagation()}>
      <h2 className="section-label">Together</h2>
      <div className="list-group">
        {goals.map(g => (
          <div key={g.id} className="flex min-h-[54px] items-center gap-3 px-4 py-1.5">
            <CheckCircle done={!!g.completedAt} color="hsl(var(--people))" label={g.text} onToggle={() => toggle(g.id, !!g.completedAt)} />
            <span className={`min-w-0 flex-1 truncate text-body font-medium ${g.completedAt ? 'text-muted-foreground line-through' : ''}`}>{g.text}</span>
            <RowMenu label="Goal actions" items={[{ label: 'Remove', icon: Trash2, destructive: true, onSelect: () => remove(g.id) }]} />
          </div>
        ))}
        <form className="flex items-center gap-2 px-3 py-2" onSubmit={e => { e.preventDefault(); add(); }}>
          <Plus className="ml-1 h-5 w-5 shrink-0 text-people" />
          <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Something to do together" enterKeyHint="done"
            className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" />
          {draft && <Button type="submit" size="sm" className="h-9 rounded-full">Add</Button>}
        </form>
      </div>
    </section>
  );
}
