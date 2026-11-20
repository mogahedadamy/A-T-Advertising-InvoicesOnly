/**
 * ═══════════════════════════════════════════════════════════════
 * Customer Repository — SQLite CRUD & Financial Read Model
 * ═══════════════════════════════════════════════════════════════
 * Authoritative customer records, multi-currency financial balance
 * computation, deletion safety guards, archiving, and live invoice ledger.
 */

import { getDb } from "@/lib/database";
import { withDbWriteLock } from "@/lib/database/writeLock";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { normalizeCustomerName } from "@/lib/customers/customerMatching";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import type { CustomerRecord, CustomerType } from "@/lib/customersStore";
import type { CustomInvoice } from "@/lib/billing/types";
import { buildSettlement, type SettlementSummary } from "@/lib/domain/finance";

function round2(v: number): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}

export function rowToCustomer(row: any): CustomerRecord {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    phone: row.phone || "",
    type: (row.type as CustomerType) || "individual",
    address: row.address || "",
    notes: row.notes || undefined,
    totalOrders: Number(row.total_orders) || 0,
    totalSpent: Number(row.total_spent) || 0,
    balance: Number(row.balance) || 0,
    createdAt: String(row.created_at || new Date().toISOString()),
    isArchived: Boolean(row.is_archived === 1 || row.is_archived === true),
    openingBalance: Number(row.opening_balance) || 0,
    openingBalanceCurrency: row.opening_balance_currency || "SDG",
    openingBalanceDate: row.opening_balance_date || undefined,
    openingBalanceType: (row.opening_balance_type as "debit" | "credit") || "debit",
    openingBalanceNotes: row.opening_balance_notes || undefined,
  };
}

export async function getAllCustomers(options: { includeArchived?: boolean } = {}): Promise<CustomerRecord[]> {
  const db = await getDb();
  const sql = options.includeArchived
    ? "SELECT * FROM customers ORDER BY name ASC"
    : "SELECT * FROM customers WHERE is_archived IS NULL OR is_archived = 0 ORDER BY name ASC";
  const res = await db.query(sql);
  return (res.values || []).map(rowToCustomer);
}

export async function getCustomerById(id: string): Promise<CustomerRecord | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
  const row = res.values?.[0];
  return row ? rowToCustomer(row) : undefined;
}

export async function upsertCustomer(customer: CustomerRecord): Promise<void> {
  const db = await getDb();
  const isArchivedInt = customer.isArchived ? 1 : 0;
  const openingBalance = Number(customer.openingBalance) || 0;
  const openingBalCurrency = customer.openingBalanceCurrency || "SDG";
  const openingBalDate = customer.openingBalanceDate || null;
  const openingBalType = customer.openingBalanceType || "debit";
  const openingBalNotes = customer.openingBalanceNotes || null;

  try {
    await db.run(
      `INSERT INTO customers
        (id, name, phone, type, address, notes,
         total_orders, total_spent, balance, created_at,
         is_archived, opening_balance, opening_balance_currency,
         opening_balance_date, opening_balance_type, opening_balance_notes)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name                     = excluded.name,
         phone                    = excluded.phone,
         type                     = excluded.type,
         address                  = excluded.address,
         notes                    = excluded.notes,
         total_orders             = excluded.total_orders,
         total_spent              = excluded.total_spent,
         balance                  = excluded.balance,
         is_archived              = excluded.is_archived,
         opening_balance          = excluded.opening_balance,
         opening_balance_currency = excluded.opening_balance_currency,
         opening_balance_date     = excluded.opening_balance_date,
         opening_balance_type     = excluded.opening_balance_type,
         opening_balance_notes    = excluded.opening_balance_notes`,
      [
        customer.id,
        customer.name,
        customer.phone || null,
        customer.type,
        customer.address || null,
        customer.notes || null,
        customer.totalOrders || 0,
        customer.totalSpent || 0,
        customer.balance || 0,
        customer.createdAt,
        isArchivedInt,
        openingBalance,
        openingBalCurrency,
        openingBalDate,
        openingBalType,
        openingBalNotes,
      ]
    );
  } catch (err) {
    // Graceful fallback for environments before migration v5 executed
    await db.run(
      `INSERT INTO customers
        (id, name, phone, type, address, notes,
         total_orders, total_spent, balance, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         name         = excluded.name,
         phone        = excluded.phone,
         type         = excluded.type,
         address      = excluded.address,
         notes        = excluded.notes,
         total_orders = excluded.total_orders,
         total_spent  = excluded.total_spent,
         balance      = excluded.balance`,
      [
        customer.id,
        customer.name,
        customer.phone || null,
        customer.type,
        customer.address || null,
        customer.notes || null,
        customer.totalOrders || 0,
        customer.totalSpent || 0,
        customer.balance || 0,
        customer.createdAt,
      ]
    );
  }

  // Safe reconciliation: link any unlinked invoices matching this customer's name
  await reconcileCustomerInvoices(customer.id, customer.name);

  notifyDataChanged();
}

/**
 * Checks if a customer can be safely deleted permanently.
 * STRICT SAFETY RULE: Deletion is forbidden if the customer has ANY historical
 * transactions (invoices or payments) even if their balance is zero.
 */
export async function canDeleteCustomer(customerId: string): Promise<{
  allowed: boolean;
  reason?: string;
  invoiceCount: number;
  paymentCount: number;
}> {
  const db = await getDb();

  const invRes = await db.query(
    "SELECT COUNT(*) AS c FROM custom_invoices WHERE customer_id = ?",
    [customerId]
  );
  const invoiceCount = Number(invRes.values?.[0]?.c) || 0;

  const payRes = await db.query(
    "SELECT COUNT(*) AS c FROM customer_payments WHERE customer_id = ?",
    [customerId]
  );
  const paymentCount = Number(payRes.values?.[0]?.c) || 0;

  if (invoiceCount > 0 || paymentCount > 0) {
    return {
      allowed: false,
      reason: `لا يمكن حذف هذا العميل لوجود معاملات مالية وتاريخية مسجلة (${invoiceCount} فاتورة، ${paymentCount} دفعة/تحصيل). يُرجى استخدام الأرشفة بدلاً من الحذف للحفاظ على السجلات التاريخية.`,
      invoiceCount,
      paymentCount,
    };
  }

  return {
    allowed: true,
    invoiceCount: 0,
    paymentCount: 0,
  };
}

export async function archiveCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE customers SET is_archived = 1 WHERE id = ?", [id]);
  await appendAuditEntry({
    entityType: "customer",
    entityId: id,
    action: "archive",
    reason: "User archived customer profile",
  });
  notifyDataChanged();
}

export async function unarchiveCustomer(id: string): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE customers SET is_archived = 0 WHERE id = ?", [id]);
  await appendAuditEntry({
    entityType: "customer",
    entityId: id,
    action: "unarchive",
    reason: "User restored customer from archive",
  });
  notifyDataChanged();
}

/**
 * Permanently deletes a customer ONLY if they have zero historical transactions.
 * Throws a descriptive error if transactions exist to preserve data integrity.
 */
export async function deleteCustomer(id: string): Promise<void> {
  const check = await canDeleteCustomer(id);
  if (!check.allowed) {
    throw new Error(check.reason);
  }
  const db = await getDb();
  await db.run("DELETE FROM customers WHERE id = ?", [id]);
  await appendAuditEntry({
    entityType: "customer",
    entityId: id,
    action: "delete",
    reason: "Permanent deletion of transaction-free customer",
  });
  notifyDataChanged();
}

/**
 * Reconciles unlinked invoices having party_name normalized-identical to customer.name
 */
export async function reconcileCustomerInvoices(customerId: string, customerName: string): Promise<number> {
  const normTarget = normalizeCustomerName(customerName);
  if (!normTarget) return 0;
  const db = await getDb();
  try {
    const res = await db.query(
      `SELECT id, party_name FROM custom_invoices
        WHERE customer_id IS NULL
          AND type IN ('sales', 'proforma')
          AND cancelled_at IS NULL
          AND TRIM(COALESCE(party_name, '')) <> ''`
    );
    const matched = (res.values || []).filter(
      (r: any) => normalizeCustomerName(String(r.party_name || "")) === normTarget
    );
    for (const r of matched) {
      await db.run("UPDATE custom_invoices SET customer_id = ? WHERE id = ?", [customerId, r.id]);
    }
    return matched.length;
  } catch {
    return 0;
  }
}

/**
 * Links a previously unlinked walk-in custom invoice to an authoritative customer record.
 */
export async function linkUnlinkedInvoiceToCustomer(invoiceId: string, customerId: string): Promise<void> {
  await withDbWriteLock(async () => {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.run(
      `UPDATE custom_invoices
          SET customer_id = ?, updated_at = ?
        WHERE id = ? AND cancelled_at IS NULL AND (customer_id IS NULL OR customer_id = '')`,
      [customerId, now, invoiceId]
    );
    await appendAuditEntry({
      entityType: "custom_invoice",
      entityId: invoiceId,
      action: "update",
      details: { customerId, linkedWalkIn: true },
      nowIso: now,
    });
    notifyDataChanged();
  });
}

export interface CurrencyFinancialSummary {
  currency: string;
  totalInvoiced: number;       // إجمالي قيمة الفواتير
  totalPaid: number;           // إجمالي المبالغ المدفوعة
  outstanding: number;         // إجمالي المبالغ المستحقة على العميل
  advanceCredit: number;       // إجمالي الأرصدة المقدمة أو الدائنة
  totalInvoicesCount: number;  // عدد الفواتير الكلي
  paidInvoicesCount: number;   // عدد الفواتير المسددة بالكامل
  partialInvoicesCount: number;// عدد الفواتير المسددة جزئياً
  unpaidInvoicesCount: number; // عدد الفواتير غير المسددة
  overdueInvoicesCount: number;// عدد الفواتير المتأخرة
}

export interface CustomerFinancialProfile {
  customerId: string;
  customerName: string;
  summariesByCurrency: Record<string, CurrencyFinancialSummary>;
  primaryCurrency: string;
  status: "regular" | "debtor" | "advance_credit" | "overdue";
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  lastTransactionDate?: string;
  totalInvoicesCount: number;
  totalPaidAllCurrencies: number;
  totalOutstandingAllCurrencies: number;
}

/**
 * Computes the customer's real-time financial profile and balances
 * separated strictly by currency, derived from actual invoices, payments,
 * allocations, and opening movements.
 */
export async function getCustomerFinancialSummary(customerId: string): Promise<CustomerFinancialProfile> {
  const db = await getDb();
  const customer = await getCustomerById(customerId);
  const customerName = customer?.name || "";
  const today = getLocalIsoDate();

  // 1. Fetch all active sales invoices for this customer
  const invoicesRes = await db.query(
    `SELECT i.id, i.total_amount, i.currency, i.date, i.due_date,
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
        AND (i.customer_id = ? OR (i.customer_id IS NULL AND LOWER(TRIM(i.party_name)) = LOWER(TRIM(?))))
      ORDER BY i.date DESC`,
    [customerId, customerName]
  );
  const invoices = invoicesRes.values || [];

  // 2. Fetch all payments for this customer
  const paymentsRes = await db.query(
    `SELECT p.id, p.amount, COALESCE(p.currency, 'SDG') AS currency, p.paid_at,
            COALESCE(alloc_agg.allocated, 0) AS allocated
       FROM customer_payments p
       LEFT JOIN (
         SELECT a.payment_id, SUM(a.amount) AS allocated
           FROM customer_payment_allocations a
           JOIN custom_invoices i ON i.id = a.invoice_id
          WHERE i.cancelled_at IS NULL
          GROUP BY a.payment_id
       ) alloc_agg ON alloc_agg.payment_id = p.id
      WHERE p.customer_id = ? AND p.cancelled_at IS NULL
      ORDER BY p.paid_at DESC`,
    [customerId]
  );
  const payments = paymentsRes.values || [];

  // 3. Group by currency
  const currenciesSet = new Set<string>(["SDG"]);
  if (customer?.openingBalanceCurrency) currenciesSet.add(customer.openingBalanceCurrency);
  for (const inv of invoices) {
    if (inv.currency) currenciesSet.add(String(inv.currency));
  }
  for (const pay of payments) {
    if (pay.currency) currenciesSet.add(String(pay.currency));
  }

  const summariesByCurrency: Record<string, CurrencyFinancialSummary> = {};
  let lastTransactionDate: string | undefined;

  for (const cur of currenciesSet) {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalInvoicesCount = 0;
    let paidInvoicesCount = 0;
    let partialInvoicesCount = 0;
    let unpaidInvoicesCount = 0;
    let overdueInvoicesCount = 0;

    const curInvoices = invoices.filter((i) => (i.currency || "SDG") === cur);
    for (const inv of curInvoices) {
      const invTotal = Number(inv.total_amount) || 0;
      const invPaid = Number(inv.paid) || 0;
      const remaining = Math.max(0, invTotal - invPaid);
      const isOverdue = remaining > 0.009 && inv.due_date && String(inv.due_date) < today;

      totalInvoiced += invTotal;
      totalInvoicesCount++;

      if (invPaid >= invTotal - 0.009) {
        paidInvoicesCount++;
      } else if (invPaid > 0.009) {
        partialInvoicesCount++;
        if (isOverdue) overdueInvoicesCount++;
      } else {
        unpaidInvoicesCount++;
        if (isOverdue) overdueInvoicesCount++;
      }

      if (!lastTransactionDate || (inv.date && String(inv.date) > lastTransactionDate)) {
        lastTransactionDate = String(inv.date);
      }
    }

    const curPayments = payments.filter((p) => (p.currency || "SDG") === cur);
    let totalPaymentsAmount = 0;
    let totalAllocatedAmount = 0;
    for (const pay of curPayments) {
      totalPaymentsAmount += Number(pay.amount) || 0;
      totalAllocatedAmount += Number(pay.allocated) || 0;
      if (!lastTransactionDate || (pay.paid_at && String(pay.paid_at) > lastTransactionDate)) {
        lastTransactionDate = String(pay.paid_at);
      }
    }
    totalPaid = totalPaymentsAmount;

    // Opening balance contribution
    let openingDebit = 0;
    let openingCredit = 0;
    if (customer && (customer.openingBalanceCurrency || "SDG") === cur && customer.openingBalance) {
      if (customer.openingBalanceType === "credit") {
        openingCredit = customer.openingBalance;
      } else {
        openingDebit = customer.openingBalance;
      }
    }

    const netOwed = Math.max(0, totalInvoiced + openingDebit - totalAllocatedAmount);
    const unallocatedCash = Math.max(0, totalPaymentsAmount - totalAllocatedAmount);
    const availableCredit = unallocatedCash + openingCredit;
    const outstanding = round2(Math.max(0, netOwed - availableCredit));
    const advanceCredit = round2(Math.max(0, availableCredit - netOwed));

    summariesByCurrency[cur] = {
      currency: cur,
      totalInvoiced: round2(totalInvoiced + openingDebit),
      totalPaid: round2(totalPaid),
      outstanding,
      advanceCredit,
      totalInvoicesCount,
      paidInvoicesCount,
      partialInvoicesCount,
      unpaidInvoicesCount,
      overdueInvoicesCount,
    };
  }

  // Determine overall status across currencies
  let hasOverdue = false;
  let hasOutstanding = false;
  let hasCredit = false;
  let totalPaidAllCurrencies = 0;
  let totalOutstandingAllCurrencies = 0;

  for (const s of Object.values(summariesByCurrency)) {
    if (s.overdueInvoicesCount > 0) hasOverdue = true;
    if (s.outstanding > 0.009) hasOutstanding = true;
    if (s.advanceCredit > 0.009) hasCredit = true;
    totalPaidAllCurrencies += s.totalPaid;
    totalOutstandingAllCurrencies += s.outstanding;
  }

  let status: CustomerFinancialProfile["status"] = "regular";
  let statusLabel = "عميل منتظم";
  let statusColor = "text-emerald-600 dark:text-emerald-400";
  let statusBg = "bg-emerald-500/10 border-emerald-500/20";

  if (hasOverdue) {
    status = "overdue";
    statusLabel = "فواتير متأخرة";
    statusColor = "text-rose-600 dark:text-rose-400";
    statusBg = "bg-rose-500/10 border-rose-500/20";
  } else if (hasOutstanding) {
    status = "debtor";
    statusLabel = "عميل مدين";
    statusColor = "text-amber-600 dark:text-amber-400";
    statusBg = "bg-amber-500/10 border-amber-500/20";
  } else if (hasCredit) {
    status = "advance_credit";
    statusLabel = "رصيد مقدم";
    statusColor = "text-blue-600 dark:text-blue-400";
    statusBg = "bg-blue-500/10 border-blue-500/20";
  }

  return {
    customerId,
    customerName,
    summariesByCurrency,
    primaryCurrency: customer?.openingBalanceCurrency || "SDG",
    status,
    statusLabel,
    statusColor,
    statusBg,
    lastTransactionDate,
    totalInvoicesCount: invoices.length,
    totalPaidAllCurrencies: round2(totalPaidAllCurrencies),
    totalOutstandingAllCurrencies: round2(totalOutstandingAllCurrencies),
  };
}

export interface CustomerInvoiceItemRow {
  id: string;
  reference?: string;
  serial: string;
  date: string;
  dueDate?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  currency: string;
  status: "paid" | "partial" | "unpaid" | "overdue";
  statusLabel: string;
  statusBadgeColor: string;
  notes?: string;
}

/**
 * Batched, high-performance aggregation of financial figures for all customers
 * (PRD & Customer Module): enables zero-latency lists without N+1 roundtrips.
 */
export async function getAllCustomerFinancialSummaries(): Promise<
  Record<
    string,
    {
      outstanding: number;
      invoiced: number;
      collected: number;
      overdueCount: number;
    }
  >
> {
  const db = await getDb();
  const today = getLocalIsoDate();

  const invRes = await db.query(
    `SELECT i.customer_id,
            COALESCE(SUM(i.total_amount), 0) AS total_invoiced,
            COALESCE(SUM(COALESCE(paid_agg.paid, 0)), 0) AS total_paid,
            COALESCE(SUM(CASE WHEN (i.total_amount - COALESCE(paid_agg.paid, 0)) > 0.009 AND COALESCE(i.due_date, i.date) < ? THEN 1 ELSE 0 END), 0) AS overdue_count
       FROM custom_invoices i
       LEFT JOIN (
         SELECT a.invoice_id, SUM(a.amount) AS paid
           FROM customer_payment_allocations a
           JOIN customer_payments p ON p.id = a.payment_id
          WHERE p.cancelled_at IS NULL
          GROUP BY a.invoice_id
       ) paid_agg ON paid_agg.invoice_id = i.id
      WHERE i.type = 'sales' AND i.cancelled_at IS NULL AND i.customer_id IS NOT NULL
      GROUP BY i.customer_id`,
    [today]
  );

  const payRes = await db.query(
    `SELECT customer_id, COALESCE(SUM(amount), 0) AS total_collected
       FROM customer_payments
      WHERE cancelled_at IS NULL
      GROUP BY customer_id`
  );

  const payMap = new Map<string, number>();
  for (const r of payRes.values || []) {
    if (r.customer_id) payMap.set(String(r.customer_id), Number(r.total_collected) || 0);
  }

  const custRes = await db.query(
    "SELECT id, name, opening_balance, opening_balance_type FROM customers"
  );
  const custMap = new Map<string, { opening: number; type: string }>();
  const nameToCustomerId = new Map<string, string>();
  for (const c of custRes.values || []) {
    const cid = c.id ? String(c.id) : "";
    if (!cid) continue;
    const norm = normalizeCustomerName(String(c.name || ""));
    if (norm && !nameToCustomerId.has(norm)) {
      nameToCustomerId.set(norm, cid);
    }
    if (c.opening_balance) {
      custMap.set(cid, { opening: Number(c.opening_balance) || 0, type: String(c.opening_balance_type || "debit") });
    }
  }

  const unlinkedInvRes = await db.query(
    `SELECT i.party_name, i.total_amount, i.date, i.due_date,
            COALESCE(paid_agg.paid, 0) AS paid
       FROM custom_invoices i
       LEFT JOIN (
         SELECT a.invoice_id, SUM(a.amount) AS paid
           FROM customer_payment_allocations a
           JOIN customer_payments p ON p.id = a.payment_id
          WHERE p.cancelled_at IS NULL
          GROUP BY a.invoice_id
       ) paid_agg ON paid_agg.invoice_id = i.id
      WHERE i.type = 'sales' AND i.cancelled_at IS NULL AND i.customer_id IS NULL
        AND TRIM(COALESCE(i.party_name, '')) <> ''`
  );

  const invAggByCid = new Map<string, { invoiced: number; paid: number; overdueCount: number }>();
  for (const r of invRes.values || []) {
    const cid = String(r.customer_id);
    invAggByCid.set(cid, {
      invoiced: Number(r.total_invoiced) || 0,
      paid: Number(r.total_paid) || 0,
      overdueCount: Number(r.overdue_count) || 0,
    });
  }

  for (const r of unlinkedInvRes.values || []) {
    const cid = nameToCustomerId.get(normalizeCustomerName(String(r.party_name || "")));
    if (!cid) continue;
    const prev = invAggByCid.get(cid) ?? { invoiced: 0, paid: 0, overdueCount: 0 };
    const total = Number(r.total_amount) || 0;
    const paid = Number(r.paid) || 0;
    const isOverdue = total - paid > 0.009 && String(r.due_date || r.date || "") < today;
    invAggByCid.set(cid, {
      invoiced: prev.invoiced + total,
      paid: prev.paid + paid,
      overdueCount: prev.overdueCount + (isOverdue ? 1 : 0),
    });
  }

  const map: Record<string, { outstanding: number; invoiced: number; collected: number; overdueCount: number }> = {};

  for (const [cid, agg] of invAggByCid.entries()) {
    const invoiced = agg.invoiced;
    const paid = agg.paid;
    const collected = Math.max(payMap.get(cid) || 0, paid);
    const op = custMap.get(cid);
    const opDebit = op && op.type === "debit" ? op.opening : 0;
    const opCredit = op && op.type === "credit" ? op.opening : 0;

    const outstanding = Math.max(0, invoiced + opDebit - collected - opCredit);
    map[cid] = {
      invoiced: round2(invoiced + opDebit),
      collected: round2(collected + opCredit),
      outstanding: round2(outstanding),
      overdueCount: agg.overdueCount,
    };
  }

  const extraCustomerIds = new Set<string>([...custMap.keys(), ...payMap.keys(), ...invAggByCid.keys()]);
  for (const cid of extraCustomerIds) {
    if (!map[cid]) {
      const op = custMap.get(cid);
      const collected = payMap.get(cid) || 0;
      const opDebit = op && op.type === "debit" ? op.opening : 0;
      const opCredit = op && op.type === "credit" ? op.opening : 0;
      map[cid] = {
        invoiced: round2(opDebit),
        collected: round2(collected + opCredit),
        outstanding: round2(Math.max(0, opDebit - collected - opCredit)),
        overdueCount: 0,
      };
    }
  }

  return map;
}

/**
 * Returns all sales invoices belonging to this customer with computed settlement
 */
export async function getCustomerInvoicesList(customerId: string): Promise<CustomerInvoiceItemRow[]> {
  const db = await getDb();
  const customer = await getCustomerById(customerId);
  const customerName = customer?.name || "";
  const today = getLocalIsoDate();

  const res = await db.query(
    `SELECT i.id, i.reference, i.serial, i.date, i.due_date, i.total_amount,
            i.currency, i.notes,
            COALESCE(paid_agg.paid, 0) AS paid
       FROM custom_invoices i
       LEFT JOIN (
         SELECT a.invoice_id, SUM(a.amount) AS paid
           FROM customer_payment_allocations a
           JOIN customer_payments cp ON cp.id = a.payment_id
          WHERE cp.cancelled_at IS NULL
          GROUP BY a.invoice_id
       ) paid_agg ON paid_agg.invoice_id = i.id
      WHERE i.type = 'sales' AND i.cancelled_at IS NULL
        AND (i.customer_id = ? OR (i.customer_id IS NULL AND LOWER(TRIM(i.party_name)) = LOWER(TRIM(?))))
      ORDER BY i.date DESC, i.created_at DESC`,
    [customerId, customerName]
  );

  return (res.values || []).map((row: any) => {
    const total = Number(row.total_amount) || 0;
    const paid = Number(row.paid) || 0;
    const remaining = Math.max(0, total - paid);
    const dueDate = row.due_date ? String(row.due_date) : undefined;
    const isOverdue = remaining > 0.009 && dueDate && dueDate < today;

    let status: CustomerInvoiceItemRow["status"] = "unpaid";
    let statusLabel = "غير مسددة";
    let statusBadgeColor = "text-rose-600 bg-rose-500/10 border-rose-500/20";

    if (paid >= total - 0.009) {
      status = "paid";
      statusLabel = "مسددة بالكامل";
      statusBadgeColor = "text-emerald-600 bg-emerald-500/10 border-emerald-500/20";
    } else if (paid > 0.009) {
      if (isOverdue) {
        status = "overdue";
        statusLabel = "متأخرة (جزئية)";
        statusBadgeColor = "text-rose-600 bg-rose-500/10 border-rose-500/20";
      } else {
        status = "partial";
        statusLabel = "مسددة جزئياً";
        statusBadgeColor = "text-amber-600 bg-amber-500/10 border-amber-500/20";
      }
    } else if (isOverdue) {
      status = "overdue";
      statusLabel = "متأخرة";
      statusBadgeColor = "text-rose-600 bg-rose-500/10 border-rose-500/20";
    }

    return {
      id: String(row.id),
      reference: row.reference ? String(row.reference) : undefined,
      serial: String(row.serial || ""),
      date: String(row.date || ""),
      dueDate,
      totalAmount: round2(total),
      paidAmount: round2(paid),
      remainingAmount: round2(remaining),
      currency: String(row.currency || "SDG"),
      status,
      statusLabel,
      statusBadgeColor,
      notes: row.notes ? String(row.notes) : undefined,
    };
  });
}
