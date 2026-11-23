import { useEffect, useMemo, useRef } from 'react';
import { addDays, daysBetween, type DateKey } from '@/lib/dates';
import type { PathNode, PathPlan } from '@/lib/path';

const STAGE_HUES = ['var(--primary)', 'var(--teal)', 'var(--violet)', 'var(--coral)', 'var(--sky)', 'var(--amber)'];
const stageColor = (i: number, alpha = 1) => `hsl(${STAGE_HUES[i % STAGE_HUES.length]} / ${alpha})`;

/**
 * The Path as a map: time runs left to right, each task is a bar placed where
 * the scheduler put it, curves show what depends on what, and the shaded zone
 * at the end is where you'll likely land. Tap a bar to open the task.
 */
export function PathMap({ plan, today, onSelect, compact = false, ghost = false }: {
  plan: PathPlan;
  today: DateKey;
  onSelect?: (node: PathNode) => void;
  /** Small version for cards: thin bars, no labels. */
  compact?: boolean;
  /** Preview style (a route you haven't picked). */
  ghost?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const ROW = compact ? 14 : 44;
  const STAGE = compact ? 6 : 26;
  const TOP = compact ? 8 : 34;
  const BAR = compact ? 8 : 14;

  const layout = useMemo(() => {
    const nodes = plan.nodes;
    const dates = nodes.flatMap(n => [n.start, n.end]);
    const firstDone = nodes.filter(n => n.state === 'done').map(n => n.start).sort()[0];
    const from = firstDone && firstDone < today ? (daysBetween(firstDone, today) > 21 ? addDays(today, -21) : firstDone) : today;
    const ends = [...dates, plan.late ?? today, plan.deadline ?? today].filter(Boolean).sort();
    const to = addDays(ends[ends.length - 1] ?? today, 10);
    const span = Math.max(14, daysBetween(from, to));
    const perDay = compact ? Math.max(2, Math.min(12, 560 / span)) : Math.max(5, Math.min(26, 1100 / span));
    const x = (k: DateKey) => 12 + daysBetween(from, k) * perDay;

    // Rows: grouped by stage, in schedule order within each stage.
    const stages: { index: number; title: string; y: number }[] = [];
    const rowY = new Map<string, number>();
    let y = TOP;
    const byStage = new Map<number, PathNode[]>();
    for (const n of nodes) byStage.set(n.phaseIndex, [...(byStage.get(n.phaseIndex) ?? []), n]);
    for (const [index, list] of [...byStage.entries()].sort((a, b) => a[0] - b[0])) {
      stages.push({ index, title: list[0].phaseTitle, y });
      y += STAGE;
      for (const n of [...list].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end))) { rowY.set(n.id, y); y += ROW; }
    }
    const width = Math.max(compact ? 300 : 340, x(to) + 24);
    // Month ticks.
    const ticks: { x: number; label: string }[] = [];
    const d = new Date(`${from}T12:00:00`);
    d.setDate(1);
    for (let i = 0; i < 60; i++) {
      d.setMonth(d.getMonth() + (i === 0 ? 1 : 1));
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` as DateKey;
      if (k > to) break;
      ticks.push({ x: x(k), label: d.toLocaleDateString(undefined, { month: 'short', ...(d.getMonth() === 0 ? { year: 'numeric' } : {}) }) });
    }
    return { x, perDay, rowY, stages, height: y + (compact ? 6 : 18), width, ticks, from };
  }, [plan, today, compact, ROW, STAGE, TOP]);

  // Start with today near the left edge.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = Math.max(0, layout.x(today) - (compact ? 16 : 40));
  }, [layout, today, compact]);

  const { x, perDay, rowY } = layout;
  const byId = new Map(plan.nodes.map(n => [n.id, n]));
  const barX = (n: PathNode) => x(n.start);
  const barW = (n: PathNode) => Math.max(compact ? 4 : 10, (daysBetween(n.start, n.end) + 1) * perDay);
  const mid = (n: PathNode) => rowY.get(n.id)! + (compact ? ROW / 2 : 26);

  return (
    <div ref={scroller} className={`no-scrollbar overflow-x-auto ${ghost ? 'opacity-80' : ''}`}>
      <svg width={layout.width} height={layout.height} role="img" aria-label="Your path: tasks over time" className="block">
        {/* Month grid */}
        {layout.ticks.map(t => (
          <g key={t.x}>
            <line x1={t.x} x2={t.x} y1={compact ? 0 : 18} y2={layout.height} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            {!compact && <text x={t.x + 4} y={13} fontSize={11} fill="hsl(var(--muted-foreground))">{t.label}</text>}
          </g>
        ))}

        {/* Likely landing zone */}
        {plan.early && plan.late && (
          <g>
            <rect x={x(plan.early)} y={compact ? 0 : 18} width={Math.max(4, x(plan.late) - x(plan.early) + perDay)} height={layout.height - (compact ? 0 : 18)}
              fill="hsl(var(--primary) / 0.08)" rx={6} />
            {plan.finish && <line x1={x(plan.finish) + perDay / 2} x2={x(plan.finish) + perDay / 2} y1={compact ? 0 : 18} y2={layout.height} stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 4" />}
            {!compact && plan.finish && (
              <text x={x(plan.finish) + perDay / 2 + 5} y={layout.height - 6} fontSize={11} fontWeight={700} fill="hsl(var(--primary))">Likely finish</text>
            )}
          </g>
        )}

        {/* Target date */}
        {plan.deadline && (
          <g>
            <line x1={x(plan.deadline) + perDay} x2={x(plan.deadline) + perDay} y1={compact ? 0 : 18} y2={layout.height} stroke="hsl(var(--destructive) / 0.7)" strokeWidth={1.5} />
            {!compact && <text x={x(plan.deadline) + perDay - 4} y={30} fontSize={11} fontWeight={700} textAnchor="end" fill="hsl(var(--destructive))">Target ⚑</text>}
          </g>
        )}

        {/* Today */}
        <line x1={x(today)} x2={x(today)} y1={compact ? 0 : 18} y2={layout.height} stroke="hsl(var(--foreground) / 0.55)" strokeWidth={1.5} />
        {!compact && <text x={x(today) + 4} y={30} fontSize={11} fontWeight={700} fill="hsl(var(--foreground))">Today</text>}

        {/* Stage labels */}
        {!compact && layout.stages.map(st => (
          <text key={st.index} x={Math.max(12, x(today) - 30)} y={st.y + 17} fontSize={11} fontWeight={700} letterSpacing={0.4} fill={stageColor(st.index)}>
            {st.title.toUpperCase().slice(0, 40)}
          </text>
        ))}

        {/* Dependencies */}
        {plan.nodes.flatMap(n => n.deps.map(d => {
          const from = byId.get(d);
          if (!from || !rowY.has(d) || !rowY.has(n.id)) return null;
          const x1 = barX(from) + barW(from) + (from.waitDays && from.state !== 'done' ? from.waitDays * perDay : 0);
          const y1 = mid(from);
          const x2 = barX(n);
          const y2 = mid(n);
          const c = Math.max(16, Math.abs(x2 - x1) / 2);
          const hot = from.critical && n.critical;
          return (
            <path key={`${d}-${n.id}`} d={`M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`} fill="none"
              stroke={hot ? 'hsl(var(--warning))' : 'hsl(var(--muted-foreground) / 0.45)'} strokeWidth={hot ? 2 : 1.25} />
          );
        }))}

        {/* Tasks */}
        {plan.nodes.map(n => {
          const y = rowY.get(n.id)!;
          const bx = barX(n);
          const bw = barW(n);
          const by = compact ? y + (ROW - BAR) / 2 : y + 19;
          const color = stageColor(n.phaseIndex);
          const done = n.state === 'done';
          const blocked = n.state === 'blocked';
          return (
            <g key={n.id} role={onSelect ? 'button' : undefined} tabIndex={onSelect && !compact ? 0 : undefined} aria-label={onSelect ? `${n.title}, ${n.state}` : undefined}
              onClick={onSelect ? () => onSelect(n) : undefined}
              onKeyDown={onSelect ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n); } } : undefined}
              className={onSelect ? 'cursor-pointer outline-none' : undefined}>
              {/* Bigger invisible tap target */}
              {!compact && <rect x={bx - 4} y={y + 2} width={Math.max(bw + 8, 120)} height={ROW - 4} fill="transparent" />}
              {/* Waiting time after the task */}
              {n.waitDays > 0 && !done && (
                <line x1={bx + bw} x2={bx + bw + n.waitDays * perDay} y1={by + BAR / 2} y2={by + BAR / 2} stroke={color} strokeOpacity={0.5} strokeWidth={2} strokeDasharray="1 4" strokeLinecap="round" />
              )}
              <rect x={bx} y={by} width={bw} height={BAR} rx={BAR / 2}
                fill={done ? 'hsl(var(--success))' : blocked ? 'hsl(var(--secondary))' : stageColor(n.phaseIndex, 0.2)}
                stroke={done ? 'none' : n.critical ? 'hsl(var(--warning))' : blocked ? 'hsl(var(--muted-foreground) / 0.5)' : color}
                strokeWidth={n.critical && !done ? 2 : 1.25} strokeDasharray={blocked ? '3 3' : undefined} />
              {/* Progress fill */}
              {!done && n.progress > 0 && <rect x={bx} y={by} width={Math.max(BAR, bw * n.progress)} height={BAR} rx={BAR / 2} fill={color} />}
              {/* Milestone */}
              {n.milestone && (
                <path d={`M${bx + bw + (compact ? 4 : 9)},${by + BAR / 2 - (compact ? 4 : 7)} l${compact ? 4 : 7},${compact ? 4 : 7} l-${compact ? 4 : 7},${compact ? 4 : 7} l-${compact ? 4 : 7},-${compact ? 4 : 7} z`}
                  fill={done ? 'hsl(var(--success))' : 'hsl(var(--warning))'} />
              )}
              {!compact && (
                <text x={bx} y={y + 13} fontSize={12.5} fontWeight={600} fill={blocked ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))'}>
                  {done ? '✓ ' : blocked ? '🔒 ' : ''}{n.title.length > 46 ? `${n.title.slice(0, 44)}…` : n.title}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
