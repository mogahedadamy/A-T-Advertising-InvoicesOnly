/**
 * ═══════════════════════════════════════════════════════════════
 * Proforma Invoice Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import type { ProformaInvoice, ProformaLine } from "@/lib/proforma/types";

function rowToProforma(row: any, lines: any[]): ProformaInvoice {
  return {
    id: row.id,
    meta: {
      serial: row.serial,
      date: row.date,
      customerName: row.customer_name,
      customerEnName: row.customer_en_name || undefined,
      attn: row.attn || undefined,
      phone: row.phone || undefined,
      branch: row.branch || undefined,
      notes: row.notes || undefined,
      validityDays: row.validity_days || 7,
      accountName: row.account_name || undefined,
      language: (row.language as "ar" | "en" | "auto") || undefined,
    },
    lines: lines.map(rowToLine),
    status: row.status || "draft",
    convertedOrderId: row.converted_order_id || undefined,
    totalArea: row.total_area || 0,
    totalQty: row.total_qty || 0,
    totalAmount: row.total_amount || 0,
    totalInWords: row.total_in_words || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLine(row: any): ProformaLine {
  return {
    id: row.id,
    description: row.description,
    material: row.material || "flex",
    width: row.width || 0,
    height: row.height || 0,
    qty: row.qty || 1,
    area: row.area || 0,
    unitPrice: row.unit_price || 0,
    total: row.total || 0,
  };
}

export async function getAllProformaInvoices(): Promise<ProformaInvoice[]> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM proforma_invoices ORDER BY date DESC, created_at DESC");
  const rows = res.values || [];
  const proformas: ProformaInvoice[] = [];
  for (const row of rows) {
    const linesRes = await db.query(
      "SELECT * FROM proforma_lines WHERE proforma_id = ? ORDER BY sort_order ASC",
      [row.id]
    );
    proformas.push(rowToProforma(row, linesRes.values || []));
  }
  return proformas;
}

export async function getProformaById(id: string): Promise<ProformaInvoice | undefined> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM proforma_invoices WHERE id = ?", [id]);
  if (!res.values || res.values.length === 0) return undefined;
  const linesRes = await db.query(
    "SELECT * FROM proforma_lines WHERE proforma_id = ? ORDER BY sort_order ASC",
    [id]
  );
  return rowToProforma(res.values[0], linesRes.values || []);
}

export async function upsertProforma(proforma: ProformaInvoice): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const statements: capSQLiteSet[] = [
    {
      statement: `INSERT INTO proforma_invoices
        (id, serial, date, customer_name, customer_en_name, attn, phone, branch,
         notes, validity_days, account_name, language, status, converted_order_id,
         total_area, total_qty, total_amount, total_in_words, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         serial             = excluded.serial,
         date               = excluded.date,
         customer_name      = excluded.customer_name,
         customer_en_name   = excluded.customer_en_name,
         attn               = excluded.attn,
         phone              = excluded.phone,
         branch             = excluded.branch,
         notes              = excluded.notes,
         validity_days      = excluded.validity_days,
         account_name       = excluded.account_name,
         language           = excluded.language,
         status             = excluded.status,
         converted_order_id = excluded.converted_order_id,
         total_area         = excluded.total_area,
         total_qty          = excluded.total_qty,
         total_amount       = excluded.total_amount,
         total_in_words     = excluded.total_in_words,
         updated_at         = excluded.updated_at`,
      values: [
        proforma.id,
        proforma.meta.serial,
        proforma.meta.date,
        proforma.meta.customerName,
        proforma.meta.customerEnName ?? null,
        proforma.meta.attn ?? null,
        proforma.meta.phone ?? null,
        proforma.meta.branch ?? null,
        proforma.meta.notes ?? null,
        proforma.meta.validityDays ?? 7,
        proforma.meta.accountName ?? null,
        proforma.meta.language ?? "ar",
        proforma.status || "draft",
        proforma.convertedOrderId ?? null,
        proforma.totalArea,
        proforma.totalQty,
        proforma.totalAmount,
        proforma.totalInWords ?? "",
        proforma.createdAt || now,
        now,
      ],
    },
    {
      statement: "DELETE FROM proforma_lines WHERE proforma_id = ?",
      values: [proforma.id],
    },
    ...proforma.lines.map((l, i) => ({
      statement: `INSERT INTO proforma_lines
        (id, proforma_id, description, material, width, height,
         qty, roll_used, area, unit_price, total, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      values: [
        l.id,
        proforma.id,
        l.description,
        l.material || null,
        l.width,
        l.height,
        l.qty,
        null,
        l.area,
        l.unitPrice,
        l.total,
        i,
      ],
    })),
  ];

  await db.executeSet(statements, true);
  notifyDataChanged();
}

export async function deleteProforma(id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM proforma_invoices WHERE id = ?", [id]);
  notifyDataChanged();
}

export async function updateProformaStatus(
  id: string,
  status: string,
  convertedOrderId?: string
): Promise<void> {
  const db = await getDb();
  await db.run(
    "UPDATE proforma_invoices SET status = ?, converted_order_id = ?, updated_at = ? WHERE id = ?",
    [status, convertedOrderId ?? null, new Date().toISOString(), id]
  );
  notifyDataChanged();
}

