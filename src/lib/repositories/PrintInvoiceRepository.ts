/**
 * ═══════════════════════════════════════════════════════════════
 * Print Invoice Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import type { InvoiceLine } from "@/lib/invoice/types";

function rowToInvoiceRecord(row: any, lines: any[]): InvoiceRecord {
  return {
    id: row.id,
    serial: row.serial,
    date: row.date,
    customerName: row.customer_name,
    phone: row.phone || "",
    branch: row.branch || "",
    shipTo: row.ship_to || "",
    clientTypes: JSON.parse(row.client_types || "[]"),
    lines: lines.map(rowToLine),
    total: row.total || 0,
    paidAmount: row.paid_amount || 0,
    paymentStatus: row.payment_status || "paid",
    currency: (row.currency as any) || "SDG",
    createdAt: row.created_at,
  };
}

function rowToLine(row: any): InvoiceLine {
  return {
    description: row.description,
    material: row.material || "",
    width: row.width || 0,
    height: row.height || 0,
    qty: row.qty || 1,
    unitPrice: row.unit_price || 0,
    total: row.total || 0,
  };
}

export async function getAllPrintInvoices(): Promise<InvoiceRecord[]> {
  const db = await getDb();
  const res = await db.query("SELECT * FROM print_invoices ORDER BY date DESC, created_at DESC");
  const rows = res.values || [];
  if (rows.length === 0) return [];

  // Batch-fetch all lines in a single query instead of N+1 round trips across the Capacitor bridge
  const linesRes = await db.query(
    `SELECT l.* FROM print_invoice_lines l
       JOIN print_invoices p ON p.id = l.invoice_id
      ORDER BY l.invoice_id, l.sort_order ASC`
  );

  const linesByInvoice = new Map<string, any[]>();
  for (const line of linesRes.values || []) {
    const invId = String(line.invoice_id);
    let list = linesByInvoice.get(invId);
    if (!list) {
      list = [];
      linesByInvoice.set(invId, list);
    }
    list.push(line);
  }

  return rows.map((row) => rowToInvoiceRecord(row, linesByInvoice.get(String(row.id)) || []));
}

export async function upsertPrintInvoice(invoice: InvoiceRecord): Promise<void> {
  const db = await getDb();
  const statements: capSQLiteSet[] = [
    {
      statement: `INSERT INTO print_invoices
        (id, serial, date, customer_name, phone, branch, ship_to,
         client_types, total, paid_amount, payment_status, currency, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         serial         = excluded.serial,
         date           = excluded.date,
         customer_name  = excluded.customer_name,
         phone          = excluded.phone,
         branch         = excluded.branch,
         ship_to        = excluded.ship_to,
         client_types   = excluded.client_types,
         total          = excluded.total,
         paid_amount    = excluded.paid_amount,
         payment_status = excluded.payment_status,
         currency       = excluded.currency`,
      values: [
        invoice.id,
        invoice.serial,
        invoice.date,
        invoice.customerName,
        invoice.phone || null,
        invoice.branch || null,
        invoice.shipTo || null,
        JSON.stringify(invoice.clientTypes || []),
        invoice.total,
        invoice.paidAmount,
        invoice.paymentStatus,
        invoice.currency || "SDG",
        invoice.createdAt,
      ],
    },
    {
      statement: "DELETE FROM print_invoice_lines WHERE invoice_id = ?",
      values: [invoice.id],
    },
    ...invoice.lines.map((line, i) => ({
      statement: `INSERT INTO print_invoice_lines
        (id, invoice_id, description, material, width, height, qty, unit_price, total, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      values: [
        `pil-${invoice.id}-${i}`,
        invoice.id,
        line.description,
        line.material || "",
        line.width || 0,
        line.height || 0,
        line.qty || 1,
        line.unitPrice || 0,
        line.total,
        i,
      ],
    })),
  ];

  await db.executeSet(statements, true);
  notifyDataChanged();
}

export async function deletePrintInvoice(id: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM print_invoices WHERE id = ?", [id]);
  notifyDataChanged();
}

