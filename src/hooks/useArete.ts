import { useMemo } from 'react';
import { toast } from 'sonner';
import { stores } from '@/lib/storage';
import { useStore } from '@/hooks/useStore';
import { todayKey } from '@/lib/dates';
import {
  addGrown, buildGraph, claimLadder, claimNode, placement, removeGrown, summarize, togglePin, unclaimNode, visibilityMap, xpFor,
  type ClaimResult, type Graph,
} from '@/lib/arete/engine';
import { layoutSky } from '@/lib/arete/layout';
import type { AreteNode, AreteState } from '@/types/arete';

const A = stores.ARETE;
const graph = () => buildGraph(A.get().grown);
const bodyweight = () => stores.SETTINGS.get().bodyweight;

/** Save a claim and celebrate it: what unlocked, the XP, a level-up if there was one — with Undo. */
function commit(before: AreteState, g: Graph, r: ClaimResult): string[] {
  if (r.state === before) return [];
  A.set(r.state);
  if (!r.unlocked.length) return [];
  const xp = r.unlocked.reduce((n, id) => n + xpFor(g.byId.get(id)!.tier), 0);
  const was = summarize(g, before).level;
  const now = summarize(g, r.state).level;
  const top = g.byId.get(r.unlocked[0])!;
  const more = r.unlocked.length - 1;
  toast.success(now > was ? `Level ${now}! ${top.title}` : `Unlocked: ${top.title}`, {
    description: `+${xp} XP${more > 0 ? ` · ${more} more node${more === 1 ? '' : 's'} unlocked on the way` : ''}`,
    action: { label: 'Undo', onClick: () => A.set(before) },
    duration: 6000,
  });
  return r.unlocked;
}

export const areteActions = {
  /** "I did this." Returns the ids that just unlocked. */
  claim(id: string, at: string = todayKey(), result?: string): string[] {
    const g = graph();
    const before = A.get();
    return commit(before, g, claimNode(g, before, id, at, result));
  },

  /** Claim as far up a ladder as a result reaches. */
  claimLadder(ladderId: string, result: string, at: string = todayKey()): string[] {
    const g = graph();
    const before = A.get();
    return commit(before, g, claimLadder(g, before, ladderId, result, at, bodyweight()));
  },

  /** Quick placement: one answer per ladder. Returns how many nodes unlocked. */
  place(answers: Record<string, string>): number {
    const g = graph();
    const before = A.get();
    const r = placement(g, before, answers, todayKey(), bodyweight());
    if (r.state === before) return 0;
    A.set({ ...r.state, started: true });
    const xp = r.unlocked.reduce((n, id) => n + xpFor(g.byId.get(id)!.tier), 0);
    toast.success(`${r.unlocked.length} nodes unlocked`, {
      description: `+${xp} XP · you're level ${summarize(g, r.state).level}`,
      action: { label: 'Undo', onClick: () => A.set(before) },
      duration: 7000,
    });
    return r.unlocked.length;
  },

  unclaim(id: string) {
    const g = graph();
    const before = A.get();
    const next = unclaimNode(g, before, id);
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
    const g = graph();
    const before = A.get();
    const next = removeGrown(g, before, id);
    if (next === before) return;
    A.set(next);
    toast.success('Node removed', { action: { label: 'Undo', onClick: () => A.set(before) } });
  },

  /** Remember which goal is chasing a node ("Go for this"), and pin the node. */
  link(nodeId: string, goalId: string) {
    A.update(s => ({ ...s, goalLinks: { ...s.goalLinks, [nodeId]: goalId }, pinned: s.pinned.includes(nodeId) ? s.pinned : [...s.pinned, nodeId] }));
  },

  start() {
    A.update(s => (s.started ? s : { ...s, started: true }));
  },
};

/** Everything a screen needs: the tree, where it sits, what you can see, and your totals. */
export function useArete() {
  const state = useStore(A);
  return useMemo(() => {
    const g = buildGraph(state.grown);
    return { state, graph: g, sky: layoutSky(g), vis: visibilityMap(g, state), summary: summarize(g, state) };
  }, [state]);
}

export { bodyweight as areteBodyweight };
