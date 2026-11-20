/**
 * ═══════════════════════════════════════════════════════════════
 * Schema v5 Migration — Customer Management & Financial Integration
 * ═══════════════════════════════════════════════════════════════
 * Additive and idempotent migration:
 *  1. Adds archiving and structured opening balance fields to `customers`
 *  2. Adds `currency` column to `customer_payments`
 *  3. Creates performance indexes for archived queries and currency tracking
 *  4. Performs safe historical reconciliation: links orphan invoices
 *     (customer_id IS NULL) to registered customer records matching party_name
 *     without modifying invoice serials, amounts, or references.
 */

import type { MigrationDatabase } from "./v2BusinessModel";

export const V5_VERSION = 5;

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

const CUSTOMER_ADDED_COLUMNS: { name: string; ddl: string }[] = [
  { name: "is_archived", ddl: "INTEGER DEFAULT 0" },
  { name: "opening_balance", ddl: "REAL DEFAULT 0" },
  { name: "opening_balance_currency", ddl: "TEXT DEFAULT 'SDG'" },
  { name: "opening_balance_date", ddl: "TEXT" },
  { name: "opening_balance_type", ddl: "TEXT DEFAULT 'debit'" },
  { name: "opening_balance_notes", ddl: "TEXT" },
];

export async function addCustomerModuleColumns(db: MigrationDatabase): Promise<string[]> {
  const added: string[] = [];
  if (await tableExists(db, "customers")) {
    const existing = await tableColumns(db, "customers");
    for (const col of CUSTOMER_ADDED_COLUMNS) {
      if (!existing.has(col.name)) {
        await db.execute(`ALTER TABLE customers ADD COLUMN ${col.name} ${col.ddl};`, false);
        added.push(`customers.${col.name}`);
      }
    }
  }

  if (await tableExists(db, "customer_payments")) {
    const existingPayments = await tableColumns(db, "customer_payments");
    if (!existingPayments.has("currency")) {
      await db.execute("ALTER TABLE customer_payments ADD COLUMN currency TEXT DEFAULT 'SDG';", false);
      added.push("customer_payments.currency");
    }
  }

  return added;
}

export async function ensureCustomerIndexes(db: MigrationDatabase): Promise<void> {
  const statements = [
    "CREATE INDEX IF NOT EXISTS idx_customers_archived ON customers(is_archived)",
    "CREATE INDEX IF NOT EXISTS idx_customer_payments_currency ON customer_payments(currency)",
    "CREATE INDEX IF NOT EXISTS idx_custom_invoices_customer_currency ON custom_invoices(customer_id, currency)",
  ];
  for (const stmt of statements) {
    try {
      await db.execute(stmt + ";", false);
    } catch (err) {
      console.warn("[Migration v5] index warning:", err);
    }
  }
}

/**
 * Safely associates legacy invoices that have party_name matching a customer's name
 * but were created with customer_id IS NULL.
 * Never alters references, totals, dates, or invoice numbers.
 */
export async function reconcileOrphanInvoicesToCustomers(db: MigrationDatabase): Promise<number> {
  if (!(await tableExists(db, "custom_invoices")) || !(await tableExists(db, "customers"))) {
    return 0;
  }
  try {
    const res = await db.query(
      `SELECT i.id, i.party_name, c.matched_customer_id
         FROM custom_invoices i
         JOIN (
           SELECT LOWER(TRIM(name)) AS norm_name, MIN(id) AS matched_customer_id
             FROM customers
            WHERE TRIM(COALESCE(name, '')) <> ''
            GROUP BY LOWER(TRIM(name))
           HAVING COUNT(*) = 1
         ) c ON c.norm_name = LOWER(TRIM(i.party_name))
        WHERE i.customer_id IS NULL
          AND i.cancelled_at IS NULL
          AND i.type = 'sales'
          AND TRIM(COALESCE(i.party_name, '')) <> ''`
    );
    const matches = res?.values ?? [];
    let updatedCount = 0;
    for (const match of matches) {
      if (match?.id && match?.matched_customer_id) {
        await db.run("UPDATE custom_invoices SET customer_id = ? WHERE id = ?", [
          match.matched_customer_id,
          match.id,
        ]);
        updatedCount++;
      }
    }
    return updatedCount;
  } catch (err) {
    console.warn("[Migration v5] orphan invoice reconciliation notice:", err);
    return 0;
  }
}

export interface V5Outcome {
  columnsAdded: string[];
  reconciledInvoices: number;
}

export async function applyV5(db: MigrationDatabase): Promise<V5Outcome> {
  const columnsAdded = await addCustomerModuleColumns(db);
  await ensureCustomerIndexes(db);
  const reconciledInvoices = await reconcileOrphanInvoicesToCustomers(db);

  // Normalize legacy categories to modern executive labels
  try {
    await db.run("UPDATE customers SET type = 'institution' WHERE type = 'agency' OR type = 'internal'");
  } catch (err) {
    console.warn("[Migration v5] customer type normalization notice:", err);
  }

  return { columnsAdded, reconciledInvoices };
}
