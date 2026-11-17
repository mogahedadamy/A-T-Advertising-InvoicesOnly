/**
 * ═══════════════════════════════════════════════════════════════
 * Document sequence repository (app-level)
 * ═══════════════════════════════════════════════════════════════
 * Thin wrapper over the infrastructure allocator in `@/lib/database/sequences`
 * so application code (repositories, stores) never touches SQL for numbering.
 */

import { getDb } from "@/lib/database";
import { DEFAULT_INVOICE_TARGET, PROJECT_TARGET, allocateDocumentNumber, readSequenceCounter } from "@/lib/database/sequences";
import { REFERENCE_PREFIX, dateKeyFromParts, localPartsFromIsoDate, type ReferenceScope } from "@/lib/domain/references";

export interface AllocatedReference {
  scope: ReferenceScope;
  dateKey: string;
  sequence: number;
  reference: string;
}

/** Allocates the next sales/purchase/preliminary invoice reference for a business date (YY-NNNN). */
export async function allocateInvoiceReference(
  type: "sales" | "purchase" | string,
  businessDate: string,
  nowIso = new Date().toISOString()
): Promise<AllocatedReference> {
  const scope: ReferenceScope = type === "purchase" ? "purchase" : "sales";
  const parts = localPartsFromIsoDate(businessDate) ?? localPartsFromIsoDate(nowIso.slice(0, 10));
  if (!parts) throw new Error(`تاريخ الفاتورة غير صالح لتوليد المرجع: ${businessDate}`);
  const dateKey = dateKeyFromParts(scope, parts);
  const db = await getDb();
  // Shared annual invoice counter ensures seamless, collision-free numbering across all invoice types
  const allocated = await allocateDocumentNumber(db, scope, dateKey, nowIso, DEFAULT_INVOICE_TARGET);
  return { scope, dateKey, sequence: allocated.sequence, reference: allocated.reference };
}

/** Allocates the next project reference for a year (PRJ-YYYY-NNN). */
export async function allocateProjectReference(
  year: number,
  nowIso = new Date().toISOString()
): Promise<AllocatedReference> {
  const db = await getDb();
  const dateKey = String(Math.trunc(year));
  const allocated = await allocateDocumentNumber(db, "project", dateKey, nowIso, PROJECT_TARGET);
  return { scope: "project", dateKey, sequence: allocated.sequence, reference: allocated.reference };
}

/**
 * Allocates a reference for a money document (receipt RCV- / supplier payment PAY-).
 * The collision check looks at the table that stores that reference.
 */
export async function allocateMoneyReference(
  kind: "receipt" | "supplier_payment",
  businessDate: string,
  nowIso = new Date().toISOString()
): Promise<AllocatedReference> {
  const parts = localPartsFromIsoDate(businessDate) ?? localPartsFromIsoDate(nowIso.slice(0, 10));
  if (!parts) throw new Error(`تاريخ الحركة غير صالح: ${businessDate}`);
  const scope = kind === "receipt" ? "receipt" : "supplier_payment";
  const dateKey = dateKeyFromParts(scope, parts);
  const table = kind === "receipt" ? "customer_payments" : "supplier_payments";
  const db = await getDb();
  const allocated = await allocateDocumentNumber(db, scope, dateKey, nowIso, { table });
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
