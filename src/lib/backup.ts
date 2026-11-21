/**
 * Backup export / import.
 *
 * The backup is built by iterating KEYS, so a new data key is backed up
 * automatically — it can't silently drift out of the export again.
 */
import { KEYS, META_KEYS, type StorageKey } from '@/lib/storage';
import { getStore, reloadAllStores } from '@/lib/store';
import { todayKey } from '@/lib/dates';
import {
  CURRENT_SCHEMA_VERSION, kindOf, matchesKind, migrateData, readAllRaw,
  writeRawWithRollback, getStoredSchemaVersion, type DataMap, type RawMap,
} from '@/lib/migrations';
import { saveSnapshot, getSnapshot, snapshotToRaw } from '@/lib/snapshots';

export interface BackupEnvelope {
  app: 'telos';
  schemaVersion: number;
  exportedAt: string;
  data: DataMap;
}

/** Names used by exports made before backups were versioned. */
const LEGACY_EXPORT_NAMES: Record<string, StorageKey> = {
  goals: KEYS.GOALS,
  sessions: KEYS.SESSIONS,
  exerciseConfigs: KEYS.EXERCISE_CONFIGS,
  weeklyPlan: KEYS.WEEKLY_PLAN,
  settings: KEYS.SETTINGS,
  achievements: KEYS.ACHIEVEMENTS,
  templates: KEYS.TEMPLATES,
  weeklySchedule: KEYS.WEEKLY_SCHEDULE,
  weeklyFocus: KEYS.WEEKLY_FOCUS,
  timeBlocks: KEYS.TIME_BLOCKS,
  blockCategories: KEYS.BLOCK_CATEGORIES,
  repeatableBlocks: KEYS.REPEATABLE_BLOCKS,
  contacts: KEYS.CONTACTS,
  customExercises: KEYS.CUSTOM_EXERCISES,
  habitLogs: KEYS.HABIT_LOGS,
  goalTemplates: KEYS.GOAL_TEMPLATES,
  interactions: KEYS.INTERACTIONS,
  commitments: KEYS.COMMITMENTS,
  relationshipGoals: KEYS.RELATIONSHIP_GOALS,
};

const ALL_KEYS = Object.values(KEYS) as StorageKey[];
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

export function labelFor(key: StorageKey): string {
  return getStore(key)?.spec.label ?? key;
}

// ─── Export ─────────────────────────────────────────────────────────────────

/** Reads raw localStorage directly (no hooks), so it works even from the recovery screen. */
export function buildBackup(): BackupEnvelope {
  const data: DataMap = {};
  readAllRaw().forEach((raw, key) => {
    if (raw === null) return;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      /* unreadable key — skip */
    }
  });
  return {
    app: 'telos',
    schemaVersion: getStoredSchemaVersion() ?? CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function exportAllData(): string {
  return JSON.stringify(buildBackup(), null, 2);
}

export function backupFileName(): string {
  return `telos-backup-${todayKey()}.json`;
}

export function markExported() {
  try {
    localStorage.setItem(META_KEYS.LAST_EXPORT, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function getLastExportAt(): string | null {
  try {
    return localStorage.getItem(META_KEYS.LAST_EXPORT);
  } catch {
    return null;
  }
}

/**
 * On iPhone, the share sheet ("Save to Files", AirDrop, email…) is far more
 * reliable than a download link inside a home-screen app.
 */
export async function shareOrDownloadBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const json = exportAllData();
  const name = backupFileName();
  const file = typeof File !== 'undefined' ? new File([json], name, { type: 'application/json' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;

  if (file && isTouch && nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'TELOS backup' });
      markExported();
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Safari aborts the download if the URL is revoked immediately.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  markExported();
  return 'downloaded';
}

// ─── Import ─────────────────────────────────────────────────────────────────

export interface BackupSummaryRow {
  key: StorageKey;
  label: string;
  count: number;
}

export type ParsedBackup =
  | { ok: true; backup: BackupEnvelope; legacy: boolean; summary: BackupSummaryRow[]; warnings: string[] }
  | { ok: false; error: string };

function countOf(v: unknown): number {
  if (Array.isArray(v)) return v.length;
  if (isObj(v)) return Object.keys(v).length ? 1 : 0;
  return v === null || v === undefined ? 0 : 1;
}

export function parseBackup(json: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  if (!isObj(parsed)) return { ok: false, error: "That doesn't look like a TELOS backup." };

  let legacy = false;
  let schemaVersion: number;
  let rawData: Record<string, unknown>;
  const warnings: string[] = [];

  if (parsed.app === 'telos') {
    if (!isObj(parsed.data)) return { ok: false, error: 'This backup has no data section.' };
    schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0;
    rawData = parsed.data;
  } else {
    legacy = true;
    schemaVersion = 0;
    rawData = {};
    for (const [name, value] of Object.entries(parsed)) {
      const key = LEGACY_EXPORT_NAMES[name] ?? (ALL_KEYS.includes(name as StorageKey) ? (name as StorageKey) : undefined);
      if (key) rawData[key] = value;
    }
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of TELOS. Update the app, then try again.' };
  }

  const data: DataMap = {};
  for (const [key, value] of Object.entries(rawData)) {
    if (!ALL_KEYS.includes(key as StorageKey)) {
      warnings.push(`Skipped unknown section "${key}".`);
      continue;
    }
    const k = key as StorageKey;
    if (value === null && kindOf(k) === 'nullable') continue;
    if (!matchesKind(value, kindOf(k))) {
      warnings.push(`Skipped "${labelFor(k)}" — it isn't in the expected format.`);
      continue;
    }
    data[k] = value;
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "That doesn't look like a TELOS backup (no recognizable data)." };
  }

  const summary = (Object.keys(data) as StorageKey[])
    .map(key => ({ key, label: labelFor(key), count: countOf(data[key]) }))
    .sort((a, b) => b.count - a.count);

  return {
    ok: true,
    legacy,
    warnings,
    summary,
    backup: { app: 'telos', schemaVersion, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '', data },
  };
}

/**
 * Restore a backup.
 * - `replaceAll`: sections missing from the backup are cleared (true for new-format
 *   backups and snapshots, which contain every section that existed). Legacy files
 *   only overwrite the sections they contain.
 */
export async function restoreBackup(b: BackupEnvelope, opts: { replaceAll: boolean }): Promise<{ ok: boolean; error?: string }> {
  const rollback = readAllRaw();
  await saveSnapshot('pre-import', rollback);

  let migrated: DataMap;
  try {
    migrated = migrateData(b.data, b.schemaVersion).data;
  } catch {
    return { ok: false, error: "This backup couldn't be upgraded to the current format." };
  }

  const next: RawMap = new Map();
  for (const key of ALL_KEYS) {
    if (key in migrated) next.set(key, JSON.stringify(migrated[key]));
    else if (opts.replaceAll) next.set(key, null);
  }

  if (!writeRawWithRollback(next, rollback)) {
    return { ok: false, error: 'Not enough storage space to restore. Nothing was changed.' };
  }
  try {
    localStorage.setItem(META_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
  } catch {
    /* version write failing is harmless — migrations are idempotent */
  }
  reloadAllStores();
  return { ok: true };
}

export async function restoreSnapshotById(id: string): Promise<{ ok: boolean; error?: string }> {
  const snap = await getSnapshot(id);
  if (!snap) return { ok: false, error: 'That snapshot no longer exists.' };
  const data: DataMap = {};
  snapshotToRaw(snap).forEach((raw, key) => {
    if (raw === null) return;
    try {
      data[key] = JSON.parse(raw);
    } catch {
      /* skip */
    }
  });
  return restoreBackup(
    { app: 'telos', schemaVersion: snap.schemaVersion ?? 0, exportedAt: snap.createdAt, data },
    { replaceAll: true },
  );
}

/** Wipe every section (a snapshot is taken first so this can be undone from Settings). */
export async function clearAllData(): Promise<void> {
  await saveSnapshot('pre-clear');
  for (const key of ALL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.setItem(META_KEYS.SCHEMA_VERSION, String(CURRENT_SCHEMA_VERSION));
  } catch {
    /* ignore */
  }
  reloadAllStores();
}

/** Reset a single section to its defaults (snapshot first). */
export async function resetSection(key: StorageKey): Promise<boolean> {
  await saveSnapshot('pre-reset');
  const store = getStore(key);
  if (store) return store.reset();
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
