/**
 * ═══════════════════════════════════════════════════════════════
 * Payments — customer receipts, supplier payments, internal transfers
 * ═══════════════════════════════════════════════════════════════
 * Every function here records a REAL money movement:
 *   1. it allocates a permanent reference (RCV- / PAY-);
 *   2. it writes the payment, its allocations and the ledger entry inside ONE
 *      transaction, so a failure can never leave a payment without its cash
 *      effect (§10.3);
 *   3. it refuses anything that would double-count or over-settle (§12).
 *
 * Invoice payment status is never stored here: it is derived from allocations
 * (see LedgerRepository).
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import { allocateMoneyReference } from "@/lib/repositories/DocumentSequenceRepository";
import {
  looksLikeDuplicatePayment,
  validateAllocations,
  type AllocationInvoice,
  type AllocationIntent,
  type ExistingPaymentFingerprint,
  type PaymentMethod,
} from "@/lib/domain/finance";

export interface CustomerReceipt {
  id: string;
  reference: string;
  customerId: string;
  projectId?: string | undefined;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  accountId: string;
  transactionRef?: string | undefined;
  notes?: string | undefined;
  allocations: AllocationIntent[];
  createdAt: string;
}

export interface SupplierPayment {
  id: string;
  reference: string;
  supplierId: string;
  projectId?: string | undefined;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  accountId: string;
  transactionRef?: string | undefined;
  notes?: string | undefined;
  allocations: AllocationIntent[];
  createdAt: string;
}

function newId(prefix: string, nowIso: string): string {
  return `${prefix}-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Outstanding per invoice, used to validate allocations (invoices only). Strict customer isolation enforcement. */
async function loadInvoiceAllocationState(
  invoiceIds: string[],
  expectedCustomerId?: string
): Promise<AllocationInvoice[]> {
  if (invoiceIds.length === 0) return [];
  const db = await getDb();
  const result: AllocationInvoice[] = [];

  let expectedCustomerName = "";
  if (expectedCustomerId) {
    const custRes = await db.query("SELECT name FROM customers WHERE id = ? LIMIT 1", [expectedCustomerId]);
    expectedCustomerName = (custRes.values?.[0]?.name ?? "").trim().toLowerCase();
  }

  for (const id of invoiceIds) {
    const invoiceRes = await db.query(
      "SELECT id, reference, total_amount, customer_id, party_name FROM custom_invoices WHERE id = ? AND cancelled_at IS NULL LIMIT 1",
      [id]
    );
    const row = invoiceRes.values?.[0];
    if (!row) {
      throw new Error(`الفاتورة المحددة (${id}) غير موجودة أو تم إلغاؤها.`);
    }

    if (expectedCustomerId) {
      const invoiceCustId = row.customer_id ? String(row.customer_id).trim() : "";
      const invoicePartyName = row.party_name ? String(row.party_name).trim().toLowerCase() : "";

      // 1. إذا كانت الفاتورة مرتبطة صراحة بمعرف عميل آخر -> انتهاك محاسبي صريح وممنوع
      if (invoiceCustId && invoiceCustId !== expectedCustomerId) {
        const invRef = row.reference ? `«${row.reference}»` : id;
        const ownerName = row.party_name ? `«${row.party_name}»` : "عميل آخر";
        throw new Error(
          `انتهاك محاسبي: لا يمكن سداد الفاتورة ${invRef} لأنها تخص ${ownerName}، بينما السند صادر للعميل الحالي. الفواتير المسموح بربطها يجب أن تخص العميل المحدد فقط.`
        );
      }

      // 2. إذا كانت الفاتورة بدون customer_id، التحقق مما إذا كان اسمها يتبع لعميل مسجل آخر في النظام
      if (!invoiceCustId && invoicePartyName) {
        const otherCustRes = await db.query(
          "SELECT id, name FROM customers WHERE LOWER(TRIM(name)) = ? AND id != ? LIMIT 1",
          [invoicePartyName, expectedCustomerId]
        );
        if (otherCustRes.values?.length) {
          const invRef = row.reference ? `«${row.reference}»` : id;
          throw new Error(
            `انتهاك محاسبي: لا يمكن سداد الفاتورة ${invRef} لأنها تخص العميل «${row.party_name}»، بينما السند صادر للعميل الحالي. الفواتير المسموح بربطها يجب أن تخص العميل المحدد فقط.`
          );
        }
      }
    }

    const paidRes = await db.query(
      `SELECT COALESCE(SUM(a.amount), 0) AS paid
         FROM customer_payment_allocations a
         JOIN customer_payments p ON p.id = a.payment_id
        WHERE a.invoice_id = ? AND p.cancelled_at IS NULL`,
      [id]
    );
    result.push({
      id: String(row.id),
      total: Number(row.total_amount) || 0,
      alreadyAllocated: Number(paidRes.values?.[0]?.paid) || 0,
    });
  }
  return result;
}

async function loadSupplierInvoiceAllocationState(
  invoiceIds: string[],
  expectedSupplierId?: string
): Promise<AllocationInvoice[]> {
  if (invoiceIds.length === 0) return [];
  const db = await getDb();
  const result: AllocationInvoice[] = [];

  let expectedSupplierName = "";
  if (expectedSupplierId) {
    const suppRes = await db.query("SELECT name FROM suppliers WHERE id = ? LIMIT 1", [expectedSupplierId]);
    expectedSupplierName = (suppRes.values?.[0]?.name ?? "").trim().toLowerCase();
  }

  for (const id of invoiceIds) {
    const invoiceRes = await db.query(
      "SELECT id, reference, total_amount, supplier_id, party_name FROM custom_invoices WHERE id = ? AND cancelled_at IS NULL LIMIT 1",
      [id]
    );
    const row = invoiceRes.values?.[0];
    if (!row) {
      throw new Error(`فاتورة المشتريات المحددة (${id}) غير موجودة أو تم إلغاؤها.`);
    }

    if (expectedSupplierId) {
      const invoiceSuppId = row.supplier_id ? String(row.supplier_id).trim() : "";
      const invoicePartyName = row.party_name ? String(row.party_name).trim().toLowerCase() : "";

      // 1. إذا كانت فاتورة المشتريات مرتبطة صراحة بمعرف مورد آخر -> انتهاك محاسبي صريح وممنوع
      if (invoiceSuppId && invoiceSuppId !== expectedSupplierId) {
        const invRef = row.reference ? `«${row.reference}»` : id;
        const ownerName = row.party_name ? `«${row.party_name}»` : "مورد آخر";
        throw new Error(
          `انتهاك محاسبي: لا يمكن سداد الفاتورة ${invRef} لأنها تخص ${ownerName}، بينما السند صادر للمورد الحالي.`
        );
      }

      // 2. إذا كانت الفاتورة بدون supplier_id، التحقق مما إذا كان اسمها يتبع لمورد مسجل آخر
      if (!invoiceSuppId && invoicePartyName) {
        const otherSuppRes = await db.query(
          "SELECT id, name FROM suppliers WHERE LOWER(TRIM(name)) = ? AND id != ? LIMIT 1",
          [invoicePartyName, expectedSupplierId]
        );
        if (otherSuppRes.values?.length) {
          const invRef = row.reference ? `«${row.reference}»` : id;
          throw new Error(
            `انتهاك محاسبي: لا يمكن سداد الفاتورة ${invRef} لأنها تخص المورد «${row.party_name}»، بينما السند صادر للمورد الحالي.`
          );
        }
      }
    }

    const paidRes = await db.query(
      `SELECT COALESCE(SUM(a.amount), 0) AS paid
         FROM supplier_payment_allocations a
         JOIN supplier_payments p ON p.id = a.payment_id
        WHERE a.invoice_id = ? AND p.cancelled_at IS NULL`,
      [id]
    );
    result.push({
      id: String(row.id),
      total: Number(row.total_amount) || 0,
      alreadyAllocated: Number(paidRes.values?.[0]?.paid) || 0,
    });
  }
  return result;
}

async function existingReceiptFingerprints(customerId: string): Promise<(ExistingPaymentFingerprint & { id: string })[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT id, amount, paid_at, method FROM customer_payments WHERE customer_id = ? AND cancelled_at IS NULL",
    [customerId]
  );
  const entries: (ExistingPaymentFingerprint & { id: string })[] = [];
  for (const row of res.values ?? []) {
    const allocRes = await db.query("SELECT invoice_id FROM customer_payment_allocations WHERE payment_id = ?", [row.id]);
    entries.push({
      id: String(row.id),
      amount: Number(row.amount) || 0,
      paidAt: String(row.paid_at),
      method: String(row.method ?? "cash"),
      invoiceIds: (allocRes.values ?? []).map((a: any) => String(a.invoice_id)),
    });
  }
  return entries;
}

async function existingSupplierFingerprints(supplierId: string): Promise<(ExistingPaymentFingerprint & { id: string })[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT id, amount, paid_at, method FROM supplier_payments WHERE supplier_id = ? AND cancelled_at IS NULL",
    [supplierId]
  );
  const entries: (ExistingPaymentFingerprint & { id: string })[] = [];
  for (const row of res.values ?? []) {
    const allocRes = await db.query("SELECT invoice_id FROM supplier_payment_allocations WHERE payment_id = ?", [row.id]);
    entries.push({
      id: String(row.id),
      amount: Number(row.amount) || 0,
      paidAt: String(row.paid_at),
      method: String(row.method ?? "cash"),
      invoiceIds: (allocRes.values ?? []).map((a: any) => String(a.invoice_id)),
    });
  }
  return entries;
}

export interface RecordPaymentInput {
  customerId: string;
  projectId?: string | null;
  amount: number;
  paidAt: string;
  method?: PaymentMethod;
  accountId: string;
  transactionRef?: string;
  notes?: string;
  allocations?: AllocationIntent[];
  /** Set by the UI only after the user confirms a probable duplicate (§12.8). */
  confirmDuplicate?: boolean;
}

/**
 * Records a customer collection.
 * An unallocated remainder is a valid advance payment, not an error (§4.2).
 */
export async function recordCustomerReceipt(
  input: RecordPaymentInput,
  nowIso = new Date().toISOString()
): Promise<{ payment: CustomerReceipt; warning?: string }> {
  const db = await getDb();
  const amount = Number(input.amount) || 0;
  if (!input.customerId) throw new Error("يجب تحديد العميل");
  if (!input.accountId) throw new Error("يجب تحديد الحساب المالي المستلم");
  if (!input.paidAt) throw new Error("تاريخ الدفعة مطلوب");

  const allocations = input.allocations ?? [];
  const invoices = await loadInvoiceAllocationState(allocations.map((a) => a.invoiceId), input.customerId);
  const validation = validateAllocations(amount, allocations, invoices);
  if (!validation.ok) throw new Error(validation.errors.join("، "));

  let warning: string | undefined;
  if (!input.confirmDuplicate) {
    const existing = await existingReceiptFingerprints(input.customerId);
    const duplicate = looksLikeDuplicatePayment(
      {
        amount,
        paidAt: input.paidAt,
        method: input.method ?? "cash",
        invoiceIds: validation.normalised.map((a) => a.invoiceId),
      },
      existing
    );
    if (duplicate) {
      // Refuse first; the caller can re-send with confirmDuplicate + a reason.
      warning = "توجد دفعة مطابقة تماماً (نفس الفاتورة والمبلغ والتاريخ والطريقة). أكّد التسجيل إن كنت متعمداً.";
      const error = new Error(warning);
      (error as Error & { code?: string }).code = "DUPLICATE_PAYMENT";
      throw error;
    }
  }

  const allocated = await allocateMoneyReference("receipt", input.paidAt, nowIso);
  const id = newId("rcv", nowIso);

  await db.beginTransaction();
  try {
    await db.run(
      `INSERT INTO customer_payments
         (id, reference, customer_id, project_id, amount, paid_at, method, account_id, transaction_ref, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        allocated.reference,
        input.customerId,
        input.projectId ?? null,
        amount,
        input.paidAt,
        input.method ?? "cash",
        input.accountId,
        input.transactionRef ?? null,
        input.notes ?? null,
        nowIso,
      ],
      false
    );

    for (const allocation of validation.normalised) {
      await db.run(
        `INSERT INTO customer_payment_allocations(id, payment_id, invoice_id, amount, created_at)
         VALUES (?,?,?,?,?)`,
        [newId("alloc", `${nowIso}-${allocation.invoiceId}-${allocation.amount}`), id, allocation.invoiceId, allocation.amount, nowIso],
        false
      );
    }

    await db.run(
      `INSERT INTO financial_transactions
         (id, kind, amount, occurred_at, account_id, source_type, source_id, project_id, reference_note, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        `tx-${id}`,
        "receipt",
        amount,
        input.paidAt,
        input.accountId,
        "customer_payment",
        id,
        input.projectId ?? null,
        allocated.reference,
        nowIso,
      ],
      false
    );

    await db.commitTransaction();
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch {
      // already resolved
    }
    throw err;
  }

  // Stored payment status is refreshed from records for linked projects (§4.4).
  if (input.projectId) {
    try {
      const { refreshProjectFinancialStatus } = await import("@/lib/repositories/ProjectRepository");
      await refreshProjectFinancialStatus(input.projectId, nowIso);
    } catch (err) {
      console.warn("[PaymentRepository] project status refresh failed:", err);
    }
  }

  await appendAuditEntry({
    entityType: "customer_payment",
    entityId: id,
    action: "create",
    details: { reference: allocated.reference, amount, allocations: validation.normalised },
    nowIso,
  });
  notifyDataChanged();

  return {
    payment: {
      id,
      reference: allocated.reference,
      customerId: input.customerId,
      projectId: input.projectId ?? undefined,
      amount,
      paidAt: input.paidAt,
      method: (input.method ?? "cash") as PaymentMethod,
      accountId: input.accountId,
      transactionRef: input.transactionRef,
      notes: input.notes,
      allocations: validation.normalised,
      createdAt: nowIso,
    },
    warning,
  };
}

/** Records a payment to a supplier against one or more purchase invoices. */
export async function recordSupplierPayment(
  input: {
    supplierId: string;
    projectId?: string | null;
    amount: number;
    paidAt: string;
    method?: PaymentMethod;
    accountId: string;
    transactionRef?: string;
    notes?: string;
    allocations?: AllocationIntent[];
    confirmDuplicate?: boolean;
  },
  nowIso = new Date().toISOString()
): Promise<{ payment: SupplierPayment; warning?: string }> {
  const db = await getDb();
  const amount = Number(input.amount) || 0;
  if (!input.supplierId) throw new Error("يجب تحديد المورد");
  if (!input.accountId) throw new Error("يجب تحديد الحساب المالي الذي خرج منه المبلغ");
  if (!input.paidAt) throw new Error("تاريخ الدفعة مطلوب");

  const allocations = input.allocations ?? [];
  const invoices = await loadSupplierInvoiceAllocationState(allocations.map((a) => a.invoiceId), input.supplierId);
  const validation = validateAllocations(amount, allocations, invoices);
  if (!validation.ok) throw new Error(validation.errors.join("، "));

  let warning: string | undefined;
  if (!input.confirmDuplicate) {
    const existing = await existingSupplierFingerprints(input.supplierId);
    const duplicate = looksLikeDuplicatePayment(
      {
        amount,
        paidAt: input.paidAt,
        method: input.method ?? "cash",
        invoiceIds: validation.normalised.map((a) => a.invoiceId),
      },
      existing
    );
    if (duplicate) {
      warning = "توجد دفعة مطابقة تماماً لنفس المورد. أكّد التسجيل إن كنت متعمداً.";
      const error = new Error(warning);
      (error as Error & { code?: string }).code = "DUPLICATE_PAYMENT";
      throw error;
    }
  }

  const allocated = await allocateMoneyReference("supplier_payment", input.paidAt, nowIso);
  const id = newId("spay", nowIso);

  await db.beginTransaction();
  try {
    await db.run(
      `INSERT INTO supplier_payments
         (id, reference, supplier_id, project_id, amount, paid_at, method, account_id, transaction_ref, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        allocated.reference,
        input.supplierId,
        input.projectId ?? null,
        amount,
        input.paidAt,
        input.method ?? "cash",
        input.accountId,
        input.transactionRef ?? null,
        input.notes ?? null,
        nowIso,
      ],
      false
    );

    for (const allocation of validation.normalised) {
      await db.run(
        `INSERT INTO supplier_payment_allocations(id, payment_id, invoice_id, amount, created_at)
         VALUES (?,?,?,?,?)`,
        [newId("salloc", `${nowIso}-${allocation.invoiceId}-${allocation.amount}`), id, allocation.invoiceId, allocation.amount, nowIso],
        false
      );
    }

    await db.run(
      `INSERT INTO financial_transactions
         (id, kind, amount, occurred_at, account_id, source_type, source_id, project_id, reference_note, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        `tx-${id}`,
        "payment",
        amount,
        input.paidAt,
        input.accountId,
        "supplier_payment",
        id,
        input.projectId ?? null,
        allocated.reference,
        nowIso,
      ],
      false
    );

    await db.commitTransaction();
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch {
      // already resolved
    }
    throw err;
  }

  if (input.projectId) {
    try {
      const { refreshProjectFinancialStatus } = await import("@/lib/repositories/ProjectRepository");
      await refreshProjectFinancialStatus(input.projectId, nowIso);
    } catch (err) {
      console.warn("[PaymentRepository] project status refresh failed:", err);
    }
  }

  await appendAuditEntry({
    entityType: "supplier_payment",
    entityId: id,
    action: "create",
    details: { reference: allocated.reference, amount, allocations: validation.normalised },
    nowIso,
  });
  notifyDataChanged();

  return {
    payment: {
      id,
      reference: allocated.reference,
      supplierId: input.supplierId,
      projectId: input.projectId ?? undefined,
      amount,
      paidAt: input.paidAt,
      method: (input.method ?? "cash") as PaymentMethod,
      accountId: input.accountId,
      transactionRef: input.transactionRef,
      notes: input.notes,
      allocations: validation.normalised,
      createdAt: nowIso,
    },
    warning,
  };
}

/**
 * Internal transfer between two accounts.
 * It moves money and is explicitly NOT revenue or an expense (§10.1, §12.11):
 * both ledger rows carry the transfer kinds and no source document.
 */
export async function recordTransfer(
  input: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    occurredAt: string;
    notes?: string;
  },
  nowIso = new Date().toISOString()
): Promise<{ ok: true }> {
  const db = await getDb();
  const amount = Number(input.amount) || 0;
  if (amount <= 0) throw new Error("قيمة التحويل يجب أن تكون أكبر من صفر");
  if (!input.fromAccountId || !input.toAccountId) throw new Error("يجب تحديد الحسابين");
  if (input.fromAccountId === input.toAccountId) throw new Error("لا يمكن التحويل إلى الحساب نفسه");

  const transferId = newId("trf", nowIso);
  await db.beginTransaction();
  try {
    await db.run(
      `INSERT INTO financial_transactions
         (id, kind, amount, occurred_at, account_id, counter_account_id, source_type, source_id, reference_note, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `tx-${transferId}-out`,
        "transfer_out",
        amount,
        input.occurredAt,
        input.fromAccountId,
        input.toAccountId,
        "transfer",
        transferId,
        transferId,
        input.notes ?? null,
        nowIso,
      ],
      false
    );
    await db.run(
      `INSERT INTO financial_transactions
         (id, kind, amount, occurred_at, account_id, counter_account_id, source_type, source_id, reference_note, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        `tx-${transferId}-in`,
        "transfer_in",
        amount,
        input.occurredAt,
        input.toAccountId,
        input.fromAccountId,
        "transfer",
        transferId,
        transferId,
        input.notes ?? null,
        nowIso,
      ],
      false
    );
    await db.commitTransaction();
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch {
      // already resolved
    }
    throw err;
  }

  await appendAuditEntry({
    entityType: "financial_transfer",
    entityId: transferId,
    action: "create",
    details: { from: input.fromAccountId, to: input.toAccountId, amount },
    nowIso,
  });
  notifyDataChanged();
  return { ok: true };
}

/**
 * Cancels a payment without destroying it (§12.7).
 * The ledger rows stay for traceability but are marked reversed, so balances and
 * reports stop counting them exactly once (§10: no duplicate financial effects).
 */
export async function cancelPayment(
  kind: "receipt" | "supplier_payment" | "expense_payment",
  paymentId: string,
  reason: string | null,
  nowIso = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  const table =
    kind === "receipt" ? "customer_payments" : kind === "supplier_payment" ? "supplier_payments" : "expense_payments";

  const paymentRes = await db.query(`SELECT project_id FROM ${table} WHERE id = ? LIMIT 1`, [paymentId]);
  const projectId = paymentRes.values?.[0]?.project_id as string | undefined;

  await db.beginTransaction();
  try {
    await db.run(
      `UPDATE ${table} SET cancelled_at = ?, cancellation_reason = ? WHERE id = ? AND cancelled_at IS NULL`,
      [nowIso, reason, paymentId],
      false
    );
    await db.run("UPDATE financial_transactions SET reversed_by = ? WHERE source_id = ?", [paymentId, paymentId], false);
    await db.commitTransaction();
  } catch (err) {
    try {
      await db.rollbackTransaction();
    } catch {
      // already resolved
    }
    throw err;
  }

  if (projectId) {
    try {
      const { refreshProjectFinancialStatus } = await import("@/lib/repositories/ProjectRepository");
      await refreshProjectFinancialStatus(projectId, nowIso);
    } catch (err) {
      console.warn("[PaymentRepository] project status refresh failed:", err);
    }
  }

  await appendAuditEntry({
    entityType: kind === "receipt" ? "customer_payment" : kind === "supplier_payment" ? "supplier_payment" : "expense_payment",
    entityId: paymentId,
    action: "cancel",
    reason,
    nowIso,
  });
  notifyDataChanged();
}
