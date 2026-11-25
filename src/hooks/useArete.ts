import { useMemo } from 'react';
import { toast } from 'sonner';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { todayKey } from '@/lib/dates';
import {
  addGrown, buildGraph, claimLadder, claimNode, placement, removeGrown, togglePin, unclaimNode, visibilityMap,
  type ClaimResult,
} from '@/lib/arete/engine';
import { layoutMetro, SLIM, WIDE } from '@/lib/arete/layout';
import { profileOf } from '@/lib/arete/progress';
import { useIsMobile } from '@/hooks/use-mobile';
import type { AreteNode, AreteState } from '@/types/arete';

const A = stores.ARETE;
const graphOf = (s: AreteState) => buildGraph(s.grown, s.claims);
const graph = () => graphOf(A.get());
const bodyweight = () => stores.SETTINGS.get().bodyweight;
const MEDAL_NAME = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', diamond: 'Diamond' } as const;

/**
 * Save a claim and celebrate it: what unlocked, the XP, and anything it set
 * off — a level-up, a new medal, a finished quest — with Undo.
 */
function commit(before: AreteState, r: ClaimResult, headline?: string): string[] {
  if (r.state === before) return [];
  A.set(r.state);
  if (!r.unlocked.length) return [];
  const today = todayKey();
  const was = profileOf(graphOf(before), before, today);
  const g = graphOf(r.state);
  const now = profileOf(g, r.state, today);
  const gained = now.summary.xp - was.summary.xp;
  const top = g.byId.get(r.unlocked[0]);
  const more = r.unlocked.length - 1;

  const medals = now.badges.filter(b => b.medal && was.badges.find(x => x.id === b.id)?.medal !== b.medal);
  const quests = now.season.quests.filter(q => q.done && !was.season.quests.find(x => x.id === q.id)?.done);
  const extras = [
    ...medals.slice(0, 2).map(b => `${MEDAL_NAME[b.medal!]}: ${b.name}`),
    ...quests.map(q => `Quest done: ${q.title}`),
    now.season.complete && !was.season.complete ? 'Season complete!' : '',
  ].filter(Boolean);

  const title = headline ?? (now.summary.level > was.summary.level ? `Level ${now.summary.level}! ${top?.title ?? ''}` : `Unlocked: ${top?.title ?? ''}`);
  toast.success(title, {
    description: [`+${gained} XP`, more > 0 && !headline ? `${more} more station${more === 1 ? '' : 's'} on the way` : '', ...extras].filter(Boolean).join(' · '),
    action: { label: 'Undo', onClick: () => A.set(before) },
    duration: extras.length ? 8000 : 6000,
  });
  return r.unlocked;
}

export const areteActions = {
  /** "I did this." Returns the ids that just unlocked. */
  claim(id: string, at: string = todayKey(), result?: string): string[] {
    const before = A.get();
    return commit(before, claimNode(graph(), before, id, at, result));
  },

  /** Claim as far up a line as a result reaches. */
  claimLadder(ladderId: string, result: string, at: string = todayKey()): string[] {
    const before = A.get();
    return commit(before, claimLadder(graph(), before, ladderId, result, at, bodyweight()));
  },

  /** Quick placement: one answer per line. Returns how many stations unlocked. */
  place(answers: Record<string, string>): number {
    const before = A.get();
    const r = placement(graph(), before, answers, todayKey(), bodyweight());
    if (r.state === before) return 0;
    const after = { ...r.state, started: true };
    commit(before, { state: after, unlocked: r.unlocked }, `${r.unlocked.length} stations unlocked`);
    return r.unlocked.length;
  },

  unclaim(id: string) {
    const before = A.get();
    const next = unclaimNode(graph(), before, id);
    if (next === before) return;
    A.set(next);
    const n = Object.keys(before.claims).length - Object.keys(next.claims).length;
    toast.success(n > 1 ? `${n} claims removed` : 'Claim removed', { action: { label: 'Undo', onClick: () => A.set(before) } });
  },

  togglePin(id: string) {
    A.update(s => togglePin(s, id));
  },

  grow(nodes: AreteNode[]) {
    A.update(s => addGrown(s, nodes));
  },

  remove(id: string) {
    const before = A.get();
    const next = removeGrown(graph(), before, id);
    if (next === before) return;
    A.set(next);
    toast.success('Station removed', { action: { label: 'Undo', onClick: () => A.set(before) } });
  },

  /** Remember which goal is chasing a station ("Go for this"), and pin it. */
  link(nodeId: string, goalId: string) {
    A.update(s => ({ ...s, goalLinks: { ...s.goalLinks, [nodeId]: goalId }, pinned: s.pinned.includes(nodeId) ? s.pinned : [...s.pinned, nodeId] }));
  },

  start() {
    A.update(s => (s.started ? s : { ...s, started: true }));
  },
};

/**
 * Everything a screen needs: the tree (with any new stops at the end of
 * never-ending lines), where it sits (shaped for this screen), what you can
 * see, and your profile — totals, class, season, badges.
 */
export function useArete() {
  const state = useStore(A);
  const slim = useIsMobile();
  const today = useTodayKey();
  return useMemo(() => {
    const g = graphOf(state);
    const profile = profileOf(g, state, today);
    return { state, graph: g, map: layoutMetro(g, slim ? SLIM : WIDE), vis: visibilityMap(g, state), profile, summary: profile.summary };
  }, [state, slim, today]);
}

export { bodyweight as areteBodyweight };
