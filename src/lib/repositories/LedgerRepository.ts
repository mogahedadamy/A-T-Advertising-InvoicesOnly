/**
 * ═══════════════════════════════════════════════════════════════
 * Ledger read model (PRD §9, §10)
 * ═══════════════════════════════════════════════════════════════
 * Everything here is DERIVED from authoritative records: invoice settlement from
 * allocations, supplier obligations from purchase invoices minus payments,
 * balances from ledger movements, and profitability from recorded documents.
 * No figure is cached or maintained by hand (§10.2).
 */

import { getDb } from "@/lib/database";
import {
  buildCompanyProfitability,
  buildSettlement,
  totalLiquidity,
  type CompanyProfitability,
  type LedgerEntry,
  type LedgerKind,
  type SettlementSummary,
} from "@/lib/domain/finance";
import { getAccountBalances } from "@/lib/repositories/FinancialAccountRepository";

/** Paid amount per invoice, derived from valid allocations only. */
export async function getInvoicePaidMap(kind: "sales" | "purchase" = "sales"): Promise<Record<string, number>> {
  const db = await getDb();
  const allocationTable =
    kind === "sales" ? "customer_payment_allocations" : "supplier_payment_allocations";
  const paymentTable = kind === "sales" ? "customer_payments" : "supplier_payments";
  const res = await db.query(
    `SELECT a.invoice_id AS invoice_id, COALESCE(SUM(a.amount), 0) AS paid
       FROM ${allocationTable} a
       JOIN ${paymentTable} p ON p.id = a.payment_id
      WHERE p.cancelled_at IS NULL
      GROUP BY a.invoice_id`
  );
  const map: Record<string, number> = {};
  for (const row of res.values ?? []) {
    map[String(row.invoice_id)] = Number(row.paid) || 0;
  }
  return map;
}

/** Settlement of one invoice (total, paid, outstanding, derived status). */
export async function getInvoiceSettlement(
  invoiceId: string,
  kind: "sales" | "purchase" = "sales",
  total?: number
): Promise<SettlementSummary | null> {
  const db = await getDb();
  let invoiceTotal = total;
  if (invoiceTotal === undefined) {
    const res = await db.query("SELECT total_amount FROM custom_invoices WHERE id = ? LIMIT 1", [invoiceId]);
    const row = res.values?.[0];
    if (!row) return null;
    invoiceTotal = Number(row.total_amount) || 0;
  }
  const allocationTable =
    kind === "sales" ? "customer_payment_allocations" : "supplier_payment_allocations";
  const paymentTable = kind === "sales" ? "customer_payments" : "supplier_payments";
  const res = await db.query(
    `SELECT COALESCE(SUM(a.amount), 0) AS paid
       FROM ${allocationTable} a
       JOIN ${paymentTable} p ON p.id = a.payment_id
      WHERE p.cancelled_at IS NULL AND a.invoice_id = ?`,
    [invoiceId]
  );
  const paid = Number(res.values?.[0]?.paid) || 0;
  return buildSettlement(invoiceTotal, paid);
}

export interface MoneyMovement {
  id: string;
  kind: LedgerKind;
  amount: number;
  occurredAt: string;
  accountId: string;
  accountName: string;
  counterAccountId?: string | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  reference?: string | undefined;
  projectId?: string | undefined;
  reversed: boolean;
}

/** Ledger movements with the account name resolved for display. */
export async function getMoneyMovements(limit = 200): Promise<MoneyMovement[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT t.*, a.name AS account_name
       FROM financial_transactions t
       LEFT JOIN financial_accounts a ON a.id = t.account_id
      ORDER BY t.occurred_at DESC, t.created_at DESC
      LIMIT ?`,
    [limit]
  );
  return (res.values ?? []).map((row: any) => ({
    id: String(row.id),
    kind: row.kind as LedgerKind,
    amount: Number(row.amount) || 0,
    occurredAt: String(row.occurred_at ?? ""),
    accountId: String(row.account_id),
    accountName: String(row.account_name ?? "حساب محذوف"),
    counterAccountId: row.counter_account_id ?? undefined,
    sourceType: row.source_type ?? undefined,
    sourceId: row.source_id ?? undefined,
    reference: row.reference_note ?? undefined,
    projectId: row.project_id ?? undefined,
    reversed: Boolean(row.reversed_by),
  }));
}

/** Ledger entries of one project (traceability, §11.6). */
export async function getProjectMovements(projectId: string, limit = 100): Promise<MoneyMovement[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT t.*, a.name AS account_name
       FROM financial_transactions t
       LEFT JOIN financial_accounts a ON a.id = t.account_id
      WHERE t.project_id = ?
      ORDER BY t.occurred_at DESC, t.created_at DESC
      LIMIT ?`,
    [projectId, limit]
  );
  return (res.values ?? []).map((row: any) => ({
    id: String(row.id),
    kind: row.kind as LedgerKind,
    amount: Number(row.amount) || 0,
    occurredAt: String(row.occurred_at ?? ""),
    accountId: String(row.account_id),
    accountName: String(row.account_name ?? "حساب محذوف"),
    counterAccountId: row.counter_account_id ?? undefined,
    sourceType: row.source_type ?? undefined,
    sourceId: row.source_id ?? undefined,
    reference: row.reference_note ?? undefined,
    projectId: row.project_id ?? undefined,
    reversed: Boolean(row.reversed_by),
  }));
}

export interface CustomerAccount {
  customerId: string;
  invoicedTotal: number;
  collectedTotal: number;
  outstanding: number;
  invoiceCount: number;
}

/** Customer receivables derived from invoices and their allocations (§9.1). */
export async function getCustomerAccount(customerId: string): Promise<CustomerAccount> {
  const db = await getDb();
  const res = await db.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS c
       FROM custom_invoices
      WHERE type = 'sales' AND cancelled_at IS NULL
        AND (customer_id = ? OR (customer_id IS NULL AND party_name = (SELECT name FROM customers WHERE id = ? LIMIT 1)))`,
    [customerId, customerId]
  );
  const invoicedTotal = Number(res.values?.[0]?.total) || 0;
  const invoiceCount = Number(res.values?.[0]?.c) || 0;

  const collectedRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM customer_payments WHERE customer_id = ? AND cancelled_at IS NULL",
    [customerId]
  );
  const collectedTotal = Number(collectedRes.values?.[0]?.total) || 0;

  return {
    customerId,
    invoicedTotal: round2(invoicedTotal),
    collectedTotal: round2(collectedTotal),
    outstanding: round2(Math.max(0, invoicedTotal - collectedTotal)),
    invoiceCount,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CashSummary {
  liquidity: number;
  receipts: number;
  payments: number;
  accountCount: number;
}

/** Actual cash in and out (liquidity, PRD §8.3). */
export async function getCashSummary(): Promise<CashSummary> {
  const db = await getDb();
  const reports = await getAccountBalances();
  const receiptsRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_transactions WHERE kind = 'receipt' AND reversed_by IS NULL"
  );
  const paymentsRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM financial_transactions WHERE kind = 'payment' AND reversed_by IS NULL"
  );
  return {
    liquidity: totalLiquidity(reports),
    receipts: round2(Number(receiptsRes.values?.[0]?.total) || 0),
    payments: round2(Number(paymentsRes.values?.[0]?.total) || 0),
    accountCount: reports.length,
  };
}

export interface ReceivablesSummary {
  invoiced: number;
  collected: number;
  outstanding: number;
  partialCount: number;
  unpaidCount: number;
  overdueCount: number;
}

/** Company-wide receivables, split the way the specification demands (§11.2). */
export async function getReceivablesSummary(today = new Date().toISOString().slice(0, 10)): Promise<ReceivablesSummary> {
  const db = await getDb();
  const res = await db.query(
    `SELECT 
       COALESCE(SUM(i.total_amount), 0) AS invoiced,
       COALESCE(SUM(COALESCE(paid_agg.paid, 0)), 0) AS collected,
       COALESCE(SUM(CASE WHEN COALESCE(paid_agg.paid, 0) <= 0.009 THEN 1 ELSE 0 END), 0) AS unpaid_count,
       COALESCE(SUM(CASE WHEN COALESCE(paid_agg.paid, 0) > 0.009 AND (COALESCE(paid_agg.paid, 0) + 0.009) < i.total_amount THEN 1 ELSE 0 END), 0) AS partial_count,
       COALESCE(SUM(CASE WHEN (i.total_amount - COALESCE(paid_agg.paid, 0)) > 0.009 AND COALESCE(i.due_date, i.date) < ? THEN 1 ELSE 0 END), 0) AS overdue_count
     FROM custom_invoices i
     LEFT JOIN (
       SELECT a.invoice_id, SUM(a.amount) AS paid
         FROM customer_payment_allocations a
         JOIN customer_payments p ON p.id = a.payment_id
        WHERE p.cancelled_at IS NULL
        GROUP BY a.invoice_id
     ) paid_agg ON paid_agg.invoice_id = i.id
     WHERE i.type = 'sales' AND i.cancelled_at IS NULL`,
    [today]
  );

  const row = res.values?.[0] || {};
  const invoiced = round2(Number(row.invoiced) || 0);
  const collected = round2(Number(row.collected) || 0);

  return {
    invoiced,
    collected,
    outstanding: round2(Math.max(0, invoiced - collected)),
    partialCount: Number(row.partial_count) || 0,
    unpaidCount: Number(row.unpaid_count) || 0,
    overdueCount: Number(row.overdue_count) || 0,
  };
}

export interface PayablesSummary {
  purchased: number;
  paid: number;
  outstanding: number;
  invoiceCount: number;
}

/** Company-wide payables to suppliers (§11.3). */
export async function getPayablesSummary(): Promise<PayablesSummary> {
  const db = await getDb();
  const res = await db.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS c FROM custom_invoices WHERE type = 'purchase' AND cancelled_at IS NULL"
  );
  const purchased = Number(res.values?.[0]?.total) || 0;
  const invoiceCount = Number(res.values?.[0]?.c) || 0;

  const paidRes = await db.query(
    `SELECT COALESCE(SUM(a.amount), 0) AS total
       FROM supplier_payment_allocations a
       JOIN supplier_payments p ON p.id = a.payment_id
      WHERE p.cancelled_at IS NULL`
  );
  const paid = Number(paidRes.values?.[0]?.total) || 0;

  return {
    purchased: round2(purchased),
    paid: round2(paid),
    outstanding: round2(Math.max(0, purchased - paid)),
    invoiceCount,
  };
}

/**
 * Company profitability with the cost split the specification requires (§9.5):
 * direct project costs and operating expenses are never mixed.
 */
export async function getCompanyProfitability(): Promise<CompanyProfitability> {
  const db = await getDb();

  const revenueRes = await db.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS total FROM custom_invoices WHERE type = 'sales' AND cancelled_at IS NULL"
  );
  const purchasesRes = await db.query(
    "SELECT COALESCE(SUM(total_amount), 0) AS total FROM custom_invoices WHERE type = 'purchase' AND cancelled_at IS NULL"
  );
  const directExpensesRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE kind = 'direct' AND cancelled_at IS NULL"
  );
  const operatingExpensesRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE kind = 'operating' AND cancelled_at IS NULL"
  );

  return buildCompanyProfitability({
    revenue: Number(revenueRes.values?.[0]?.total) || 0,
    directCosts:
      (Number(purchasesRes.values?.[0]?.total) || 0) + (Number(directExpensesRes.values?.[0]?.total) || 0),
    operatingExpenses: Number(operatingExpensesRes.values?.[0]?.total) || 0,
  });
}

export interface CustomerReceiptRow {
  id: string;
  reference: string | null;
  customerId: string;
  customerName: string;
  projectId?: string | undefined;
  amount: number;
  paidAt: string;
  method: string;
  accountId?: string | undefined;
  notes?: string | undefined;
}

/** Recorded customer collections, newest first. */
export async function getCustomerReceipts(limit = 100): Promise<CustomerReceiptRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT p.*, c.name AS customer_name
       FROM customer_payments p
       LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.cancelled_at IS NULL
      ORDER BY p.paid_at DESC, p.created_at DESC
      LIMIT ?`,
    [limit]
  );
  return (res.values ?? []).map((row: any) => ({
    id: String(row.id),
    reference: row.reference ?? null,
    customerId: String(row.customer_id),
    customerName: String(row.customer_name ?? "عميل محذوف"),
    projectId: row.project_id ?? undefined,
    amount: Number(row.amount) || 0,
    paidAt: String(row.paid_at ?? ""),
    method: String(row.method ?? "cash"),
    accountId: row.account_id ?? undefined,
    notes: row.notes ?? undefined,
  }));
}

export interface SupplierPaymentRow {
  id: string;
  reference: string | null;
  supplierId: string;
  supplierName: string;
  amount: number;
  paidAt: string;
  method: string;
  notes?: string | undefined;
}

export async function getSupplierPayments(limit = 100): Promise<SupplierPaymentRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT p.*, s.name AS supplier_name
       FROM supplier_payments p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.cancelled_at IS NULL
      ORDER BY p.paid_at DESC, p.created_at DESC
      LIMIT ?`,
    [limit]
  );
  return (res.values ?? []).map((row: any) => ({
    id: String(row.id),
    reference: row.reference ?? null,
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name ?? "مورد محذوف"),
    amount: Number(row.amount) || 0,
    paidAt: String(row.paid_at ?? ""),
    method: String(row.method ?? "cash"),
    notes: row.notes ?? undefined,
  }));
}

export interface OpenSalesInvoiceRow {
  id: string;
  reference: string;
  customerId: string | null;
  customerName: string;
  projectId: string | null;
  date: string;
  settlement: SettlementSummary;
}

/** Invoices still carrying an outstanding balance (§11.2 drill-down). */
export async function getOpenSalesInvoices(limit = 200): Promise<OpenSalesInvoiceRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT i.id, i.reference, i.serial, i.customer_id, i.party_name, i.project_id, i.date, i.total_amount,
            COALESCE(paid_agg.paid, 0) AS paid
       FROM custom_invoices i
       LEFT JOIN (
         SELECT a.invoice_id, SUM(a.amount) AS paid
           FROM customer_payment_allocations a
           JOIN customer_payments p ON p.id = a.payment_id
          WHERE p.cancelled_at IS NULL
          GROUP BY a.invoice_id
       ) paid_agg ON paid_agg.invoice_id = i.id
      WHERE i.type = 'sales' AND i.cancelled_at IS NULL
        AND (i.total_amount - COALESCE(paid_agg.paid, 0)) > 0.009
      ORDER BY i.date DESC, i.created_at DESC
      LIMIT ?`,
    [limit]
  );
  const rows: OpenSalesInvoiceRow[] = [];
  for (const row of res.values ?? []) {
    const total = Number(row.total_amount) || 0;
    const paid = Number(row.paid) || 0;
    const settlement = buildSettlement(total, paid);
    rows.push({
      id: String(row.id),
      reference: String(row.reference ?? row.serial ?? ""),
      customerId: row.customer_id ? String(row.customer_id) : null,
      customerName: String(row.party_name ?? ""),
      projectId: row.project_id ? String(row.project_id) : null,
      date: String(row.date ?? ""),
      settlement,
    });
  }
  return rows;
}

export type { LedgerEntry };
