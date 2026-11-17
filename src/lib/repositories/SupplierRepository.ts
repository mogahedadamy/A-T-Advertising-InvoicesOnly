/**
 * ═══════════════════════════════════════════════════════════════
 * Suppliers & purchase obligations (PRD §7.1–§7.3)
 * ═══════════════════════════════════════════════════════════════
 * A supplier's balance is derived: purchase invoices (obligations) minus the
 * payments actually recorded against them. Never stored, never guessed.
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import { appendAuditEntry } from "@/lib/repositories/AuditLogRepository";
import { buildSettlement, type SettlementSummary } from "@/lib/domain/finance";

export interface Supplier {
  id: string;
  name: string;
  phone?: string | undefined;
  email?: string | undefined;
  address?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
  cancelledAt?: string | undefined;
}

function rowToSupplier(row: any): Supplier {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    address: row.address ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: String(row.created_at),
    cancelledAt: row.cancelled_at ?? undefined,
  };
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM suppliers WHERE cancelled_at IS NULL ORDER BY name ASC");
  return (res.values ?? []).map(rowToSupplier);
}

export async function getSupplierById(id: string): Promise<Supplier | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM suppliers WHERE id = ? LIMIT 1", [id]);
  const row = res.values?.[0];
  return row ? rowToSupplier(row) : undefined;
}

export async function createSupplier(input: {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  nowIso?: string;
}): Promise<Supplier> {
  const db = await getDb();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const id = `sup-${nowIso.replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
  await db.run(
    "INSERT INTO suppliers(id, name, phone, email, address, notes, created_at) VALUES(?,?,?,?,?,?,?)",
    [id, input.name.trim(), input.phone ?? null, input.email ?? null, input.address ?? null, input.notes ?? null, nowIso]
  );
  await appendAuditEntry({ entityType: "supplier", entityId: id, action: "create", details: { name: input.name }, nowIso });
  notifyDataChanged();
  return {
    id,
    name: input.name.trim(),
    phone: input.phone,
    email: input.email,
    address: input.address,
    notes: input.notes,
    createdAt: nowIso,
  };
}

export async function updateSupplier(
  id: string,
  changes: Partial<Omit<Supplier, "id" | "createdAt">>,
  nowIso = new Date().toISOString()
): Promise<void> {
  const db = await getDb();
  const current = await getSupplierById(id);
  if (!current) throw new Error("المورد غير موجود");
  await db.run("UPDATE suppliers SET name = ?, phone = ?, email = ?, address = ?, notes = ? WHERE id = ?", [
    changes.name?.trim() || current.name,
    changes.phone ?? current.phone ?? null,
    changes.email ?? current.email ?? null,
    changes.address ?? current.address ?? null,
    changes.notes ?? current.notes ?? null,
    id,
  ]);
  await appendAuditEntry({ entityType: "supplier", entityId: id, action: "update", nowIso });
  notifyDataChanged();
}

export async function cancelSupplier(id: string, reason: string | null, nowIso = new Date().toISOString()): Promise<void> {
  const db = await getDb();
  await db.run("UPDATE suppliers SET cancelled_at = ? WHERE id = ? AND cancelled_at IS NULL", [nowIso, id]);
  await appendAuditEntry({ entityType: "supplier", entityId: id, action: "cancel", reason, nowIso });
  notifyDataChanged();
}

export interface SupplierObligationRow {
  invoiceId: string;
  reference: string;
  supplierInvoiceNumber?: string | undefined;
  date: string;
  projectId?: string | undefined;
  settlement: SettlementSummary;
}

export interface SupplierAccount {
  supplier: Supplier;
  totalObligations: number;
  totalPaid: number;
  outstanding: number;
  invoices: SupplierObligationRow[];
}

/** Purchase invoices of one supplier with their payments applied (§9.2). */
export async function getSupplierAccount(supplierId: string): Promise<SupplierAccount> {
  const db = await getDb();
  const supplier = await getSupplierById(supplierId);
  const invoicesRes = await db.query(
    `SELECT id, reference, supplier_invoice_number, date, total_amount, project_id
       FROM custom_invoices
      WHERE supplier_id = ? AND type = 'purchase' AND cancelled_at IS NULL
      ORDER BY date DESC, created_at DESC`,
    [supplierId]
  );

  const invoices: SupplierObligationRow[] = [];
  let totalObligations = 0;
  let totalPaid = 0;

  for (const row of invoicesRes.values ?? []) {
    const paidRes = await db.query(
      `SELECT COALESCE(SUM(a.amount), 0) AS paid
         FROM supplier_payment_allocations a
         JOIN supplier_payments p ON p.id = a.payment_id
        WHERE a.invoice_id = ? AND p.cancelled_at IS NULL`,
      [row.id]
    );
    const paid = Number(paidRes.values?.[0]?.paid) || 0;
    const settlement = buildSettlement(Number(row.total_amount) || 0, paid);
    totalObligations += settlement.total;
    totalPaid += settlement.paid;
    invoices.push({
      invoiceId: String(row.id),
      reference: String(row.reference ?? ""),
      supplierInvoiceNumber: row.supplier_invoice_number ?? undefined,
      date: String(row.date ?? ""),
      projectId: row.project_id ?? undefined,
      settlement,
    });
  }

  return {
    supplier: supplier ?? {
      id: supplierId,
      name: "مورد غير معروف",
      createdAt: new Date().toISOString(),
    },
    totalObligations: Math.round(totalObligations * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    outstanding: Math.round(Math.max(0, totalObligations - totalPaid) * 100) / 100,
    invoices,
  };
}

/** Outstanding per supplier, for the suppliers list. */
export async function getSupplierOutstandingMap(): Promise<Record<string, number>> {
  const suppliers = await getAllSuppliers();
  const result: Record<string, number> = {};
  for (const supplier of suppliers) {
    const account = await getSupplierAccount(supplier.id);
    result[supplier.id] = account.outstanding;
  }
  return result;
}
