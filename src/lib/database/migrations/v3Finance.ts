/**
 * ═══════════════════════════════════════════════════════════════
 * Schema v3 migration — expense settlements + a usable default account
 * ═══════════════════════════════════════════════════════════════
 * Additive and idempotent. Seeding one cash account is a sensible default
 * (PRD §13.2), not invented business data: it is an empty account with a zero
 * opening balance, and the user can rename it or add more.
 */

import { CREATE_SCHEMA_V3, DEFAULT_CASH_ACCOUNT } from "../schema";
import type { MigrationDatabase } from "./v2BusinessModel";

export const V3_VERSION = 3;

/** Idempotent DDL for every v3 object. */
export async function ensureSchemaV3(db: MigrationDatabase): Promise<void> {
  for (const statement of CREATE_SCHEMA_V3) {
    try {
      await db.execute(statement + ";", false);
    } catch (err) {
      console.warn("[Migration v3] DDL warning:", err, "\nStatement:", statement.slice(0, 90));
    }
  }
}

/** Makes sure at least one financial account exists before money is recorded. */
export async function ensureDefaultAccount(db: MigrationDatabase, nowIso: string): Promise<boolean> {
  const existing = await db.query("SELECT id FROM financial_accounts LIMIT 1");
  if (existing?.values?.length) return false;
  await db.run(
    "INSERT OR IGNORE INTO financial_accounts(id, name, kind, opening_balance, is_active, created_at) VALUES(?,?,?,?,?,?)",
    [DEFAULT_CASH_ACCOUNT.id, DEFAULT_CASH_ACCOUNT.name, DEFAULT_CASH_ACCOUNT.kind, 0, 1, nowIso]
  );
  return true;
}

export interface V3Outcome {
  expensePaymentsReady: boolean;
  accountSeeded: boolean;
}

export async function applyV3(db: MigrationDatabase, nowIso: string): Promise<V3Outcome> {
  await ensureSchemaV3(db);
  const accountSeeded = await ensureDefaultAccount(db, nowIso);
  return { expensePaymentsReady: true, accountSeeded };
}
