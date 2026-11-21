import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import {
  AlertTriangle, CheckCircle2, Database, Download, History, Loader2, ShieldCheck, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  clearAllData, getLastExportAt, parseBackup, restoreBackup, restoreSnapshotById,
  shareOrDownloadBackup, type ParsedBackup,
} from '@/lib/backup';
import {
  listSnapshots, requestPersistentStorage, saveSnapshot, snapshotsAvailable,
  SNAPSHOT_REASON_LABELS, type SnapshotMeta,
} from '@/lib/snapshots';
import { daysBetween, dateKeyOf, todayKey } from '@/lib/dates';

const BACKUP_NUDGE_DAYS = 14;

function fmtBytes(b?: number) {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeDays(iso: string | null): { label: string; days: number | null } {
  if (!iso) return { label: 'Never', days: null };
  const days = daysBetween(dateKeyOf(iso), todayKey());
  if (days <= 0) return { label: 'Today', days: 0 };
  if (days === 1) return { label: 'Yesterday', days };
  return { label: `${days} days ago`, days };
}

type Confirm =
  | { kind: 'snapshot'; snap: SnapshotMeta }
  | { kind: 'clear' }
  | null;

export function DataCard() {
  const [lastExport, setLastExport] = useState<string | null>(() => getLastExportAt());
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number } | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [preview, setPreview] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listSnapshots().then(setSnapshots);
    setLastExport(getLastExportAt());
  }, []);

  useEffect(() => {
    refresh();
    requestPersistentStorage().then(setStorage);
  }, [refresh]);

  const backupAge = relativeDays(lastExport);
  const needsBackup = backupAge.days === null || backupAge.days >= BACKUP_NUDGE_DAYS;

  const handleExport = async () => {
    const r = await shareOrDownloadBackup();
    if (r !== 'cancelled') {
      toast.success(r === 'shared' ? 'Backup ready — save it to Files or iCloud Drive' : 'Backup downloaded');
      refresh();
    }
  };

  const openParsed = (text: string) => {
    const parsed = parseBackup(text);
    if (parsed.ok === false) {
      toast.error((parsed as { error: string }).error);
      return;
    }
    setPasteOpen(false);
    setPasteText('');
    setPreview(parsed);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => openParsed(String(ev.target?.result ?? ''));
    reader.onerror = () => toast.error("Couldn't read that file");
    reader.readAsText(file);
  };

  const doRestore = async () => {
    if (!preview) return;
    setBusy(true);
    const r = await restoreBackup(preview.backup, { replaceAll: !preview.legacy });
    setBusy(false);
    if (r.ok) {
      toast.success('Backup restored', { description: 'Your previous data was saved as a safety copy.' });
      setPreview(null);
      refresh();
    } else {
      toast.error(r.error ?? 'Restore failed');
    }
  };

  const doConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    if (confirm.kind === 'snapshot') {
      const r = await restoreSnapshotById(confirm.snap.id);
      if (r.ok) toast.success('Safety copy restored');
      else toast.error(r.error ?? 'Restore failed');
    } else {
      await clearAllData();
      toast.success('All data cleared', { description: 'A safety copy was saved first — restore it below if needed.' });
    }
    setBusy(false);
    setConfirm(null);
    refresh();
  };

  const takeSnapshot = async () => {
    const ok = await saveSnapshot('manual');
    toast[ok ? 'success' : 'error'](ok ? 'Safety copy saved' : 'Nothing to save yet');
    refresh();
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" /> Your Data
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Status */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
            {needsBackup
              ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
            <div className="min-w-0">
              <p className="text-sm font-medium">Last backup: {backupAge.label}</p>
              <p className="text-xs text-muted-foreground">
                {needsBackup ? 'Save a backup file so your data survives a lost or reset phone.' : 'Nice — keep a recent copy in Files or iCloud Drive.'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-3">
            <ShieldCheck className={`mt-0.5 h-4 w-4 shrink-0 ${storage?.persisted ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{storage?.persisted ? 'Storage protected' : 'Standard storage'}</p>
              <p className="text-xs text-muted-foreground">
                Using {fmtBytes(storage?.usage)} on this device{storage?.persisted ? '' : ' · add TELOS to your Home Screen for extra protection'}
              </p>
            </div>
          </div>
        </div>

        {/* Backup / restore */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={handleExport} className="h-11 font-semibold">
            <Download className="mr-2 h-4 w-4" /> Save backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="h-11">
            <Upload className="mr-2 h-4 w-4" /> Restore from file
          </Button>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
        </div>
        <button type="button" onClick={() => setPasteOpen(true)} className="text-xs text-muted-foreground underline underline-offset-2">
          Paste backup text instead
        </button>

        {/* Safety copies */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4" /> Safety copies</p>
            <Button variant="ghost" size="sm" onClick={takeSnapshot} className="h-9 text-xs">Save one now</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            TELOS saves a copy automatically each day and before any import or reset. These live on this device only — a backup file is still the safest.
          </p>
          {!snapshotsAvailable() && <p className="text-xs text-muted-foreground">Safety copies aren't available in this browser.</p>}
          {snapshots.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {snapshots.slice(0, 8).map(s => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{SNAPSHOT_REASON_LABELS[s.reason]}</p>
                    <p className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {fmtBytes(s.bytes)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setConfirm({ kind: 'snapshot', snap: s })}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Danger zone */}
        <div className="border-t pt-4">
          <Button variant="outline" className="h-11 w-full border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => setConfirm({ kind: 'clear' })}>
            <Trash2 className="mr-2 h-4 w-4" /> Clear all data
          </Button>
        </div>
      </CardContent>

      {/* Import preview */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restore this backup?</DialogTitle>
            <DialogDescription>
              {preview?.backup.exportedAt
                ? `Saved ${new Date(preview.backup.exportedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`
                : 'An older TELOS export.'}{' '}
              {preview?.legacy
                ? 'Sections not in this file will be left as they are.'
                : 'This replaces what\'s on this device.'}{' '}
              Your current data is saved as a safety copy first.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-56 divide-y overflow-auto rounded-lg border text-sm">
            {preview?.summary.map(row => (
              <li key={row.key} className="flex justify-between px-3 py-2">
                <span>{row.label}</span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </li>
            ))}
          </ul>
          {preview && preview.warnings.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {preview.warnings.map(w => <li key={w}>• {w}</li>)}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setPreview(null)}>Cancel</Button>
            <Button className="h-11 flex-1 font-semibold" onClick={doRestore} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paste */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Paste backup text</DialogTitle>
            <DialogDescription>Paste the full contents of a TELOS backup file.</DialogDescription>
          </DialogHeader>
          <Textarea className="h-40 font-mono text-base md:text-xs" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder='{"app":"telos", …}' />
          <Button className="h-11" disabled={!pasteText.trim()} onClick={() => openParsed(pasteText)}>Continue</Button>
        </DialogContent>
      </Dialog>

      {/* Confirmations */}
      <Dialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={confirm?.kind === 'clear' ? 'flex items-center gap-2 text-destructive' : undefined}>
              {confirm?.kind === 'clear' && <AlertTriangle className="h-5 w-5" />}
              {confirm?.kind === 'clear' ? 'Clear all data?' : 'Restore this safety copy?'}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === 'clear'
                ? 'Every goal, workout, person and setting will be removed from this device. A safety copy is saved first.'
                : confirm?.kind === 'snapshot'
                  ? `Replace your current data with the copy from ${new Date(confirm.snap.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}. Your current data is saved as a safety copy first.`
                  : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button
              variant={confirm?.kind === 'clear' ? 'destructive' : 'default'}
              className="h-11 flex-1 font-semibold"
              onClick={doConfirm}
              disabled={busy}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirm?.kind === 'clear' ? 'Clear everything' : 'Restore'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
