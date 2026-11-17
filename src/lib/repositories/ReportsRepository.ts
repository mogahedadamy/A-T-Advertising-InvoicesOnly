/**
 * ═══════════════════════════════════════════════════════════════
 * Reports read model (PRD §11)
 * ═══════════════════════════════════════════════════════════════
 * Every figure is computed from the authoritative records at read time, and
 * each one can be drilled down to the transactions that produced it (§11.6).
 * Nothing here is cached, estimated or hardcoded (§12.10).
 *
 * Date filters compare the document's own business date, so a report for a
 * period shows the documents issued in that period.
 */

import { getDb } from "@/lib/database";
import { buildCompanyProfitability, buildSettlement, type CompanyProfitability, type SettlementSummary } from "@/lib/domain/finance";

export interface DateRange {
  from?: string | undefined; // inclusive YYYY-MM-DD
  to?: string | undefined; // inclusive YYYY-MM-DD
}

function rangeClause(range: DateRange, column: string): { sql: string; values: string[] } {
  const parts: string[] = [];
  const values: string[] = [];
  if (range.from) {
    parts.push(`${column} >= ?`);
    values.push(range.from);
  }
  if (range.to) {
    parts.push(`${column} <= ?`);
    values.push(range.to);
  }
  return { sql: parts.length ? ` AND ${parts.join(" AND ")}` : "", values };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// §11.1 Sales performance
// ═══════════════════════════════════════════════════════════════════════════

export interface SalesPerformance {
  invoiceCount: number;
  totalSales: number;
  totalDiscount: number;
  averageInvoice: number;
  byCustomer: { customerId: string | null; name: string; total: number; count: number }[];
  byProject: { projectId: string | null; title: string; total: number; count: number }[];
  invoices: SalesInvoiceRow[];
}

export interface SalesInvoiceRow {
  id: string;
  reference: string;
  date: string;
  customerName: string;
  projectId?: string | undefined;
  total: number;
  discount: number;
}

export async function getSalesPerformance(range: DateRange = {}): Promise<SalesPerformance> {
  const db = await getDb();
  const clause = rangeClause(range, "date");
  const res = await db.query(
    `SELECT id, reference, serial, date, party_name, customer_id, project_id, total_amount, discount
       FROM custom_invoices
      WHERE type = 'sales' AND cancelled_at IS NULL${clause.sql}
      ORDER BY date DESC, created_at DESC`,
    clause.values
  );

  const invoices: SalesInvoiceRow[] = (res.values ?? []).map((row: any) => ({
    id: String(row.id),
    reference: String(row.reference ?? row.serial ?? ""),
    date: String(row.date ?? ""),
    customerName: String(row.party_name ?? ""),
    projectId: row.project_id ?? undefined,
    total: num(row.total_amount),
    discount: num(row.discount),
  }));

  const totalSales = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalDiscount = invoices.reduce((sum, inv) => sum + inv.discount, 0);

  const customerMap = new Map<string, { customerId: string | null; name: string; total: number; count: number }>();
  for (const invoice of invoices) {
    const key = invoice.customerName || "غير محدد";
    const entry = customerMap.get(key) ?? { customerId: null, name: key, total: 0, count: 0 };
    entry.total = round2(entry.total + invoice.total);
    entry.count += 1;
    customerMap.set(key, entry);
  }

  const projectMap = new Map<string, { projectId: string | null; title: string; total: number; count: number }>();
  for (const invoice of invoices) {
    const key = invoice.projectId ?? "__none__";
    const entry = projectMap.get(key) ?? { projectId: invoice.projectId ?? null, title: invoice.projectId ?? "بلا مشروع", total: 0, count: 0 };
    entry.total = round2(entry.total + invoice.total);
    entry.count += 1;
    projectMap.set(key, entry);
  }

  // Resolve project titles in one query (no per-row lookups).
  const projectIds = Array.from(projectMap.keys()).filter((key) => key !== "__none__");
  if (projectIds.length > 0) {
    const placeholders = projectIds.map(() => "?").join(",");
    const projectsRes = await db.query(`SELECT id, reference, title FROM projects WHERE id IN (${placeholders})`, projectIds);
    for (const row of projectsRes.values ?? []) {
      const entry = projectMap.get(String(row.id));
      if (entry) entry.title = `${row.reference} · ${row.title}`;
    }
  }

  return {
    invoiceCount: invoices.length,
    totalSales: round2(totalSales),
    totalDiscount: round2(totalDiscount),
    averageInvoice: invoices.length ? round2(totalSales / invoices.length) : 0,
    byCustomer: Array.from(customerMap.values()).sort((a, b) => b.total - a.total),
    byProject: Array.from(projectMap.values()).sort((a, b) => b.total - a.total),
    invoices,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §11.2 Customer collections
// ═══════════════════════════════════════════════════════════════════════════

export interface CustomerCollectionsReport {
  collectedTotal: number;
  payments: { id: string; reference: string; date: string; customerName: string; amount: number; method: string; projectId?: string | undefined }[];
  openInvoices: { id: string; reference: string; customerName: string; date: string; dueDate?: string | undefined; settlement: SettlementSummary; overdue: boolean }[];
  outstandingTotal: number;
  overdueTotal: number;
}

export async function getCustomerCollectionsReport(
  range: DateRange = {},
  today = new Date().toISOString().slice(0, 10)
): Promise<CustomerCollectionsReport> {
  const db = await getDb();
  const clause = rangeClause(range, "p.paid_at");
  const paymentsRes = await db.query(
    `SELECT p.id, p.reference, p.paid_at, p.amount, p.method, p.project_id, c.name AS customer_name
       FROM customer_payments p
       LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.cancelled_at IS NULL${clause.sql}
      ORDER BY p.paid_at DESC`,
    clause.values
  );

  const payments = (paymentsRes.values ?? []).map((row: any) => ({
    id: String(row.id),
    reference: String(row.reference ?? ""),
    date: String(row.paid_at ?? ""),
    customerName: String(row.customer_name ?? "عميل محذوف"),
    amount: num(row.amount),
    method: String(row.method ?? "cash"),
    projectId: row.project_id ?? undefined,
  }));

  // Open invoices are not date-filtered: a balance is a current state, and the
  // report labels it as such instead of pretending it belongs to a period.
  // Pushed into SQL with LEFT JOIN to return ONLY invoices with genuine outstanding balances.
  const invoicesRes = await db.query(
    `SELECT i.id, i.reference, i.serial, i.party_name, i.date, i.due_date, i.total_amount,
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
      ORDER BY i.date DESC`
  );

  const openInvoices: CustomerCollectionsReport["openInvoices"] = [];
  let outstandingTotal = 0;
  let overdueTotal = 0;
  for (const row of invoicesRes.values ?? []) {
    const settlement = buildSettlement(num(row.total_amount), num(row.paid));
    if (settlement.outstanding <= 0) continue;
    const due = row.due_date || row.date;
    const overdue = Boolean(due && String(due) < today);
    outstandingTotal += settlement.outstanding;
    if (overdue) overdueTotal += settlement.outstanding;
    openInvoices.push({
      id: String(row.id),
      reference: String(row.reference ?? row.serial ?? ""),
      customerName: String(row.party_name ?? ""),
      date: String(row.date ?? ""),
      dueDate: row.due_date ?? undefined,
      settlement,
      overdue,
    });
  }

  return {
    collectedTotal: round2(payments.reduce((sum, p) => sum + p.amount, 0)),
    payments,
    openInvoices,
    outstandingTotal: round2(outstandingTotal),
    overdueTotal: round2(overdueTotal),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §11.3 Purchases & execution costs
// ═══════════════════════════════════════════════════════════════════════════

export interface PurchasesReport {
  purchaseCount: number;
  purchaseTotal: number;
  paidTotal: number;
  outstandingTotal: number;
  purchases: {
    id: string;
    reference: string;
    supplierName: string;
    supplierInvoiceNumber?: string | undefined;
    date: string;
    settlement: SettlementSummary;
  }[];
  supplierPayments: { id: string; reference: string; date: string; supplierName: string; amount: number }[];
  directExpenses: { id: string; date: string; beneficiary: string; category: string; amount: number; paid: number }[];
}

export async function getPurchasesReport(range: DateRange = {}): Promise<PurchasesReport> {
  const db = await getDb();
  const clause = rangeClause(range, "i.date");
  const purchasesRes = await db.query(
    `SELECT i.id, i.reference, i.serial, i.date, i.supplier_invoice_number, i.total_amount, s.name AS supplier_name
       FROM custom_invoices i
       LEFT JOIN suppliers s ON s.id = i.supplier_id
      WHERE i.type = 'purchase' AND i.cancelled_at IS NULL${clause.sql}
      ORDER BY i.date DESC`,
    clause.values
  );
  const paidRes = await db.query(
    `SELECT a.invoice_id AS invoice_id, COALESCE(SUM(a.amount), 0) AS paid
       FROM supplier_payment_allocations a
       JOIN supplier_payments p ON p.id = a.payment_id
      WHERE p.cancelled_at IS NULL
      GROUP BY a.invoice_id`
  );
  const paidMap: Record<string, number> = {};
  for (const row of paidRes.values ?? []) paidMap[String(row.invoice_id)] = num(row.paid);

  const purchases: PurchasesReport["purchases"] = [];
  let purchaseTotal = 0;
  let paidTotal = 0;
  for (const row of purchasesRes.values ?? []) {
    const settlement = buildSettlement(num(row.total_amount), paidMap[String(row.id)] ?? 0);
    purchaseTotal += settlement.total;
    paidTotal += settlement.paid;
    purchases.push({
      id: String(row.id),
      reference: String(row.reference ?? row.serial ?? ""),
      supplierName: String(row.supplier_name ?? "مورد غير محدد"),
      supplierInvoiceNumber: row.supplier_invoice_number ?? undefined,
      date: String(row.date ?? ""),
      settlement,
    });
  }

  const paymentsClause = rangeClause(range, "p.paid_at");
  const paymentsRes = await db.query(
    `SELECT p.id, p.reference, p.paid_at, p.amount, s.name AS supplier_name
       FROM supplier_payments p
       LEFT JOIN suppliers s ON s.id = p.supplier_id
      WHERE p.cancelled_at IS NULL${paymentsClause.sql}
      ORDER BY p.paid_at DESC`,
    paymentsClause.values
  );
  const supplierPayments = (paymentsRes.values ?? []).map((row: any) => ({
    id: String(row.id),
    reference: String(row.reference ?? ""),
    date: String(row.paid_at ?? ""),
    supplierName: String(row.supplier_name ?? "مورد محذوف"),
    amount: num(row.amount),
  }));

  const expensesClause = rangeClause(range, "e.expense_date");
  const expensesRes = await db.query(
    `SELECT e.id, e.expense_date, e.beneficiary, e.category, e.amount,
            COALESCE((SELECT SUM(p.amount) FROM expense_payments p WHERE p.expense_id = e.id AND p.cancelled_at IS NULL), 0) AS paid
       FROM expenses e
      WHERE e.kind = 'direct' AND e.cancelled_at IS NULL${expensesClause.sql}
      ORDER BY e.expense_date DESC`,
    expensesClause.values
  );
  const directExpenses = (expensesRes.values ?? []).map((row: any) => ({
    id: String(row.id),
    date: String(row.expense_date ?? ""),
    beneficiary: String(row.beneficiary ?? ""),
    category: String(row.category ?? ""),
    amount: num(row.amount),
    paid: num(row.paid),
  }));

  return {
    purchaseCount: purchases.length,
    purchaseTotal: round2(purchaseTotal),
    paidTotal: round2(paidTotal),
    outstandingTotal: round2(Math.max(0, purchaseTotal - paidTotal)),
    purchases,
    supplierPayments,
    directExpenses,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// §11.4 Financial performance
// ═══════════════════════════════════════════════════════════════════════════

export interface FinancialPerformanceReport extends CompanyProfitability {
  liquidity: number;
  receiptsTotal: number;
  paymentsTotal: number;
  /** تفصيل المصروفات التشغيلية (القيمة الإجمالية في الحقل الموروث operatingExpenses) */
  operatingExpenseRows: { id: string; date: string; beneficiary: string; amount: number; paid: number }[];
  unreliableProjects: { projectId: string; reference: string; title: string; missing: string[] }[];
}

export async function getFinancialPerformanceReport(range: DateRange = {}): Promise<FinancialPerformanceReport> {
  const db = await getDb();

  const salesClause = rangeClause(range, "date");
  const salesRes = await db.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total FROM custom_invoices WHERE type = 'sales' AND cancelled_at IS NULL${salesClause.sql}`,
    salesClause.values
  );
  const purchaseClause = rangeClause(range, "date");
  const purchasesRes = await db.query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total FROM custom_invoices WHERE type = 'purchase' AND cancelled_at IS NULL${purchaseClause.sql}`,
    purchaseClause.values
  );
  const expenseClause = rangeClause(range, "expense_date");
  const directExpensesRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE kind = 'direct' AND cancelled_at IS NULL${expenseClause.sql}`,
    expenseClause.values
  );
  const operatingRes = await db.query(
    `SELECT id, expense_date, beneficiary, amount,
            COALESCE((SELECT SUM(p.amount) FROM expense_payments p WHERE p.expense_id = e.id AND p.cancelled_at IS NULL), 0) AS paid
       FROM expenses e
      WHERE e.kind = 'operating' AND e.cancelled_at IS NULL${expenseClause.sql}
      ORDER BY e.expense_date DESC`,
    expenseClause.values
  );

  const profitability = buildCompanyProfitability({
    revenue: num(salesRes.values?.[0]?.total),
    directCosts: num(purchasesRes.values?.[0]?.total) + num(directExpensesRes.values?.[0]?.total),
    operatingExpenses: (operatingRes.values ?? []).reduce((sum: number, row: any) => sum + num(row.amount), 0),
  });

  const { getCashSummary } = await import("@/lib/repositories/LedgerRepository");
  const cash = await getCashSummary();

  // Projects whose reported margin is incomplete (§9.6) — surfaced, not hidden.
  const { getAllProjectSummaries } = await import("@/lib/repositories/ProjectRepository");
  const projectSummaries = await getAllProjectSummaries();
  const unreliableProjects: FinancialPerformanceReport["unreliableProjects"] = projectSummaries
    .filter((entry) => !entry.summary.isComplete)
    .map((entry) => ({
      projectId: entry.id,
      reference: entry.reference,
      title: entry.title,
      missing: entry.summary.completenessNotes,
    }));

  return {
    ...profitability,
    liquidity: cash.liquidity,
    receiptsTotal: cash.receipts,
    paymentsTotal: cash.payments,
    operatingExpenseRows: (operatingRes.values ?? []).map((row: any) => ({
      id: String(row.id),
      date: String(row.expense_date ?? ""),
      beneficiary: String(row.beneficiary ?? ""),
      amount: num(row.amount),
      paid: num(row.paid),
    })),
    unreliableProjects,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Report A — Project profitability (§11.5 A) with drill-down
// ═══════════════════════════════════════════════════════════════════════════

export interface ProjectProfitabilityRow {
  projectId: string;
  reference: string;
  title: string;
  customerName: string;
  revenue: number;
  directCosts: number;
  margin: number;
  collected: number;
  outstanding: number;
  supplierOutstanding: number;
  isComplete: boolean;
  missing: string[];
}

export async function getProjectProfitabilityReport(range: DateRange = {}): Promise<ProjectProfitabilityRow[]> {
  const db = await getDb();
  const clause = rangeClause(range, "created_at");
  const projectsRes = await db.query(
    `SELECT p.id, p.reference, p.title, p.created_at, c.name AS customer_name
       FROM projects p
       LEFT JOIN customers c ON c.id = p.customer_id
      WHERE p.cancelled_at IS NULL${clause.sql}
      ORDER BY p.reference DESC`,
    clause.values
  );

  // One batched aggregation instead of a query per project (no N+1).
  const { getAllProjectSummaries } = await import("@/lib/repositories/ProjectRepository");
  const summaries = await getAllProjectSummaries();
  const customerByProject = new Map<string, string>();
  for (const row of projectsRes.values ?? []) {
    customerByProject.set(String(row.id), String(row.customer_name ?? "—"));
  }
  const inRange = new Set((projectsRes.values ?? []).map((row: any) => String(row.id)));

  return summaries
    .filter((entry) => inRange.has(entry.id))
    .map((entry) => ({
      projectId: entry.id,
      reference: entry.reference,
      title: entry.title,
      customerName: customerByProject.get(entry.id) ?? "—",
      revenue: entry.summary.invoicedAmount,
      directCosts: entry.summary.directCosts,
      margin: entry.summary.margin,
      collected: entry.summary.collectedAmount,
      outstanding: entry.summary.customerOutstanding,
      supplierOutstanding: entry.summary.supplierOutstanding,
      isComplete: entry.summary.isComplete,
      missing: entry.summary.completenessNotes,
    }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Report B — Customer statement (§11.5 B)
// ═══════════════════════════════════════════════════════════════════════════

export interface StatementLine {
  kind: "invoice" | "receipt";
  id: string;
  reference: string;
  date: string;
  label: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export interface CustomerStatement {
  customerId: string;
  customerName: string;
  lines: StatementLine[];
  totalInvoiced: number;
  totalCollected: number;
  outstanding: number;
}

export async function getCustomerStatement(customerId: string, range: DateRange = {}): Promise<CustomerStatement> {
  const db = await getDb();
  const customerRes = await db.query("SELECT name FROM customers WHERE id = ? LIMIT 1", [customerId]);
  const customerName = String(customerRes.values?.[0]?.name ?? "عميل");

  const invoiceClause = rangeClause(range, "i.date");
  const invoicesRes = await db.query(
    `SELECT i.id, i.reference, i.serial, i.date, i.total_amount
       FROM custom_invoices i
      WHERE i.type = 'sales' AND i.cancelled_at IS NULL AND (i.customer_id = ? OR i.party_name = ?)${invoiceClause.sql}
      ORDER BY i.date ASC, i.created_at ASC`,
    [customerId, customerName, ...invoiceClause.values]
  );
  const paymentClause = rangeClause(range, "p.paid_at");
  const paymentsRes = await db.query(
    `SELECT p.id, p.reference, p.paid_at, p.amount, p.method
       FROM customer_payments p
      WHERE p.cancelled_at IS NULL AND p.customer_id = ?${paymentClause.sql}
      ORDER BY p.paid_at ASC, p.created_at ASC`,
    [customerId, ...paymentClause.values]
  );

  const events: { date: string; order: number; line: Omit<StatementLine, "runningBalance"> }[] = [];
  for (const row of invoicesRes.values ?? []) {
    events.push({
      date: String(row.date ?? ""),
      order: 0,
      line: {
        kind: "invoice",
        id: String(row.id),
        reference: String(row.reference ?? row.serial ?? ""),
        date: String(row.date ?? ""),
        label: "فاتورة مبيعات",
        debit: num(row.total_amount),
        credit: 0,
      },
    });
  }
  for (const row of paymentsRes.values ?? []) {
    events.push({
      date: String(row.paid_at ?? ""),
      order: 1,
      line: {
        kind: "receipt",
        id: String(row.id),
        reference: String(row.reference ?? ""),
        date: String(row.paid_at ?? ""),
        label: `تحصيل (${row.method ?? "cash"})`,
        debit: 0,
        credit: num(row.amount),
      },
    });
  }

  events.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));

  let running = 0;
  const lines: StatementLine[] = [];
  for (const event of events) {
    running += event.line.debit - event.line.credit;
    lines.push({ ...event.line, runningBalance: round2(running) });
  }

  const totalInvoiced = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCollected = lines.reduce((sum, line) => sum + line.credit, 0);

  return {
    customerId,
    customerName,
    lines,
    totalInvoiced: round2(totalInvoiced),
    totalCollected: round2(totalCollected),
    outstanding: round2(Math.max(0, totalInvoiced - totalCollected)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Report C — Supplier statement (§11.5 C)
// ═══════════════════════════════════════════════════════════════════════════

export interface SupplierStatement {
  supplierId: string;
  supplierName: string;
  lines: StatementLine[];
  totalPurchased: number;
  totalPaid: number;
  outstanding: number;
}

export async function getSupplierStatement(supplierId: string, range: DateRange = {}): Promise<SupplierStatement> {
  const db = await getDb();
  const supplierRes = await db.query("SELECT name FROM suppliers WHERE id = ? LIMIT 1", [supplierId]);
  const supplierName = String(supplierRes.values?.[0]?.name ?? "مورد");

  const invoiceClause = rangeClause(range, "date");
  const invoicesRes = await db.query(
    `SELECT id, reference, serial, date, total_amount
       FROM custom_invoices
      WHERE type = 'purchase' AND cancelled_at IS NULL AND supplier_id = ?${invoiceClause.sql}
      ORDER BY date ASC, created_at ASC`,
    [supplierId, ...invoiceClause.values]
  );
  const paymentClause = rangeClause(range, "p.paid_at");
  const paymentsRes = await db.query(
    `SELECT p.id, p.reference, p.paid_at, p.amount, p.method
       FROM supplier_payments p
      WHERE p.cancelled_at IS NULL AND p.supplier_id = ?${paymentClause.sql}
      ORDER BY p.paid_at ASC, p.created_at ASC`,
    [supplierId, ...paymentClause.values]
  );

  const events: { date: string; order: number; line: Omit<StatementLine, "runningBalance"> }[] = [];
  for (const row of invoicesRes.values ?? []) {
    events.push({
      date: String(row.date ?? ""),
      order: 0,
      line: {
        kind: "invoice",
        id: String(row.id),
        reference: String(row.reference ?? row.serial ?? ""),
        date: String(row.date ?? ""),
        label: "فاتورة شراء",
        debit: 0,
        credit: num(row.total_amount),
      },
    });
  }
  for (const row of paymentsRes.values ?? []) {
    events.push({
      date: String(row.paid_at ?? ""),
      order: 1,
      line: {
        kind: "receipt",
        id: String(row.id),
        reference: String(row.reference ?? ""),
        date: String(row.paid_at ?? ""),
        label: "سداد للمورد",
        debit: num(row.amount),
        credit: 0,
      },
    });
  }

  events.sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1));

  let running = 0;
  const lines: StatementLine[] = [];
  for (const event of events) {
    running += event.line.credit - event.line.debit;
    lines.push({ ...event.line, runningBalance: round2(running) });
  }

  const totalPurchased = lines.reduce((sum, line) => sum + line.credit, 0);
  const totalPaid = lines.reduce((sum, line) => sum + line.debit, 0);

  return {
    supplierId,
    supplierName,
    lines,
    totalPurchased: round2(totalPurchased),
    totalPaid: round2(totalPaid),
    outstanding: round2(Math.max(0, totalPurchased - totalPaid)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Report D — Cash movement (§11.5 D) and E — incomplete projects (§11.5 E)
// ═══════════════════════════════════════════════════════════════════════════

export interface CashMovementLine {
  id: string;
  kind: string;
  date: string;
  accountName: string;
  reference?: string | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  inflow: number;
  outflow: number;
  reversed: boolean;
}

export interface CashMovementReport {
  lines: CashMovementLine[];
  totalInflow: number;
  totalOutflow: number;
  net: number;
}

export async function getCashMovementReport(range: DateRange = {}): Promise<CashMovementReport> {
  const db = await getDb();
  const clause = rangeClause(range, "t.occurred_at");
  const res = await db.query(
    `SELECT t.id, t.kind, t.occurred_at, t.amount, t.reference_note, t.source_type, t.source_id, t.reversed_by,
            a.name AS account_name
       FROM financial_transactions t
       LEFT JOIN financial_accounts a ON a.id = t.account_id
      WHERE 1 = 1${clause.sql}
      ORDER BY t.occurred_at DESC, t.created_at DESC`,
    clause.values
  );

  const lines: CashMovementLine[] = (res.values ?? []).map((row: any) => {
    const inflow = row.kind === "receipt" || row.kind === "transfer_in";
    const amount = num(row.amount);
    return {
      id: String(row.id),
      kind: String(row.kind),
      date: String(row.occurred_at ?? ""),
      accountName: String(row.account_name ?? "حساب محذوف"),
      reference: row.reference_note ?? undefined,
      sourceType: row.source_type ?? undefined,
      sourceId: row.source_id ?? undefined,
      inflow: inflow ? amount : 0,
      outflow: inflow ? 0 : amount,
      reversed: Boolean(row.reversed_by),
    };
  });

  const active = lines.filter((line) => !line.reversed);
  const totalInflow = active.reduce((sum, line) => sum + line.inflow, 0);
  const totalOutflow = active.reduce((sum, line) => sum + line.outflow, 0);

  return { lines, totalInflow: round2(totalInflow), totalOutflow: round2(totalOutflow), net: round2(totalInflow - totalOutflow) };
}

export interface IncompleteProjectRow {
  projectId: string;
  reference: string;
  title: string;
  executionStatus: string;
  customerOutstanding: number;
  supplierOutstanding: number;
  missing: string[];
}

/** Report E — projects with execution started but money still open (§11.5 E). */
export async function getIncompleteProjectsReport(): Promise<IncompleteProjectRow[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT id, reference, title, execution_status FROM projects WHERE cancelled_at IS NULL ORDER BY reference DESC`
  );
  const { getAllProjectSummaries } = await import("@/lib/repositories/ProjectRepository");
  const summaries = await getAllProjectSummaries();
  const statusByProject = new Map<string, string>();
  for (const row of res.values ?? []) {
    statusByProject.set(String(row.id), String(row.execution_status ?? "new"));
  }

  return summaries
    .filter((entry) => statusByProject.has(entry.id))
    .filter(
      (entry) =>
        entry.summary.customerOutstanding > 0.009 ||
        entry.summary.supplierOutstanding > 0.009 ||
        !entry.summary.isComplete
    )
    .map((entry) => ({
      projectId: entry.id,
      reference: entry.reference,
      title: entry.title,
      executionStatus: statusByProject.get(entry.id) ?? "new",
      customerOutstanding: entry.summary.customerOutstanding,
      supplierOutstanding: entry.summary.supplierOutstanding,
      missing: entry.summary.completenessNotes,
    }));
}
