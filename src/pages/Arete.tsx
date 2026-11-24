import { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Compass, Pin, Search, Sparkles, X } from 'lucide-react';
import { PageHeader, HeaderButton } from '@/components/app/PageHeader';
import { ListRow } from '@/components/app/ListRow';
import { MetroMap, type FlyTarget } from '@/components/arete/MetroMap';
import { NodeSheet } from '@/components/arete/NodeSheet';
import { PlacementSheet } from '@/components/arete/PlacementSheet';
import { areteActions, useArete } from '@/hooks/useArete';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { calculateGoalProgress } from '@/types/goals';
import { AREAS, LADDER_BY_ID } from '@/lib/arete/tree';
import { rarityOf, statusOf, xpFor } from '@/lib/arete/engine';
import { READ_ZOOM, areaHubId, branchHubId } from '@/lib/arete/layout';
import type { AreaId, AreteNode } from '@/types/arete';
import { cn } from '@/lib/utils';

const DayZeroSheet = lazy(() => import('@/components/dayzero/DayZeroSheet').then(m => ({ default: m.DayZeroSheet })));

/**
 * Arete: the universal skill tree for a life, drawn as a metro map — separate
 * from goals. Follow the lines, claim what you've done, chase what's next.
 */
export default function AretePage() {
  const { state, graph, map, vis, summary } = useArete();
  const goals = useStore(stores.GOALS);
  const [selected, setSelected] = useState<string | null>(null); // open in the sheet
  const [spot, setSpot] = useState<string | null>(null); // ringed on the map by "Next up"
  const [target, setTarget] = useState<FlyTarget | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  const [area, setArea] = useState<AreaId | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [goFor, setGoFor] = useState<AreteNode | null>(null);
  const [query, setQuery] = useState('');
  const [where, setWhere] = useState<{ area: AreaId; branch: string } | null>(null); // the district in the middle of the map
  const nonce = useRef(0);
  const mapRef = useRef<HTMLDivElement>(null);

  const fly = useCallback((x: number, y: number, k?: number) => setTarget({ x, y, k, nonce: ++nonce.current }), []);
  const show = useCallback((id: string) => {
    const p = map.pos.get(id);
    if (p) fly(p.x, p.y, READ_ZOOM);
  }, [map, fly]);
  const open = useCallback((id: string) => { setSelected(id); setSpot(id); show(id); }, [show]);
  const openFromList = (id: string) => {
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    open(id);
  };
  /** Jump to an area's trunk or a discipline's branch. */
  const goHub = useCallback((hubId: string) => {
    const h = map.hubs.find(x => x.id === hubId);
    if (!h) return;
    if (h.kind === 'area') fly(h.x, h.dir * 250, 0.34);
    else fly(h.x + h.side * 230, h.y + h.dir * 150, 0.6);
  }, [map, fly]);
  /** The trail follows the map: which district is in the middle of the screen right now. */
  const onWhere = useCallback((x: number, y: number, k: number) => {
    let next: { area: AreaId; branch: string } | null = null;
    if (k >= 0.2 && Math.hypot(x, y) > 170) {
      let best = Infinity;
      for (const [id, p] of map.pos) {
        const d = (p.x - x) ** 2 + (p.y - y) ** 2;
        if (d < best) { best = d; const n = graph.byId.get(id)!; next = { area: n.area, branch: n.branch }; }
      }
    }
    setWhere(prev => (prev?.area === next?.area && prev?.branch === next?.branch ? prev : next));
  }, [map, graph]);
  const pickArea = (id: AreaId) => {
    const next = area === id ? null : id;
    setArea(next);
    setShowAll(false);
    if (next) goHub(areaHubId(next)); else fly(0, 0, 0.5);
  };
  const celebrate = useCallback((ids: string[]) => {
    if (!ids.length) return;
    setFresh(new Set(ids));
    window.setTimeout(() => setFresh(new Set()), 3600);
  }, []);

  // What continues something you've started comes before fresh starting points; what you're chasing comes first.
  const byReach = useCallback((a: AreteNode, b: AreteNode) =>
    Number(state.pinned.includes(b.id)) - Number(state.pinned.includes(a.id))
    || Number(!a.requires.length) - Number(!b.requires.length) || a.tier - b.tier || a.title.localeCompare(b.title), [state.pinned]);
  const reach = useMemo(() => graph.nodes.filter(n => vis.get(n.id) === 'open').sort(byReach), [graph, vis, byReach]);
  const within = area ? reach.filter(n => n.area === area) : reach;
  const chasing = state.pinned.map(id => graph.byId.get(id)).filter((n): n is AreteNode => !!n && !state.claims[n.id]);
  const ready = Object.entries(state.goalLinks).flatMap(([nodeId, goalId]) => {
    const n = graph.byId.get(nodeId);
    const g = goals.find(x => x.id === goalId);
    return n && g && !state.claims[nodeId] && (g.status === 'achieved' || calculateGoalProgress(g) === 100) ? [{ n, g }] : [];
  });
  const latest = useMemo(() => Object.entries(state.claims).filter(([, c]) => !c.implied).sort((a, b) => b[1].at.localeCompare(a[1].at)).slice(0, 3)
    .map(([id, c]) => ({ n: graph.byId.get(id), c })).filter((x): x is { n: AreteNode; c: typeof x.c } => !!x.n), [state.claims, graph]);

  // "Next up": step through what's within reach, one station at a time.
  const upNext = (spot && reach.find(n => n.id === spot)) || reach[0] || null;
  const nextStop = () => {
    if (!reach.length) return;
    const i = spot ? reach.findIndex(n => n.id === spot) : -1;
    const n = reach[(i + 1) % reach.length];
    setSpot(n.id);
    show(n.id);
  };

  // Find anything by name.
  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const rank = (n: AreteNode) => (vis.get(n.id) === 'fog' ? 1 : 0);
    return graph.nodes.filter(n => n.title.toLowerCase().includes(q) || n.branch.toLowerCase().includes(q))
      .sort((a, b) => rank(a) - rank(b) || a.tier - b.tier).slice(0, 8);
  }, [query, graph, vis]);
  const statusText = (n: AreteNode) => {
    const s = statusOf(n, state);
    return s === 'claimed' ? 'Unlocked' : s === 'open' ? 'Within reach' : vis.get(n.id) === 'fog' ? 'In the fog' : 'Locked';
  };

  const hueOf = (n: AreteNode) => AREAS.find(a => a.id === n.area)!.hue;
  const dotFor = (n: AreteNode) => (
    <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `hsl(${hueOf(n)} / 0.14)`, color: `hsl(${hueOf(n)})` }}>
      <span className="h-2.5 w-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 2px hsl(${hueOf(n)})`, background: state.claims[n.id] ? `hsl(${hueOf(n)})` : 'transparent' }} />
    </span>
  );
  const sub = (n: AreteNode) => <><span className="font-semibold">{rarityOf(n.tier).name}</span> · {n.branch} · +{xpFor(n.tier)} XP</>;
  const pct = Math.round((summary.into / summary.need) * 100);
  // The trail: the open station if there is one, otherwise wherever the map is.
  const openNode = selected ? graph.byId.get(selected) : undefined;
  const here = openNode ? { area: openNode.area, branch: openNode.branch, ladder: openNode.ladder } : where ? { ...where, ladder: undefined as string | undefined } : null;
  const hereHue = here ? AREAS.find(a => a.id === here.area)!.hue : '';
  const crumb = 'pointer-events-auto h-7 rounded-full bg-black/45 px-2.5 text-[12px] font-semibold text-white backdrop-blur-md';

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
          <p className="mt-1 text-footnote text-muted-foreground">You're the central station. Every line runs from the basics out to the legendary, and branches as it goes. You claim the stations you've reached; the fog lifts as you travel. Nobody starts at zero, so begin with what you've already earned.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="pressable h-11 flex-1 rounded-xl bg-primary px-3 text-body font-semibold text-primary-foreground" onClick={() => setPlacing(true)}>Where am I already?</button>
            <button type="button" className="pressable h-11 rounded-xl bg-card px-4 text-body font-semibold" onClick={() => areteActions.start()}>Just explore</button>
          </div>
        </section>
      )}

      {/* Find anything */}
      <div className="relative">
        <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-secondary px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Find anything: marathon, chess, net worth" aria-label="Find a station"
            className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" enterKeyHint="search" />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="flex h-8 w-8 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>}
        </label>
        {query.trim().length >= 2 && (
          <div className="list-group mt-2">
            {found.length ? found.map(n => (
              <ListRow key={n.id} onClick={() => { setQuery(''); openFromList(n.id); }} leading={dotFor(n)} title={n.title}
                subtitle={<>{AREAS.find(a => a.id === n.area)!.name} · {n.branch} · <span className="font-semibold">{statusText(n)}</span></>} chevron />
            )) : <p className="px-4 py-3 text-footnote text-muted-foreground">Nothing by that name yet. Open any station and tap "Add my own" to put it on the map.</p>}
          </div>
        )}
      </div>

      {/* The map */}
      <div ref={mapRef} className="h-[64dvh] min-h-[400px] scroll-mt-3 md:h-[70vh]">
        <MetroMap graph={graph} map={map} vis={vis} state={state} level={summary.level} selected={selected ?? spot} fresh={fresh}
          onSelect={open} onHub={goHub} onWhere={onWhere} target={target}
          overlay={<>
            {/* Where you are: tap any part to jump back */}
            <div className="pointer-events-none absolute left-3 right-16 top-3 flex flex-wrap items-center gap-1">
              <button type="button" className={crumb} onClick={() => { setSpot(null); fly(0, 0, 0.5); }}>You</button>
              {here && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                  <button type="button" className={crumb} style={{ color: `hsl(${hereHue})` }} onClick={() => goHub(areaHubId(here.area))}>{AREAS.find(a => a.id === here.area)!.name}</button>
                  <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                  <button type="button" className={crumb} onClick={() => goHub(branchHubId(here.area, here.branch))}>{here.branch}</button>
                  {here.ladder && LADDER_BY_ID.get(here.ladder) && (
                    <>
                      <ChevronRight className="h-3.5 w-3.5 text-white/60" />
                      <button type="button" className={crumb} onClick={() => show(LADDER_BY_ID.get(here.ladder!)!.rungs[0])}>{LADDER_BY_ID.get(here.ladder)!.name}</button>
                    </>
                  )}
                </>
              )}
            </div>
            {/* Next up: step through what's within reach */}
            {upNext && (
              <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-2xl bg-black/55 p-2 pl-3.5 text-white backdrop-blur-md">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setSpot(upNext.id); show(upNext.id); }}>
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/65">Next up · {upNext.branch}</span>
                  <span className="block truncate text-body font-semibold">{upNext.title}</span>
                </button>
                <button type="button" className="h-10 shrink-0 rounded-xl bg-white px-3.5 text-footnote font-bold text-neutral-900" onClick={() => open(upNext.id)}>Open</button>
                {reach.length > 1 && (
                  <button type="button" aria-label="Next station within reach" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15" onClick={nextStop}>
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </>} />
      </div>
      <p className="-mt-3 px-1 text-footnote text-muted-foreground">Drag to move, pinch or scroll to zoom, tap a station. Bright line = travelled, dotted = your next stop, dim = further on, grey = still in the fog, ✦ = legendary. Zoomed out, tap anywhere to dive in.</p>

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
        ) : <p className="px-1 text-footnote text-muted-foreground">Nothing open here right now. Tap "Discover more" on any station to lay new track.</p>}
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
