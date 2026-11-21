import type { Ring, RingKey } from '@/lib/today';
import { overallScore } from '@/lib/today';

const COLOR: Record<RingKey, string> = {
  habits: 'hsl(var(--habits))',
  tasks: 'hsl(var(--tasks))',
  move: 'hsl(var(--move))',
  people: 'hsl(var(--people))',
};

const SIZE = 150;
const STROKE = 10;
const GAP = 2.5;
const circ = (r: number) => 2 * Math.PI * r;

/** Concentric progress rings — one per life area — with the day's overall score in the middle. */
export function LifeRings({ rings }: { rings: Ring[] }) {
  const score = overallScore(rings);
  const allDone = rings.every(r => r.total === 0 || r.done >= r.total);

  return (
    <div className="surface flex items-center gap-4 p-4 pr-5">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} className="-rotate-90" aria-hidden>
          {rings.map((r, i) => {
            const radius = SIZE / 2 - STROKE / 2 - i * (STROKE + GAP);
            const pct = r.total === 0 ? 0 : Math.min(1, r.done / r.total);
            return (
              <g key={r.key}>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={radius} fill="none" stroke={COLOR[r.key]} strokeOpacity={0.16} strokeWidth={STROKE} />
                {pct > 0 && (
                  <circle
                    cx={SIZE / 2}
                    cy={SIZE / 2}
                    r={radius}
                    fill="none"
                    stroke={COLOR[r.key]}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={circ(radius)}
                    strokeDashoffset={circ(radius) * (1 - pct)}
                    style={{
                      ['--ring-circ' as string]: circ(radius),
                      animation: `ring-fill 0.9s cubic-bezier(0.22,1,0.36,1) ${0.1 + i * 0.08}s backwards`,
                      transition: 'stroke-dashoffset 0.6s cubic-bezier(0.22,1,0.36,1)',
                    }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-bold leading-none tracking-tight tabular-nums">{score}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{allDone ? 'Done' : 'Today'}</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-2.5" aria-label="Today's progress">
        {rings.map(r => (
          <li key={r.key} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLOR[r.key] }} />
              <span className="truncate text-footnote font-medium text-muted-foreground">{r.label}</span>
            </span>
            <span className="shrink-0 text-body font-semibold tabular-nums">{r.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
