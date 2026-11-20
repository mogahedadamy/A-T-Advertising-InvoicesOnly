/**
 * ═══════════════════════════════════════════════════════════════
 * Schema v2 migration — business model + document references
 * ═══════════════════════════════════════════════════════════════
 * Purely additive and idempotent:
 *  - creates the v2 tables (CREATE ... IF NOT EXISTS);
 *  - adds the new columns to v1 tables, guarded by PRAGMA table_info (SQLite
 *    has no "ADD COLUMN IF NOT EXISTS", and re-running must not fail);
 *  - assigns reference numbers retroactively to existing invoices in a
 *    deterministic order (PRD §5.3.3 forbids silent reassignment, so the order
 *    and the resulting numbers must be reproducible).
 *
 * Recovery property: the reference backfill commits per row and only touches
 * rows whose reference is still empty, so an interrupted migration can simply
 * be re-run and will continue where it stopped without ever renumbering an
 * invoice that already has an official reference.
 */

import { CREATE_SCHEMA_V2, CREATE_SCHEMA_V2_COLUMN_INDEXES, V2_ADDED_COLUMNS } from "../schema";
import { reserveReference, seedSequenceCounter, type NumberingDatabase } from "../sequences";
import {
  compareForBackfill,
  dateKeyFromParts,
  localPartsFromIsoDate,
  parseReference,
  planReferenceBackfill,
  scopeForInvoiceType,
} from "@/lib/domain/references";

export interface MigrationDatabase extends NumberingDatabase {
  execute(statements: string, transaction?: boolean): Promise<unknown> | unknown;
  run(statement: string, values?: unknown[]): Promise<unknown> | unknown;
  query(statement: string, values?: unknown[]): Promise<{ values?: any[] }> | { values?: any[] };
}

export const V2_VERSION = 2;

/** Idempotent DDL for every v2 object. Safe to call on every launch. */
export async function ensureSchemaV2(db: MigrationDatabase): Promise<void> {
  for (const statement of CREATE_SCHEMA_V2) {
    try {
      await db.execute(statement + ";", false);
    } catch (err) {
      // A partial index or an already-existing column variant can warn on some
      // builds; the migration verifies the real state afterwards regardless.
      console.warn("[Migration v2] DDL warning:", err, "\nStatement:", statement.slice(0, 90));
    }
  }
}

/**
 * Indexes on columns added by this migration.
 * Must run AFTER addMissingColumns: creating them earlier fails (the column does
 * not exist yet) and would silently drop the unique guarantee on `reference`.
 */
export async function ensureColumnIndexes(db: MigrationDatabase): Promise<string[]> {
  const created: string[] = [];
  for (const statement of CREATE_SCHEMA_V2_COLUMN_INDEXES) {
    try {
      await db.execute(statement + ";", false);
      created.push(statement);
    } catch (err) {
      console.error("[Migration v2] could not create an index on a v2 column:", err);
    }
  }
  return created;
}

async function tableColumns(db: MigrationDatabase, table: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const res = await db.query(`PRAGMA table_info(${table})`);
    for (const row of res?.values ?? []) {
      if (row?.name) names.add(String(row.name));
    }
  } catch {
    // table absent
  }
  return names;
}

async function tableExists(db: MigrationDatabase, table: string): Promise<boolean> {
  const res = await db.query("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1", [table]);
  return Boolean(res?.values?.length);
}

/** Adds the v2 columns to v1 tables, only when missing. */
export async function addMissingColumns(db: MigrationDatabase): Promise<string[]> {
  const added: string[] = [];
  for (const [table, columns] of Object.entries(V2_ADDED_COLUMNS)) {
    if (columns.length === 0) continue;
    if (!(await tableExists(db, table))) continue;
    const existing = await tableColumns(db, table);
    for (const column of columns) {
      if (existing.has(column.name)) continue;
      await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.ddl};`, false);
      added.push(`${table}.${column.name}`);
    }
  }
  return added;
}

export interface BackfillReport {
  scanned: number;
  assigned: number;
  skipped: number;
  byScope: Record<string, number>;
}

/**
 * Assigns official references to invoices that predate the numbering system.
 * Ordering: business date, then creation instant, then id (see
 * planReferenceBackfill) so the outcome is stable and reviewable.
 *
 * Proforma/billing rows are intentionally NOT numbered here: the specification
 * defines formats only for sales (INV-) and purchase (PINV-) invoices, and
 * inventing a format for another document type is out of scope.
 */
export async function backfillInvoiceReferences(
  db: MigrationDatabase,
  nowIso: string
): Promise<BackfillReport> {
  const report: BackfillReport = { scanned: 0, assigned: 0, skipped: 0, byScope: {} };

  const res = await db.query(
    "SELECT id, type, date, created_at FROM custom_invoices WHERE reference IS NULL OR reference = ''"
  );
  const rows = res?.values ?? [];
  report.scanned = rows.length;
  if (rows.length === 0) return report;

  const byScope = new Map<"sales" | "purchase", { id: string; date: string | null; createdAt: string | null }[]>();
  for (const row of rows) {
    const scope = scopeForInvoiceType(String(row?.type ?? ""));
    if (!scope) {
      report.skipped++;
      continue;
    }
    const list = byScope.get(scope) ?? [];
    list.push({ id: String(row.id), date: row.date ?? null, createdAt: row.created_at ?? null });
    byScope.set(scope, list);
  }

  for (const [scope, candidates] of byScope) {
    // Process in the deterministic order that the plan produced, so the numbers
    // handed out are monotonic per day and a re-run cannot skip a number.
    const ordered = [...candidates].sort(compareForBackfill);
    const plan = planReferenceBackfill(scope, ordered, 0);
    const planned = new Map(plan.assignments.map((a) => [a.id, a]));

    for (const candidate of ordered) {
      const assignment = planned.get(candidate.id);
      if (!assignment) continue;

      // prefer the planned number so the result is reproducible; the allocator
      // falls back to the next free number if that one is already taken.
      const allocated = await reserveReference(db, scope, assignment.dateKey, assignment.sequence, nowIso);

      const update = await db.run(
        "UPDATE custom_invoices SET reference = ?, reference_assigned_at = ? WHERE id = ? AND (reference IS NULL OR reference = '')",
        [allocated.reference, nowIso, candidate.id]
      );
      const changed = Number((update as { changes?: { changes?: number } })?.changes?.changes ?? 1);
      if (changed > 0) {
        report.assigned++;
        report.byScope[scope] = (report.byScope[scope] ?? 0) + 1;
      } else {
        // Someone assigned a reference in the meantime: keep theirs.
        report.skipped++;
      }
    }

    // Make sure future allocations continue after the highest number in use.
    for (const [dateKey, maxSequence] of Object.entries(plan.maxSequenceByDateKey)) {
      await seedSequenceCounter(db, scope, dateKey, maxSequence, nowIso);
    }
  }

  return report;
}

/** Republishes the current counters as a defensive consistency step. */
export async function verifySequenceConsistency(db: MigrationDatabase, nowIso: string): Promise<number> {
  let repaired = 0;
  for (const scope of ["sales", "purchase"] as const) {
    const res = await db.query(
      `SELECT reference FROM custom_invoices WHERE type = ? AND reference IS NOT NULL AND reference <> ''`,
      [scope]
    );
    const highestByDateKey = new Map<string, number>();
    for (const row of res?.values ?? []) {
      const reference = String(row?.reference ?? "");
      const parsed = parseReference(reference);
      if (!parsed) continue;
      const dateKey = String(parsed.date.year);
      const seq = parsed.sequence;
      if (seq > (highestByDateKey.get(dateKey) ?? 0)) highestByDateKey.set(dateKey, seq);
    }
    for (const [dateKey, seq] of highestByDateKey) {
      await seedSequenceCounter(db, scope, dateKey, seq, nowIso);
      repaired++;
    }
  }
  return repaired;
}

export { dateKeyFromParts, localPartsFromIsoDate };