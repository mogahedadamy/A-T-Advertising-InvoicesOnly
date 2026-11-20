/**
 * ═══════════════════════════════════════════════════════════════
 * Schema v6 Migration — Multi-Currency Accounting & Indexes
 * ═══════════════════════════════════════════════════════════════
 * Purely additive and idempotent:
 *  1. Adds `currency TEXT NOT NULL DEFAULT 'SDG'` to financial & order tables
 *     (`financial_accounts`, `financial_transactions`, `supplier_payments`,
 *     `expenses`, `expense_payments`, `orders`).
 *  2. Creates missing composite & currency performance indexes.
 *  3. Backfills any null/blank currency values safely to `'SDG'` (or the
 *     linked account's currency for `financial_transactions`).
 */

import { CREATE_SCHEMA_V6_INDEXES, V6_ADDED_COLUMNS } from "../schema";
import type { MigrationDatabase } from "./v2BusinessModel";

export const V6_VERSION = 6;

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

/** Adds missing v6 multi-currency columns idempotently via PRAGMA table_info. */
export async function addV6MultiCurrencyColumns(db: MigrationDatabase): Promise<string[]> {
  const added: string[] = [];
  for (const [table, columns] of Object.entries(V6_ADDED_COLUMNS)) {
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

/** Creates v6 composite and currency indexes idempotently. */
export async function ensureV6Indexes(db: MigrationDatabase): Promise<number> {
  let created = 0;
  for (const statement of CREATE_SCHEMA_V6_INDEXES) {
    try {
      await db.execute(statement + ";", false);
      created++;
    } catch (err) {
      console.warn("[Migration v6] index warning:", err);
    }
  }
  return created;
}

/** Backfills null/blank currency columns safely without altering valid codes. */
export async function backfillV6Currencies(db: MigrationDatabase): Promise<number> {
  let updated = 0;
  const tables = [
    "financial_accounts",
    "supplier_payments",
    "expenses",
    "expense_payments",
    "orders",
    "customer_payments",
    "custom_invoices",
  ];

  for (const table of tables) {
    if (!(await tableExists(db, table))) continue;
    const cols = await tableColumns(db, table);
    if (!cols.has("currency")) continue;
    try {
      const res = await db.run(
        `UPDATE ${table} SET currency = 'SDG' WHERE currency IS NULL OR TRIM(currency) = ''`
      );
      updated += Number((res as { changes?: { changes?: number } })?.changes?.changes ?? 0);
    } catch (err) {
      console.warn(`[Migration v6] currency backfill warning on ${table}:`, err);
    }
  }

  if (await tableExists(db, "financial_transactions")) {
    const txCols = await tableColumns(db, "financial_transactions");
    if (txCols.has("currency")) {
      try {
        const res = await db.run(
          `UPDATE financial_transactions
              SET currency = COALESCE(
                (SELECT NULLIF(TRIM(fa.currency), '') FROM financial_accounts fa WHERE fa.id = financial_transactions.account_id),
                'SDG'
              )
            WHERE currency IS NULL OR TRIM(currency) = ''`
        );
        updated += Number((res as { changes?: { changes?: number } })?.changes?.changes ?? 0);
      } catch (err) {
        console.warn("[Migration v6] financial_transactions currency backfill warning:", err);
      }
    }
  }

  return updated;
}

export interface V6Outcome {
  columnsAdded: string[];
  indexesCreated: number;
  backfilledRows: number;
}

export async function applyV6MultiCurrency(db: MigrationDatabase): Promise<V6Outcome> {
  const columnsAdded = await addV6MultiCurrencyColumns(db);
  const indexesCreated = await ensureV6Indexes(db);
  const backfilledRows = await backfillV6Currencies(db);
  return { columnsAdded, indexesCreated, backfilledRows };
}
