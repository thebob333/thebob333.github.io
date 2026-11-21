import { useMemo, useState } from 'react';
import { Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { contactActions } from '@/hooks/useContacts';
import { RoundCheck } from '@/components/app/RoundCheck';
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
    <div className="pt-1" onClick={e => e.stopPropagation()}>
      <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-foreground/70">
        <Target className="h-3 w-3" /> Relationship goals
      </p>
      {goals.map(g => (
        <div key={g.id} className="flex items-center gap-1">
          <RoundCheck checked={!!g.completedAt} label={g.text} onToggle={() => toggle(g.id, !!g.completedAt)} />
          <span className={`flex-1 text-sm ${g.completedAt ? 'text-muted-foreground line-through' : ''}`}>{g.text}</span>
          <RowMenu label="Goal actions" items={[{ label: 'Remove goal', icon: Trash2, destructive: true, onSelect: () => remove(g.id) }]} />
        </div>
      ))}
      <form className="mt-1 flex gap-1" onSubmit={e => { e.preventDefault(); add(); }}>
        <Input value={draft} onChange={e => setDraft(e.target.value)} placeholder="e.g. Plan a trip together" className="h-10 text-sm" enterKeyHint="done" />
        <Button type="submit" size="icon" variant="ghost" className="h-10 w-10 shrink-0" disabled={!draft.trim()} aria-label="Add relationship goal">
          <Plus className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
