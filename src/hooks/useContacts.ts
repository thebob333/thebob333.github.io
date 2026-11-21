import { useCallback, useMemo } from 'react';
import {
  stores, generateId,
  Contact, Interaction, Commitment, RelationshipGoal,
  CircleRing, InteractionType, CIRCLE_RINGS,
} from '@/lib/storage';
import { dateKeyOf, daysBetween } from '@/lib/dates';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';

const C = stores.CONTACTS;
const I = stores.INTERACTIONS;
const K = stores.COMMITMENTS;
const R = stores.RELATIONSHIP_GOALS;

export type StreakStatus = 'on-track' | 'due-soon' | 'overdue' | 'no-goal';

const byDateDesc = (a: Interaction, b: Interaction) => new Date(b.date).getTime() - new Date(a.date).getTime();

export const contactActions = {
  addContact(data: Omit<Contact, 'id' | 'createdAt'>): Contact {
    const contact: Contact = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    C.update(list => [contact, ...list]);
    return contact;
  },

  /** Add many at once — a single write, so nothing can be dropped. */
  addContacts(list: Contact[]): Contact[] {
    if (list.length === 0) return [];
    C.update(prev => [...list, ...prev]);
    return list;
  },

  updateContact(id: string, data: Partial<Contact>) {
    C.update(list => list.map(c => (c.id === id ? { ...c, ...data } : c)));
  },

  /** Everything that belongs to a person — taken before deleting so Undo can restore it all. */
  snapshotContact(id: string) {
    return {
      contact: C.get().find(c => c.id === id),
      interactions: I.get().filter(i => i.contactId === id),
      commitments: K.get().filter(c => c.contactId === id),
      goals: R.get().filter(g => g.contactId === id),
      blockIds: stores.TIME_BLOCKS.get().filter(b => b.contactId === id).map(b => b.id),
    };
  },

  restoreContact(snap: ReturnType<typeof contactActions.snapshotContact>) {
    if (!snap.contact) return;
    const has = <T extends { id: string }>(list: T[], id: string) => list.some(x => x.id === id);
    C.update(list => (has(list, snap.contact!.id) ? list : [snap.contact!, ...list]));
    I.update(list => [...snap.interactions.filter(x => !has(list, x.id)), ...list]);
    K.update(list => [...snap.commitments.filter(x => !has(list, x.id)), ...list]);
    R.update(list => [...snap.goals.filter(x => !has(list, x.id)), ...list]);
    const ids = new Set(snap.blockIds);
    if (ids.size) stores.TIME_BLOCKS.update(blocks => blocks.map(b => (ids.has(b.id) ? { ...b, contactId: snap.contact!.id } : b)));
  },

  restoreInteraction(i: Interaction) {
    I.update(list => (list.some(x => x.id === i.id) ? list : [i, ...list]));
  },

  restoreCommitment(c: Commitment) {
    K.update(list => (list.some(x => x.id === c.id) ? list : [c, ...list]));
  },

  deleteContact(id: string) {
    C.update(list => list.filter(c => c.id !== id));
    I.update(list => list.filter(i => i.contactId !== id));
    K.update(list => list.filter(c => c.contactId !== id));
    R.update(list => list.filter(g => g.contactId !== id));
    // Unlink (don't delete) Plan blocks that referenced this person.
    stores.TIME_BLOCKS.update(blocks =>
      blocks.some(b => b.contactId === id)
        ? blocks.map(b => (b.contactId === id ? { ...b, contactId: undefined } : b))
        : blocks,
    );
  },

  addInteraction(data: {
    contactId: string;
    type: InteractionType;
    durationMinutes?: number;
    energyAfter?: 1 | 2 | 3 | 4 | 5;
    note?: string;
    date?: string;
  }): Interaction {
    const interaction: Interaction = {
      id: generateId(),
      contactId: data.contactId,
      date: data.date || new Date().toISOString(),
      type: data.type,
      durationMinutes: data.durationMinutes,
      energyAfter: data.energyAfter,
      note: data.note,
    };
    I.update(list => [interaction, ...list]);
    return interaction;
  },

  deleteInteraction(id: string) {
    I.update(list => list.filter(i => i.id !== id));
  },

  addCommitment(data: { contactId: string; text: string; dueDate?: string; recurring?: 'weekly' | 'biweekly' | 'monthly' }): Commitment {
    const commitment: Commitment = { id: generateId(), ...data };
    K.update(list => [commitment, ...list]);
    return commitment;
  },

  completeCommitment(id: string) {
    const at = new Date().toISOString();
    K.update(list => list.map(c => (c.id === id ? { ...c, completedAt: at } : c)));
  },

  uncompleteCommitment(id: string) {
    K.update(list => list.map(c => (c.id === id ? { ...c, completedAt: undefined } : c)));
  },

  deleteCommitment(id: string) {
    K.update(list => list.filter(c => c.id !== id));
  },

  addRelationshipGoal(data: { contactId: string; text: string; targetDate?: string }): RelationshipGoal {
    const goal: RelationshipGoal = { id: generateId(), ...data };
    R.update(list => [goal, ...list]);
    return goal;
  },

  completeRelationshipGoal(id: string) {
    const at = new Date().toISOString();
    R.update(list => list.map(g => (g.id === id ? { ...g, completedAt: at } : g)));
  },

  deleteRelationshipGoal(id: string) {
    R.update(list => list.filter(g => g.id !== id));
  },
};

export function useContacts() {
  const contacts = useStore(C);
  const interactions = useStore(I);
  const commitments = useStore(K);
  const relationshipGoals = useStore(R);
  const today = useTodayKey();

  // O(1) lookups instead of scanning every interaction per contact per render.
  const interactionsByContact = useMemo(() => {
    const m = new Map<string, Interaction[]>();
    for (const i of interactions) {
      const list = m.get(i.contactId);
      if (list) list.push(i);
      else m.set(i.contactId, [i]);
    }
    m.forEach(list => list.sort(byDateDesc));
    return m;
  }, [interactions]);

  const commitmentsByContact = useMemo(() => {
    const m = new Map<string, Commitment[]>();
    for (const c of commitments) {
      const list = m.get(c.contactId);
      if (list) list.push(c);
      else m.set(c.contactId, [c]);
    }
    return m;
  }, [commitments]);

  const getInteractionsForContact = useCallback(
    (contactId: string) => interactionsByContact.get(contactId) ?? [],
    [interactionsByContact],
  );

  const getCommitmentsForContact = useCallback(
    (contactId: string) => commitmentsByContact.get(contactId) ?? [],
    [commitmentsByContact],
  );

  const getRelationshipGoalsForContact = useCallback(
    (contactId: string) => relationshipGoals.filter(g => g.contactId === contactId),
    [relationshipGoals],
  );

  const getLastInteraction = useCallback(
    (contactId: string): Interaction | null => interactionsByContact.get(contactId)?.[0] ?? null,
    [interactionsByContact],
  );

  /** Whole calendar days since the last interaction (0 = today). */
  const getDaysSinceLastInteraction = useCallback((contactId: string): number | null => {
    const last = getLastInteraction(contactId);
    if (!last) return null;
    return Math.max(0, daysBetween(dateKeyOf(last.date), today));
  }, [getLastInteraction, today]);

  const getStreakStatus = useCallback((contact: Contact): StreakStatus => {
    if (!contact.interactionGoalDays) return 'no-goal';
    const daysSince = getDaysSinceLastInteraction(contact.id);
    if (daysSince === null) return 'overdue'; // never interacted
    if (daysSince > contact.interactionGoalDays) return 'overdue';
    if (daysSince >= contact.interactionGoalDays * 0.75) return 'due-soon';
    return 'on-track';
  }, [getDaysSinceLastInteraction]);

  const activeCommitments = useMemo(() =>
    commitments.filter(c => !c.completedAt).sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return dateKeyOf(a.dueDate).localeCompare(dateKeyOf(b.dueDate));
    }),
  [commitments]);

  /** Overdue only once the due day has fully passed. */
  const overdueCommitments = useMemo(() =>
    activeCommitments.filter(c => c.dueDate && dateKeyOf(c.dueDate) < today),
  [activeCommitments, today]);

  const contactsByRing = useMemo(() => {
    const rings: Record<CircleRing, Contact[]> = { core: [], close: [], extended: [], distant: [] };
    for (const c of contacts) {
      const ring = CIRCLE_RINGS.includes(c.circleRing) ? c.circleRing : 'distant';
      rings[ring].push(c);
    }
    return rings;
  }, [contacts]);

  return {
    contacts,
    interactions,
    commitments,
    relationshipGoals,
    activeCommitments,
    overdueCommitments,
    contactsByRing,
    ...contactActions,
    getInteractionsForContact,
    getLastInteraction,
    getDaysSinceLastInteraction,
    getStreakStatus,
    getCommitmentsForContact,
    getRelationshipGoalsForContact,
  };
}
