/**
 * ═══════════════════════════════════════════════════════════════
 * Document sequence repository (app-level)
 * ═══════════════════════════════════════════════════════════════
 * Thin wrapper over the infrastructure allocator in `@/lib/database/sequences`
 * so application code (repositories, stores) never touches SQL for numbering.
 */

import { getDb } from "@/lib/database";
import {
  DEFAULT_INVOICE_TARGET,
  EXPENSE_PAYMENT_TARGET,
  allocateDocumentNumber,
  readSequenceCounter,
  type AllocationTarget,
} from "@/lib/database/sequences";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { REFERENCE_PREFIX, dateKeyFromParts, localPartsFromIsoDate, type ReferenceScope } from "@/lib/domain/references";

export type MoneyReferenceKind = "receipt" | "supplier_payment" | "expense_payment";

export interface AllocatedReference {
  scope: ReferenceScope;
  dateKey: string;
  sequence: number;
  reference: string;
}

function resolveBusinessDateParts(businessDate: string, nowIso?: string) {
  const fromBusiness = localPartsFromIsoDate(businessDate);
  if (fromBusiness) return fromBusiness;
  const fallbackDate = nowIso ? new Date(nowIso) : new Date();
  return localPartsFromIsoDate(getLocalIsoDate(fallbackDate));
}

/** Allocates the next sales/purchase/preliminary invoice reference for a business date (YY-NNNN). */
export async function allocateInvoiceReference(
  type: "sales" | "purchase" | string,
  businessDate: string,
  nowIso = new Date().toISOString()
): Promise<AllocatedReference> {
  const scope: ReferenceScope = type === "purchase" ? "purchase" : "sales";
  const parts = resolveBusinessDateParts(businessDate, nowIso);
  if (!parts) throw new Error(`تاريخ الفاتورة غير صالح لتوليد المرجع: ${businessDate}`);
  const dateKey = dateKeyFromParts(scope, parts);
  const db = await getDb();
  // Shared annual invoice counter in `sequences.ts` ensures seamless, collision-free numbering across sales & purchase.
  const allocated = await allocateDocumentNumber(db, scope, dateKey, nowIso, DEFAULT_INVOICE_TARGET);
  return { scope, dateKey, sequence: allocated.sequence, reference: allocated.reference };
}

/**
 * Allocates a reference for a money document:
 *   - receipt (`RCV-DDMMYYYY-NNN` -> `customer_payments`)
 *   - supplier_payment (`PAY-DDMMYYYY-NNN` -> `supplier_payments`)
 *   - expense_payment (`EXP-DDMMYYYY-NNN` -> `expense_payments`)
 * The collision check looks at the table that stores that reference.
 */
export async function allocateMoneyReference(
  kind: MoneyReferenceKind,
  businessDate: string,
  nowIso = new Date().toISOString()
): Promise<AllocatedReference> {
  const parts = resolveBusinessDateParts(businessDate, nowIso);
  if (!parts) throw new Error(`تاريخ الحركة غير صالح: ${businessDate}`);
  const scope: ReferenceScope = kind;
  const dateKey = dateKeyFromParts(scope, parts);
  const target: AllocationTarget =
    kind === "receipt"
      ? { table: "customer_payments" }
      : kind === "expense_payment"
        ? EXPENSE_PAYMENT_TARGET
        : { table: "supplier_payments" };
  const db = await getDb();
  const allocated = await allocateDocumentNumber(db, scope, dateKey, nowIso, target);
  return { scope, dateKey, sequence: allocated.sequence, reference: allocated.reference };
}

/** Current counter value for a bucket (diagnostics / UI). */
export async function getSequenceCounter(scope: ReferenceScope, dateKey: string): Promise<number> {
  const db = await getDb();
  return readSequenceCounter(db, scope, dateKey);
}

/** The prefix that belongs to a scope, for search and validation in the UI. */
export function prefixForScope(scope: ReferenceScope): string {
  return REFERENCE_PREFIX[scope];
}
