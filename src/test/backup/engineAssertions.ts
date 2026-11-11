/**
 * Assertions shared by the backup tests (test-only).
 * Kept separate so both the Node engine port and the spec files use one rule set.
 */

import type { TableCounts } from "@/lib/backup/types";

/** A restore is only "good" when the relational shape survived. */
export function isValidRestoreCounts(counts: TableCounts): boolean {
  const customInvoices = counts.custom_invoices ?? 0;
  const customItems = counts.custom_invoice_items ?? 0;
  const proforma = counts.proforma_invoices ?? 0;
  const proformaLines = counts.proforma_lines ?? 0;
  const printInvoices = counts.print_invoices ?? 0;
  const printLines = counts.print_invoice_lines ?? 0;

  // Orphaned child rows are the signature of a half-restored database: a child
  // table cannot contain rows when its parent table is empty.
  if (customInvoices === 0 && customItems > 0) return false;
  if (proforma === 0 && proformaLines > 0) return false;
  if (printInvoices === 0 && printLines > 0) return false;

  // Loose upper bound that catches a merged/duplicated explosion without
  // assuming an invoice must have items (they can legitimately have none).
  if (customItems > customInvoices * 500 || proformaLines > proforma * 500 || printLines > printInvoices * 500) return false;
  return true;
}

/** Schema compatibility mirror of src/lib/backup/validation.ts. */
export function isSchemaCompatible(snapshotSchema: number, currentSchema: number): boolean {
  return snapshotSchema >= 1 && snapshotSchema <= currentSchema;
}
