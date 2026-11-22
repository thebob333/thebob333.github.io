import { useState } from 'react';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { metricActions, useGoalMetrics } from '@/hooks/useMetrics';
import { parseDateKey } from '@/lib/dates';
import type { Goal } from '@/types/goals';

const fmtDate = (k: string) => parseDateKey(k).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** A tiny trend line with the target as a dashed line. Colors come from CSS vars (works in dark mode). */
function Sparkline({ values, target }: { values: number[]; target?: number }) {
  const W = 300;
  const H = 72;
  const all = target !== undefined ? [...values, target] : values;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? W / 2 : (i / (values.length - 1)) * (W - 8) + 4);
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 12);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[72px] w-full" aria-hidden>
      {target !== undefined && <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="hsl(var(--success))" strokeWidth="1.5" strokeDasharray="5 5" />}
      <path d={d} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 2.5} fill="hsl(var(--primary))" />)}
    </svg>
  );
}

/** "Get better" goals: the number you're moving, toward the target. */
export function MetricCard({ goal, onSetUp }: { goal: Goal; onSetUp: () => void }) {
  const entries = useGoalMetrics(goal.id);
  const [value, setValue] = useState('');
  const [showAll, setShowAll] = useState(false);
  const m = goal.metric;

  if (!m) {
    return (
      <section className="surface p-4">
        <p className="text-headline">What will you measure?</p>
        <p className="mt-1 text-footnote text-muted-foreground">"Get better" goals move a number: your 5K time, your bench, words a day. Set it and log it as you go.</p>
        <button type="button" onClick={onSetUp} className="pressable mt-3 h-10 rounded-full bg-primary px-4 text-footnote font-semibold text-primary-foreground">Choose a measure</button>
      </section>
    );
  }

  const latest = entries[entries.length - 1]?.value ?? m.start;
  const start = m.start ?? entries[0]?.value;
  const pct = latest !== undefined && start !== undefined && m.target !== undefined && m.target !== start
    ? Math.max(0, Math.min(100, Math.round(((latest - start) / (m.target - start)) * 100)))
    : null;
  const prev = entries.length >= 2 ? entries[entries.length - 2].value : undefined;
  const improving = prev !== undefined && latest !== undefined && (m.higherIsBetter ? latest > prev : latest < prev);
  const series = [...(m.start !== undefined && entries[0]?.value !== m.start ? [m.start] : []), ...entries.map(e => e.value)];

  const submit = () => {
    const v = Number(value);
    if (value.trim() === '' || !Number.isFinite(v)) return;
    metricActions.log(goal.id, v);
    setValue('');
  };

  return (
    <section className="space-y-2">
      <h2 className="section-label">{m.name}</h2>
      <div className="surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums">
              {latest ?? '—'}<span className="ml-1 text-body font-semibold text-muted-foreground">{m.unit}</span>
            </p>
            <p className="mt-1 text-footnote text-muted-foreground">
              {start !== undefined ? `Started at ${start}` : 'No starting point yet'}{m.target !== undefined ? ` · target ${m.target} ${m.unit}` : ''}
            </p>
          </div>
          {prev !== undefined && latest !== prev && (
            <span className={`flex items-center gap-1 text-footnote font-semibold ${improving ? 'text-success' : 'text-warning'}`}>
              {(latest! > prev) ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(Math.round((latest! - prev) * 100) / 100)} since last
            </span>
          )}
        </div>
        {pct !== null && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-success transition-[width] duration-700" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-footnote text-muted-foreground">{pct}% of the way there</p>
          </div>
        )}
        {series.length >= 2 && <div className="mt-3"><Sparkline values={series} target={m.target} /></div>}
        <form className="mt-3 flex gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
          <label className="flex h-11 flex-1 items-center rounded-xl bg-secondary px-3">
            <input type="number" inputMode="decimal" step="any" value={value} onChange={e => setValue(e.target.value)} placeholder={`Today's ${m.name.toLowerCase()}`}
              className="h-full min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground" />
            <span className="text-footnote text-muted-foreground">{m.unit}</span>
          </label>
          <button type="submit" disabled={!value.trim()} className="pressable h-11 rounded-xl bg-primary px-4 text-body font-semibold text-primary-foreground disabled:opacity-40">Log</button>
        </form>
        <p className="mt-2 text-footnote text-muted-foreground">
          {entries.length < 3 ? 'Log a few times — an honest finish-date range appears once there\'s enough data.' : `${entries.length} entries since ${fmtDate(entries[0].date)}.`}
        </p>
        {entries.length > 0 && (
          <>
            <button type="button" onClick={() => setShowAll(v => !v)} className="mt-1 text-footnote font-semibold text-primary">{showAll ? 'Hide entries' : 'See entries'}</button>
            {showAll && (
              <div className="mt-2 divide-y divide-border/70">
                {[...entries].reverse().map(e => (
                  <div key={e.id} className="flex items-center justify-between py-2 text-body">
                    <span className="text-muted-foreground">{fmtDate(e.date)}</span>
                    <span className="flex items-center gap-2 font-semibold tabular-nums">{e.value} {m.unit}
                      <button type="button" aria-label="Remove entry" onClick={() => metricActions.remove(e)} className="flex h-8 w-8 items-center justify-center text-muted-foreground"><X className="h-4 w-4" /></button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
