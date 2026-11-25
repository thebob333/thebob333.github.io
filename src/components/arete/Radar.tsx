import { AREAS } from '@/lib/arete/tree';
import type { Character } from '@/lib/arete/progress';

/** Your six areas as a radar: further out = stronger, relative to your best area. */
export function Radar({ radar, size = 220, labels = true }: { radar: Character['radar']; size?: number; labels?: boolean }) {
  const pad = labels ? 46 : 6;
  const r = size / 2 - pad;
  const c = size / 2;
  const n = radar.length;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const ring = (v: number) => radar.map((_, i) => pt(i, v).join(',')).join(' ');
  const shape = radar.map((x, i) => pt(i, Math.max(0.04, x.value)).join(',')).join(' ');
  const empty = radar.every(x => x.value === 0);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Your areas: ${radar.map(x => `${AREAS.find(a => a.id === x.area)!.name} level ${x.level}`).join(', ')}`}>
      {[0.25, 0.5, 0.75, 1].map(v => <polygon key={v} points={ring(v)} fill="none" stroke="hsl(var(--border))" strokeWidth={1} />)}
      {radar.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth={1} />; })}
      {!empty && <polygon points={shape} fill="hsl(var(--primary) / 0.22)" stroke="hsl(var(--primary))" strokeWidth={2} strokeLinejoin="round" />}
      {!empty && radar.map((x, i) => { const [px, py] = pt(i, Math.max(0.04, x.value)); return <circle key={x.area} cx={px} cy={py} r={3} fill={`hsl(${AREAS.find(a => a.id === x.area)!.hue})`} />; })}
      {labels && radar.map((x, i) => {
        const area = AREAS.find(a => a.id === x.area)!;
        const [lx, ly] = pt(i, 1.24);
        return (
          <text key={x.area} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight={700} fill={`hsl(${area.hue})`}>
            <tspan x={lx} dy="-0.35em">{area.name}</tspan>
            <tspan x={lx} dy="1.2em" fontSize={11} fontWeight={600} fill="hsl(var(--muted-foreground))">Lv {x.level}</tspan>
          </text>
        );
      })}
    </svg>
  );
}
