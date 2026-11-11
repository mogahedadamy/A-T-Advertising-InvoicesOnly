/**
 * ═══════════════════════════════════════════════════════════════
 * Backup settings store
 * ═══════════════════════════════════════════════════════════════
 * Stored in the SQLite `settings` table (key = backup_settings_v1) so every
 * backup carries the retention policy, encryption choice and last-run status
 * along with the invoice data.
 *
 * A synchronous in-memory copy backs the React external-store pattern.
 */

import { Capacitor } from "@capacitor/core";
import { getDb } from "@/lib/database";
import { DEFAULT_BACKUP_SETTINGS, type BackupSettings, type RetentionPolicy } from "./types";

const SETTINGS_KEY = "backup_settings_v1";

let snapshot: BackupSettings = { ...DEFAULT_BACKUP_SETTINGS, retention: { ...DEFAULT_BACKUP_SETTINGS.retention } };
let loaded = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeBackupSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getBackupSettingsSnapshot(): BackupSettings {
  return snapshot;
}

function sanitize(raw: any): BackupSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BACKUP_SETTINGS, retention: { ...DEFAULT_BACKUP_SETTINGS.retention } };
  const retention: RetentionPolicy = {
    daily: clampInt(raw.retention?.daily, 1, 60, DEFAULT_BACKUP_SETTINGS.retention.daily),
    weekly: clampInt(raw.retention?.weekly, 1, 52, DEFAULT_BACKUP_SETTINGS.retention.weekly),
    monthly: clampInt(raw.retention?.monthly, 1, 120, DEFAULT_BACKUP_SETTINGS.retention.monthly),
    keepMinimum: clampInt(raw.retention?.keepMinimum, 1, 10, DEFAULT_BACKUP_SETTINGS.retention.keepMinimum),
  };
  return {
    folderUri: typeof raw.folderUri === "string" ? raw.folderUri : "",
    folderLabel: typeof raw.folderLabel === "string" ? raw.folderLabel : "",
    encryptionEnabled: Boolean(raw.encryptionEnabled),
    encryptionKey: "",
    autoDaily: raw.autoDaily !== false,
    afterTransaction: raw.afterTransaction !== false,
    retention,
    transactionThrottleMinutes: clampInt(raw.transactionThrottleMinutes, 1, 240, DEFAULT_BACKUP_SETTINGS.transactionThrottleMinutes),
    staleAfterHours: clampInt(raw.staleAfterHours, 1, 24 * 30, DEFAULT_BACKUP_SETTINGS.staleAfterHours),
    lastBackupAt: typeof raw.lastBackupAt === "string" ? raw.lastBackupAt : null,
    lastBackupStatus: raw.lastBackupStatus === "ok" || raw.lastBackupStatus === "failed" ? raw.lastBackupStatus : "never",
    lastBackupMessage: typeof raw.lastBackupMessage === "string" ? raw.lastBackupMessage : null,
    lastDataChangeAt: typeof raw.lastDataChangeAt === "string" ? raw.lastDataChangeAt : null,
    onboardingCompletedAt: typeof raw.onboardingCompletedAt === "string" ? raw.onboardingCompletedAt : null,
    dismissedRecoveryBackupId: typeof raw.dismissedRecoveryBackupId === "string" ? raw.dismissedRecoveryBackupId : null,
    lastPreUpdateVersion: typeof raw.lastPreUpdateVersion === "string" ? raw.lastPreUpdateVersion : null,
  };
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function autoDailyTouched(patch: Partial<BackupSettings>): boolean {
  return Object.prototype.hasOwnProperty.call(patch, "autoDaily");
}

export async function loadBackupSettings(): Promise<BackupSettings> {
  if (loaded) return snapshot;
  loaded = true;
  if (!Capacitor.isNativePlatform()) return snapshot;
  try {
    const db = await getDb();
    const res = await db.query("SELECT value FROM settings WHERE key = ?", [SETTINGS_KEY]);
    const value = res.values?.[0]?.value;
    if (typeof value === "string" && value) {
      snapshot = sanitize(JSON.parse(value));
      notify();
    }
  } catch (err) {
    console.warn("[BackupSettings] load failed:", err);
  }
  return snapshot;
}

export async function saveBackupSettings(patch: Partial<BackupSettings>): Promise<BackupSettings> {
  snapshot = sanitize({ ...snapshot, ...patch, encryptionKey: "" });
  notify();
  if (autoDailyTouched(patch) && Capacitor.isNativePlatform()) {
    // The native scheduler is the source of truth for the daily cadence.
    try {
      const { backupBridge } = await import("./bridge");
      await backupBridge.setScheduledBackupEnabled(snapshot.autoDaily);
    } catch (err) {
      console.warn("[BackupSettings] scheduler update failed:", err);
    }
  }
  if (Capacitor.isNativePlatform()) {
    try {
      const db = await getDb();
      await db.run("INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)", [SETTINGS_KEY, JSON.stringify(snapshot)]);
    } catch (err) {
      console.warn("[BackupSettings] save failed:", err);
    }
  }
  return snapshot;
}

/** Records the outcome of a backup run for the dashboard. */
export async function recordBackupRun(status: "ok" | "failed", at: string, message: string | null): Promise<void> {
  await saveBackupSettings({ lastBackupAt: at, lastBackupStatus: status, lastBackupMessage: message });
}

export function resetBackupSettingsCacheForTests(): void {
  loaded = false;
  snapshot = { ...DEFAULT_BACKUP_SETTINGS, retention: { ...DEFAULT_BACKUP_SETTINGS.retention } };
}
