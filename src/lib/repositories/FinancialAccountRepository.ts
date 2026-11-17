/**
 * ═══════════════════════════════════════════════════════════════
 * Financial accounts (PRD §10)
 * ═══════════════════════════════════════════════════════════════
 * Balances are always DERIVED from ledger movements; nothing is cached here
 * (§10.2). Opening balance is the only stored figure, and it is explicit.
 */

import { getDb } from "@/lib/database";
import { buildAccountReport, type AccountBalanceReport, type AccountKind, type FinancialAccount } from "@/lib/domain/finance";

function rowToAccount(row: any): FinancialAccount {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    kind: (row.kind as AccountKind) ?? "cash",
    openingBalance: Number(row.opening_balance) || 0,
    isActive: Number(row.is_active ?? 1) === 1,
    notes: row.notes ?? undefined,
    createdAt: String(row.created_at),
  };
}

export async function getAllAccounts(includeInactive = false): Promise<FinancialAccount[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT * FROM financial_accounts ${includeInactive ? "" : "WHERE is_active = 1"} ORDER BY created_at ASC`
  );
  return (res.values ?? []).map(rowToAccount);
}

export async function getAccountById(id: string): Promise<FinancialAccount | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM financial_accounts WHERE id = ? LIMIT 1", [id]);
  const row = res.values?.[0];
  return row ? rowToAccount(row) : undefined;
}

export async function createAccount(input: {
  name: string;
  kind: AccountKind;
  openingBalance?: number;
  notes?: string;
  nowIso?: string;
}): Promise<FinancialAccount> {
  const db = await getDb();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const id = `acc-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.run(
    "INSERT INTO financial_accounts(id, name, kind, opening_balance, is_active, notes, created_at) VALUES(?,?,?,?,?,?,?)",
    [id, input.name.trim(), input.kind, Number(input.openingBalance) || 0, 1, input.notes ?? null, nowIso]
  );
  return {
    id,
    name: input.name.trim(),
    kind: input.kind,
    openingBalance: Number(input.openingBalance) || 0,
    isActive: true,
    notes: input.notes,
    createdAt: nowIso,
  };
}

export async function updateAccount(
  id: string,
  changes: { name?: string; kind?: AccountKind; notes?: string; isActive?: boolean }
): Promise<void> {
  const db = await getDb();
  const current = await getAccountById(id);
  if (!current) throw new Error("الحساب المالي غير موجود");
  await db.run(
    "UPDATE financial_accounts SET name = ?, kind = ?, notes = ?, is_active = ? WHERE id = ?",
    [
      changes.name?.trim() || current.name,
      changes.kind ?? current.kind,
      changes.notes ?? current.notes ?? null,
      (changes.isActive ?? current.isActive) ? 1 : 0,
      id,
    ]
  );
}

/** Account balance report from real ledger movements (§10.1). */
export async function getAccountBalances(): Promise<AccountBalanceReport[]> {
  const db = await getDb();
  const accounts = await getAllAccounts();
  const reports: AccountBalanceReport[] = [];
  for (const account of accounts) {
    const res = await db.query(
      "SELECT kind, amount, account_id, reversed_by FROM financial_transactions WHERE account_id = ?",
      [account.id]
    );
    reports.push(
      buildAccountReport(
        account,
        (res.values ?? []).map((row: any) => ({
          kind: row.kind,
          amount: Number(row.amount) || 0,
          accountId: String(row.account_id),
          reversedBy: row.reversed_by ?? undefined,
        }))
      )
    );
  }
  return reports;
}

/** The account used when the caller does not choose one. */
export async function getDefaultAccountId(): Promise<string | null> {
  const accounts = await getAllAccounts();
  if (accounts.length === 0) return null;
  const cash = accounts.find((account) => account.kind === "cash");
  return (cash ?? accounts[0]).id;
}
