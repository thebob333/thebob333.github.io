/**
 * Arete: a universal skill tree for a human life.
 *
 * Six areas, each with disciplines that start from bare basics and branch
 * outward to the legendary. Hand-designed feats plus ladders built from
 * series (every mile time, lift, distance, count…). Written in the small
 * language in ./tree/dsl.ts, one file per area; the AI "Discover" and your own
 * nodes extend it from there.
 *
 * Ids are permanent (claims are stored by id) — never rename or reuse one.
 */
import type { AreaId, AreteNode } from '@/types/arete';
import { guides, ladders, nodes, type Guide, type LadderInfo } from './tree/dsl';
// Order matters only for display ties; every file adds to the same list.
import './tree/core';
import './tree/body';
import './tree/mind';
import './tree/craft';
import './tree/wealth';
import './tree/bonds';
import './tree/spirit';
import './tree/crossroads';

export type { Guide, LadderInfo };

export const AREAS: { id: AreaId; name: string; blurb: string; hue: string }[] = [
  { id: 'body', name: 'Body', blurb: 'Strength, endurance, health', hue: 'var(--teal)' },
  { id: 'mind', name: 'Mind', blurb: 'Knowledge, languages, thinking', hue: 'var(--sky)' },
  { id: 'craft', name: 'Craft', blurb: 'Making things', hue: 'var(--violet)' },
  { id: 'wealth', name: 'Wealth', blurb: 'Career, business, money', hue: 'var(--amber)' },
  { id: 'bonds', name: 'Bonds', blurb: 'Relationships, leadership, community', hue: 'var(--coral)' },
  { id: 'spirit', name: 'Spirit', blurb: 'Discipline, calm, adventure', hue: 'var(--primary)' },
];

export const CORE_NODES: readonly AreteNode[] = nodes;
export const LADDERS: readonly LadderInfo[] = ladders;
export const LADDER_BY_ID: ReadonlyMap<string, LadderInfo> = new Map(ladders.map(l => [l.id, l]));
/** How each discipline works, by `${area}.${slug(discipline)}`. */
export const GUIDES: ReadonlyMap<string, Guide> = guides;
