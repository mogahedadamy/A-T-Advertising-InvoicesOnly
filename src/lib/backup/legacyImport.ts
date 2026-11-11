/**
 * ═══════════════════════════════════════════════════════════════
 * Legacy JSON backup importer (pre-engine exports)
 * ═══════════════════════════════════════════════════════════════
 * Older releases could only write a flat JSON file
 * (`TA-Invoices-Backup-YYYY-MM-DD.json`) through the AndroidPrint bridge.
 * Users still hold those files, so restoring must keep working.
 *
 * The planner here is pure: it normalises untrusted JSON into the database
 * shape, then the repository layer writes it in ONE transaction (so a failure
 * halfway through never leaves half the invoices imported).
 */

import type { TableCounts } from "./types";
import { LEGACY_EXPORT_APP_ID } from "./types";

export interface LegacyNormalized {
  customInvoices: any[];
  customInvoiceItems: { invoiceId: string; item: any; sortOrder: number }[];
  proformaInvoices: any[];
  proformaLines: { proformaId: string; line: any; sortOrder: number }[];
  printInvoices: any[];
  printInvoiceLines: { invoiceId: string; line: any; sortOrder: number }[];
  customers: any[];
  orders: any[];
  orderItems: { orderId: string; item: any; sortOrder: number }[];
  sequences: { key: string; value: string }[];
  warnings: string[];
  counts: TableCounts;
}

export class LegacyImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegacyImportError";
  }
}

const MAX_ROWS = 200_000;

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function arr(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

/** Rejects anything that is not a recognised legacy export document. */
export function detectLegacyBackup(doc: unknown): { ok: boolean; version?: string; stats?: Record<string, number>; reason?: string } {
  const root = doc as any;
  if (!root || typeof root !== "object") return { ok: false, reason: "الملف فارغ أو ليس JSON صالحاً." };
  if (root.format === undefined && root.appId !== undefined && root.appId !== LEGACY_EXPORT_APP_ID) {
    return { ok: false, reason: "الملف يخص تطبيقاً آخر." };
  }
  const data = root.data && typeof root.data === "object" ? root.data : root;
  const hasAny = ["customInvoices", "proformaInvoices", "printInvoices", "customers", "orders"].some((k) => Array.isArray(data[k]));
  if (!hasAny) return { ok: false, reason: "بنية الملف لا تحتوي أي سجلات فواتير معروفة." };
  const stats = root.stats && typeof root.stats === "object" ? root.stats : undefined;
  return { ok: true, version: typeof root.version === "string" ? root.version : "legacy", stats };
}

/**
 * Normalises a legacy export into insertable rows.
 * IDs are preserved; duplicate ids inside the file are dropped (first wins) so
 * the import cannot violate the primary keys of the database.
 */
export function normalizeLegacyBackup(doc: unknown, nowIso: string): LegacyNormalized {
  const detection = detectLegacyBackup(doc);
  if (!detection.ok) throw new LegacyImportError(detection.reason || "ملف غير معروف.");
  const root = doc as any;
  const data = root.data && typeof root.data === "object" ? root.data : root;
  const warnings: string[] = [];

  const collect = (rows: any[], label: string): any[] => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") {
        warnings.push(`${label}: تم تجاهل سجل غير صالح.`);
        continue;
      }
      const id = str(row.id);
      if (!id) {
        warnings.push(`${label}: تم تجاهل سجل بدون معرّف.`);
        continue;
      }
      if (seen.has(id)) {
        warnings.push(`${label}: معرّف مكرر (${id}) تم تجاهله.`);
        continue;
      }
      seen.add(id);
      out.push(row);
    }
    if (out.length > MAX_ROWS) throw new LegacyImportError(`${label}: عدد السجلات يتجاوز الحد الآمن للاستيراد.`);
    return out;
  };

  const customInvoices = collect(arr(data.customInvoices), "الفواتير");
  const proformaInvoices = collect(arr(data.proformaInvoices), "الفواتير المبدئية");
  const printInvoices = collect(arr(data.printInvoices), "فواتير الحاسبة");
  const customers = collect(arr(data.customers), "العملاء");
  const orders = collect(arr(data.orders), "الطلبات");

  const customInvoiceItems: LegacyNormalized["customInvoiceItems"] = [];
  const customRows = customInvoices.map((inv) => {
    const items = arr(inv.items);
    items.forEach((item, index) => customInvoiceItems.push({ invoiceId: inv.id, item, sortOrder: index }));
    const meta = inv.meta || {};
    return {
      id: str(inv.id),
      serial: str(meta.serial, "001"),
      type: str(meta.type, "sales"),
      date: str(meta.date, nowIso.slice(0, 10)),
      partyName: str(meta.partyName),
      partyEnName: meta.partyEnName ?? null,
      attn: meta.attn ?? null,
      phone: meta.phone ?? null,
      salutation: meta.salutation ?? null,
      closingNote: meta.closingNote ?? null,
      accountNumber: meta.accountNumber ?? null,
      accountName: meta.accountName ?? null,
      signatoryTitle: meta.signatoryTitle ?? null,
      notes: meta.notes ?? null,
      language: str(meta.language, "ar"),
      totalAmount: num(inv.totalAmount),
      totalInWords: inv.totalInWords ?? null,
      createdAt: str(inv.createdAt, nowIso),
      updatedAt: str(inv.updatedAt, nowIso),
    };
  });

  const proformaLines: LegacyNormalized["proformaLines"] = [];
  const proformaRows = proformaInvoices.map((p) => {
    const meta = p.meta || {};
    arr(p.lines).forEach((line, index) => proformaLines.push({ proformaId: p.id, line, sortOrder: index }));
    return {
      id: str(p.id),
      serial: str(meta.serial, "001"),
      date: str(meta.date, nowIso.slice(0, 10)),
      customerName: str(meta.customerName),
      customerEnName: meta.customerEnName ?? null,
      attn: meta.attn ?? null,
      phone: meta.phone ?? null,
      branch: meta.branch ?? null,
      notes: meta.notes ?? null,
      validityDays: num(meta.validityDays, 7),
      accountName: meta.accountName ?? null,
      language: str(meta.language, "ar"),
      status: str(p.status, "draft"),
      convertedOrderId: p.convertedOrderId ?? null,
      totalArea: num(p.totalArea),
      totalQty: num(p.totalQty),
      totalAmount: num(p.totalAmount),
      totalInWords: str(p.totalInWords),
      createdAt: str(p.createdAt, nowIso),
      updatedAt: str(p.updatedAt, nowIso),
    };
  });

  const printInvoiceLines: LegacyNormalized["printInvoiceLines"] = [];
  const printRows = printInvoices.map((inv) => {
    arr(inv.lines).forEach((line, index) => printInvoiceLines.push({ invoiceId: inv.id, line, sortOrder: index }));
    return {
      id: str(inv.id),
      serial: str(inv.serial, "001"),
      date: str(inv.date, nowIso.slice(0, 10)),
      customerName: str(inv.customerName),
      phone: inv.phone ?? null,
      branch: inv.branch ?? null,
      shipTo: inv.shipTo ?? null,
      clientTypes: JSON.stringify(arr(inv.clientTypes)),
      total: num(inv.total),
      paidAmount: num(inv.paidAmount),
      paymentStatus: str(inv.paymentStatus, "paid"),
      createdAt: str(inv.createdAt, nowIso),
    };
  });

  const customerRows = customers.map((c) => ({
    id: str(c.id),
    name: str(c.name),
    phone: c.phone ?? null,
    type: str(c.type, "individual"),
    address: c.address ?? null,
    notes: c.notes ?? null,
    totalOrders: num(c.totalOrders),
    totalSpent: num(c.totalSpent),
    balance: num(c.balance),
    createdAt: str(c.createdAt, nowIso),
  }));

  const orderItems: LegacyNormalized["orderItems"] = [];
  const orderRows = orders.map((o) => {
    arr(o.items).forEach((item, index) => orderItems.push({ orderId: o.id, item, sortOrder: index }));
    return {
      id: str(o.id),
      orderNumber: str(o.orderNumber, "001"),
      customerName: str(o.customerName),
      customerPhone: o.customerPhone ?? null,
      clientType: str(o.clientType, "takeaway"),
      status: str(o.status, "new"),
      priority: str(o.priority, "normal"),
      createdAt: str(o.createdAt, nowIso),
      deliveryDate: o.deliveryDate ?? null,
      totalArea: num(o.totalArea),
      totalCost: num(o.totalCost),
      paidAmount: num(o.paidAmount),
      branch: o.branch ?? null,
      notes: o.notes ?? null,
      invoiceSerial: o.invoiceSerial ?? null,
    };
  });

  const sequences: { key: string; value: string }[] = [];
  const seqs = data.sequences || {};
  const pushSeq = (key: string, value: unknown) => {
    const raw = str(value).trim();
    if (!raw) return;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      warnings.push(`الرقم التسلسلي ${key} غير صالح وتم تجاهله.`);
      return;
    }
    sequences.push({ key, value: String(parsed) });
  };
  pushSeq("future_invoice_seq", seqs.invoiceSeq);
  pushSeq("future_proforma_seq", seqs.proformaSeq);

  return {
    customInvoices: customRows,
    customInvoiceItems,
    proformaInvoices: proformaRows,
    proformaLines,
    printInvoices: printRows,
    printInvoiceLines,
    customers: customerRows,
    orders: orderRows,
    orderItems,
    sequences,
    warnings,
    counts: {
      custom_invoices: customRows.length,
      custom_invoice_items: customInvoiceItems.length,
      proforma_invoices: proformaRows.length,
      proforma_lines: proformaLines.length,
      print_invoices: printRows.length,
      print_invoice_lines: printInvoiceLines.length,
      customers: customerRows.length,
      orders: orderRows.length,
      order_items: orderItems.length,
      total:
        customRows.length +
        proformaRows.length +
        printRows.length +
        customerRows.length +
        orderRows.length,
    },
  };
}
