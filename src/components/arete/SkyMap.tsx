import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, Telescope, LocateFixed } from 'lucide-react';
import type { AreteState } from '@/types/arete';
import { AREAS } from '@/lib/arete/tree';
import type { Graph, Visibility } from '@/lib/arete/engine';
import type { SkyLayout } from '@/lib/arete/layout';

const ZSTEP = 1.35;
const bucketOf = (k: number) => Math.round(Math.log(k) / Math.log(ZSTEP));
const K_MAX = 2.6;
const SKY = '#0a0e1f';
const HUE = Object.fromEntries(AREAS.map(a => [a.id, a.hue])) as Record<string, string>;
const color = (area: string, alpha = 1) => `hsl(${HUE[area]} / ${alpha})`;

const STARS = [[8, 12], [22, 71], [35, 28], [47, 88], [58, 9], [66, 52], [79, 81], [91, 33], [14, 46], [72, 18], [41, 60], [86, 64]]
  .map(([x, y], i) => `radial-gradient(${i % 3 ? 1 : 1.5}px ${i % 3 ? 1 : 1.5}px at ${x}% ${y}%, rgba(255,255,255,${i % 2 ? 0.45 : 0.7}) 50%, transparent 51%)`)
  .concat('radial-gradient(ellipse at 50% 45%, #171d3a 0%, #0a0e1f 72%)').join(', ');

export interface FlyTarget { x: number; y: number; k?: number; nonce: number }

interface Label { key: string; x: number; y: number; text: string; pri: number; anchor: 'start' | 'end' | 'middle'; size: number; fill: string; weight: number; upper?: boolean }

/** Keep the most important labels that don't overlap, at this zoom. */
function cull(labels: Label[], k: number): Label[] {
  const placed: [number, number, number, number][] = [];
  const out: Label[] = [];
  for (const l of [...labels].sort((a, b) => b.pri - a.pri)) {
    const w = l.text.length * l.size * (l.upper ? 0.66 : 0.56) + 6;
    const sx = l.x * k;
    const sy = l.y * k;
    const x0 = l.anchor === 'start' ? sx + 9 : l.anchor === 'end' ? sx - 9 - w : sx - w / 2;
    const y0 = sy - l.size * 0.8;
    const r: [number, number, number, number] = [x0 - 2, y0 - 2, x0 + w + 2, y0 + l.size * 1.3 + 2];
    if (placed.some(p => r[0] < p[2] && r[2] > p[0] && r[1] < p[3] && r[3] > p[1])) continue;
    placed.push(r);
    out.push(l);
  }
  return out;
}

const dot = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const star = (x: number, y: number, r: number) => `M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`;

/**
 * The night sky of everything a person can become. You're at the centre; drag
 * to move, pinch or scroll to zoom, tap a star to open it. Unlocked nodes glow,
 * the next ones are outlined, and the rest waits in the fog.
 */
export function SkyMap({ graph, sky, vis, state, level, selected, fresh, onSelect, target }: {
  graph: Graph;
  sky: SkyLayout;
  vis: Map<string, Visibility>;
  state: AreteState;
  level: number;
  selected: string | null;
  /** Just unlocked: these pulse for a moment. */
  fresh: ReadonlySet<string>;
  onSelect: (id: string) => void;
  /** Change `nonce` to fly somewhere. */
  target: FlyTarget | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<SVGGElement>(null);
  const view = useRef({ tx: 0, ty: 0, k: 0.3 });
  const size = useRef({ w: 0, h: 0 });
  const anim = useRef(0);
  const [zb, setZb] = useState(() => bucketOf(0.3));
  const zbRef = useRef(zb);
  const [ready, setReady] = useState(false);

  const kMin = useCallback(() => Math.max(0.03, Math.min(size.current.w, size.current.h) / (2 * sky.radius * 1.12)), [sky.radius]);

  /** The opening view: you, the six areas and the first ring of nodes, big enough to read. */
  const homeK = useCallback(() => Math.min(0.5, Math.max(0.27, size.current.w / (sky.radius * 0.36))), [sky.radius]);

  const apply = useCallback(() => {
    const v = view.current;
    v.k = Math.min(K_MAX, Math.max(kMin(), v.k));
    // Keep the centre of the screen somewhere over the sky.
    const { w, h } = size.current;
    const lim = sky.radius * 1.1 * v.k;
    v.tx = Math.min(w / 2 + lim, Math.max(w / 2 - lim, v.tx));
    v.ty = Math.min(h / 2 + lim, Math.max(h / 2 - lim, v.ty));
    layer.current?.setAttribute('transform', `translate(${v.tx} ${v.ty}) scale(${v.k})`);
    const b = bucketOf(v.k);
    if (b !== zbRef.current) { zbRef.current = b; setZb(b); }
  }, [kMin, sky.radius]);

  const flyTo = useCallback((x: number, y: number, k?: number) => {
    cancelAnimationFrame(anim.current);
    const { w, h } = size.current;
    const v = view.current;
    const from = { cx: (w / 2 - v.tx) / v.k, cy: (h / 2 - v.ty) / v.k, lk: Math.log(v.k) };
    const to = { cx: x, cy: y, lk: Math.log(Math.min(K_MAX, Math.max(kMin(), k ?? v.k))) };
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / 480);
      const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const kk = Math.exp(from.lk + (to.lk - from.lk) * e);
      v.k = kk;
      v.tx = w / 2 - (from.cx + (to.cx - from.cx) * e) * kk;
      v.ty = h / 2 - (from.cy + (to.cy - from.cy) * e) * kk;
      apply();
      if (t < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, [apply, kMin]);

  // Size, first view, and wheel zoom.
  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => {
      const first = size.current.w === 0;
      const prev = size.current;
      size.current = { w: el.clientWidth, h: el.clientHeight };
      const v = view.current;
      if (first) {
        // Open on the centre with the first ring of nodes in view.
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
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { ro.disconnect(); el.removeEventListener('wheel', wheel); cancelAnimationFrame(anim.current); };
  }, [apply, kMin, homeK, sky.radius]);

  useEffect(() => {
    if (target && size.current.w) flyTo(target.x, target.y, target.k);
    // Fly only when asked (the nonce changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.nonce]);

  // Drag to pan, two fingers to zoom, tap to select.
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
    if (wasSingle && g.moved < 8 && g.downId && performance.now() - g.t < 700) onSelect(g.downId);
    if (pointers.current.size < 2) g.pinch = 0;
  };

  const zoomBy = (f: number) => {
    const { w, h } = size.current;
    const v = view.current;
    flyTo((w / 2 - v.tx) / v.k, (h / 2 - v.ty) / v.k, v.k * f);
  };

  // ─── Drawing (re-done only when the tree, your progress or the zoom step changes) ───
  const drawn = useMemo(() => {
    const k = ZSTEP ** zb; // the zoom this step stands for
    const u = 1 / k; // one screen pixel, in sky units
    const far = k < 0.17; // the whole sky: regions and legends only
    const dotScale = Math.min(1, Math.max(0.42, k / 0.3)); // stars shrink a little as you pull back
    const P = (id: string) => sky.pos.get(id) ?? sky.hubPos.get(id)!;
    const pinned = new Set(state.pinned);

    let fogDots = '';
    let fogEdges = '';
    let dimEdges = '';
    const litEdges: Record<string, string> = {};
    const openEdges: Record<string, string> = {};
    const stars: JSX.Element[] = [];
    const labels: Label[] = [];

    for (const n of graph.nodes) {
      const p = sky.pos.get(n.id)!;
      const v = vis.get(n.id) ?? 'fog';
      const pp = P(sky.parent.get(n.id)!);
      const seg = `M${pp.x} ${pp.y}L${p.x} ${p.y}`;
      const parentLit = !graph.byId.has(sky.parent.get(n.id)!) || !!state.claims[sky.parent.get(n.id)!];
      if (v === 'lit' && parentLit) litEdges[n.area] = (litEdges[n.area] ?? '') + seg;
      else if (v === 'open' || v === 'lit') openEdges[n.area] = (openEdges[n.area] ?? '') + seg;
      else if (v === 'near') dimEdges += seg;
      else fogEdges += seg;

      if (v === 'fog') { fogDots += dot(p.x, p.y, 1.5 * u); continue; }

      const isPinned = pinned.has(n.id);
      const isSel = selected === n.id;
      const c = color(n.area);
      const r = (v === 'lit' ? 5 + n.tier * 0.35 : v === 'open' ? 6 : v === 'near' ? 4 : 5) * u * dotScale;
      stars.push(
        <g key={n.id} data-id={n.id} style={{ cursor: 'pointer' }}>
          {v === 'lit' && <circle cx={p.x} cy={p.y} r={r + 6 * u} fill={c} opacity={0.22} />}
          {fresh.has(n.id) && <circle cx={p.x} cy={p.y} r={r + 4 * u} fill="none" stroke="#fff" strokeWidth={2 * u} className="arete-pulse" />}
          {v === 'legend'
            ? <path d={star(p.x, p.y, 6.5 * u)} fill="hsl(var(--amber) / 0.55)" />
            : <circle cx={p.x} cy={p.y} r={r} fill={v === 'lit' ? c : SKY} stroke={v === 'lit' ? '#fff' : v === 'open' ? c : 'rgba(255,255,255,0.38)'}
              strokeWidth={(v === 'open' ? 2 : 1.2) * u} strokeDasharray={v === 'near' ? `${2.5 * u} ${2.5 * u}` : undefined} />}
          {isPinned && <circle cx={p.x} cy={p.y} r={r + 5 * u} fill="none" stroke="hsl(var(--amber))" strokeWidth={1.6 * u} strokeDasharray={`${3 * u} ${3 * u}`} />}
          {isSel && <circle cx={p.x} cy={p.y} r={r + 9 * u} fill="none" stroke="#fff" strokeWidth={1.5 * u} />}
          <circle cx={p.x} cy={p.y} r={17 * u} fill="transparent" pointerEvents="all" />
        </g>,
      );

      if (far && !isSel && !isPinned && v !== 'legend') continue; // names would only pile up at this distance
      const frontier = v === 'lit' && (graph.dependents.get(n.id) ?? []).some(d => !state.claims[d]);
      const pri = isSel ? 100 : isPinned ? 90 : v === 'open' ? 70 - n.tier : frontier ? 50 : v === 'near' ? 30 - n.tier : v === 'legend' ? 18 + n.tier : 8;
      labels.push({
        key: n.id, x: p.x, y: p.y, text: (v === 'legend' ? '✦ ' : '') + n.title, pri,
        anchor: p.x >= 0 ? 'start' : 'end', size: 11.5, weight: v === 'open' || isSel || isPinned ? 600 : 500,
        fill: v === 'lit' ? 'rgba(255,255,255,0.92)' : v === 'open' ? '#fff' : v === 'legend' ? 'hsl(var(--amber) / 0.7)' : 'rgba(255,255,255,0.5)',
      });
    }

    // Extra requirements (beyond the map parent) as faint arcs, for what you can see.
    let cross = '';
    for (const n of graph.nodes) {
      const v = vis.get(n.id);
      if (v === 'fog' || v === 'legend' || n.requires.length < 2) continue;
      const p = sky.pos.get(n.id)!;
      for (const r of n.requires.slice(1)) {
        const q = sky.pos.get(r);
        if (q) cross += `M${q.x} ${q.y}Q${(p.x + q.x) / 2 * 0.86} ${(p.y + q.y) / 2 * 0.86} ${p.x} ${p.y}`;
      }
    }

    let hubEdges = '';
    for (const h of sky.hubs) {
      const from = h.kind === 'area' ? { x: 0, y: 0 } : sky.hubPos.get(`hub:${h.area}`)!;
      hubEdges += `M${from.x} ${from.y}L${h.x} ${h.y}`;
      if (h.kind === 'area') {
        // From far away the area names sit out in their region, like names on a map.
        const out = far ? sky.radius * 0.42 : 0;
        labels.push({ key: h.id, x: far ? Math.cos(h.angle) * out : h.x, y: far ? Math.sin(h.angle) * out : h.y - 26 * u, text: h.name, pri: 200, anchor: 'middle', size: far ? 17 : 15, weight: 700, fill: color(h.area), upper: far });
      } else if (!far) {
        labels.push({ key: h.id, x: h.x, y: h.y - 20 * u, text: h.name, pri: 80, anchor: 'middle', size: 10.5, weight: 700, fill: color(h.area, 0.85), upper: true });
      }
    }

    const shown = cull(labels, k);
    return { u, far, dotScale, fogDots, fogEdges, dimEdges, litEdges, openEdges, stars, cross, hubEdges, shown };
  }, [graph, sky, vis, state.claims, state.pinned, zb, selected, fresh]);

  const { u, far, dotScale } = drawn;
  const line = { fill: 'none', vectorEffect: 'non-scaling-stroke' as const };

  return (
    <div ref={box} className="relative h-full w-full touch-none select-none overflow-hidden rounded-[24px]" style={{ background: STARS, backgroundColor: SKY }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <style>{'@keyframes arete-pulse{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(3.2)}}.arete-pulse{transform-box:fill-box;transform-origin:center;animation:arete-pulse 1.1s ease-out 3}'}</style>
      <svg width="100%" height="100%" role="img" aria-label="Arete skill tree map" className="block" style={{ opacity: ready ? 1 : 0 }}>
        <g ref={layer}>
          <path d={drawn.fogEdges} {...line} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          <path d={drawn.fogDots} fill="rgba(255,255,255,0.2)" />
          <path d={drawn.hubEdges} {...line} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
          <path d={drawn.dimEdges} {...line} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="2 4" />
          <path d={drawn.cross} {...line} stroke="rgba(255,255,255,0.16)" strokeWidth={1} strokeDasharray="1 5" />
          {AREAS.map(a => drawn.openEdges[a.id] && <path key={`o${a.id}`} d={drawn.openEdges[a.id]} {...line} stroke={color(a.id, 0.55)} strokeWidth={1.4} strokeDasharray="4 4" />)}
          {AREAS.map(a => drawn.litEdges[a.id] && <path key={`l${a.id}`} d={drawn.litEdges[a.id]} {...line} stroke={color(a.id, 0.95)} strokeWidth={2} />)}

          {/* Hubs */}
          {sky.hubs.filter(h => !far || h.kind === 'area').map(h => (
            <circle key={h.id} cx={h.x} cy={h.y} r={(h.kind === 'area' ? 9 : 4) * u * dotScale} fill={h.kind === 'area' ? color(h.area) : SKY} stroke={color(h.area)} strokeWidth={1.5 * u} />
          ))}

          {/* You */}
          {far ? <circle r={5 * u} fill="#fff" /> : (
            <>
              <circle r={34 * u} fill="rgba(255,255,255,0.06)" />
              <circle r={22 * u} fill={SKY} stroke="#fff" strokeWidth={2 * u} />
              <text textAnchor="middle" y={-1 * u} fontSize={8 * u} fontWeight={700} fill="rgba(255,255,255,0.7)" letterSpacing={1 * u}>LEVEL</text>
              <text textAnchor="middle" y={11 * u} fontSize={13 * u} fontWeight={800} fill="#fff">{level}</text>
            </>
          )}

          {drawn.stars}

          {drawn.shown.map(l => (
            <text key={l.key} x={l.x} y={l.y} dx={(l.anchor === 'start' ? 10 : l.anchor === 'end' ? -10 : 0) * u} dy={(l.anchor === 'middle' ? 0 : 4) * u}
              textAnchor={l.anchor} fontSize={l.size * u} fontWeight={l.weight} fill={l.fill} letterSpacing={l.upper ? 0.6 * u : undefined}
              stroke={SKY} strokeWidth={3 * u} paintOrder="stroke" pointerEvents="none">
              {l.upper ? l.text.toUpperCase() : l.text}
            </text>
          ))}
        </g>
      </svg>

      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5" onPointerDown={e => e.stopPropagation()}>
        {([['Zoom in', Plus, () => zoomBy(1.6)], ['Zoom out', Minus, () => zoomBy(1 / 1.6)], ['Back to you', LocateFixed, () => flyTo(0, 0, homeK())], ['See the whole sky', Telescope, () => flyTo(0, 0, kMin())]] as const).map(([label, Icon, fn]) => (
          <button key={label} type="button" aria-label={label} title={label} onClick={fn}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md active:bg-white/25">
            <Icon className="h-[18px] w-[18px]" />
          </button>
        ))}
      </div>
    </div>
  );
}
