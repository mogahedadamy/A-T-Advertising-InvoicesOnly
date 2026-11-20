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

import { formatReference, parseReference, type ReferenceScope } from "@/lib/domain/references";

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
export const EXPENSE_PAYMENT_TARGET: AllocationTarget = { table: "expense_payments" };

/**
 * Strict SQL identifier allowlist for sequence collision checks.
 * Prevents arbitrary SQL identifier interpolation into SELECT queries.
 */
export const ALLOWED_SEQUENCE_TARGETS: Readonly<
  Record<string, Readonly<{ columns: readonly string[]; idColumns: readonly string[] }>>
> = Object.freeze({
  custom_invoices: Object.freeze({
    columns: Object.freeze(["reference"]),
    idColumns: Object.freeze(["id"]),
  }),
  customer_payments: Object.freeze({
    columns: Object.freeze(["reference"]),
    idColumns: Object.freeze(["id"]),
  }),
  supplier_payments: Object.freeze({
    columns: Object.freeze(["reference"]),
    idColumns: Object.freeze(["id"]),
  }),
  expense_payments: Object.freeze({
    columns: Object.freeze(["reference"]),
    idColumns: Object.freeze(["id"]),
  }),
  projects: Object.freeze({
    columns: Object.freeze(["reference"]),
    idColumns: Object.freeze(["id"]),
  }),
});

function resolveSafeTarget(target: AllocationTarget): {
  table: string;
  column: string;
  idColumn: string;
} {
  const allowed = Object.prototype.hasOwnProperty.call(ALLOWED_SEQUENCE_TARGETS, target.table)
    ? ALLOWED_SEQUENCE_TARGETS[target.table]
    : undefined;
  if (!allowed) {
    throw new Error(`Invalid sequence target table: ${target.table}`);
  }
  const column = target.column ?? "reference";
  if (!allowed.columns.includes(column)) {
    throw new Error(`Invalid sequence target column: ${target.table}.${column}`);
  }
  const idColumn = target.idColumn ?? "id";
  if (!allowed.idColumns.includes(idColumn)) {
    throw new Error(`Invalid sequence target idColumn: ${target.table}.${idColumn}`);
  }
  return { table: target.table, column, idColumn };
}

export interface AllocatedReference {
  sequence: number;
  reference: string;
}

function safeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

/**
 * Checks whether a reference already exists in the validated target table.
 */
export async function referenceExists(
  db: NumberingDatabase,
  reference: string,
  target: AllocationTarget = DEFAULT_INVOICE_TARGET
): Promise<boolean> {
  const safe = resolveSafeTarget(target);
  const res = await db.query(
    `SELECT ${safe.idColumn} AS id FROM ${safe.table} WHERE ${safe.column} = ? LIMIT 1`,
    [reference]
  );
  return Boolean(res?.values?.length);
}

function isAnnualInvoiceBucket(scope: ReferenceScope, dateKey: string): boolean {
  return (scope === "sales" || scope === "purchase") && /^\d{2,4}$/.test(dateKey);
}

/**
 * Annual YY-NNNN invoices share a single UNIQUE namespace across sales and
 * purchase invoices in `custom_invoices`, so they must share one counter row
 * (`("sales", "YYYY")`) to prevent collisions after 64 sales invoices (FIN-05).
 * Daily/legacy keys (`DDMMYYYY`) keep `sales` and `purchase` separate.
 */
function resolveCounterScope(scope: ReferenceScope, dateKey: string): ReferenceScope {
  return isAnnualInvoiceBucket(scope, dateKey) ? "sales" : scope;
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
  const safe = resolveSafeTarget(target);
  const annual = isAnnualInvoiceBucket(scope, dateKey);
  const yy = dateKey.length === 8 ? dateKey.slice(6, 8) : dateKey.slice(-2);
  let highest = 0;
  try {
    const res = annual
      ? await db.query(`SELECT ${safe.column} AS ref FROM ${safe.table} WHERE ${safe.column} LIKE ?`, [`${yy}-%`])
      : await db.query(`SELECT ${safe.column} AS ref FROM ${safe.table} WHERE ${safe.column} LIKE ?`, [`%${dateKey}%`]);
    for (const row of res?.values ?? []) {
      const rawRef = String(row?.ref ?? "").trim();
      const parsed = parseReference(rawRef);
      if (!parsed) continue;
      if (annual) {
        // Match all annual YY-NNNN references for the same year (shared across sales & purchase).
        if (!/^\d{2}-\d{4,6}$/.test(parsed.raw)) continue;
        if (String(parsed.date.year).slice(-2) !== yy) continue;
        if (parsed.sequence > highest) highest = parsed.sequence;
      } else {
        if (parsed.scope !== scope) continue;
        const parsedDayKey = `${String(parsed.date.day).padStart(2, "0")}${String(parsed.date.month).padStart(2, "0")}${parsed.date.year}`;
        if (parsedDayKey !== dateKey) continue;
        if (parsed.sequence > highest) highest = parsed.sequence;
      }
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
  const counterScope = resolveCounterScope(scope, dateKey);
  const res = await db.query("SELECT last_number FROM document_sequences WHERE scope = ? AND date_key = ?", [
    counterScope,
    dateKey,
  ]);
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
  const counterScope = resolveCounterScope(scope, dateKey);
  await db.run(
    "INSERT INTO document_sequences(scope, date_key, last_number, updated_at) VALUES(?,?,?,?) ON CONFLICT(scope, date_key) DO UPDATE SET last_number = CASE WHEN excluded.last_number > last_number THEN excluded.last_number ELSE last_number END, updated_at = excluded.updated_at",
    [counterScope, dateKey, safeInt(value), nowIso]
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
  const safe = resolveSafeTarget(target);
  const counterScope = resolveCounterScope(scope, dateKey);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let sequence = 0;
    await db.beginTransaction();
    try {
      // transaction = false: an explicit transaction is already open on Android SQLite.
      await db.run(
        "INSERT OR IGNORE INTO document_sequences(scope, date_key, last_number, updated_at) VALUES(?,?,0,?)",
        [counterScope, dateKey, nowIso],
        false
      );
      let current = await readSequenceCounter(db, counterScope, dateKey);
      if (current === 0 || attempt > 0) {
        // Counter lost/never seeded or fell behind restored/imported rows: jump past highest stored sequence.
        const highest = await highestStoredSequence(db, counterScope, dateKey, safe);
        if (highest > current) current = highest;
      }
      sequence = current + 1;
      await db.run(
        "UPDATE document_sequences SET last_number = ?, updated_at = ? WHERE scope = ? AND date_key = ?",
        [sequence, nowIso, counterScope, dateKey],
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
    if (!(await referenceExists(db, reference, safe))) return { sequence, reference };
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
  const safe = resolveSafeTarget(target);
  const preferred = formatReference(scope, dateKey, preferredSequence);

  // A number at or below the persisted counter has already been handed out, and
  // one that exists in the table is taken: both must advance instead of repeat.
  const counter = await readSequenceCounter(db, scope, dateKey);
  if (preferredSequence > counter) {
    if (!(await referenceExists(db, preferred, safe))) {
      // Keep the counter ahead of any number we hand out.
      await seedSequenceCounter(db, scope, dateKey, preferredSequence, nowIso);
      return { sequence: preferredSequence, reference: preferred };
    }
  }
  return allocateDocumentNumber(db, scope, dateKey, nowIso, safe);
}
