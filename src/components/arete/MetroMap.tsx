import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Maximize, Minus, Plus, LocateFixed } from 'lucide-react';
import type { AreteState } from '@/types/arete';
import { AREAS } from '@/lib/arete/tree';
import type { Graph, Visibility } from '@/lib/arete/engine';
import { LANE, READ_ZOOM, labelLines, titleLines, type MetroLayout } from '@/lib/arete/layout';
import { isInterchange } from '@/lib/arete/progress';

const ZSTEP = 1.35;
const bucketOf = (k: number) => Math.round(Math.log(k) / Math.log(ZSTEP));
const K_MAX = 2.2;
const BG = '#0c111d';
/** Line colours, like a transit map. */
const LINES = ['#3fd0a8', '#4aa8ff', '#a78bfa', '#f0795a', '#f0b03c', '#ec6aa9', '#86d65a', '#56cfe1'];
const HUE = Object.fromEntries(AREAS.map(a => [a.id, a.hue])) as Record<string, string>;
const areaColor = (area: string, alpha = 1) => `hsl(${HUE[area]} / ${alpha})`;

export interface FlyTarget { x: number; y: number; k?: number; nonce: number }

interface Label {
  key: string; x: number; y: number; lines: string[]; pri: number; anchor: 'start' | 'end' | 'middle';
  size: number; fill: string; weight: number; upper?: boolean; tagFill?: string; hub?: string;
}

const widthOf = (l: Label) => Math.max(...l.lines.map(t => t.length)) * l.size * (l.upper ? 0.68 : 0.56) + 6;

/** Keep the most important names that don't overlap at this zoom. */
function cull(labels: Label[], k: number): Label[] {
  const placed: [number, number, number, number][] = [];
  const out: Label[] = [];
  for (const l of [...labels].sort((a, b) => b.pri - a.pri)) {
    const w = widthOf(l);
    const h = l.lines.length * l.size * 1.15;
    const sx = l.x * k;
    const sy = l.y * k;
    const x0 = l.anchor === 'start' ? sx + 11 : l.anchor === 'end' ? sx - 11 - w : sx - w / 2;
    const r: [number, number, number, number] = [x0 - 2, sy - h / 2 - 2, x0 + w + 2, sy + h / 2 + 2];
    if (placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
    placed.push(r);
    out.push(l);
  }
  return out;
}

const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const star = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`;

/**
 * Arete as a metro map. You are the central station; every area is a line out
 * of it, every discipline a branch, every run of achievements a line of
 * stations. Bright track = travelled, dashed = your next stop, dim = further
 * on, grey = still in the fog. Drag to move, pinch or scroll to zoom, tap a
 * station — or tap anywhere on the zoomed-out map to dive in there.
 */
export function MetroMap({ graph, map, vis, state, level, selected, fresh, onSelect, onHub, onWhere, target, overlay }: {
  graph: Graph;
  map: MetroLayout;
  vis: Map<string, Visibility>;
  state: AreteState;
  level: number;
  /** Station shown with a ring (open in the sheet, or in the spotlight). */
  selected: string | null;
  /** Just unlocked: these pulse for a moment. */
  fresh: ReadonlySet<string>;
  onSelect: (id: string) => void;
  /** An area or discipline name was tapped. */
  onHub: (hubId: string) => void;
  /** Told where the middle of the screen is (map units) and the zoom, whenever the view settles. */
  onWhere?: (x: number, y: number, k: number) => void;
  /** Change `nonce` to fly somewhere. */
  target: FlyTarget | null;
  /** Controls drawn over the map (trail, spotlight card). */
  overlay?: ReactNode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<SVGGElement>(null);
  const view = useRef({ tx: 0, ty: 0, k: 0.5 });
  const size = useRef({ w: 0, h: 0 });
  const anim = useRef(0);
  const [zb, setZb] = useState(() => bucketOf(0.5));
  const zbRef = useRef(zb);
  const [ready, setReady] = useState(false);
  const { bounds } = map;

  const kMin = useCallback(() => Math.max(0.02, Math.min(size.current.w / (bounds.x1 - bounds.x0), size.current.h / (bounds.y1 - bounds.y0)) * 0.96), [bounds]);
  /** The opening view: the central station with the six lines leaving it. */
  const homeK = useCallback(() => Math.min(0.8, Math.max(0.45, size.current.w / 720)), []);

  const apply = useCallback(() => {
    const v = view.current;
    const { w, h } = size.current;
    v.k = Math.min(K_MAX, Math.max(kMin(), v.k));
    // Keep the middle of the screen over the map.
    v.tx = Math.min(w / 2 - bounds.x0 * v.k, Math.max(w / 2 - bounds.x1 * v.k, v.tx));
    v.ty = Math.min(h / 2 - bounds.y0 * v.k, Math.max(h / 2 - bounds.y1 * v.k, v.ty));
    layer.current?.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.k})`);
    const b = bucketOf(v.k);
    if (b !== zbRef.current) { zbRef.current = b; setZb(b); }
  }, [kMin, bounds]);

  const whereRef = useRef(onWhere);
  whereRef.current = onWhere;
  const settle = useRef(0);
  /** The view has stopped moving: say where we are (after a short pause, so it isn't called mid-gesture). */
  const report = useCallback(() => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const v = view.current;
      whereRef.current?.((size.current.w / 2 - v.tx) / v.k, (size.current.h / 2 - v.ty) / v.k, v.k);
    }, 140);
  }, []);

  const flyTo = useCallback((x: number, y: number, k?: number) => {
    cancelAnimationFrame(anim.current);
    const { w, h } = size.current;
    const v = view.current;
    const from = { cx: (w / 2 - v.tx) / v.k, cy: (h / 2 - v.ty) / v.k, lk: Math.log(v.k) };
    const to = { cx: x, cy: y, lk: Math.log(Math.min(K_MAX, Math.max(kMin(), k ?? v.k))) };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 520);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const kk = Math.exp(from.lk + (to.lk - from.lk) * e);
      v.k = kk;
      v.tx = w / 2 - (from.cx + (to.cx - from.cx) * e) * kk;
      v.ty = h / 2 - (from.cy + (to.cy - from.cy) * e) * kk;
      apply();
      if (t < 1) anim.current = requestAnimationFrame(step);
      else report();
    };
    anim.current = requestAnimationFrame(step);
  }, [apply, kMin, report]);

  // Size, first view, and wheel zoom.
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => {
      const first = size.current.w === 0;
      const prev = size.current;
      size.current = { w: el.clientWidth, h: el.clientHeight };
      const v = view.current;
      if (first) {
        v.k = homeK();
        v.tx = size.current.w / 2;
        v.ty = size.current.h / 2;
        setReady(true);
      } else {
        v.tx += (size.current.w - prev.w) / 2;
        v.ty += (size.current.h - prev.h) / 2;
      }
      apply();
    });
    ro.observe(el);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const v = view.current;
      const k = Math.min(K_MAX, Math.max(kMin(), v.k * Math.exp(-e.deltaY * 0.0016)));
      v.tx = px - ((px - v.tx) * k) / v.k;
      v.ty = py - ((py - v.ty) * k) / v.k;
      v.k = k;
      apply();
      report();
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); cancelAnimationFrame(anim.current); };
  }, [apply, kMin, homeK, report]);

  useEffect(() => {
    if (target && size.current.w) flyTo(target.x, target.y, target.k);
    // Fly only when asked (the nonce changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);

  // Drag to pan, two fingers to zoom, tap to select or dive in.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ moved: 0, downId: null as string | null, pinch: 0, t: 0 });
  const onDown = (e: React.PointerEvent) => {
    cancelAnimationFrame(anim.current);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { moved: 0, downId: (e.target as Element).closest?.('[data-id]')?.getAttribute('data-id') ?? null, pinch: 0, t: performance.now() };
    } else {
      const [a, b] = [...pointers.current.values()];
      gesture.current.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.moved = 99;
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const p = pointers.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = view.current;
    if (pointers.current.size === 1) {
      gesture.current.moved += Math.abs(dx) + Math.abs(dy);
      v.tx += dx; v.ty += dy;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const rect = box.current!.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - rect.left;
      const my = (a.y + b.y) / 2 - rect.top;
      if (gesture.current.pinch > 0 && d > 0) {
        const k = Math.min(K_MAX, Math.max(kMin(), (v.k * d) / gesture.current.pinch));
        v.tx = mx - ((mx - v.tx) * k) / v.k + dx / 2;
        v.ty = my - ((my - v.ty) * k) / v.k + dy / 2;
        v.k = k;
      }
      gesture.current.pinch = d;
    }
    apply();
  };
  const onUp = (e: React.PointerEvent) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (pointers.current.size < 2) g.pinch = 0;
    if (pointers.current.size === 0 && g.moved >= 8) report();
    if (!wasSingle || g.moved >= 8 || performance.now() - g.t > 700) return;
    // From far away stations are too small to aim at: a tap there dives in instead.
    const tiny = view.current.k < 0.3;
    if (g.downId?.startsWith('hub:')) onHub(g.downId);
    else if (g.downId && !tiny) onSelect(g.downId);
    else if (view.current.k < 0.42) {
      // Zoomed out: a tap dives in right there.
      const rect = box.current!.getBoundingClientRect();
      const v = view.current;
      flyTo((e.clientX - rect.left - v.tx) / v.k, (e.clientY - rect.top - v.ty) / v.k, READ_ZOOM);
    }
  };

  const zoomBy = (f: number) => {
    const { w, h } = size.current;
    const v = view.current;
    flyTo((w / 2 - v.tx) / v.k, (h / 2 - v.ty) / v.k, v.k * f);
  };

  // ─── Drawing (re-done only when the tree, your progress or the zoom step changes) ───
  const drawn = useMemo(() => {
    const k = ZSTEP ** zb; // the zoom this step stands for
    const u = 1 / k; // one screen pixel, in map units
    const far = k < 0.17; // the whole network: lines and names of places only
    // Stations shrink as you pull back so neighbours on a line never touch.
    const dotScale = Math.min(1, Math.max(0.3, k * 2.2));
    const pinned = new Set(state.pinned);
    const fan = new Map<string, number>();
    for (const p of map.parent.values()) fan.set(p, (fan.get(p) ?? 0) + 1);

    const track: Record<string, string> = {}; // "colour|state" → path
    let fogTrack = '';
    let fogDots = '';
    const stations: JSX.Element[] = [];
    const labels: Label[] = [];
    const trains: { id: string; d: string; color: string }[] = [];

    for (const n of graph.nodes) {
      const p = map.pos.get(n.id)!;
      const v = vis.get(n.id) ?? 'fog';
      const col = map.color.get(n.id) ?? 0;
      const seg = map.seg.get(n.id) ?? '';
      if (v === 'lit' || v === 'open' || v === 'near') track[`${col}|${v}`] = (track[`${col}|${v}`] ?? '') + seg;
      else fogTrack += seg;

      if (v === 'fog') { fogDots += dot(p.x, p.y, 2 * u * dotScale); continue; }

      const c = LINES[col];
      const isPinned = pinned.has(n.id);
      const isSel = selected === n.id;
      // A train heads for whatever you're chasing (and the station in the spotlight).
      if ((isPinned || isSel) && v !== 'lit' && seg && !far) trains.push({ id: n.id, d: seg, color: c });
      const inter = isInterchange(graph, n);
      const junction = (fan.get(n.id) ?? 0) > 1 || n.requires.length > 1;
      const r = (v === 'lit' ? (junction ? 7 : 5.5) : v === 'open' ? 6.5 : v === 'near' ? 4.5 : 6) * u * dotScale;
      stations.push(
        <g key={n.id} data-id={n.id} style={{ cursor: 'pointer' }}>
          {fresh.has(n.id) && <circle cx={p.x} cy={p.y} r={r + 4 * u} fill="none" stroke="#fff" strokeWidth={2 * u} className="arete-pulse" />}
          {v === 'legend'
            ? <path d={star(p.x, p.y, 7 * u * dotScale)} fill="#f0b03c" fillOpacity={0.6} />
            : inter
              // Interchange: a capsule, like stations where lines meet on a real metro map.
              ? <rect x={p.x - r * 1.7} y={p.y - r * 1.05} width={r * 3.4} height={r * 2.1} rx={r * 1.05}
                fill={v === 'lit' ? '#fff' : BG} stroke={v === 'lit' ? c : v === 'open' ? '#fff' : '#56617f'} strokeWidth={(v === 'lit' ? 2.4 : 2) * u * Math.max(0.6, dotScale)} />
            : <circle cx={p.x} cy={p.y} r={r}
              fill={v === 'lit' ? (junction ? '#fff' : c) : BG}
              stroke={v === 'lit' ? BG : v === 'open' ? c : '#56617f'}
              strokeWidth={(v === 'open' ? 2.6 : v === 'lit' ? 1.8 : 1.4) * u * Math.max(0.6, dotScale)} />}
          {v === 'lit' && junction && !inter && <circle cx={p.x} cy={p.y} r={r * 0.52} fill={c} />}
          {isPinned && <circle cx={p.x} cy={p.y} r={r + 5 * u} fill="none" stroke="#f0b03c" strokeWidth={1.6 * u} strokeDasharray={`${3 * u} ${3 * u}`} />}
          {isSel && <circle cx={p.x} cy={p.y} r={r + 9 * u} fill="none" stroke="#fff" strokeWidth={1.6 * u} />}
          <circle cx={p.x} cy={p.y} r={18 * u} fill="transparent" pointerEvents="all" />
        </g>,
      );

      if (far && !isSel && !isPinned && v !== 'legend') continue; // names would only pile up at this distance
      // Far-off legends are named in full: a bare "13:00" means nothing without its line.
      const { lines, tagged } = v === 'legend' ? { lines: titleLines(n.title), tagged: false } : labelLines(n);
      const frontier = v === 'lit' && (graph.dependents.get(n.id) ?? []).some(d => !state.claims[d]);
      const pri = isSel ? 100 : isPinned ? 90 : v === 'open' ? 70 - n.tier : frontier ? 55 : v === 'lit' ? 40 : v === 'near' ? 30 - n.tier : 8 + n.tier;
      labels.push({
        key: n.id, x: p.x, y: p.y, lines, pri, anchor: (map.side.get(n.id) ?? -1) < 0 ? 'end' : 'start', size: 11.5,
        weight: v === 'open' || isSel || isPinned ? 600 : 500, tagFill: tagged ? c : undefined,
        fill: v === 'lit' ? 'rgba(255,255,255,0.9)' : v === 'open' ? '#fff' : v === 'legend' ? 'rgba(240,176,60,0.75)' : 'rgba(255,255,255,0.5)',
      });
    }

    // Extra requirements (beyond the line it sits on) as dotted transfers, for what you can see.
    let transfers = '';
    for (const n of graph.nodes) {
      const v = vis.get(n.id);
      if (n.requires.length < 2 || !(v === 'open' || v === 'lit' || selected === n.id)) continue; // only where it matters now
      const p = map.pos.get(n.id)!;
      for (const r of n.requires.slice(1)) {
        const q = map.pos.get(r);
        if (q) transfers += `M${q.x} ${q.y}L${p.x} ${p.y}`;
      }
    }

    // Signs by the central station: which line goes where.
    const signs: Label[] = [];
    if (k >= 0.42) {
      const lanes = new Map<string, number>();
      for (const h of [...map.hubs].filter(x => x.kind === 'area').sort((a, b) => Math.abs(a.x) - Math.abs(b.x))) {
        const key = `${Math.sign(h.x)}|${h.dir}`;
        const at = lanes.get(key) ?? 44;
        const w = h.name.length * 9 + 22;
        lanes.set(key, at + w);
        signs.push({
          key: `sign:${h.id}`, hub: h.id, x: Math.sign(h.x) * (at + w / 2) * u, y: h.dir * (2 * LANE + 17 * u), lines: [h.name], pri: 300, anchor: 'middle',
          size: 13, weight: 700, fill: areaColor(h.area),
        });
      }
    }
    for (const h of map.hubs) {
      if (h.kind === 'area') {
        const top = map.hubs.filter(x => x.kind === 'branch' && x.area === h.area).reduce((m, x) => Math.max(m, Math.abs(x.y)), 200);
        labels.push(far
          ? { key: h.id, hub: h.id, x: h.x, y: h.dir * top * 0.5, lines: [h.name], pri: 200, anchor: 'middle', size: 17, weight: 700, fill: areaColor(h.area), upper: true }
          // A name plate on the trunk itself, between the corridor and its first branch.
          : { key: h.id, hub: h.id, x: h.x, y: h.dir * 72, lines: [h.name], pri: 200, anchor: 'middle', size: 16, weight: 700, fill: areaColor(h.area) });
      } else {
        labels.push({
          key: h.id, hub: h.id, x: h.x + h.side * 2 * u, y: h.y - h.dir * 15 * u, lines: [h.name], pri: far ? 60 : 85, anchor: h.side > 0 ? 'start' : 'end',
          size: far ? 10 : 11, weight: 700, fill: areaColor(h.area, 0.95), upper: true,
        });
      }
    }

    const shown = cull([...signs, ...labels], k);
    return { u, far, dotScale, lineW: far ? 2.4 : k < 0.42 ? 3.4 : 5, track, fogTrack, fogDots, stations, transfers, shown, trains };
  }, [graph, map, vis, state.claims, state.pinned, zb, selected, fresh]);

  const { u, far, dotScale, lineW } = drawn;
  const reduceMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const line = { fill: 'none', vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none overflow-hidden rounded-[24px]" style={{ background: BG }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <style>{'@keyframes arete-pulse{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}.arete-pulse{transform-box:fill-box;transform-origin:center;animation:arete-pulse 1.1s ease-out 3}'}</style>
      <svg width="100%" height="100%" role="img" aria-label="Arete skill tree, drawn as a metro map" className="block" style={{ opacity: ready ? 1 : 0 }}>
        <g ref={layer}>
          {/* Districts: a soft region behind each discipline */}
          {map.districts.map(d => (
            <rect key={d.key} x={d.x0} y={d.y0} width={d.x1 - d.x0} height={d.y1 - d.y0} rx={30}
              fill={areaColor(d.area, 0.045)} stroke={areaColor(d.area, far ? 0.25 : 0.12)} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ))}

          {/* Fog: track that exists but you can't read yet */}
          <path d={drawn.fogTrack} {...line} stroke="#1a2236" strokeWidth={Math.max(2, lineW - 2)} />
          <path d={drawn.fogDots} fill="#2b3654" />

          {/* Area lines out of the central station, and the discipline feeders */}
          {map.rails.map((r, i) => <path key={i} d={r.d} {...line} stroke={areaColor(r.area, r.trunk ? 0.9 : 0.6)} strokeWidth={r.trunk ? lineW + 1 : lineW - 0.5} />)}

          {/* Lines: dim = ahead of you, dashed = your next stop, bright = travelled */}
          {LINES.map((c, i) => drawn.track[`${i}|near`] && <path key={`n${i}`} d={drawn.track[`${i}|near`]} {...line} stroke={c} strokeOpacity={0.3} strokeWidth={lineW} />)}
          {LINES.map((c, i) => drawn.track[`${i}|open`] && <path key={`o${i}`} d={drawn.track[`${i}|open`]} {...line} stroke={c} strokeOpacity={0.85} strokeWidth={lineW} strokeDasharray="1 9" />)}
          {LINES.map((c, i) => drawn.track[`${i}|lit`] && <path key={`l${i}`} d={drawn.track[`${i}|lit`]} {...line} stroke={c} strokeWidth={lineW} />)}
          <path d={drawn.transfers} {...line} stroke="rgba(255,255,255,0.28)" strokeWidth={1.2} strokeDasharray="1 5" />

          {/* Trains on their way to what you're chasing */}
          {!reduceMotion && drawn.trains.map(t => (
            <g key={`train:${t.id}`} pointerEvents="none">
              <rect x={-9 * u} y={-4.5 * u} width={18 * u} height={9 * u} rx={4.5 * u} fill="#fff" stroke={t.color} strokeWidth={2 * u}>
                <animateMotion dur="2.8s" repeatCount="indefinite" rotate="auto" path={t.d} />
              </rect>
            </g>
          ))}

          {/* Discipline junctions on the trunks */}
          {map.hubs.filter(h => h.kind === 'branch').map(h => (
            <circle key={h.id} data-id={h.id} cx={h.x} cy={h.y} r={(far ? 3 : 5.5) * u * dotScale} fill={BG} stroke={areaColor(h.area)} strokeWidth={2 * u} style={{ cursor: 'pointer' }} />
          ))}

          {/* You: the central station */}
          {far ? <circle r={6 * u} fill="#fff" /> : (
            <>
              <circle r={24 * u} fill={BG} stroke="#fff" strokeWidth={3 * u} />
              <text textAnchor="middle" y={-2 * u} fontSize={8 * u} fontWeight={700} fill="rgba(255,255,255,0.7)" letterSpacing={1 * u}>YOU · LV</text>
              <text textAnchor="middle" y={12 * u} fontSize={14 * u} fontWeight={800} fill="#fff">{level}</text>
            </>
          )}

          {drawn.stations}

          {drawn.shown.map(l => {
            const dx = (l.anchor === 'start' ? 12 : l.anchor === 'end' ? -12 : 0) * u;
            const lh = l.size * 1.15 * u;
            const y0 = l.y - ((l.lines.length - 1) * lh) / 2 + l.size * 0.36 * u;
            const tagW = l.tagFill ? (l.lines[0].length * l.size * 0.62 + 10) * u : 0;
            const tagX = l.anchor === 'end' ? l.x + dx - tagW + 5 * u : l.anchor === 'start' ? l.x + dx - 5 * u : l.x - tagW / 2;
            return (
              <g key={l.key}>
              {l.tagFill && <rect x={tagX} y={y0 - l.size * 0.95 * u} width={tagW} height={l.size * 1.35 * u} rx={l.size * 0.4 * u} fill={l.tagFill} />}
              <text data-id={l.hub} textAnchor={l.anchor} fontSize={l.size * u} fontWeight={l.weight} fill={l.fill}
                letterSpacing={l.upper ? 0.7 * u : undefined} stroke={BG} strokeWidth={3.5 * u} paintOrder="stroke"
                pointerEvents={l.hub ? 'all' : 'none'} style={l.hub ? { cursor: 'pointer' } : undefined}>
                {l.lines.map((t, i) => (
                  <tspan key={i} x={l.x + dx} y={y0 + i * lh} fill={i === 0 && l.tagFill ? BG : undefined} fontWeight={i === 0 && l.tagFill ? 800 : undefined}
                    stroke={i === 0 && l.tagFill ? 'none' : undefined}>
                    {l.upper ? t.toUpperCase() : t}
                  </tspan>
                ))}
              </text>
              </g>
            );
          })}
        </g>
      </svg>

      {overlay && <div onPointerDown={e => e.stopPropagation()}>{overlay}</div>}

      <div className="absolute right-3 top-3 flex flex-col gap-1.5" onPointerDown={e => e.stopPropagation()}>
        {([['Zoom in', Plus, () => zoomBy(1.6)], ['Zoom out', Minus, () => zoomBy(1 / 1.6)], ['Back to you', LocateFixed, () => flyTo(0, 0, homeK())], ['See the whole map', Maximize, () => flyTo((bounds.x0 + bounds.x1) / 2, (bounds.y0 + bounds.y1) / 2, kMin())]] as const).map(([label, Icon, fn]) => (
          <button key={label} type="button" aria-label={label} title={label} onClick={fn}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:bg-white/25">
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}
