import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, ClipboardPaste, Download, History, Loader2, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/app/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  clearAllData, getLastExportAt, parseBackup, restoreBackup, restoreSnapshotById,
  shareOrDownloadBackup, type ParsedBackup,
} from '@/lib/backup';
import {
  listSnapshots, requestPersistentStorage, saveSnapshot, snapshotsAvailable,
  SNAPSHOT_REASON_LABELS, type SnapshotMeta,
} from '@/lib/snapshots';
import { daysBetween, dateKeyOf, todayKey } from '@/lib/dates';
import { cn } from '@/lib/utils';

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

type Confirm = { kind: 'snapshot'; snap: SnapshotMeta } | { kind: 'clear' } | null;

function Row({ icon, label, detail, onClick, tone, chevron = true }: {
  icon: React.ReactNode; label: string; detail?: string; onClick: () => void; tone?: 'primary' | 'destructive'; chevron?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[52px] w-full items-center gap-3 px-4 text-left active:bg-accent/70">
      <span className={cn('flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg text-white', tone === 'destructive' ? 'bg-destructive' : 'bg-primary')}>{icon}</span>
      <span className={cn('flex-1 text-body font-medium', tone === 'destructive' && 'text-destructive', tone === 'primary' && 'font-semibold text-primary')}>{label}</span>
      {detail && <span className="text-footnote text-muted-foreground">{detail}</span>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
    </button>
  );
}

/**
 * Backups, restore and safety copies at the top; "clear everything" at the very
 * bottom, with any other settings sections passed in between as children.
 */
export function DataCard({ children }: { children?: React.ReactNode }) {
  const [lastExport, setLastExport] = useState<string | null>(() => getLastExportAt());
  const [storage, setStorage] = useState<{ persisted: boolean; usage?: number } | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [preview, setPreview] = useState<Extract<ParsedBackup, { ok: true }> | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [copiesOpen, setCopiesOpen] = useState(false);
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
    if (parsed.ok === false) { toast.error((parsed as { error: string }).error); return; }
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
      toast.success('All data cleared', { description: 'A safety copy was saved first — restore it from Safety copies if needed.' });
    }
    setBusy(false);
    setConfirm(null);
    setCopiesOpen(false);
    refresh();
  };

  const takeSnapshot = async () => {
    const ok = await saveSnapshot('manual');
    toast[ok ? 'success' : 'error'](ok ? 'Safety copy saved' : 'Nothing to save yet');
    refresh();
  };

  return (
    <>
      <section className="space-y-2">
        <h2 className="section-label">Your data</h2>
        <div className={cn('flex items-start gap-3 rounded-2xl p-4', needsBackup ? 'bg-warning/15' : 'bg-success/10')}>
          {needsBackup ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />}
          <div className="min-w-0">
            <p className="text-headline">Last backup: {backupAge.label}</p>
            <p className="text-footnote text-muted-foreground">
              {needsBackup ? 'Everything lives on this phone. Save a backup to Files or iCloud Drive so it survives a lost or reset phone.' : 'Nice — keep a recent copy in Files or iCloud Drive.'}
            </p>
          </div>
        </div>
        <div className="list-group">
          <Row icon={<Download className="h-4 w-4" />} label="Save a backup" tone="primary" onClick={handleExport} chevron={false} />
          <Row icon={<Upload className="h-4 w-4" />} label="Restore from a file" onClick={() => fileRef.current?.click()} />
          <Row icon={<ClipboardPaste className="h-4 w-4" />} label="Paste backup text" onClick={() => setPasteOpen(true)} />
          <Row icon={<History className="h-4 w-4" />} label="Safety copies" detail={snapshots.length ? String(snapshots.length) : undefined} onClick={() => setCopiesOpen(true)} />
        </div>
        <p className="flex items-start gap-1.5 px-1 text-footnote text-muted-foreground">
          <ShieldCheck className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', storage?.persisted && 'text-success')} />
          {storage?.persisted ? 'Storage protected' : 'Standard storage'} · {fmtBytes(storage?.usage)} used{storage?.persisted ? '' : ' · add TELOS to your Home Screen for extra protection'}
        </p>
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={handleFile} />
      </section>

      {children}

      <section className="space-y-2">
        <div className="list-group">
          <Row icon={<Trash2 className="h-4 w-4" />} label="Clear all data" tone="destructive" onClick={() => setConfirm({ kind: 'clear' })} chevron={false} />
        </div>
        <p className="px-1 text-footnote text-muted-foreground">Removes everything from this device. A safety copy is saved first.</p>
      </section>

      {/* Safety copies */}
      <Dialog open={copiesOpen} onOpenChange={setCopiesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Safety copies</DialogTitle>
            <DialogDescription>Saved automatically each day and before any import or reset. They live on this device only — a backup file is still safest.</DialogDescription>
          </DialogHeader>
          {!snapshotsAvailable() && <p className="text-footnote text-muted-foreground">Safety copies aren't available in this browser.</p>}
          {snapshots.length > 0 && (
            <div className="list-group max-h-[45vh] overflow-y-auto">
              {snapshots.slice(0, 12).map(s => (
                <div key={s.id} className="flex min-h-[56px] items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body font-medium">{SNAPSHOT_REASON_LABELS[s.reason]}</p>
                    <p className="text-footnote text-muted-foreground">{new Date(s.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} · {fmtBytes(s.bytes)}</p>
                  </div>
                  <button type="button" onClick={() => setConfirm({ kind: 'snapshot', snap: s })} className="h-9 shrink-0 rounded-full bg-primary/10 px-3.5 text-footnote font-semibold text-primary">Restore</button>
                </div>
              ))}
            </div>
          )}
          <Button variant="secondary" className="h-12 w-full rounded-xl text-body" onClick={takeSnapshot}>Save one now</Button>
        </DialogContent>
      </Dialog>

      {/* Import preview */}
      <Dialog open={!!preview} onOpenChange={o => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Restore this backup?</DialogTitle>
            <DialogDescription>
              {preview?.backup.exportedAt
                ? `Saved ${new Date(preview.backup.exportedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`
                : 'An older TELOS export.'}{' '}
              {preview?.legacy ? 'Sections not in this file are left as they are.' : "This replaces what's on this device."}{' '}
              Your current data is saved as a safety copy first.
            </DialogDescription>
          </DialogHeader>
          <div className="list-group max-h-56 overflow-auto">
            {preview?.summary.map(row => (
              <div key={row.key} className="flex justify-between px-4 py-2.5 text-body">
                <span>{row.label}</span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </div>
            ))}
          </div>
          {preview && preview.warnings.length > 0 && (
            <ul className="space-y-1 text-footnote text-muted-foreground">
              {preview.warnings.map(w => <li key={w}>• {w}</li>)}
            </ul>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => setPreview(null)}>Cancel</Button>
            <Button className="h-12 flex-1 rounded-xl font-semibold" onClick={doRestore} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Paste */}
      <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title">Paste backup text</DialogTitle>
            <DialogDescription>Paste the full contents of a TELOS backup file.</DialogDescription>
          </DialogHeader>
          <Textarea className="h-40 rounded-xl font-mono text-base md:text-xs" value={pasteText} onChange={e => setPasteText(e.target.value)} placeholder='{"app":"telos", …}' />
          <Button className="h-12 rounded-xl font-semibold" disabled={!pasteText.trim()} onClick={() => openParsed(pasteText)}>Continue</Button>
        </DialogContent>
      </Dialog>

      {/* Confirmations */}
      <Dialog open={!!confirm} onOpenChange={o => !o && setConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className={cn('text-title', confirm?.kind === 'clear' && 'text-destructive')}>
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
            <Button variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm?.kind === 'clear' ? 'destructive' : 'default'} className="h-12 flex-1 rounded-xl font-semibold" onClick={doConfirm} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirm?.kind === 'clear' ? 'Clear everything' : 'Restore'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
