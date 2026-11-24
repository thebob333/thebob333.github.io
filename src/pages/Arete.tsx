import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
import { Check, Compass, Pin, Sparkles } from 'lucide-react';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import { ListRow } from '@/components/app/ListRow';
import { SkyMap, type FlyTarget } from '@/components/arete/SkyMap';
import { NodeSheet } from '@/components/arete/NodeSheet';
import { PlacementSheet } from '@/components/arete/PlacementSheet';
import { areteActions, useArete } from '@/hooks/useArete';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { calculateGoalProgress } from '@/types/goals';
import { AREAS } from '@/lib/arete/tree';
import { rarityOf, xpFor } from '@/lib/arete/engine';
import type { AreaId, AreteNode } from '@/types/arete';
import { cn } from '@/lib/utils';

const DayZeroSheet = lazy(() => import('@/components/dayzero/DayZeroSheet').then(m => ({ default: m.DayZeroSheet })));

/**
 * Arete: the universal skill tree for a life — separate from goals. Explore
 * the sky, claim what you've done, chase what's next.
 */
export default function AretePage() {
  const { state, graph, sky, vis, summary } = useArete();
  const goals = useStore(stores.GOALS);
  const [selected, setSelected] = useState<string | null>(null);
  const [target, setTarget] = useState<FlyTarget | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [area, setArea] = useState<AreaId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [goFor, setGoFor] = useState<AreteNode | null>(null);
  const nonce = useRef(0);
  const mapRef = useRef<HTMLDivElement>(null);

  const fly = useCallback((x: number, y: number, k?: number) => setTarget({ x, y, k, nonce: ++nonce.current }), []);
  const open = useCallback((id: string) => {
    const p = sky.pos.get(id);
    if (!p) return;
    setSelected(id);
    fly(p.x, p.y, 0.9);
  }, [sky, fly]);
  const openFromList = (id: string) => {
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    open(id);
  };
  const pickArea = (id: AreaId) => {
    const next = area === id ? null : id;
    setArea(next);
    setShowAll(false);
    if (!next) { fly(0, 0, 0.3); return; }
    const hub = sky.hubs.find(h => h.kind === 'area' && h.area === id)!;
    // Aim past the hub, at the area's first ring of nodes.
    const r = Math.hypot(hub.x, hub.y) || 1;
    fly((hub.x / r) * sky.radius * 0.28, (hub.y / r) * sky.radius * 0.28, 0.42);
  };
  const celebrate = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFresh(new Set(ids));
    window.setTimeout(() => setFresh(new Set()), 3600);
  }, []);

  // What continues something you've started comes before fresh starting points.
  const byTier = (a: AreteNode, b: AreteNode) => Number(!a.requires.length) - Number(!b.requires.length) || a.tier - b.tier || a.title.localeCompare(b.title);
  const within = useMemo(() => graph.nodes.filter(n => vis.get(n.id) === 'open' && (!area || n.area === area)).sort(byTier), [graph, vis, area]);
  const chasing = state.pinned.map(id => graph.byId.get(id)).filter((n): n is AreteNode => !!n && !state.claims[n.id]);
  const ready = Object.entries(state.goalLinks).flatMap(([nodeId, goalId]) => {
    const n = graph.byId.get(nodeId);
    const g = goals.find(x => x.id === goalId);
    return n && g && !state.claims[nodeId] && (g.status === 'achieved' || calculateGoalProgress(g) === 100) ? [{ n, g }] : [];
  });
  const latest = useMemo(() => Object.entries(state.claims).filter(([, c]) => !c.implied).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 3)
    .map(([id, c]) => ({ n: graph.byId.get(id), c })).filter((x): x is { n: AreteNode; c: typeof x.c } => !!x.n), [state.claims, graph]);

  const dotFor = (n: AreteNode) => {
    const hue = AREAS.find(a => a.id === n.area)!.hue;
    return <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `hsl(${hue} / 0.14)`, color: `hsl(${hue})` }}><span className="h-2.5 w-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px hsl(${hue})`, background: state.claims[n.id] ? `hsl(${hue})` : 'transparent' }} /></span>;
  };
  const sub = (n: AreteNode) => <><span className="font-semibold">{rarityOf(n.tier).name}</span> · {n.branch} · +{xpFor(n.tier)} XP</>;
  const pct = Math.round((summary.into / summary.need) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-24">
      <PageHeader title="Arete" actions={<HeaderButton label="Where are you already?" onClick={() => setPlacing(true)}><Compass className="h-[18px] w-[18px]" /></HeaderButton>} />

      {/* You */}
      <section className="surface p-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-[9px] font-bold uppercase leading-none tracking-wider opacity-80">Level</span>
            <span className="text-[20px] font-extrabold leading-6 tabular-nums">{summary.level}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-headline">{summary.rank}</p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1 text-footnote tabular-nums text-muted-foreground">{summary.need - summary.into} XP to level {summary.level + 1} · {summary.claimed} of {summary.total} unlocked</p>
          </div>
        </div>
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4">
          {AREAS.map(a => {
            const s = summary.areas[a.id];
            const on = area === a.id;
            return (
              <button key={a.id} type="button" aria-pressed={on} onClick={() => pickArea(a.id)} title={a.blurb}
                className={cn('pressable flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-footnote font-semibold', on ? 'text-white' : 'bg-secondary')}
                style={on ? { background: `hsl(${a.hue})` } : undefined}>
                {!on && <span className="h-2 w-2 rounded-full" style={{ background: `hsl(${a.hue})` }} />}
                {a.name} <span className={cn('tabular-nums', on ? 'opacity-85' : 'text-muted-foreground')}>Lv {s.level}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!state.started && (
        <section className="rounded-[24px] bg-primary/10 p-4">
          <p className="text-headline">Everything a person can become, on one map.</p>
          <p className="mt-1 text-footnote text-muted-foreground">It starts from the basics and branches out to the legendary. You claim what you've done; the fog lifts as you go. Nobody starts at zero, so begin with what you've already earned.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="pressable h-11 flex-1 rounded-xl bg-primary px-3 text-body font-semibold text-primary-foreground" onClick={() => setPlacing(true)}>Where am I already?</button>
            <button type="button" className="pressable h-11 rounded-xl bg-card px-4 text-body font-semibold" onClick={() => areteActions.start()}>Just explore</button>
          </div>
        </section>
      )}

      {/* The sky */}
      <div ref={mapRef} className="h-[62dvh] min-h-[380px] scroll-mt-3 md:h-[68vh]">
        <SkyMap graph={graph} sky={sky} vis={vis} state={state} level={summary.level} selected={selected} fresh={fresh} onSelect={open} target={target} />
      </div>
      <p className="-mt-3 px-1 text-footnote text-muted-foreground">Drag to move · pinch or scroll to zoom · tap a star. Glowing = unlocked, outlined = within reach, ✦ = legendary, faint dots = still in the fog.</p>

      {ready.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">Ready to claim</h2>
          <div className="list-group">
            {ready.map(({ n, g }) => (
              <ListRow key={n.id} onClick={() => openFromList(n.id)} leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-success/15 text-success"><Check className="h-4 w-4" strokeWidth={3} /></span>}
                title={n.title} subtitle={`You finished "${g.title}"`} chevron />
            ))}
          </div>
        </section>
      )}

      {chasing.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label flex items-center gap-1.5"><Pin className="h-3.5 w-3.5" /> Chasing</h2>
          <div className="list-group">
            {chasing.map(n => <ListRow key={n.id} onClick={() => openFromList(n.id)} leading={dotFor(n)} title={n.title} subtitle={sub(n)} chevron />)}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-label">Within reach{area ? ` · ${AREAS.find(a => a.id === area)!.name}` : ''}</h2>
        {within.length > 0 ? (
          <>
            <div className="list-group">
              {(showAll ? within : within.slice(0, 6)).map(n => <ListRow key={n.id} onClick={() => openFromList(n.id)} leading={dotFor(n)} title={n.title} subtitle={sub(n)} chevron />)}
            </div>
            {within.length > 6 && (
              <button type="button" onClick={() => setShowAll(v => !v)} className="h-10 w-full text-footnote font-semibold text-primary">{showAll ? 'Show fewer' : `Show all ${within.length}`}</button>
            )}
          </>
        ) : <p className="px-1 text-footnote text-muted-foreground">Nothing open here right now. Tap "Discover more" on any node to chart new territory.</p>}
      </section>

      {latest.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">Latest unlocks</h2>
          <div className="list-group">
            {latest.map(({ n, c }) => <ListRow key={n.id} onClick={() => openFromList(n.id)} leading={dotFor(n)} title={n.title} subtitle={<>{c.result ? `${c.result} · ` : ''}{c.at} · {rarityOf(n.tier).name}</>} chevron />)}
          </div>
        </section>
      )}

      <button type="button" onClick={() => setPlacing(true)} className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-body font-semibold">
        <Sparkles className="h-4 w-4 text-primary" /> Claim what I've already done
      </button>

      {selected && (
        <NodeSheet nodeId={selected} onClose={() => setSelected(null)} onSelect={open} onUnlocked={celebrate}
          onGoFor={n => { setSelected(null); setGoFor(n); }} />
      )}
      <PlacementSheet open={placing} onClose={() => { setPlacing(false); areteActions.start(); }} />
      {goFor && (
        <Suspense fallback={null}>
          <DayZeroSheet open initialBrief={`${goFor.title}${goFor.detail ? ` (${goFor.detail})` : ''}`} onClose={() => setGoFor(null)}
            onCreated={g => areteActions.link(goFor.id, g.id)} />
        </Suspense>
      )}
    </div>
  );
}
