/**
 * ═══════════════════════════════════════════════════════════════
 * Project domain — the central business entity (PRD §4)
 * ═══════════════════════════════════════════════════════════════
 * Pure module: no Capacitor, no SQLite, no React. Everything here is a rule
 * from the specification expressed as a function, so it is unit-testable and
 * shared by the repository, the stores and the UI.
 *
 * Non-negotiable rules implemented here:
 *  - execution status and financial status stay SEPARATE (§4.4, §12);
 *  - the financial status is DERIVED from real records, never toggled by hand;
 *  - a project is never called financially closed while the customer still owes
 *    money or suppliers have not been paid (§4.4, §12 step 12);
 *  - an incomplete figure is labelled incomplete (§9.6).
 */

import {
  PROJECT_EXECUTION_STATUSES,
  PROJECT_FINANCIAL_STATUSES,
  type ProjectExecutionStatus,
  type ProjectFinancialStatus,
} from "@/lib/database/schema";

export type { ProjectExecutionStatus, ProjectFinancialStatus };
export { PROJECT_EXECUTION_STATUSES, PROJECT_FINANCIAL_STATUSES };

export interface Project {
  id: string;
  /** PRJ-YYYY-NNN — permanent, allocated once (§2.2) */
  reference: string;
  customerId: string | null;
  title: string;
  description?: string | undefined;
  requestNotes?: string | undefined;
  executionStatus: ProjectExecutionStatus;
  financialStatus: ProjectFinancialStatus;
  deliveryDate?: string | undefined;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string | undefined;
  cancellationReason?: string | undefined;
}

export interface ProjectDraft {
  customerId: string;
  title: string;
  description?: string;
  requestNotes?: string;
  executionStatus?: ProjectExecutionStatus;
  deliveryDate?: string;
}

export const EXECUTION_STATUS_LABELS: Record<ProjectExecutionStatus, string> = {
  new: "جديد",
  quotation_pending: "بانتظار عرض السعر",
  approved: "معتمد",
  in_progress: "قيد التنفيذ",
  partially_delivered: "تسليم جزئي",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const FINANCIAL_STATUS_LABELS: Record<ProjectFinancialStatus, string> = {
  not_invoiced: "غير مُفوتر",
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئياً",
  fully_paid: "مدفوع بالكامل",
  partially_settled: "تسوية جزئية",
  financially_closed: "مغلق مالياً",
};

/** Visual tone per status, shared so the same status always looks the same. */
export const EXECUTION_STATUS_TONES: Record<ProjectExecutionStatus, string> = {
  new: "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10",
  quotation_pending: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  approved: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
  in_progress: "border-primary/40 text-primary bg-primary/10",
  partially_delivered: "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10",
  completed: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  cancelled: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
};

export const FINANCIAL_STATUS_TONES: Record<ProjectFinancialStatus, string> = {
  not_invoiced: "border-border text-muted-foreground bg-muted/40",
  unpaid: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
  partially_paid: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  fully_paid: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
  partially_settled: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/10",
  financially_closed: "border-primary/40 text-primary bg-primary/10",
};

export interface ProjectValidation {
  ok: boolean;
  errors: string[];
}

/** Validates the minimum a project needs before it can be saved (§4.1, §10.1). */
export function validateProjectDraft(draft: Partial<ProjectDraft>): ProjectValidation {
  const errors: string[] = [];
  if (!draft.title || !String(draft.title).trim()) {
    errors.push("عنوان المشروع مطلوب");
  }
  if (!draft.customerId || !String(draft.customerId).trim()) {
    errors.push("يجب اختيار العميل");
  }
  if (draft.executionStatus && !PROJECT_EXECUTION_STATUSES.includes(draft.executionStatus)) {
    errors.push("حالة التنفيذ غير معروفة");
  }
  if (draft.deliveryDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.deliveryDate)) {
    errors.push("تاريخ التسليم غير صالح");
  }
  return { ok: errors.length === 0, errors };
}

// ═══════════════════════════════════════════════════════════════════════════
// Financial derivation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * What the records actually say about a project.
 * Every number must come from a stored transaction; nothing is estimated here.
 */
export interface ProjectFinancialInputs {
  /** Sum of valid linked sales invoice totals (recognized revenue basis). */
  invoicedAmount: number;
  /** Sum of customer payment amounts allocated to those invoices. */
  collectedAmount: number;
  /** Recorded direct costs: supplier purchase invoices + direct expenses. */
  directCosts: number;
  /** Amount actually paid to suppliers/beneficiaries against those costs. */
  paidToSuppliers: number;
  /** Counts used for the completeness indicator (§9.6). */
  invoiceCount: number;
  quotationCount: number;
  orderCount: number;
  paymentCount: number;
  costRecordCount: number;
  /** True when the project was explicitly reviewed and closed by the user. */
  closedByUser?: boolean;
}

export interface ProjectFinancialSummary {
  invoicedAmount: number;
  collectedAmount: number;
  /** ما زال على العميل (§9.1) */
  customerOutstanding: number;
  directCosts: number;
  paidToSuppliers: number;
  /** ما زال على الشركة للموردين (§9.2) */
  supplierOutstanding: number;
  /** هامش المشروع = الإيراد المعترف به − التكاليف المباشرة (§9.4) */
  margin: number;
  /** صافي النقد = المحصّل − المدفوع */
  netCash: number;
  /** الحالة المالية المشتقة (§4.4) */
  suggestedFinancialStatus: ProjectFinancialStatus;
  /** هل البيانات كافية للحكم على النتيجة؟ (§9.6) */
  isComplete: boolean;
  /** ملاحظات النقص الواجب إظهارها (§9.6، Blueprint §5.2) */
  completenessNotes: string[];
}

function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derives the financial status from records only (§4.4).
 * `financially_closed` is never inferred from arithmetic alone: the spec
 * requires an explicit review, so it needs `closedByUser`.
 */
export function deriveFinancialStatus(inputs: ProjectFinancialInputs): ProjectFinancialStatus {
  const invoiced = safe(inputs.invoicedAmount);
  const collected = safe(inputs.collectedAmount);
  const costs = safe(inputs.directCosts);
  const paid = safe(inputs.paidToSuppliers);

  if (inputs.invoiceCount === 0 && invoiced <= 0) return "not_invoiced";
  if (collected <= 0) return "unpaid";
  if (collected + 0.009 < invoiced) return "partially_paid";

  // Customer side settled. The supplier side decides the rest.
  if (costs > 0 && paid + 0.009 < costs) return "partially_settled";
  if (inputs.closedByUser === true && paid + 0.009 >= costs) return "financially_closed";
  return "fully_paid";
}

/** Builds every figure the project screen may show, plus its completeness. */
export function buildProjectFinancialSummary(inputs: ProjectFinancialInputs): ProjectFinancialSummary {
  const invoicedAmount = round2(safe(inputs.invoicedAmount));
  const collectedAmount = round2(safe(inputs.collectedAmount));
  const directCosts = round2(safe(inputs.directCosts));
  const paidToSuppliers = round2(safe(inputs.paidToSuppliers));

  const notes: string[] = [];
  if (inputs.invoiceCount === 0) {
    notes.push("لا توجد فاتورة مبيعات مرتبطة بالمشروع بعد.");
  }
  if (inputs.invoiceCount > 0 && inputs.paymentCount === 0) {
    notes.push("لم تُسجَّل أي دفعة من العميل — المبلغ المعروض ذمم وليس نقداً محصّلاً.");
  }
  if (inputs.costRecordCount === 0) {
    notes.push("لم تُسجَّل أي تكاليف تنفيذ (موردون أو مصروفات مباشرة) — الهامش المعروض غير مكتمل.");
  } else if (paidToSuppliers + 0.009 < directCosts) {
    notes.push("توجد تكاليف مسجّلة لم تُسدَّد بالكامل — التزامات على الشركة قائمة.");
  }
  if (inputs.quotationCount > 0 && inputs.invoiceCount === 0) {
    notes.push("يوجد عرض سعر بدون فاتورة مبيعات صادرة.");
  }

  return {
    invoicedAmount,
    collectedAmount,
    customerOutstanding: round2(Math.max(0, invoicedAmount - collectedAmount)),
    directCosts,
    paidToSuppliers,
    supplierOutstanding: round2(Math.max(0, directCosts - paidToSuppliers)),
    margin: round2(invoicedAmount - directCosts),
    netCash: round2(collectedAmount - paidToSuppliers),
    suggestedFinancialStatus: deriveFinancialStatus(inputs),
    isComplete: notes.length === 0,
    completenessNotes: notes,
  };
}

/**
 * The status shown in the UI.
 * An explicit user closure wins; otherwise the derived value is authoritative.
 * A stored value that no longer matches the records is corrected on read, so
 * the database can never show a stale "paid" state (§10.2, §12.1).
 */
export function resolveFinancialStatus(
  stored: ProjectFinancialStatus,
  derived: ProjectFinancialStatus
): ProjectFinancialStatus {
  if (stored === "financially_closed" && derived !== "not_invoiced") return stored;
  return derived;
}

/** Progress of a project in human terms (execution side only). */
export function executionProgressLabel(status: ProjectExecutionStatus): string {
  return EXECUTION_STATUS_LABELS[status] ?? "غير معروف";
}
