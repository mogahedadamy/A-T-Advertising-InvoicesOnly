/**
 * ═══════════════════════════════════════════════════════════════
 * Versioned schema migration runner
 * ═══════════════════════════════════════════════════════════════
 * The authoritative version marker is `db_meta.schema_version`, which the app
 * already maintains; `PRAGMA user_version` is mirrored so the native backup
 * engine reports the same number in its manifests.
 *
 * Every step is additive and re-runnable. A step that fails leaves the recorded
 * version untouched, so the next launch retries instead of running on a
 * half-migrated database.
 */

import type { MigrationDatabase } from "./v2BusinessModel";
import {
  V2_VERSION,
  addMissingColumns,
  backfillInvoiceReferences,
  ensureColumnIndexes,
  ensureSchemaV2,
  verifySequenceConsistency,
  type BackfillReport,
} from "./v2BusinessModel";
import { V3_VERSION, applyV3 } from "./v3Finance";
import { applyV4 } from "./v4Currency";

export const SCHEMA_VERSION = V3_VERSION;

export interface MigrationOutcome {
  from: number;
  to: number;
  applied: string[];
  backfill: BackfillReport | null;
  warnings: string[];
}

function readNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Current recorded schema version (defaults to 1 for a v1/fresh database). */
export async function getStoredSchemaVersion(db: MigrationDatabase): Promise<number> {
  try {
    const res = await db.query("SELECT value FROM db_meta WHERE key = 'schema_version' LIMIT 1");
    const fromMeta = readNumber(res?.values?.[0]?.value);
    if (fromMeta) return fromMeta;
  } catch {
    // db_meta missing (very old or fresh database)
  }
  try {
    const res = await db.query("PRAGMA user_version");
    const row = res?.values?.[0];
    const fromPragma = readNumber(row?.user_version ?? (row ? Object.values(row)[0] : null));
    if (fromPragma) return fromPragma;
  } catch {
    // ignore
  }
  return 1;
}

async function setStoredSchemaVersion(db: MigrationDatabase, version: number, nowIso: string): Promise<void> {
  await db.run("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version', ?)", [String(version)]);
  await db.run("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_migrated_at', ?)", [nowIso]);
  try {
    await db.execute(`PRAGMA user_version = ${Math.max(0, Math.trunc(version))};`, false);
  } catch (err) {
    console.warn("[Migration] could not mirror user_version:", err);
  }
}

/**
 * Applies every pending migration in order.
 * Never throws for a recoverable problem: callers get a report and the app
 * continues with whatever version was successfully reached.
 */
export async function runPendingMigrations(
  db: MigrationDatabase,
  options: { nowIso?: string } = {}
): Promise<MigrationOutcome> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const outcome: MigrationOutcome = {
    from: await getStoredSchemaVersion(db),
    to: 1,
    applied: [],
    backfill: null,
    warnings: [],
  };

  // v2 objects are created idempotently on every launch (self-healing), then the
  // versioned work runs once per version bump.
  try {
    await ensureSchemaV2(db);
    // Column-dependent indexes run immediately when v2 columns already exist;
    // on a v1 -> v2 upgrade they run right after addMissingColumns(db) below.
    if (outcome.from >= V2_VERSION) {
      await ensureColumnIndexes(db);
    }
  } catch (err) {
    outcome.warnings.push(`ensureSchemaV2: ${String(err)}`);
  }

  if (outcome.from < V2_VERSION) {
    try {
      const addedColumns = await addMissingColumns(db);
      const indexes = await ensureColumnIndexes(db);
      outcome.backfill = await backfillInvoiceReferences(db, nowIso);
      const counters = await verifySequenceConsistency(db, nowIso);
      await setStoredSchemaVersion(db, V2_VERSION, nowIso);
      outcome.applied.push(
        `v2 (columns: ${addedColumns.length}, indexes: ${indexes.length}, references: ${outcome.backfill.assigned}, counters: ${counters})`
      );
    } catch (err) {
      outcome.warnings.push(`v2: ${String(err)}`);
      console.error("[Migration] v2 failed; version left unchanged for a retry:", err);
    }
  }

  if (outcome.from < V3_VERSION) {
    try {
      const v3 = await applyV3(db, nowIso);
      await setStoredSchemaVersion(db, V3_VERSION, nowIso);
      outcome.applied.push(
        `v3 (expense settlements, default account ${v3.accountSeeded ? "created" : "present"})`
      );
    } catch (err) {
      outcome.warnings.push(`v3: ${String(err)}`);
      console.error("[Migration] v3 failed; version left unchanged for a retry:", err);
    }
  }

  // Multi-currency self-heal: keeps currency columns and indexes ready on all invoice tables.
  try {
    await applyV4(db);
  } catch (err) {
    outcome.warnings.push(`currency self-heal: ${String(err)}`);
  }

  // Always safe to re-run: keeps a usable account available for money operations.
  try {
    await applyV3(db, nowIso);
  } catch (err) {
    outcome.warnings.push(`v3 self-heal: ${String(err)}`);
  }

  outcome.to = await getStoredSchemaVersion(db);
  return outcome;
}
/** Re-runs only the reference backfill (used after a legacy JSON import). */
export async function backfillReferencesOnly(
  db: MigrationDatabase,
  nowIso = new Date().toISOString()
): Promise<BackfillReport> {
  await ensureSchemaV2(db);
  await addMissingColumns(db);
  await ensureColumnIndexes(db);
  const report = await backfillInvoiceReferences(db, nowIso);
  await verifySequenceConsistency(db, nowIso);
  return report;
}

export { V2_VERSION, V3_VERSION };
export type { MigrationDatabase };
