import { useSyncExternalStore } from "react";
import type { ProformaInvoice, ProformaLine, ProformaMeta } from "./types";
import { getInvoiceAmountInWords } from "@/lib/currency/amountToWords";
import { AppCurrency, sanitizeCurrency } from "@/lib/currency/types";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { saveInvoice } from "@/lib/invoicesStore";
import { addOrder } from "@/lib/ordersStore";
import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "@/lib/sqliteStorage";
import {
  upsertProforma as repoUpsertProforma,
  deleteProforma as repoDeleteProforma,
  updateProformaStatus as repoUpdateProformaStatus,
} from "@/lib/repositories/ProformaRepository";

const STORAGE_KEY = "future_proforma_invoices_v2";

export function calculateProformaTotals(
  lines: ProformaLine[],
  currency: AppCurrency = "SDG",
  isRtl = true
) {
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
  const totalAmount = Math.round(safeLines.reduce((sum, l) => sum + (Number(l?.total) || 0), 0) * 100) / 100;
  const totalInWords = getInvoiceAmountInWords(totalAmount, currency, isRtl);

  return { totalArea, totalQty, totalAmount, totalInWords };
}

const INITIAL_DEMO_PROFORMAS: ProformaInvoice[] = [];

function sanitizeProforma(raw: any): ProformaInvoice {
  const currency: AppCurrency = sanitizeCurrency(raw?.currency || raw?.meta?.currency, "SDG");
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

  const totals = calculateProformaTotals(lines, currency);

  return {
    id: String(raw?.id || `proforma-${raw?.meta?.serial || Date.now()}`),
    meta: {
      serial: String(raw?.meta?.serial || "001"),
      date: String(raw?.meta?.date || getLocalIsoDate()),
      customerName: String(raw?.meta?.customerName || "عميل غير محدد"),
      customerEnName: raw?.meta?.customerEnName ? String(raw.meta.customerEnName) : undefined,
      phone: String(raw?.meta?.phone || ""),
      branch: String(raw?.meta?.branch || "امدرمان"),
      notes: raw?.meta?.notes ? String(raw.meta.notes) : undefined,
      validityDays: Number(raw?.meta?.validityDays) || 7,
      accountName: raw?.meta?.accountName ? String(raw.meta.accountName) : undefined,
      language: raw?.meta?.language || "ar",
      currency,
    },
    lines,
    ...totals,
    currency,
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
    const key = p.id;
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
  setMemoryCacheJson(STORAGE_KEY, snapshot);
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

const inFlightProformaSaves = new Map<string, Promise<ProformaInvoice>>();

async function executeSaveProformaInvoice(
  meta: ProformaMeta,
  lines: ProformaLine[],
  existingId?: string
): Promise<ProformaInvoice> {
  const currency = meta.currency || "SDG";
  const totals = calculateProformaTotals(lines, currency, (meta.language || "ar") !== "en");
  const now = new Date().toISOString();

  // 1. عند التعديل يُطابق المعرّف مباشرة، وعند الإنشاء يمنع تكرار الرقم التسلسلي
  const idx = existingId
    ? snapshot.findIndex((p) => p.id === existingId)
    : snapshot.findIndex((p) => p.meta?.serial && p.meta.serial === meta.serial);

  if (idx !== -1) {
    const matched = snapshot[idx];
    const updated: ProformaInvoice = {
      ...matched,
      meta,
      lines,
      ...totals,
      currency,
      updatedAt: now,
    };
    if (Capacitor.isNativePlatform()) {
      await repoUpsertProforma(updated);
    }
    const finalIdx = snapshot.findIndex((p) => p.id === updated.id);
    const newList = [...snapshot];
    if (finalIdx !== -1) {
      newList[finalIdx] = updated;
    } else {
      newList[idx] = updated;
    }
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
    currency,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };

  if (Capacitor.isNativePlatform()) {
    await repoUpsertProforma(record);
  }
  const finalIdx = snapshot.findIndex((p) => p.id === record.id);
  if (finalIdx !== -1) {
    const newList = [...snapshot];
    newList[finalIdx] = record;
    snapshot = newList;
  } else {
    snapshot = [record, ...snapshot];
  }
  notify();
  return record;
}

export function saveProformaInvoice(
  meta: ProformaMeta,
  lines: ProformaLine[],
  existingId?: string
): Promise<ProformaInvoice> {
  const lockKey = existingId || `serial:${meta.serial}`;
  const previous = inFlightProformaSaves.get(lockKey);
  const run = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() =>
    executeSaveProformaInvoice(meta, lines, existingId)
  );
  inFlightProformaSaves.set(lockKey, run);
  return run.finally(() => {
    if (inFlightProformaSaves.get(lockKey) === run) {
      inFlightProformaSaves.delete(lockKey);
    }
  });
}

export async function deleteProformaInvoice(id: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await repoDeleteProforma(id);
  }
  snapshot = snapshot.filter((p) => p.id !== id);
  notify();
}

/**
 * تحويل فاتورة مبدئية إلى فاتورة تشغيل وطباعة فعلية في خط الإنتاج
 */
export async function convertProformaToOperatingInvoice(proformaId: string) {
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
      currency: proforma.currency || proforma.meta.currency || "SDG",
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
    // تحويل عرض السعر إلى أمر شغل لا يعني استلام المال (PRD §12.1):
    // تُسجَّل الفاتورة غير مدفوعة ويُحتسب المحصّل من الدفعات الفعلية.
    paidAmount: 0,
    totalArea: proforma.totalArea,
    totalCost: proforma.totalAmount,
    invoiceSerial: proforma.meta.serial,
    items: proforma.lines.map((l, i) => ({
      id: `item-${Date.now()}-${i}`,
      description: l.description,
      material: (l.material || "flex") as any,
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
    if (Capacitor.isNativePlatform()) {
      await repoUpdateProformaStatus(proformaId, "converted", orderRecord.id);
    }
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
