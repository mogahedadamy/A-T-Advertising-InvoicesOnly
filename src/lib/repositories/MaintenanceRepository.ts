/**
 * ═══════════════════════════════════════════════════════════════
 * Storage integrity & maintenance (PRD §12, Blueprint §10)
 * ═══════════════════════════════════════════════════════════════
 * Answers one question honestly: "is the data on this device still sound?"
 * Everything is read from SQLite itself — page integrity, foreign-key
 * consistency, per-table counts and the schema version actually in use.
 */

import { getDb } from "@/lib/database";
import { DB_VERSION, BACKUP_INTEGRITY_TABLES } from "@/lib/database/integrityTables";

export interface TableCount {
  table: string;
  rows: number;
}

export interface IntegrityReport {
  ok: boolean;
  /** PRAGMA quick_check result ("ok" when sound). */
  quickCheck: string;
  /** Rows violating a foreign key (empty is good). */
  foreignKeyViolations: { table: string; parent: string; rowid: number | null; constraint: number }[];
  schemaVersion: number;
  appSchemaVersion: number;
  journalMode: string;
  counts: TableCount[];
  totalRows: number;
  databaseBytes: number;
  /** Plain-language verdict for the UI (Arabic). */
  message: string;
}

/**
 * Runs the full storage check.
 * `quick_check` scans the b-trees for corruption without the cost of a full
 * integrity_check, and `foreign_key_check` catches orphaned rows that would make
 * an invoice point at a project or payment that no longer exists.
 */
export async function runIntegrityCheck(): Promise<IntegrityReport> {
  const db = await getDb();

  const report: IntegrityReport = {
    ok: true,
    quickCheck: "unknown",
    foreignKeyViolations: [],
    schemaVersion: 0,
    appSchemaVersion: DB_VERSION,
    journalMode: "",
    counts: [],
    totalRows: 0,
    databaseBytes: 0,
    message: "",
  };

  try {
    const quick = await db.query("PRAGMA quick_check");
    const firstRow = quick.values?.[0];
    report.quickCheck = String(firstRow?.quick_check ?? (firstRow ? Object.values(firstRow)[0] : "unknown"));
  } catch (err) {
    report.quickCheck = `تعذّر الفحص: ${err instanceof Error ? err.message : String(err)}`;
  }

  try {
    const fk = await db.query("PRAGMA foreign_key_check");
    report.foreignKeyViolations = (fk.values ?? []).map((row: any) => ({
      table: String(row.table ?? ""),
      parent: String(row.parent ?? ""),
      rowid: row.rowid ?? null,
      constraint: Number(row.fkid ?? 0),
    }));
  } catch (err) {
    console.warn("[Integrity] foreign_key_check failed:", err);
  }

  try {
    const version = await db.query("SELECT value FROM db_meta WHERE key = 'schema_version' LIMIT 1");
    report.schemaVersion = Number(version.values?.[0]?.value ?? 0) || 0;
  } catch {
    // db_meta is created with the schema; absence just means "unknown"
  }

  try {
    const journal = await db.query("PRAGMA journal_mode");
    report.journalMode = String(journal.values?.[0]?.journal_mode ?? "");
  } catch {
    // not fatal
  }

  for (const table of BACKUP_INTEGRITY_TABLES) {
    try {
      const res = await db.query(`SELECT COUNT(*) AS c FROM "${table}"`);
      const rows = Number(res.values?.[0]?.c ?? 0);
      report.counts.push({ table, rows });
      report.totalRows += rows;
    } catch {
      // a table that does not exist yet simply contributes nothing
    }
  }

  // "Sound" means all three: pages intact, relationships consistent, and the
  // schema at the version this build expects. A stale version means a migration
  // did not complete, which is worth flagging rather than silently accepting.
  report.ok =
    report.quickCheck.toLowerCase() === "ok" &&
    report.foreignKeyViolations.length === 0 &&
    report.schemaVersion === report.appSchemaVersion;

  if (report.quickCheck.toLowerCase() !== "ok") {
    report.message = "قاعدة البيانات تحتاج فحصاً: اكتُشف خلل في سلامة الصفحات.";
  } else if (report.foreignKeyViolations.length > 0) {
    report.message = `توجد ${report.foreignKeyViolations.length} علاقة مكسورة بين السجلات — قد يشير سجل إلى كيان محذوف.`;
  } else if (report.schemaVersion === 0) {
    report.message = "لم يُسجَّل إصدار المخطط — شغّل التطبيق مرة أخرى لإكمال الترحيل.";
  } else if (report.schemaVersion < report.appSchemaVersion) {
    report.message = `المخطط على إصدار ${report.schemaVersion} بينما التطبيق يتوقّع ${report.appSchemaVersion} — سيُرقّى عند التشغيل.`;
  } else {
    report.message = "قاعدة البيانات سليمة وعلاقات السجلات متسقة.";
  }

  return report;
}

/**
 * Rebuilds the query planner statistics for the whole database.
 * Cheap, safe, and it keeps report queries fast as the data grows (§15
 * performance evaluation).
 */
export async function optimizeStorage(): Promise<{ ok: boolean; message: string }> {
  const db = await getDb();
  try {
    await db.query("PRAGMA optimize;");
    try {
      await db.query("PRAGMA wal_checkpoint(PASSIVE);");
    } catch {
      // checkpoint is best-effort on a busy database
    }
    return { ok: true, message: "تم تحديث إحصاءات الاستعلامات." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "تعذّر تحديث الإحصاءات." };
  }
}
