/**
 * ═══════════════════════════════════════════════════════════════
 * Automatic backup triggers (type A: after important transactions)
 * ═══════════════════════════════════════════════════════════════
 * Every mutation path in the app already writes through a repository. This
 * module is the single entry point those paths call after a successful write.
 *
 * Design rules:
 *  - Never runs synchronously inside the write path: the caller fires and
 *    forgets, the UI is never blocked.
 *  - Coalesces bursts: while a backup is running, further requests collapse
 *    into ONE follow-up run instead of queueing N snapshots.
 *  - Throttles by time AND content: `skipIfUnchanged` lets the native engine
 *    see the same database hash and return without writing a file.
 *  - Never throws at the caller: a failed automatic backup must not break the
 *    invoice save that triggered it. Failures are recorded for the dashboard.
 */

import { Capacitor } from "@capacitor/core";
import { getDb } from "@/lib/database";
import { backupBridge, isBackupEngineAvailable } from "./bridge";
import { getBackupSettingsSnapshot, loadBackupSettings, recordBackupRun } from "./settingsStore";
import type { BackupKind, BackupRunResult } from "./types";

/**
 * Flush committed SQLCipher WAL frames into the main .db file before the native
 * Android SQLite snapshotter reads it, avoiding cross-driver WAL visibility gaps.
 * Uses PASSIVE mode for transaction-triggered runs to prevent locking the database,
 * and TRUNCATE mode only for manual explicit user backups.
 */
export async function flushWalBeforeBackup(mode: "passive" | "truncate" = "passive"): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const pragma = mode === "truncate" ? "PRAGMA wal_checkpoint(TRUNCATE);" : "PRAGMA wal_checkpoint(PASSIVE);";
  try {
    const db = await getDb();
    await db.query(pragma);
  } catch {
    try {
      const db = await getDb();
      await db.query("PRAGMA wal_checkpoint(PASSIVE);");
    } catch {
      // non-fatal: snapshotter still reads WAL when possible
    }
  }
}

let running = false;
let queued = false;
let lastAttemptAt = 0;

type Listener = (result: BackupRunResult) => void;
const listeners = new Set<Listener>();

/** UI can subscribe to background results (dashboard toast / badge). */
export function subscribeBackupRuns(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(result: BackupRunResult) {
  listeners.forEach((fn) => {
    try {
      fn(result);
    } catch {
      // a broken listener must not stop the backup engine
    }
  });
}

/** True when a backup operation is currently in flight. */
export function isBackupRunning(): boolean {
  return running;
}

/** Resets module state (tests only). */
export function resetAutoBackupStateForTests(): void {
  running = false;
  queued = false;
  lastAttemptAt = 0;
  listeners.clear();
}

/**
 * Main entry point for mutation-triggered backups.
 * Safe to call on every invoice save.
 */
export function triggerBackupAfterTransaction(reason = "transaction"): void {
  if (!Capacitor.isNativePlatform() || !isBackupEngineAvailable()) return;
  void runQueue("transaction", reason).catch((err) => {
    console.warn("[AutoBackup] trigger failed:", err);
  });
}

/**
 * Whether a transaction-triggered backup should even be attempted now.
 * Exported for tests; the throttle window comes from the user's settings.
 */
export function shouldAttemptTransactionBackup(
  now: number,
  lastAttempt: number,
  throttleMinutes: number,
  autoEnabled: boolean
): boolean {
  if (!autoEnabled) return false;
  return now - lastAttempt >= Math.max(1, throttleMinutes) * 60_000;
}

async function runQueue(kind: BackupKind, reason: string): Promise<void> {
  if (running) {
    queued = true;
    return;
  }
  await loadBackupSettings();
  const settings = getBackupSettingsSnapshot();
  if (kind === "transaction") {
    if (!settings.afterTransaction) return;
    const now = Date.now();
    if (!shouldAttemptTransactionBackup(now, lastAttemptAt, settings.transactionThrottleMinutes, true)) return;
    lastAttemptAt = now;
  }

  running = true;
  try {
    // Give the repository's async SQLite write a moment to land, then flush WAL passively without locking readers.
    await new Promise((r) => setTimeout(r, 250));
    await flushWalBeforeBackup("passive");
    const settingsNow = getBackupSettingsSnapshot();
    const result = await backupBridge.createBackup(kind, {
      skipIfUnchanged: true,
      encrypt: settingsNow.encryptionEnabled,
    });
    const nowIso = new Date().toISOString();
    if (result.ok) {
      await recordBackupRun("ok", nowIso, null);
      emit({ ...result, message: "تم حفظ نسخة احتياطية تلقائية (" + reason + ")" });
    } else {
      await recordBackupRun("failed", nowIso, result.message ?? result.errorCode ?? "خطأ غير معروف");
      emit(result);
    }
  } catch (err: any) {
    const message = err?.message === "NATIVE_UNAVAILABLE" ? "وحدة النسخ الاحتياطي غير متوفرة في هذه النسخة." : String(err?.message ?? err);
    await recordBackupRun("failed", new Date().toISOString(), message);
    emit({ ok: false, errorCode: "IO_FAILED", message });
  } finally {
    running = false;
    if (queued) {
      queued = false;
      setTimeout(() => {
        void runQueue("transaction", "queued");
      }, 1500);
    }
  }
}

/**
 * Manual backup from the UI. Bypasses the throttle; still coalesces with a
 * running operation so two taps cannot produce overlapping snapshots.
 */
export async function createManualBackup(): Promise<BackupRunResult> {
  if (!isBackupEngineAvailable()) {
    return { ok: false, errorCode: "UNSUPPORTED", message: "النسخ الاحتياطي متاح داخل تطبيق أندرويد فقط." };
  }
  if (running) {
    return { ok: false, errorCode: "ALREADY_RUNNING", message: "هناك عملية نسخ احتياطي جارية بالفعل، انتظر قليلاً." };
  }
  running = true;
  try {
    await flushWalBeforeBackup("truncate");
    await loadBackupSettings();
    const settings = getBackupSettingsSnapshot();
    const result = await backupBridge.createBackup("manual", { skipIfUnchanged: false, encrypt: settings.encryptionEnabled });
    const nowIso = new Date().toISOString();
    if (result.ok) await recordBackupRun("ok", nowIso, null);
    else await recordBackupRun("failed", nowIso, result.message ?? result.errorCode ?? "خطأ غير معروف");
    return result;
  } catch (err: any) {
    const message = err?.message === "NATIVE_UNAVAILABLE" ? "وحدة النسخ الاحتياطي غير متوفرة في هذه النسخة." : String(err?.message ?? err);
    await recordBackupRun("failed", new Date().toISOString(), message);
    return { ok: false, errorCode: "IO_FAILED", message };
  } finally {
    running = false;
  }
}

/**
 * Ensures the daily schedule exists (idempotent; WorkManager de-duplicates by
 * unique work name). Called once at app start.
 */
export async function ensureScheduledBackups(): Promise<void> {
  if (!isBackupEngineAvailable()) return;
  try {
    await loadBackupSettings();
    const settings = getBackupSettingsSnapshot();
    await backupBridge.setScheduledBackupEnabled(settings.autoDaily);
    await backupBridge.saveSettings({
      encryptionEnabled: settings.encryptionEnabled,
      autoDaily: settings.autoDaily,
      retentionDaily: settings.retention.daily,
      retentionWeekly: settings.retention.weekly,
      retentionMonthly: settings.retention.monthly,
      retentionMinimum: settings.retention.keepMinimum,
      staleAfterHours: settings.staleAfterHours,
      transactionThrottleMinutes: settings.transactionThrottleMinutes,
    });
  } catch (err) {
    console.warn("[AutoBackup] could not ensure schedule:", err);
  }
}
