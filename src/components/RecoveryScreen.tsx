import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, RefreshCw, RotateCcw, Copy, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KEYS, type StorageKey } from '@/lib/storage';
import { CORRUPT_PREFIX } from '@/lib/store';
import { labelFor, resetSection, restoreSnapshotById, shareOrDownloadBackup } from '@/lib/backup';
import { listSnapshots, SNAPSHOT_REASON_LABELS, type SnapshotMeta } from '@/lib/snapshots';

/**
 * Shown when the app crashes. Deliberately imports no pages or hooks so it
 * keeps working even when the data that crashed the app is still there.
 */

interface SectionRow {
  key: StorageKey;
  label: string;
  bytes: number;
  readable: boolean;
  quarantined: boolean;
}

function readSections(): SectionRow[] {
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage);
  } catch {
    keys = [];
  }
  return (Object.values(KEYS) as StorageKey[]).map(key => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      raw = null;
    }
    let readable = true;
    if (raw !== null) {
      try {
        JSON.parse(raw);
      } catch {
        readable = false;
      }
    }
    return {
      key,
      label: labelFor(key),
      bytes: raw?.length ?? 0,
      readable,
      quarantined: keys.some(k => k.startsWith(`${CORRUPT_PREFIX}${key}:`)),
    };
  });
}

const fmtKb = (b: number) => (b === 0 ? '—' : b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

export function RecoveryScreen({ error, onRetry, inline = false }: { error?: unknown; onRetry?: () => void; inline?: boolean }) {
  const [sections, setSections] = useState<SectionRow[]>(() => readSections());
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [armed, setArmed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    listSnapshots().then(setSnapshots).catch(() => setSnapshots([]));
  }, []);

  const details = useMemo(() => {
    const e = error as Error | undefined;
    return [e?.name, e?.message, e?.stack].filter(Boolean).join('\n') || String(error ?? 'Unknown error');
  }, [error]);

  const reload = () => window.location.reload();

  const download = async () => {
    try {
      await shareOrDownloadBackup();
      setMessage('Backup saved. Keep it somewhere safe.');
    } catch {
      setMessage("Couldn't create the backup file.");
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(details);
      setMessage('Error details copied.');
    } catch {
      setMessage("Couldn't copy — select the text below instead.");
    }
  };

  const confirmTwice = (id: string, action: () => Promise<void>) => async () => {
    if (armed !== id) {
      setArmed(id);
      return;
    }
    setArmed(null);
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const reset = (key: StorageKey) => confirmTwice(`reset:${key}`, async () => {
    const ok = await resetSection(key);
    setSections(readSections());
    setMessage(ok ? `${labelFor(key)} was reset. A safety copy was saved first. Tap "Reload app".` : `Couldn't reset ${labelFor(key)}.`);
  });

  const restore = (s: SnapshotMeta) => confirmTwice(`snap:${s.id}`, async () => {
    const r = await restoreSnapshotById(s.id);
    setSections(readSections());
    setMessage(r.ok ? 'Snapshot restored. Tap "Reload app".' : r.error ?? 'Restore failed.');
  });

  return (
    <div className={inline ? 'w-full' : 'min-h-[100dvh] bg-background px-4 py-8'}>
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-destructive/10 p-2.5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              Your data is still on this device. Try reloading first. If it keeps happening, save a backup, then reset the section that's causing trouble.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {onRetry && (
            <Button variant="outline" onClick={onRetry} className="h-11">
              <RotateCcw className="mr-2 h-4 w-4" /> Try again
            </Button>
          )}
          <Button onClick={reload} className="h-11">
            <RefreshCw className="mr-2 h-4 w-4" /> Reload app
          </Button>
          <Button variant="outline" onClick={download} className="h-11">
            <Download className="mr-2 h-4 w-4" /> Save backup
          </Button>
          <Button variant="outline" onClick={copy} className="h-11">
            <Copy className="mr-2 h-4 w-4" /> Copy details
          </Button>
        </div>

        {message && <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm">{message}</p>}

        {snapshots.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> Safety copies</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {snapshots.map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{SNAPSHOT_REASON_LABELS[s.reason]}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()} · {fmtKb(s.bytes)}</p>
                  </div>
                  <Button size="sm" variant={armed === `snap:${s.id}` ? 'destructive' : 'outline'} disabled={busy} onClick={restore(s)} className="h-9 shrink-0">
                    {armed === `snap:${s.id}` ? 'Tap to confirm' : 'Restore'}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Your data</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {sections.filter(s => s.bytes > 0).map(s => (
              <li key={s.key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtKb(s.bytes)}
                    {!s.readable && <span className="text-destructive"> · unreadable</span>}
                    {s.quarantined && <span> · damaged copy saved</span>}
                  </p>
                </div>
                <Button size="sm" variant={armed === `reset:${s.key}` ? 'destructive' : 'ghost'} disabled={busy} onClick={reset(s.key)} className="h-9 shrink-0">
                  {armed === `reset:${s.key}` ? 'Tap to confirm' : 'Reset'}
                </Button>
              </li>
            ))}
            {sections.every(s => s.bytes === 0) && <li className="px-3 py-3 text-sm text-muted-foreground">No saved data.</li>}
          </ul>
        </section>

        <details className="rounded-xl border bg-card px-3 py-2 text-xs">
          <summary className="cursor-pointer py-1 font-medium">Technical details</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-muted-foreground">{details}</pre>
        </details>
      </div>
    </div>
  );
}
