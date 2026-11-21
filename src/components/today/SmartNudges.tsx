import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudDownload, TrendingDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { useStore } from '@/hooks/useStore';
import { stores } from '@/lib/storage';
import { trainingNudges, type Nudge } from '@/lib/insights';
import { getLastExportAt, shareOrDownloadBackup } from '@/lib/backup';
import { daysBetween, dateKeyOf, type DateKey } from '@/lib/dates';

const DISMISS_KEY = 'telos_dismissed_nudges'; // device-only, not backed up
const BACKUP_NUDGE_DAYS = 14;

function readDismissed(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}'); } catch { return {}; }
}

/** Helpful heads-ups: stalled lifts and an overdue backup. Each can be hidden for the day. */
export function SmartNudges({ today }: { today: DateKey }) {
  const sessions = useStore(stores.SESSIONS);
  const configs = useStore(stores.EXERCISE_CONFIGS);
  const custom = useStore(stores.CUSTOM_EXERCISES);
  const goals = useStore(stores.GOALS);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [lastExport, setLastExport] = useState(getLastExportAt);

  const nudges = useMemo(() => {
    const list: Nudge[] = trainingNudges(sessions, configs, custom).slice(0, 2);
    // Don't nag on day one: only once you've been using TELOS for a few days.
    const firstUse = [...goals.map(g => g.createdAt), ...sessions.map(x => x.date)].filter(Boolean).map(d => dateKeyOf(d)).sort()[0];
    const daysUsing = firstUse ? daysBetween(firstUse, today) : 0;
    const age = lastExport ? daysBetween(dateKeyOf(lastExport), today) : null;
    if (daysUsing >= 3 && (age === null || age >= BACKUP_NUDGE_DAYS)) {
      list.push({
        id: 'backup',
        kind: 'backup',
        title: age === null ? 'Back up your data' : `Last backup was ${age} days ago`,
        detail: 'Save a copy to Files or iCloud Drive so nothing is lost if your phone is reset.',
      });
    }
    return list.filter(n => dismissed[n.id] !== today);
  }, [sessions, configs, custom, goals.length, lastExport, dismissed, today]);

  if (nudges.length === 0) return null;

  const dismiss = (id: string) => {
    const next = { ...dismissed, [id]: today };
    setDismissed(next);
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-2">
      {nudges.map(n => (
        <div key={n.id} className="flex items-start gap-3 rounded-2xl border bg-card p-3 shadow-sm">
          <div className={`mt-0.5 rounded-full p-2 ${n.kind === 'backup' ? 'bg-info/10 text-info' : 'bg-warning/10 text-warning'}`}>
            {n.kind === 'backup' ? <CloudDownload className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{n.title}</p>
            <p className="text-xs text-muted-foreground">{n.detail}</p>
            {n.kind === 'backup' ? (
              <button
                type="button"
                className="mt-1.5 h-9 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
                onClick={async () => {
                  const r = await shareOrDownloadBackup();
                  if (r !== 'cancelled') { toast.success('Backup saved'); setLastExport(getLastExportAt()); }
                }}
              >
                Save backup
              </button>
            ) : (
              <Link to="/gym" className="mt-1.5 inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold">Open Gym</Link>
            )}
          </div>
          <button type="button" aria-label="Hide for today" onClick={() => dismiss(n.id)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
