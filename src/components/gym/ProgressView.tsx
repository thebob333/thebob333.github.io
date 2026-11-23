import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Footprints, Trophy } from 'lucide-react';
import { useStore } from '@/hooks/useStore';
import { useTodayKey } from '@/hooks/useToday';
import { stores } from '@/lib/storage';
import { dateKeyOf, parseDateKey, startOfWeekKey } from '@/lib/dates';
import { calculateVolumeLoad, estimateE1RM, getExerciseHistory, getPersonalRecords, getWeeklyVolume } from '@/lib/progressive-overload';
import { muscleSets } from '@/lib/gym-stats';
import { weekStart as monWeekStart } from '@/lib/practice';
import { CARDIO_LABELS, durationText, getExerciseLabel, isBodyweightExercise, paceText, type CustomExercise, type WorkoutSession } from '@/types/workout';
import { ListRow } from '@/components/app/ListRow';
import { BodyDiagram } from '@/components/BodyDiagram';
import { BadgeShelf } from './BadgeShelf';
import { SessionSheet } from './SessionSheet';
import { count, fmtLb, sessionVolume, splitLabel } from '@/lib/gym-format';
import { cn } from '@/lib/utils';

const tooltipStyle = { background: 'hsl(var(--popover))', color: 'hsl(var(--popover-foreground))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 13 };
const shortDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface px-3 py-3.5 text-center">
      <p className="text-[24px] font-bold leading-7 tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-footnote text-muted-foreground">{label}</p>
    </div>
  );
}

export function ProgressView({ customExercises, sessions, onStartLogging }: {
  customExercises: CustomExercise[];
  sessions: WorkoutSession[];
  onStartLogging: () => void;
}) {
  const today = useTodayKey();
  const settings = useStore(stores.SETTINGS);
  const [openSession, setOpenSession] = useState<WorkoutSession | null>(null);
  const [showAll, setShowAll] = useState(false);
  const isBw = (id: string) => isBodyweightExercise(id, customExercises);
  const label = (id: string) => getExerciseLabel(id, customExercises);

  const prs = useMemo(() => getPersonalRecords(sessions, id => isBodyweightExercise(id, customExercises)), [sessions, customExercises]);
  const sorted = useMemo(() => [...sessions].sort((a, b) => b.date.localeCompare(a.date)), [sessions]);
  const weekStart = startOfWeekKey(today, 0);
  const thisWeek = sorted.filter(s => dateKeyOf(s.date) >= weekStart);
  const weekVolume = thisWeek.reduce((n, s) => n + sessionVolume(s), 0);

  // Exercises you've actually logged, most recent first.
  const logged = useMemo(() => {
    const seen: string[] = [];
    for (const s of sorted) for (const e of s.exercises) if (e.sets.length && !seen.includes(e.exercise)) seen.push(e.exercise);
    return seen;
  }, [sorted]);
  const [picked, setPicked] = useState<string | null>(null);
  const chartExercise = picked && logged.includes(picked) ? picked : logged[0];
  const chartBw = chartExercise ? isBw(chartExercise) : false;
  const [mode, setMode] = useState<'top' | 'max'>('top');
  const showMax = mode === 'max' && !chartBw;
  const chartData = useMemo(() => (chartExercise ? getExerciseHistory(sessions, chartExercise) : [])
    .filter(h => h.sets.length > 0).slice().reverse()
    .map(h => ({
      date: shortDate(h.date),
      value: chartBw ? Math.max(...h.sets.map(s => s.reps))
        : showMax ? Math.max(...h.sets.map(s => estimateE1RM(s.weight, s.reps))) : Math.max(...h.sets.map(s => s.weight)),
      volume: calculateVolumeLoad(h.sets),
    })),
  [sessions, chartExercise, chartBw, showMax]);
  const cardio = useStore(stores.CARDIO);
  const muscles = useMemo(() => Object.entries(muscleSets(sessions, customExercises, monWeekStart(today))).sort((a, b) => b[1] - a[1]), [sessions, customExercises, today]);
  const weekly = useMemo(() => getWeeklyVolume(sessions).slice(-8).map(w => ({ ...w, label: parseDateKey(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })), [sessions]);

  if (sessions.length === 0 && cardio.length === 0) {
    return (
      <div className="surface flex flex-col items-center px-6 py-12 text-center">
        <Trophy className="h-10 w-10 text-move" />
        <h2 className="mt-3 text-title">Your progress lives here</h2>
        <p className="mt-1 text-body text-muted-foreground">Log a workout or a run and you'll see records, a strength map, pace and charts of every lift.</p>
        <button type="button" onClick={onStartLogging} className="pressable mt-5 h-12 rounded-2xl bg-move px-6 text-headline text-white">Log a workout</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={String(thisWeek.length)} label={thisWeek.length === 1 ? 'workout this week' : 'workouts this week'} />
        <Stat value={fmtLb(weekVolume)} label="lb this week" />
        <Stat value={String(prs.length)} label="records" />
      </div>

      {sessions.length > 0 && <>
      <section className="space-y-2">
        <h2 className="section-label">Strength map</h2>
        <div className="surface p-4">
          <BodyDiagram prs={prs} customExercises={customExercises} bodyweight={settings.bodyweight} goldTargets={settings.goldTargets} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-label">Lift progress</h2>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {logged.map(id => (
            <button key={id} type="button" onClick={() => setPicked(id)}
              className={cn('pressable h-9 shrink-0 rounded-full px-3.5 text-footnote font-semibold', id === chartExercise ? 'bg-move text-white' : 'bg-secondary text-foreground')}>
              {label(id)}
            </button>
          ))}
        </div>
        <div className="surface p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-footnote font-semibold text-muted-foreground">{chartBw ? 'Best reps per session' : showMax ? 'Estimated one-rep max (lb)' : 'Top weight per session (lb)'}</p>
            {!chartBw && (
              <div className="flex rounded-full bg-secondary p-0.5 text-footnote font-semibold">
                {([['top', 'Top set'], ['max', 'Est. max']] as const).map(([v, l]) => (
                  <button key={v} type="button" onClick={() => setMode(v)} className={cn('h-7 rounded-full px-2.5', mode === v ? 'bg-card shadow-sm' : 'text-muted-foreground')}>{l}</button>
                ))}
              </div>
            )}
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} domain={[(min: number) => Math.max(0, Math.floor((min - 5) / 5) * 5), (max: number) => Math.ceil((max + 5) / 5) * 5]} tickCount={4} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [chartBw ? `${v} reps` : `${v} lb`, chartBw ? 'Best' : showMax ? 'Est. max' : 'Top set']} />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--move))" strokeWidth={3} dot={{ fill: 'hsl(var(--move))', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-footnote text-muted-foreground">Log this lift one more time to see a trend.</p>
          )}
        </div>
      </section>
      </>}

      {muscles.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">This week by muscle</h2>
          <div className="surface space-y-2.5 p-4">
            {muscles.map(([m, n]) => (
              <div key={m} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-footnote font-medium capitalize">{m}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full', n >= 10 ? 'bg-success' : 'bg-move')} style={{ width: `${Math.min(100, (n / 20) * 100)}%` }} />
                </div>
                <span className="w-14 shrink-0 text-right text-footnote tabular-nums text-muted-foreground">{n} set{n === 1 ? '' : 's'}</span>
              </div>
            ))}
            <p className="pt-1 text-footnote text-muted-foreground">Around 10–20 hard sets a week per muscle is a common target for growth.</p>
          </div>
        </section>
      )}

      {cardio.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-label">Cardio</h2>
          <div className="list-group">
            {[...cardio].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(c => (
              <ListRow key={c.id}
                leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-move/10 text-move"><Footprints className="h-4 w-4" /></span>}
                title={`${CARDIO_LABELS[c.kind]}${c.distance ? ` · ${c.distance} ${c.unit}` : ''}`}
                subtitle={`${shortDate(c.date)} · ${durationText(c.seconds)}${c.note ? ` · ${c.note}` : ''}`}
                trailing={<span className="text-footnote font-semibold tabular-nums">{paceText(c) ?? ''}</span>} />
            ))}
          </div>
        </section>
      )}

      {sessions.length > 0 && <section className="space-y-2">
        <h2 className="section-label">Records</h2>
        <div className="list-group">
          {prs.map(pr => (
            <ListRow key={pr.exercise}
              leading={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-warning/15 text-warning"><Trophy className="h-4 w-4" /></span>}
              title={label(pr.exercise)}
              subtitle={shortDate(pr.date)}
              trailing={<span className="text-headline tabular-nums">{isBw(pr.exercise) ? `${pr.reps} reps${pr.weight ? ` +${pr.weight}` : ''}` : `${pr.weight} × ${pr.reps}`}</span>}
            />
          ))}
        </div>
      </section>}

      {weekly.length > 1 && (
        <section className="space-y-2">
          <h2 className="section-label">Weekly volume</h2>
          <div className="surface p-4">
            <p className="text-footnote font-semibold text-muted-foreground">Total lb lifted per week (weight × reps)</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={weekly} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={fmtLb} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v.toLocaleString()} lb`, 'Volume']} cursor={{ fill: 'hsl(var(--accent))' }} />
                <Bar dataKey="volume" fill="hsl(var(--move))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-label">History</h2>
        <div className="list-group">
          {(showAll ? sorted : sorted.slice(0, 8)).map(s => (
            <ListRow key={s.id} chevron onClick={() => setOpenSession(s)}
              title={`${splitLabel(s.splitDay)} day`}
              subtitle={`${new Date(s.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${count(s.exercises.length, 'exercise')} · ${fmtLb(sessionVolume(s))} lb`} />
          ))}
        </div>
        {sorted.length > 8 && (
          <button type="button" onClick={() => setShowAll(v => !v)} className="w-full py-2 text-body font-semibold text-primary">
            {showAll ? 'Show less' : `Show all ${sorted.length}`}
          </button>
        )}
      </section>

      <BadgeShelf />

      <SessionSheet session={openSession} customExercises={customExercises} onClose={() => setOpenSession(null)} onRepeat={onStartLogging} />
    </div>
  );
}
