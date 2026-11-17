/**
 * ═══════════════════════════════════════════════════════════════
 * Atomic document numbering (PRD §5.3.2 — uniqueness is mandatory)
 * ═══════════════════════════════════════════════════════════════
 * Infrastructure-level and database-handle based (no import of the app's DB
 * singleton), so the migration runner, the repositories and the Node tests can
 * all use exactly the same allocation code.
 *
 * Why not a simple counter table read + write:
 *   two invoices saved in the same second would read the same value and produce
 *   a duplicate reference. The allocation therefore runs inside ONE transaction
 *   (BEGIN IMMEDIATE) that inserts-if-missing, reads, increments and writes, so
 *   SQLite's write lock serialises concurrent allocations.
 *
 * Portability note: this deliberately avoids `RETURNING` (SQLite >= 3.35) and
 * `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`, because minSdk is 23 and the
 * bundled SQLite version varies by Android release.
 *
 * Rules implemented (§5.3.2, §12.12–12.15):
 *  - a reference already present anywhere in the target table is never handed
 *    out again; on a clash the allocator advances and retries;
 *  - when the counter row is missing while references exist (e.g. a backup from
 *    an older build), the counter is derived from the highest stored sequence.
 */

import { REFERENCE_PREFIX, formatReference, parseReference, type ReferenceScope } from "@/lib/domain/references";

export interface NumberingDatabase {
  query(statement: string, values?: unknown[]): Promise<{ values?: any[] }> | { values?: any[] };
  run(statement: string, values?: unknown[], transaction?: boolean): Promise<unknown> | unknown;
  beginTransaction(): Promise<unknown> | unknown;
  commitTransaction(): Promise<unknown> | unknown;
  rollbackTransaction(): Promise<unknown> | unknown;
}

export interface AllocationTarget {
  /** Table that stores the reference (collision check). */
  table: string;
  column?: string;
  /** Primary key column used by the collision check. */
  idColumn?: string;
}

export const DEFAULT_INVOICE_TARGET: AllocationTarget = { table: "custom_invoices" };
export const PROJECT_TARGET: AllocationTarget = { table: "projects" };

export interface AllocatedReference {
  sequence: number;
  reference: string;
}

function safeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Highest sequence already present in the target table for one date bucket.
 * This is the safety net for restored/older data (§5.3.2).
 */
async function highestStoredSequence(
  db: NumberingDatabase,
  scope: ReferenceScope,
  dateKey: string,
  target: AllocationTarget
): Promise<number> {
  const column = target.column ?? "reference";
  const yy = dateKey.length === 8 ? dateKey.slice(6, 8) : dateKey.slice(-2);
  const prefix = scope === "project" ? `${REFERENCE_PREFIX[scope]}-${dateKey}-` : `${yy}-`;
  let highest = 0;
  try {
    const res = await db.query(
      `SELECT ${column} AS ref FROM ${target.table} WHERE ${column} LIKE ? OR ${column} LIKE ?`,
      [`${prefix}%`, `%${dateKey}%`]
    );
    for (const row of res?.values ?? []) {
      const parsed = parseReference(String(row?.ref ?? ""));
      if (parsed && parsed.scope === scope && parsed.sequence > highest) highest = parsed.sequence;
    }
  } catch {
    // A missing table simply means nothing to collide with yet.
  }
  return highest;
}

/** Reads the persisted counter for a bucket (0 when absent). */
export async function readSequenceCounter(
  db: NumberingDatabase,
  scope: ReferenceScope,
  dateKey: string
): Promise<number> {
  const res = await db.query("SELECT last_number FROM document_sequences WHERE scope = ? AND date_key = ?", [scope, dateKey]);
  return safeInt(res?.values?.[0]?.last_number);
}

/** Raises the persisted counter; never lowers it. */
export async function seedSequenceCounter(
  db: NumberingDatabase,
  scope: ReferenceScope,
  dateKey: string,
  value: number,
  nowIso: string
): Promise<void> {
  await db.run(
    "INSERT INTO document_sequences(scope, date_key, last_number, updated_at) VALUES(?,?,?,?) ON CONFLICT(scope, date_key) DO UPDATE SET last_number = CASE WHEN excluded.last_number > last_number THEN excluded.last_number ELSE last_number END, updated_at = excluded.updated_at",
    [scope, dateKey, safeInt(value), nowIso]
  );
}

/**
 * Allocates the next reference for a bucket.
 * The returned reference is guaranteed not to exist in `target.table`.
 */
export async function allocateDocumentNumber(
  db: NumberingDatabase,
  scope: ReferenceScope,
  dateKey: string,
  nowIso: string,
  target: AllocationTarget = DEFAULT_INVOICE_TARGET,
  maxAttempts = 64
): Promise<AllocatedReference> {
  const column = target.column ?? "reference";

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let sequence = 0;
    await db.beginTransaction();
    try {
      // transaction = false: an explicit transaction is already open on Android SQLite.
      await db.run(
        "INSERT OR IGNORE INTO document_sequences(scope, date_key, last_number, updated_at) VALUES(?,?,0,?)",
        [scope, dateKey, nowIso],
        false
      );
      let current = await readSequenceCounter(db, scope, dateKey);
      if (current === 0) {
        // Counter lost/never seeded while references exist: derive it.
        current = await highestStoredSequence(db, scope, dateKey, target);
      }
      sequence = current + 1;
      await db.run(
        "UPDATE document_sequences SET last_number = ?, updated_at = ? WHERE scope = ? AND date_key = ?",
        [sequence, nowIso, scope, dateKey],
        false
      );
      await db.commitTransaction();
    } catch (err) {
      try {
        await db.rollbackTransaction();
      } catch {
        // transaction already resolved
      }
      throw err;
    }

    const reference = formatReference(scope, dateKey, sequence);
    const clash = await db.query(`SELECT ${target.idColumn ?? "id"} AS id FROM ${target.table} WHERE ${column} = ? LIMIT 1`, [reference]);
    if (!clash?.values?.length) return { sequence, reference };
    // Reference already taken (restored data, manual import): advance and retry.
  }

  throw new Error("تعذّر توليد رقم مرجع فريد بعد عدة محاولات — تحقق من سلامة بيانات الترقيم.");
}

/**
 * Reserves a SPECIFIC reference (used by the deterministic backfill, where the
 * expected number is known). Falls back to the next free number when the
 * requested one is already taken, so a legacy collision can never abort the
 * migration or overwrite an existing reference.
 */
export async function reserveReference(
  db: NumberingDatabase,
  scope: ReferenceScope,
  dateKey: string,
  preferredSequence: number,
  nowIso: string,
  target: AllocationTarget = DEFAULT_INVOICE_TARGET
): Promise<AllocatedReference> {
  const column = target.column ?? "reference";
  const preferred = formatReference(scope, dateKey, preferredSequence);

  // A number at or below the persisted counter has already been handed out, and
  // one that exists in the table is taken: both must advance instead of repeat.
  const counter = await readSequenceCounter(db, scope, dateKey);
  if (preferredSequence > counter) {
    const taken = await db.query(`SELECT ${target.idColumn ?? "id"} AS id FROM ${target.table} WHERE ${column} = ? LIMIT 1`, [preferred]);
    if (!taken?.values?.length) {
      // Keep the counter ahead of any number we hand out.
      await seedSequenceCounter(db, scope, dateKey, preferredSequence, nowIso);
      return { sequence: preferredSequence, reference: preferred };
    }
  }
  return allocateDocumentNumber(db, scope, dateKey, nowIso, target);
}
