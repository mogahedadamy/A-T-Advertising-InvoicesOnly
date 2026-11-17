/**
 * ═══════════════════════════════════════════════════════════════
 * Expenses — direct project costs vs operating expenses (PRD §7.4, §7.5)
 * ═══════════════════════════════════════════════════════════════
 * Recording an expense creates an obligation only. Money leaves an account when
 * a settlement (expense_payments) is recorded — the two are never conflated.
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import { allocateMoneyReference } from "@/lib/repositories/DocumentSequenceRepository";
import { buildSettlement, type PaymentMethod, type SettlementSummary } from "@/lib/domain/finance";

export type ExpenseKind = "direct" | "operating";

export const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  direct: "تكلفة مباشرة للمشروع",
  operating: "مصروف تشغيلي عام",
};

export interface Expense {
  id: string;
  kind: ExpenseKind;
  projectId?: string | undefined;
  supplierId?: string | undefined;
  beneficiary?: string | undefined;
  category?: string | undefined;
  amount: number;
  expenseDate: string;
  method?: string | undefined;
  accountId?: string | undefined;
  evidenceRef?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  cancelledAt?: string | undefined;
}

function rowToExpense(row: any): Expense {
  return {
    id: String(row.id),
    kind: (row.kind as ExpenseKind) ?? "direct",
    projectId: row.project_id ?? undefined,
    supplierId: row.supplier_id ?? undefined,
    beneficiary: row.beneficiary ?? undefined,
    category: row.category ?? undefined,
    amount: Number(row.amount) || 0,
    expenseDate: String(row.expense_date ?? ""),
    method: row.method ?? undefined,
    accountId: row.account_id ?? undefined,
    evidenceRef: row.evidence_ref ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: String(row.created_at),
    cancelledAt: row.cancelled_at ?? undefined,
  };
}

export interface ExpenseWithSettlement extends Expense {
  settlement: SettlementSummary;
}

export async function getAllExpenses(kind?: ExpenseKind): Promise<Expense[]> {
  const db = await getDb();
  const res = await db.query(
    `SELECT * FROM expenses WHERE cancelled_at IS NULL ${kind ? "AND kind = ?" : ""} ORDER BY expense_date DESC, created_at DESC`,
    kind ? [kind] : []
  );
  return (res.values ?? []).map(rowToExpense);
}

/** Expenses with how much of each was actually paid. */
export async function getExpensesWithSettlement(kind?: ExpenseKind): Promise<ExpenseWithSettlement[]> {
  const expenses = await getAllExpenses(kind);
  const db = await getDb();
  const result: ExpenseWithSettlement[] = [];
  for (const expense of expenses) {
    const paidRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM expense_payments WHERE expense_id = ? AND cancelled_at IS NULL`,
      [expense.id]
    );
    const paid = Number(paidRes.values?.[0]?.paid) || 0;
    result.push({ ...expense, settlement: buildSettlement(expense.amount, paid) });
  }
  return result;
}

export async function getExpenseById(id: string): Promise<Expense | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM expenses WHERE id = ? LIMIT 1", [id]);
  const row = res.values?.[0];
  return row ? rowToExpense(row) : undefined;
}

export async function createExpense(
  input: {
    kind: ExpenseKind;
    projectId?: string | null;
    supplierId?: string | null;
    beneficiary?: string;
    category?: string;
    amount: number;
    expenseDate: string;
    evidenceRef?: string;
    notes?: string;
  },
  nowIso = new Date().toISOString()
): Promise<Expense> {
  const db = await getDb();
  if (!(Number(input.amount) > 0)) throw new Error("قيمة المصروف يجب أن تكون أكبر من صفر");
  if (input.kind === "direct" && !input.projectId) {
    throw new Error("التكلفة المباشرة يجب أن تُربط بمشروع");
  }
  if (input.kind === "operating" && input.projectId) {
    throw new Error("المصروف التشغيلي لا يُربط بمشروع — الاثنان لا يُخلطان (PRD §4.5)");
  }

  const id = `exp-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.run(
    `INSERT INTO expenses
       (id, kind, project_id, supplier_id, beneficiary, category, amount, expense_date, evidence_ref, notes, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.kind,
      input.projectId ?? null,
      input.supplierId ?? null,
      input.beneficiary ?? null,
      input.category ?? null,
      Number(input.amount),
      input.expenseDate,
      input.evidenceRef ?? null,
      input.notes ?? null,
      nowIso,
    ]
  );

  await appendAuditEntry({
    entityType: "expense",
    entityId: id,
    action: "create",
    details: { kind: input.kind, amount: input.amount, projectId: input.projectId ?? null },
    nowIso,
  });
  notifyDataChanged();

  return {
    id,
    kind: input.kind,
    projectId: input.projectId ?? undefined,
    supplierId: input.supplierId ?? undefined,
    beneficiary: input.beneficiary,
    category: input.category,
    amount: Number(input.amount),
    expenseDate: input.expenseDate,
    evidenceRef: input.evidenceRef,
    notes: input.notes,
    createdAt: nowIso,
  };
}

export async function cancelExpense(id: string, reason: string | null, nowIso = new Date().toISOString()): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE expenses SET cancelled_at = ?, cancellation_reason = ? WHERE id = ? AND cancelled_at IS NULL", [
    nowIso,
    reason,
    id,
  ]);
  await appendAuditEntry({ entityType: "expense", entityId: id, action: "cancel", reason, nowIso });
  notifyDataChanged();
}

export interface ExpensePayment {
  id: string;
  reference: string | null;
  expenseId: string;
  amount: number;
  paidAt: string;
  method: PaymentMethod;
  accountId?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
}

/**
 * Settles (part of) an expense and records the outgoing money movement.
 * Payment + account movement are written in ONE transaction so a failure cannot
 * leave a paid expense with no cash effect, or vice versa (§10.3).
 */
export async function payExpense(
  input: {
    expenseId: string;
    amount: number;
    paidAt: string;
    method?: PaymentMethod;
    accountId: string;
    notes?: string;
  },
  nowIso = new Date().toISOString()
): Promise<ExpensePayment> {
  const db = await getDb();
  const expense = await getExpenseById(input.expenseId);
  if (!expense) throw new Error("المصروف غير موجود");
  const amount = Number(input.amount) || 0;
  if (amount <= 0) throw new Error("قيمة السداد يجب أن تكون أكبر من صفر");

  const paidRes = await db.query(
    "SELECT COALESCE(SUM(amount), 0) AS paid FROM expense_payments WHERE expense_id = ? AND cancelled_at IS NULL",
    [input.expenseId]
  );
  const alreadyPaid = Number(paidRes.values?.[0]?.paid) || 0;
  const outstanding = Math.max(0, expense.amount - alreadyPaid);
  if (amount > outstanding + 0.009) {
    throw new Error(`قيمة السداد (${amount}) تتجاوز المتبقي على المصروف (${outstanding})`);
  }
  if (!input.accountId) throw new Error("يجب تحديد الحساب المالي الذي خرج منه المبلغ");

  // Reference allocated before the transaction: the allocator uses its own one.
  const allocated = await allocateMoneyReference("supplier_payment", input.paidAt, nowIso);
  const id = `exppay-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;

  await db.beginTransaction();
  try {
    await db.run(
      `INSERT INTO expense_payments
         (id, reference, expense_id, amount, paid_at, method, account_id, notes, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [id, allocated.reference, input.expenseId, amount, input.paidAt, input.method ?? "cash", input.accountId, input.notes ?? null, nowIso],
      false
    );
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
        "expense_payment",
        id,
        expense.projectId ?? null,
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
      // transaction already resolved
    }
    throw err;
  }

  await appendAuditEntry({
    entityType: "expense",
    entityId: input.expenseId,
    action: "update",
    reason: "تسجيل سداد مصروف",
    details: { paymentId: id, amount, reference: allocated.reference },
    nowIso,
  });
  notifyDataChanged();

  return {
    id,
    reference: allocated.reference,
    expenseId: input.expenseId,
    amount,
    paidAt: input.paidAt,
    method: (input.method ?? "cash") as PaymentMethod,
    accountId: input.accountId,
    notes: input.notes,
    createdAt: nowIso,
  };
}
