/**
 * ═══════════════════════════════════════════════════════════════
 * Custom Invoice Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 * Handles all persistence for sales / purchase / billing invoices.
 * Uses parameterized queries for SQL injection safety.
 */

import type { capSQLiteSet } from "@capacitor-community/sqlite";
import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";
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
    },
    items: items.map(rowToItem),
    totalAmount: row.total_amount,
    totalInWords: row.total_in_words || undefined,
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

export async function getAllCustomInvoices(): Promise<CustomInvoice[]> {
  const db = await getDb();
  const res = await db.query(
    "SELECT * FROM custom_invoices ORDER BY date DESC, created_at DESC"
  );
  const rows = res.values || [];
  const invoices: CustomInvoice[] = [];
  for (const row of rows) {
    const itemsRes = await db.query(
      "SELECT * FROM custom_invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC",
      [row.id]
    );
    invoices.push(rowToInvoice(row, itemsRes.values || []));
  }
  return invoices;
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

// ── Write ──────────────────────────────────────────────────────────────────

export async function upsertCustomInvoice(invoice: CustomInvoice): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const statements: capSQLiteSet[] = [
    {
      statement: `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, party_en_name, attn, phone,
         salutation, closing_note, account_number, account_name,
         signatory_title, notes, language, total_amount, total_in_words,
         created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
         total_amount    = excluded.total_amount,
         total_in_words  = excluded.total_in_words,
         updated_at      = excluded.updated_at`,
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
        invoice.totalAmount,
        invoice.totalInWords ?? null,
        invoice.createdAt || now,
        now,
      ],
    },
    {
      statement: "DELETE FROM custom_invoice_items WHERE invoice_id = ?",
      values: [invoice.id],
    },
    ...invoice.items.map((item, i) => ({
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
  notifyDataChanged();
}

export async function deleteCustomInvoice(id: string): Promise<void> {
  const db = await getDb();
  // CASCADE will delete items automatically
  await db.run("DELETE FROM custom_invoices WHERE id = ?", [id]);
  notifyDataChanged();
}

