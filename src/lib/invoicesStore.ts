import { useSyncExternalStore } from "react";
import type { Invoice, InvoiceLine, InvoiceMeta } from "./invoice/types";
import { invoiceTotal } from "./invoice/types";

export interface InvoiceRecord {
  id: string;
  serial: string;
  date: string;
  customerName: string;
  phone: string;
  branch: string;
  shipTo: string;
  clientTypes: string[];
  lines: InvoiceLine[];
  total: number;
  paidAmount: number;
  paymentStatus: "paid" | "partial" | "unpaid";
  createdAt: string;
}

import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "./sqliteStorage";
import {
  upsertPrintInvoice as repoUpsertPrintInvoice,
  deletePrintInvoice as repoDeletePrintInvoice,
} from "./repositories/PrintInvoiceRepository";

const STORAGE_KEY = "future_print_invoices_v2";

const INITIAL_DEMO_INVOICES: InvoiceRecord[] = [];

function sanitizeInvoice(raw: any): InvoiceRecord {
  return {
    id: String(raw.id || `inv-${raw.serial || Date.now()}`),
    serial: String(raw.serial || "001"),
    date: String(raw.date || new Date().toISOString().slice(0, 10)),
    customerName: String(raw.customerName || "عميل نقدي"),
    phone: String(raw.phone || ""),
    branch: String(raw.branch || "امدرمان"),
    shipTo: String(raw.shipTo || ""),
    clientTypes: Array.isArray(raw.clientTypes) ? raw.clientTypes : [],
    lines: Array.isArray(raw.lines)
      ? raw.lines.map((l: any) => ({
          description: String(l.description || "بند طباعة"),
          width: Number(l.width) || 0,
          height: Number(l.height) || 0,
          qty: Number(l.qty) || 1,
          unitPrice: Number(l.unitPrice) || 0,
          total: Number(l.total) || 0,
        }))
      : [],
    total: Number(raw.total) || 0,
    paidAmount: Number(raw.paidAmount) || 0,
    paymentStatus: raw.paymentStatus || "paid",
    createdAt: raw.createdAt || new Date().toISOString(),
  };
}

function loadInvoicesFromStorage(): InvoiceRecord[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_INVOICES);
  const safe = Array.isArray(list) ? list.map(sanitizeInvoice) : INITIAL_DEMO_INVOICES;
  const seen = new Set<string>();
  const deduped: InvoiceRecord[] = [];
  for (const inv of safe) {
    const key = inv.serial || inv.id;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(inv);
    }
  }
  return deduped;
}

let invoicesSnapshot: InvoiceRecord[] = loadInvoicesFromStorage();
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    invoicesSnapshot = loadInvoicesFromStorage();
    subscribers.forEach((fn) => fn());
  });
}

function notify() {
  setMemoryCacheJson(STORAGE_KEY, invoicesSnapshot);
  subscribers.forEach((fn) => fn());
}

export function getInvoicesSnapshot(): InvoiceRecord[] {
  return invoicesSnapshot;
}

export function subscribeInvoices(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useInvoices() {
  return useSyncExternalStore(subscribeInvoices, getInvoicesSnapshot, () => INITIAL_DEMO_INVOICES);
}

export function saveInvoice(invoice: Invoice, paidAmount?: number): InvoiceRecord {
  const total = invoiceTotal(invoice.lines);
  const paid = paidAmount !== undefined ? paidAmount : total;
  const paymentStatus: "paid" | "partial" | "unpaid" =
    paid >= total ? "paid" : paid > 0 ? "partial" : "unpaid";

  const existingIdx = invoicesSnapshot.findIndex((x) => x.serial === invoice.meta.serial);
  const record: InvoiceRecord = {
    id: existingIdx >= 0 ? invoicesSnapshot[existingIdx].id : `inv-${invoice.meta.serial}-${Date.now()}`,
    serial: invoice.meta.serial,
    date: invoice.meta.date,
    customerName: invoice.meta.customerName || "عميل بدون اسم",
    phone: invoice.meta.phone || "",
    branch: invoice.meta.branch || "امدرمان",
    shipTo: invoice.meta.shipTo || "",
    clientTypes: invoice.meta.clientTypes || [],
    lines: invoice.lines,
    total,
    paidAmount: paid,
    paymentStatus,
    createdAt: existingIdx >= 0 ? invoicesSnapshot[existingIdx].createdAt : new Date().toISOString(),
  };

  // Replace if exists with same serial or prepend
  if (existingIdx >= 0) {
    const next = [...invoicesSnapshot];
    next[existingIdx] = record;
    invoicesSnapshot = next;
  } else {
    invoicesSnapshot = [record, ...invoicesSnapshot];
  }
  notify();
  if (Capacitor.isNativePlatform()) {
    repoUpsertPrintInvoice(record).catch((err) =>
      console.warn("[InvoicesStore] SQLite save failed:", err)
    );
  }
  return record;
}

export function deleteInvoice(id: string): void {
  invoicesSnapshot = invoicesSnapshot.filter((inv) => inv.id !== id);
  notify();
  if (Capacitor.isNativePlatform()) {
    repoDeletePrintInvoice(id).catch((err) =>
      console.warn("[InvoicesStore] SQLite delete failed:", err)
    );
  }
}
