/**
 * ═══════════════════════════════════════════════════════════════
 * Schema v4 migration — Multi-Currency System (SDG, USD, SAR, EGP)
 * ═══════════════════════════════════════════════════════════════
 * Additive and idempotent migration.
 * Ensures the `currency` column exists on all invoice tables with default 'SDG'.
 * Safely preserves all historical data and balances without modification.
 */

import type { MigrationDatabase } from "./v2BusinessModel";

export const V4_VERSION = 4;

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

const INVOICE_TABLES = ["custom_invoices", "proforma_invoices", "print_invoices"];

/** Adds the currency column to all invoice tables if missing */
export async function addCurrencyColumns(db: MigrationDatabase): Promise<string[]> {
  const added: string[] = [];
  for (const table of INVOICE_TABLES) {
    if (!(await tableExists(db, table))) continue;
    const existing = await tableColumns(db, table);
    if (!existing.has("currency")) {
      await db.execute(`ALTER TABLE ${table} ADD COLUMN currency TEXT DEFAULT 'SDG';`, false);
      added.push(`${table}.currency`);
    }
  }
  return added;
}

/** Creates currency indexes */
export async function ensureCurrencyIndexes(db: MigrationDatabase): Promise<void> {
  const statements = [
    "CREATE INDEX IF NOT EXISTS idx_custom_invoices_currency ON custom_invoices(currency)",
    "CREATE INDEX IF NOT EXISTS idx_proforma_invoices_currency ON proforma_invoices(currency)",
    "CREATE INDEX IF NOT EXISTS idx_print_invoices_currency ON print_invoices(currency)",
  ];
  for (const stmt of statements) {
    try {
      await db.execute(stmt + ";", false);
    } catch (err) {
      console.warn("[Migration v4] index warning:", err);
    }
  }
}

export interface V4Outcome {
  columnsAdded: string[];
  indexesReady: boolean;
}

export async function applyV4(db: MigrationDatabase): Promise<V4Outcome> {
  const columnsAdded = await addCurrencyColumns(db);
  await ensureCurrencyIndexes(db);
  return { columnsAdded, indexesReady: true };
}

