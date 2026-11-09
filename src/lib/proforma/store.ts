import { useSyncExternalStore } from "react";
import type { ProformaInvoice, ProformaLine, ProformaMeta } from "./types";
import { tafqeetSDG } from "./tafqeet";
import { saveInvoice } from "@/lib/invoicesStore";
import { addOrder } from "@/lib/ordersStore";
import { getStoredJsonSync, setStoredJson } from "@/lib/nativeStorage";

const STORAGE_KEY = "future_proforma_invoices_v2";

export function calculateProformaTotals(lines: ProformaLine[]) {
  const safeLines = Array.isArray(lines) ? lines : [];
  const totalArea = Number(
    safeLines
      .reduce(
        (sum, l) =>
          sum +
          (typeof l?.area === "number" && Number.isFinite(l.area)
            ? l.area
            : ((Number(l?.width) || 0) * (Number(l?.height) || 0) * (Number(l?.qty) || 1)) / 10000),
        0
      )
      .toFixed(2)
  );
  const totalQty = safeLines.reduce((sum, l) => sum + (Number(l?.qty) || 0), 0);
  const totalAmount = safeLines.reduce((sum, l) => sum + (Number(l?.total) || 0), 0);
  const totalInWords = tafqeetSDG(totalAmount);

  return { totalArea, totalQty, totalAmount, totalInWords };
}

const INITIAL_DEMO_PROFORMAS: ProformaInvoice[] = [];

function sanitizeProforma(raw: any): ProformaInvoice {
  const lines: ProformaLine[] = Array.isArray(raw?.lines)
    ? raw.lines.map((l: any) => ({
        id: String(l?.id || `pline-${Math.random()}`),
        description: String(l?.description || "بند"),
        material: l?.material || "flex",
        width: Number(l?.width) || 0,
        height: Number(l?.height) || 0,
        qty: Number(l?.qty) || 1,
        rollUsed: String(l?.rollUsed || ""),
        area: Number(l?.area) || 0,
        unitPrice: Number(l?.unitPrice) || 0,
        total: Number(l?.total) || 0,
      }))
    : [];

  const totals = calculateProformaTotals(lines);

  return {
    id: String(raw?.id || `proforma-${raw?.meta?.serial || Date.now()}`),
    meta: {
      serial: String(raw?.meta?.serial || "001"),
      date: String(raw?.meta?.date || new Date().toISOString().slice(0, 10)),
      customerName: String(raw?.meta?.customerName || "عميل غير محدد"),
      customerEnName: raw?.meta?.customerEnName ? String(raw.meta.customerEnName) : undefined,
      phone: String(raw?.meta?.phone || ""),
      branch: String(raw?.meta?.branch || "امدرمان"),
      notes: raw?.meta?.notes ? String(raw.meta.notes) : undefined,
      validityDays: Number(raw?.meta?.validityDays) || 7,
    },
    lines,
    ...totals,
    status: raw?.status || "draft",
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

function loadFromStorage(): ProformaInvoice[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_PROFORMAS);
  const safe = Array.isArray(list) ? list.map(sanitizeProforma) : INITIAL_DEMO_PROFORMAS;
  const seen = new Set<string>();
  const deduped: ProformaInvoice[] = [];
  for (const p of safe) {
    const key = p.meta.serial || p.id;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return deduped;
}

let snapshot: ProformaInvoice[] = loadFromStorage();
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

export function subscribeProforma(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getProformaSnapshot(): ProformaInvoice[] {
  return snapshot;
}

export function useProformaInvoices() {
  return useSyncExternalStore(subscribeProforma, getProformaSnapshot, () => INITIAL_DEMO_PROFORMAS);
}

export function getProformaById(id: string): ProformaInvoice | undefined {
  return snapshot.find((p) => p.id === id);
}

export function saveProformaInvoice(
  meta: ProformaMeta,
  lines: ProformaLine[],
  existingId?: string
): ProformaInvoice {
  const totals = calculateProformaTotals(lines);
  const now = new Date().toISOString();

  // 1. البحث عن فاتورة سابقة بنفس الـ ID أو بنفس الرقم التسلسلي لمنع التكرار نهائياً
  const idx = snapshot.findIndex(
    (p) => (existingId && p.id === existingId) || (p.meta?.serial && p.meta.serial === meta.serial)
  );

  if (idx !== -1) {
    const matched = snapshot[idx];
    const updated: ProformaInvoice = {
      ...matched,
      meta,
      lines,
      ...totals,
      updatedAt: now,
    };
    const newList = [...snapshot];
    newList[idx] = updated;
    snapshot = newList;
    notify();
    return updated;
  }

  const id = existingId || `proforma-${meta.serial}-${Date.now()}`;
  const record: ProformaInvoice = {
    id,
    meta,
    lines,
    ...totals,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  snapshot = [record, ...snapshot];
  notify();
  return record;
}

export function deleteProformaInvoice(id: string) {
  snapshot = snapshot.filter((p) => p.id !== id);
  notify();
}

/**
 * تحويل فاتورة مبدئية إلى فاتورة تشغيل وطباعة فعلية في خط الإنتاج
 */
export function convertProformaToOperatingInvoice(proformaId: string) {
  const proforma = getProformaById(proformaId);
  if (!proforma) return null;

  // 1. إنشاء فاتورة تشغيل معتمدة
  const invRecord = saveInvoice({
    meta: {
      serial: proforma.meta.serial,
      date: proforma.meta.date,
      customerName: proforma.meta.customerName,
      phone: proforma.meta.phone || "",
      clientTypes: ["takeaway"],
      shipTo: "",
      branch: proforma.meta.branch || "امدرمان",
    },
    lines: proforma.lines.map((l) => ({
      description: l.description,
      material: l.material,
      width: l.width,
      height: l.height,
      qty: l.qty,
      unitPrice: l.unitPrice,
      total: l.total,
    })),
  });

  // 2. إدراج طلب في خط الإنتاج
  const orderRecord = addOrder({
    orderNumber: proforma.meta.serial,
    customerName: proforma.meta.customerName,
    customerPhone: proforma.meta.phone || "",
    clientType: "takeaway",
    status: "ready_to_print",
    priority: "normal",
    branch: proforma.meta.branch || "امدرمان",
    paidAmount: proforma.totalAmount,
    totalArea: proforma.totalArea,
    totalCost: proforma.totalAmount,
    invoiceSerial: proforma.meta.serial,
    items: proforma.lines.map((l, i) => ({
      id: `item-${Date.now()}-${i}`,
      description: l.description,
      material: "flex",
      width: l.width,
      height: l.height,
      qty: l.qty,
      rollUsed: `${Math.max(l.width, l.height)} سم`,
      area: l.area,
      unitPrice: l.unitPrice,
      total: l.total,
    })),
  });

  // 3. تحديث حالة الفاتورة المبدئية إلى محولة (converted)
  const idx = snapshot.findIndex((p) => p.id === proformaId);
  if (idx !== -1) {
    snapshot[idx] = {
      ...snapshot[idx],
      status: "converted",
      convertedOrderId: orderRecord.id,
      updatedAt: new Date().toISOString(),
    };
    snapshot = [...snapshot];
    notify();
  }

  return { invRecord, orderRecord };
}
