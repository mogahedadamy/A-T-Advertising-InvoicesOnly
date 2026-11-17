/**
 * ═══════════════════════════════════════════════════════════════
 * Custom Invoice Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 * Handles all persistence for sales / purchase / billing invoices.
 * Uses parameterized queries for SQL injection safety.
 *
 * Reference handling (PRD §5.3):
 *  - the official reference is allocated on the FIRST successful save only;
 *  - later saves never touch `reference` (immutability, §5.3.3);
 *  - reads exclude softly cancelled rows, but the rows and their references
 *    stay in the database and in backups (§12.7, §12.13).
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import { allocateInvoiceReference } from "@/lib/repositories/DocumentSequenceRepository";
import { scopeForInvoiceType } from "@/lib/domain/references";
import type { CustomInvoice, CustomInvoiceItem, CustomInvoiceType } from "@/lib/billing/types";

// ── Helpers ────────────────────────────────────────────────────────────────

function rowToInvoice(row: any, items: any[]): CustomInvoice {
  return {
    id: row.id,
    meta: {
      serial: row.serial,
      type: row.type as CustomInvoiceType,
      date: row.date,
      partyName: row.party_name,
      partyEnName: row.party_en_name || undefined,
      attn: row.attn || undefined,
      phone: row.phone || undefined,
      salutation: row.salutation || undefined,
      closingNote: row.closing_note || undefined,
      accountNumber: row.account_number || undefined,
      accountName: row.account_name || undefined,
      signatoryTitle: row.signatory_title || undefined,
      notes: row.notes || undefined,
      language: (row.language as "ar" | "en" | "auto") || "ar",
      currency: (row.currency as any) || "SDG",
      dueDate: row.due_date || undefined,
      discount: row.discount ?? undefined,
    },
    items: items.map(rowToItem),
    totalAmount: row.total_amount,
    subtotal: row.subtotal ?? undefined,
    totalInWords: row.total_in_words || undefined,
    currency: (row.currency as any) || "SDG",
    reference: row.reference || undefined,
    referenceAssignedAt: row.reference_assigned_at || undefined,
    projectId: row.project_id || undefined,
    customerId: row.customer_id || undefined,
    supplierId: row.supplier_id || undefined,
    supplierInvoiceNumber: row.supplier_invoice_number || undefined,
    cancelledAt: row.cancelled_at || undefined,
    cancellationReason: row.cancellation_reason || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToItem(row: any): CustomInvoiceItem {
  return {
    id: row.id,
    description: row.description,
    material: row.material ?? undefined,
    dimensions: row.dimensions ?? undefined,
    qty: row.qty,
    unitPrice: row.unit_price ?? undefined,
    total: row.total,
  };
}

// ── Read ───────────────────────────────────────────────────────────────────

/** Active (non-cancelled) invoices, newest first. */
export async function getAllCustomInvoices(): Promise<CustomInvoice[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM custom_invoices WHERE cancelled_at IS NULL ORDER BY date DESC, created_at DESC"
  );
  const rows = res.values || [];
  if (rows.length === 0) return [];

  // Batch-fetch all items for active invoices in a single query instead of N+1 round trips
  const itemsRes = await db.query(
    `SELECT i.* FROM custom_invoice_items i
       JOIN custom_invoices c ON c.id = i.invoice_id
      WHERE c.cancelled_at IS NULL
      ORDER BY i.invoice_id, i.sort_order ASC`
  );

  const itemsByInvoice = new Map<string, any[]>();
  for (const item of itemsRes.values || []) {
    const invId = String(item.invoice_id);
    let list = itemsByInvoice.get(invId);
    if (!list) {
      list = [];
      itemsByInvoice.set(invId, list);
    }
    list.push(item);
  }

  return rows.map((row) => rowToInvoice(row, itemsByInvoice.get(String(row.id)) || []));
}

export async function getCustomInvoiceById(id: string): Promise<CustomInvoice | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM custom_invoices WHERE id = ?", [id]);
  if (!res.values || res.values.length === 0) return undefined;
  const row = res.values[0];
  const itemsRes = await db.query(
    "SELECT * FROM custom_invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC",
    [id]
  );
  return rowToInvoice(row, itemsRes.values || []);
}

/** Exact reference lookup used by search (PRD §5.3.6). */
export async function findCustomInvoiceByReference(reference: string): Promise<CustomInvoice | undefined> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM custom_invoices WHERE reference = ? AND cancelled_at IS NULL LIMIT 1",
    [reference.trim()]
  );
  const row = res.values?.[0];
  if (!row) return undefined;
  const itemsRes = await db.query(
    "SELECT * FROM custom_invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC",
    [row.id]
  );
  return rowToInvoice(row, itemsRes.values || []);
}

/** True when the reference already exists (any state, including cancelled). */
export async function referenceExists(reference: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.query("SELECT id FROM custom_invoices WHERE reference = ? LIMIT 1", [reference.trim()]);
  return Boolean(res.values?.length);
}

// ── Write ──────────────────────────────────────────────────────────────────

export interface UpsertResult {
  reference: string | null;
  referenceAssigned: boolean;
}

/**
 * Inserts or updates an invoice.
 *
 * The reference is allocated here — never in the UI — so it is produced by the
 * atomic allocator and persisted with the record (§5.3.1). An existing reference
 * is preserved verbatim on update (§5.3.3, §12.14).
 */
export async function upsertCustomInvoice(invoice: CustomInvoice): Promise<UpsertResult> {
  const db = await getDb();
  const now = new Date().toISOString();

  const existingRes = await db.query(
    "SELECT id, reference, project_id FROM custom_invoices WHERE id = ? LIMIT 1",
    [invoice.id]
  );
  const existing = existingRes.values?.[0];
  const isNewRow = !existing;
  const previousProjectId = existing?.project_id ? String(existing.project_id) : null;

  let reference: string | null = existing?.reference ?? invoice.reference ?? null;
  let referenceAssigned = false;
  let referenceAssignedAt: string | null = null;

  if (!reference) {
    const scope = scopeForInvoiceType(invoice.meta.type);
    if (scope) {
      // First successful save as an official invoice → allocate the reference.
      const allocated = await allocateInvoiceReference(
        scope === "purchase" ? "purchase" : "sales",
        invoice.meta.date || now.slice(0, 10),
        now
      );
      reference = allocated.reference;
      referenceAssigned = true;
      referenceAssignedAt = now;
    }
  }

  // Item primary keys are global. A duplicated invoice (or imported data) can
  // carry item ids that already belong to another invoice; inserting those would
  // fail the whole save (and, when the caller swallows the error, silently lose
  // the invoice). Any conflicting id is re-namespaced to this invoice instead.
  const incomingItemIds = invoice.items.map((item) => String(item.id || "")).filter(Boolean);
  let conflictingItemIds = new Set<string>();
  if (incomingItemIds.length > 0) {
    try {
      const placeholders = incomingItemIds.map(() => "?").join(",");
      const clash = await db.query(
        `SELECT id FROM custom_invoice_items WHERE id IN (${placeholders}) AND invoice_id <> ?`,
        [...incomingItemIds, invoice.id]
      );
      conflictingItemIds = new Set((clash.values ?? []).map((row: any) => String(row.id)));
    } catch (err) {
      console.warn("[CustomInvoiceRepository] item id check failed:", err);
    }
  }
  const items = invoice.items.map((item, index) => {
    if (!conflictingItemIds.has(String(item.id))) return item;
    const unique = `${invoice.id}-item-${index}-${Math.random().toString(36).slice(2, 7)}`;
    return { ...item, id: unique };
  });

  const statements: capSQLiteSet[] = [
    {
      statement: `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, party_en_name, attn, phone,
         salutation, closing_note, account_number, account_name,
         signatory_title, notes, language, currency, total_amount, total_in_words,
         created_at, updated_at,
         reference, reference_assigned_at, project_id, customer_id,
         due_date, discount, subtotal, supplier_id, supplier_invoice_number)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         serial          = excluded.serial,
         type            = excluded.type,
         date            = excluded.date,
         party_name      = excluded.party_name,
         party_en_name   = excluded.party_en_name,
         attn            = excluded.attn,
         phone           = excluded.phone,
         salutation      = excluded.salutation,
         closing_note    = excluded.closing_note,
         account_number  = excluded.account_number,
         account_name    = excluded.account_name,
         signatory_title = excluded.signatory_title,
         notes           = excluded.notes,
         language        = excluded.language,
         currency        = excluded.currency,
         total_amount    = excluded.total_amount,
         total_in_words  = excluded.total_in_words,
         project_id      = excluded.project_id,
         customer_id     = excluded.customer_id,
         due_date        = excluded.due_date,
         discount        = excluded.discount,
         subtotal        = excluded.subtotal,
         supplier_id     = excluded.supplier_id,
         supplier_invoice_number = excluded.supplier_invoice_number,
         updated_at      = excluded.updated_at
         -- reference and reference_assigned_at are deliberately NOT updated:
         -- an official reference is permanent (PRD §5.3.3, §12.14).`,
      values: [
        invoice.id,
        invoice.meta.serial,
        invoice.meta.type,
        invoice.meta.date,
        invoice.meta.partyName,
        invoice.meta.partyEnName ?? null,
        invoice.meta.attn ?? null,
        invoice.meta.phone ?? null,
        invoice.meta.salutation ?? null,
        invoice.meta.closingNote ?? null,
        invoice.meta.accountNumber ?? null,
        invoice.meta.accountName ?? null,
        invoice.meta.signatoryTitle ?? null,
        invoice.meta.notes ?? null,
        invoice.meta.language ?? "ar",
        invoice.currency || invoice.meta.currency || "SDG",
        invoice.totalAmount,
        invoice.totalInWords ?? null,
        invoice.createdAt || now,
        now,
        reference,
        referenceAssignedAt ?? existing?.reference_assigned_at ?? (reference ? now : null),
        invoice.projectId ?? null,
        invoice.customerId ?? null,
        invoice.meta.dueDate ?? null,
        invoice.meta.discount ?? 0,
        invoice.subtotal ?? invoice.totalAmount ?? 0,
        invoice.supplierId ?? null,
        invoice.supplierInvoiceNumber ?? null,
      ],
    },
    {
      statement: "DELETE FROM custom_invoice_items WHERE invoice_id = ?",
      values: [invoice.id],
    },
    ...items.map((item, i) => ({
      statement: `INSERT INTO custom_invoice_items
        (id, invoice_id, description, material, dimensions, qty, unit_price, total, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      values: [
        item.id,
        invoice.id,
        item.description,
        item.material ?? null,
        item.dimensions ?? null,
        item.qty,
        item.unitPrice ?? null,
        item.total,
        i,
      ],
    })),
  ];

  await db.executeSet(statements, true);

  const affectedProjects = new Set<string>();
  if (invoice.projectId) affectedProjects.add(invoice.projectId);
  if (previousProjectId) affectedProjects.add(previousProjectId);
  if (affectedProjects.size > 0) {
    try {
      const { refreshProjectFinancialStatus } = await import("@/lib/repositories/ProjectRepository");
      for (const pid of affectedProjects) {
        await refreshProjectFinancialStatus(pid, now).catch(() => undefined);
      }
    } catch {
      // Ignore if ProjectRepository is unavailable in isolated tests
    }
  }

  if (isNewRow) {
    await appendAuditEntry({
      entityType: "custom_invoice",
      entityId: invoice.id,
      action: "create",
      details: { reference, type: invoice.meta.type, total: invoice.totalAmount },
      nowIso: now,
    });
  }

  notifyDataChanged();
  return { reference, referenceAssigned };
}

/** Items actually stored for an invoice (ids may have been re-namespaced). */
export async function getCustomInvoiceItemIds(invoiceId: string): Promise<string[]> {
  const db = await getDb();
  const res = await db.query("SELECT id FROM custom_invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC", [invoiceId]);
  return (res.values ?? []).map((row: any) => String(row.id));
}

/**
 * Soft cancellation: the record and its reference are preserved forever
 * (PRD §5.3.3, §5.3.7, §12.7, §12.13). The row disappears from lists because
 * reads filter on cancelled_at, but nothing is destroyed.
 */
export async function cancelCustomInvoice(id: string, reason: string | null): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    "UPDATE custom_invoices SET cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ? AND cancelled_at IS NULL",
    [now, reason, now, id]
  );
  await appendAuditEntry({
    entityType: "custom_invoice",
    entityId: id,
    action: "cancel",
    reason,
    nowIso: now,
  });
  notifyDataChanged();
}

/** Restores a cancelled invoice (audit action: restore). */
export async function restoreCancelledCustomInvoice(id: string, reason: string | null): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.run(
    "UPDATE custom_invoices SET cancelled_at = NULL, cancellation_reason = NULL, updated_at = ? WHERE id = ?",
    [now, id]
  );
  await appendAuditEntry({
    entityType: "custom_invoice",
    entityId: id,
    action: "restore",
    reason,
    nowIso: now,
  });
  notifyDataChanged();
}

/**
 * Cancellation replaces deletion in the UI.
 * Kept under the old name so existing callers keep working, but it no longer
 * destroys financial history.
 */
export async function deleteCustomInvoice(id: string): Promise<void> {
  await cancelCustomInvoice(id, "حذف من الواجهة — السجل محفوظ");
}
