/**
 * Arete: the universal skill tree for a life. Separate from goals.
 * The tree itself (the core nodes) is code — see src/lib/arete/tree.ts.
 * Only what YOU did with it is stored: claims, pins, and nodes you or the AI added.
 */
export type AreaId = 'body' | 'mind' | 'craft' | 'wealth' | 'bonds' | 'spirit';

/** How a ladder's results are read: a time (lower is better), an amount, or a multiple of bodyweight. */
export type MetricKind = 'time' | 'amount' | 'bwx';

export interface AreteNode {
  id: string;
  area: AreaId;
  /** Discipline within the area, e.g. "Running". */
  branch: string;
  title: string;
  /** What it takes / what counts. */
  detail?: string;
  /** 0 (anyone, this week) … 10 (once in a generation). Sets rarity, XP and distance from the centre. */
  tier: number;
  /** What must be unlocked first. The first one is its parent on the map; none = a starting point. */
  requires: string[];
  /** Ladder it belongs to (e.g. mile times) and the result that reaches this rung. */
  ladder?: string;
  value?: number;
  /** Short station name on the map for ladder rungs, e.g. "7:30". */
  short?: string;
  source: 'core' | 'ai' | 'custom';
}

export interface AreteClaim {
  /** Local day you did it (YYYY-MM-DD). */
  at: string;
  /** Your result in your words, e.g. "7:42". */
  result?: string;
  /** Unlocked because something further along was claimed. */
  implied?: boolean;
}

export interface AreteState {
  claims: Record<string, AreteClaim>;
  /** Nodes you're chasing. */
  pinned: string[];
  /** Nodes discovered by the AI or added by you. */
  grown: AreteNode[];
  /** Node → the goal created with "Go for this". */
  goalLinks: Record<string, string>;
  /** The intro has been seen. */
  started?: boolean;
}

export const EMPTY_ARETE: AreteState = { claims: {}, pinned: [], grown: [], goalLinks: {} };
