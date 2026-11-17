/**
 * ═══════════════════════════════════════════════════════════════
 * Finance domain — money movements, allocations and balances
 * ═══════════════════════════════════════════════════════════════
 * Pure module. Every rule from PRD §6–§10 that can be a function lives here so
 * the same logic is unit-tested, used by the repositories and shown by the UI.
 *
 * Rules enforced:
 *  - a payment is a real transaction; allocating it is what settles an invoice;
 *  - allocations may never exceed the payment nor an invoice's own total (§12);
 *  - an identical transaction is not accepted twice without explicit intent (§12.8);
 *  - only actual movements change an account balance (§10.1);
 *  - internal transfers are never revenue or expenses (§10.1, §12.11).
 */

import type { ReferenceScope } from "./references";

export type PaymentMethod = "cash" | "bank_transfer" | "cheque" | "card" | "other";
export type AccountKind = "cash" | "bank" | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقداً",
  bank_transfer: "تحويل بنكي",
  cheque: "شيك",
  card: "بطاقة",
  other: "أخرى",
};

export const ACCOUNT_KIND_LABELS: Record<AccountKind, string> = {
  cash: "نقدي",
  bank: "بنكي",
  other: "أخرى",
};

export type LedgerKind = "receipt" | "payment" | "transfer_in" | "transfer_out";

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  receipt: "مقبوضات",
  payment: "مدفوعات",
  transfer_in: "تحويل وارد",
  transfer_out: "تحويل صادر",
};

export interface FinancialAccount {
  id: string;
  name: string;
  kind: AccountKind;
  openingBalance: number;
  isActive: boolean;
  notes?: string | undefined;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amount: number;
  occurredAt: string;
  accountId: string;
  counterAccountId?: string | undefined;
  sourceType?: string | undefined;
  sourceId?: string | undefined;
  projectId?: string | undefined;
  referenceNote?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  reversedBy?: string | undefined;
}

/** One allocation of a payment onto one invoice. */
export interface AllocationIntent {
  invoiceId: string;
  amount: number;
}

export interface AllocationInvoice {
  id: string;
  /** Total of the invoice. */
  total: number;
  /** Amount already allocated by other, still-valid payments. */
  alreadyAllocated: number;
}

export interface AllocationValidation {
  ok: boolean;
  errors: string[];
  /** Allocations that are valid as given (positive amounts only). */
  normalised: AllocationIntent[];
  totalAllocated: number;
  /** Payment amount left unallocated (a valid advance, not an error). */
  unallocated: number;
}

/**
 * Validates a payment's allocations (§4.2, §6.2, §12).
 * An unallocated remainder is allowed: it is an advance payment.
 */
export function validateAllocations(
  paymentAmount: number,
  allocations: AllocationIntent[],
  invoices: AllocationInvoice[]
): AllocationValidation {
  const errors: string[] = [];
  const amount = Number(paymentAmount) || 0;

  if (amount <= 0) {
    errors.push("قيمة الدفعة يجب أن تكون أكبر من صفر");
  }

  const byInvoice = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  const normalised: AllocationIntent[] = [];
  let totalAllocated = 0;

  for (const allocation of allocations) {
    const value = Number(allocation.amount) || 0;
    if (value <= 0) {
      errors.push("كل تخصيص يجب أن يكون أكبر من صفر");
      continue;
    }
    const invoice = byInvoice.get(allocation.invoiceId);
    if (!invoice) {
      errors.push("الفاتورة المحددة في التخصيص غير موجودة");
      continue;
    }
    const outstanding = Math.max(0, (Number(invoice.total) || 0) - (Number(invoice.alreadyAllocated) || 0));
    if (value > outstanding + 0.009) {
      errors.push(`التخصيص (${value}) يتجاوز المتبقي على الفاتورة (${round2(outstanding)})`);
      continue;
    }
    normalised.push({ invoiceId: allocation.invoiceId, amount: round2(value) });
    totalAllocated = round2(totalAllocated + value);
  }

  if (totalAllocated > amount + 0.009) {
    errors.push("مجموع التخصيصات يتجاوز قيمة الدفعة");
  }

  return {
    ok: errors.length === 0,
    errors,
    normalised,
    totalAllocated,
    unallocated: round2(Math.max(0, amount - totalAllocated)),
  };
}

/**
 * Detects a probable duplicate transaction (§12.8).
 * The caller must pass `confirmDuplicate` to proceed, so a repeat is only ever
 * recorded with explicit user intent.
 */
export interface ExistingPaymentFingerprint {
  amount: number;
  paidAt: string;
  method: string;
  invoiceIds: string[];
}

export function looksLikeDuplicatePayment(
  candidate: { amount: number; paidAt: string; method: string; invoiceIds: string[] },
  existing: ExistingPaymentFingerprint[]
): boolean {
  const key = (p: { amount: number; paidAt: string; method: string; invoiceIds: string[] }) =>
    `${round2(p.amount)}|${p.paidAt}|${p.method}|${[...p.invoiceIds].sort().join(",")}`;
  const candidateKey = key(candidate);
  return existing.some((entry) => key(entry) === candidateKey);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function safe(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Account balance from actual movements only (§10.1, §10.2).
 * Transfers move money between accounts and never appear as income or expense.
 */
export function deriveAccountBalance(
  openingBalance: number,
  entries: Pick<LedgerEntry, "kind" | "amount" | "accountId" | "reversedBy">[]
): number {
  let balance = safe(openingBalance);
  for (const entry of entries) {
    if (entry.reversedBy) continue; // reversed movement: no effect
    const amount = safe(entry.amount);
    if (entry.kind === "receipt" || entry.kind === "transfer_in") balance += amount;
    else if (entry.kind === "payment" || entry.kind === "transfer_out") balance -= amount;
  }
  return round2(balance);
}

export interface AccountBalanceReport {
  account: FinancialAccount;
  balance: number;
  inflow: number;
  outflow: number;
}

export function buildAccountReport(
  account: FinancialAccount,
  entries: Pick<LedgerEntry, "kind" | "amount" | "accountId" | "reversedBy">[]
): AccountBalanceReport {
  let inflow = 0;
  let outflow = 0;
  for (const entry of entries) {
    if (entry.reversedBy) continue;
    const amount = safe(entry.amount);
    if (entry.kind === "receipt" || entry.kind === "transfer_in") inflow += amount;
    else if (entry.kind === "payment" || entry.kind === "transfer_out") outflow += amount;
  }
  return {
    account,
    balance: deriveAccountBalance(account.openingBalance, entries),
    inflow: round2(inflow),
    outflow: round2(outflow),
  };
}

/** Total liquidity across active accounts. */
export function totalLiquidity(reports: AccountBalanceReport[]): number {
  return round2(reports.reduce((sum, report) => sum + report.balance, 0));
}

// ═══════════════════════════════════════════════════════════════════════════
// Settlement / obligations
// ═══════════════════════════════════════════════════════════════════════════

export type SettlementStatus = "unpaid" | "partially_paid" | "fully_paid";

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  unpaid: "غير مدفوع",
  partially_paid: "مدفوع جزئياً",
  fully_paid: "مدفوع بالكامل",
};

export const SETTLEMENT_STATUS_TONES: Record<SettlementStatus, string> = {
  unpaid: "border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10",
  partially_paid: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10",
  fully_paid: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
};

/**
 * Payment status of an invoice, derived from valid payment records only
 * (PRD §4.2 “A payment status must be derived from actual payment records
 * rather than manually toggled”).
 */
export function deriveSettlementStatus(total: number, paid: number): SettlementStatus {
  const amount = safe(total);
  const settled = safe(paid);
  if (settled <= 0) return "unpaid";
  if (settled + 0.009 >= amount) return "fully_paid";
  return "partially_paid";
}

export interface SettlementSummary {
  total: number;
  paid: number;
  outstanding: number;
  status: SettlementStatus;
}

export function buildSettlement(total: number, paid: number): SettlementSummary {
  const amount = round2(safe(total));
  const settled = round2(safe(paid));
  return {
    total: amount,
    paid: settled,
    outstanding: round2(Math.max(0, amount - settled)),
    status: deriveSettlementStatus(amount, settled),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Company profitability (PRD §9.5)
// ═══════════════════════════════════════════════════════════════════════════

export interface CompanyProfitabilityInputs {
  /** Recognized sales revenue (issued invoices, not collections). */
  revenue: number;
  /** Direct project costs: supplier invoices + direct expenses. */
  directCosts: number;
  /** Expenses that belong to running the business, not to a project. */
  operatingExpenses: number;
}

export interface CompanyProfitability {
  revenue: number;
  directCosts: number;
  operatingExpenses: number;
  /** Revenue − direct costs (§9.4 aggregation across projects). */
  grossMargin: number;
  /** Revenue − direct costs − operating expenses (§9.5). */
  netProfit: number;
}

export function buildCompanyProfitability(inputs: CompanyProfitabilityInputs): CompanyProfitability {
  const revenue = round2(safe(inputs.revenue));
  const directCosts = round2(safe(inputs.directCosts));
  const operatingExpenses = round2(safe(inputs.operatingExpenses));
  return {
    revenue,
    directCosts,
    operatingExpenses,
    grossMargin: round2(revenue - directCosts),
    netProfit: round2(revenue - directCosts - operatingExpenses),
  };
}

/** Reference scope used for each money document. */
export const MONEY_REFERENCE_SCOPE: Record<"receipt" | "supplier_payment", ReferenceScope> = {
  receipt: "receipt",
  supplier_payment: "supplier_payment",
};
