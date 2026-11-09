import { useSyncExternalStore } from "react";
import type { CustomInvoice, CustomInvoiceItem, CustomInvoiceType } from "./types";
import { tafqeetSDG } from "@/lib/proforma/tafqeet";

import { getStoredJsonSync, setStoredJson } from "@/lib/nativeStorage";

const STORAGE_KEY = "future_custom_invoices_v2";

export function calculateCustomInvoiceTotals(items: CustomInvoiceItem[]) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalQty = safeItems.reduce((sum, item) => sum + (Number(item?.qty) || 0), 0);
  const totalAmount = safeItems.reduce((sum, item) => sum + (Number(item?.total) || 0), 0);
  const totalInWords = tafqeetSDG(totalAmount);
  return { totalQty, totalAmount, totalInWords };
}

const INITIAL_DEMO_INVOICES: CustomInvoice[] = [];

function sanitizeCustomInvoice(raw: any): CustomInvoice {
  const items = Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        id: String(it?.id || `item-${Math.random()}`),
        description: String(it?.description || ""),
        qty: Number(it?.qty) || 1,
        unitPrice: Number(it?.unitPrice) || 0,
        total: Number(it?.total) || 0,
      }))
    : [];

  const totals = calculateCustomInvoiceTotals(items);
  const meta = {
    serial: String(raw?.meta?.serial || "001"),
    type: (raw?.meta?.type as CustomInvoiceType) || "proforma",
    date: String(raw?.meta?.date || new Date().toISOString().slice(0, 10)),
    partyName: String(raw?.meta?.partyName || "عميل غير محدد"),
    partyEnName: raw?.meta?.partyEnName ? String(raw.meta.partyEnName) : undefined,
    salutation: String(raw?.meta?.salutation || "بعد التحية والاحترام ،،،،،،،،"),
    closingNote: String(raw?.meta?.closingNote || "لكم جزيل الشكر والتقدير ،،،،،،،،،،،،،،،،،،،،،،،"),
    accountNumber: String(raw?.meta?.accountNumber || "3768914"),
    accountName: String(raw?.meta?.accountName || "طارق عثمان علي / T.A Advertising"),
    signatoryTitle: String(raw?.meta?.signatoryTitle || "الإدارة"),
  };

  return {
    id: String(raw?.id || `custom-inv-${Date.now()}`),
    meta,
    items,
    totalAmount: raw?.totalAmount !== undefined ? Number(raw.totalAmount) : totals.totalAmount,
    totalInWords: raw?.totalInWords || totals.totalInWords,
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

function loadFromStorage(): CustomInvoice[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_INVOICES);
  const safe = Array.isArray(list) ? list.map(sanitizeCustomInvoice) : INITIAL_DEMO_INVOICES;
  const seen = new Set<string>();
  const deduped: CustomInvoice[] = [];
  for (const inv of safe) {
    const key = `${inv.meta?.type || "sales"}-${inv.meta?.serial || inv.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(inv);
    }
  }
  return deduped;
}

let snapshot: CustomInvoice[] = loadFromStorage();
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    snapshot = loadFromStorage();
    subscribers.forEach((fn) => fn());
  });
}

function notify() {
  setStoredJson(STORAGE_KEY, snapshot).catch(console.warn);
  subscribers.forEach((fn) => fn());
}

export function subscribeCustomInvoices(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getCustomInvoicesSnapshot(): CustomInvoice[] {
  return snapshot;
}

export function useCustomInvoices(): CustomInvoice[] {
  return useSyncExternalStore(
    subscribeCustomInvoices,
    getCustomInvoicesSnapshot,
    () => INITIAL_DEMO_INVOICES
  );
}

export function saveCustomInvoice(invoice: CustomInvoice): void {
  // فحص الفاتورة السابقة بنفس الـ ID أو بنفس النوع والرقم التسلسلي لمنع التكرار
  const existingIdx = snapshot.findIndex(
    (inv) =>
      inv.id === invoice.id ||
      (inv.meta?.type === invoice.meta?.type && inv.meta?.serial === invoice.meta?.serial)
  );
  const now = new Date().toISOString();
  if (existingIdx >= 0) {
    const updated = [...snapshot];
    updated[existingIdx] = {
      ...snapshot[existingIdx],
      ...invoice,
      id: snapshot[existingIdx].id,
      updatedAt: now,
    };
    snapshot = updated;
  } else {
    snapshot = [
      {
        ...invoice,
        createdAt: invoice.createdAt || now,
        updatedAt: now,
      },
      ...snapshot,
    ];
  }
  notify();
}

export function deleteCustomInvoice(id: string): void {
  snapshot = snapshot.filter((inv) => inv.id !== id);
  notify();
}

export function getCustomInvoice(id: string): CustomInvoice | undefined {
  return snapshot.find((inv) => inv.id === id);
}

export function getNextCustomInvoiceSerial(type: CustomInvoiceType): string {
  const count = snapshot.length + 1;
  return String(count).padStart(3, "0");
}
