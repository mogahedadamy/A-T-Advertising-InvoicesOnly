import { useSyncExternalStore } from "react";
import type { CustomInvoice, CustomInvoiceItem, CustomInvoiceType } from "./types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { getInvoiceAmountInWords } from "@/lib/currency/amountToWords";
import { AppCurrency, sanitizeCurrency } from "@/lib/currency/types";

import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "@/lib/sqliteStorage";
import {
  getCustomInvoiceById as repoGetCustomInvoiceById,
  upsertCustomInvoice as repoUpsertCustomInvoice,
  deleteCustomInvoice as repoDeleteCustomInvoice,
} from "@/lib/repositories/CustomInvoiceRepository";
import { updateProformaStatus as repoUpdateProformaStatus } from "@/lib/repositories/ProformaRepository";

const STORAGE_KEY = "future_custom_invoices_v2";

export function calculateCustomInvoiceTotals(
  items: CustomInvoiceItem[],
  currency: AppCurrency = "SDG",
  isRtl = true
) {
  const safeItems = Array.isArray(items) ? items : [];
  const totalQty = safeItems.reduce((sum, item) => sum + (Number(item?.qty) || 0), 0);
  const totalAmount = safeItems.reduce((sum, item) => sum + (Number(item?.total) || 0), 0);
  const totalInWords = getInvoiceAmountInWords(totalAmount, currency, isRtl);
  return { totalQty, totalAmount, totalInWords };
}

const INITIAL_DEMO_INVOICES: CustomInvoice[] = [];

function sanitizeCustomInvoice(raw: any): CustomInvoice {
  const currency: AppCurrency = sanitizeCurrency(raw?.currency || raw?.meta?.currency, "SDG");
  const items = Array.isArray(raw?.items)
    ? raw.items.map((it: any) => ({
        id: String(it?.id || `item-${Math.random()}`),
        description: String(it?.description || ""),
        material: it?.material ? String(it.material) : undefined,
        dimensions: it?.dimensions ? String(it.dimensions) : undefined,
        qty: Number(it?.qty) || 1,
        unitPrice: it?.unitPrice !== undefined ? Number(it.unitPrice) : undefined,
        total: Number(it?.total) || 0,
      }))
    : [];

  // Optimize: Avoid heavy recalculation and tafqeet string generation if totals already exist
  const hasExistingTotals = raw?.totalAmount !== undefined && Boolean(raw?.totalInWords);
  const totals = hasExistingTotals
    ? { totalQty: 0, totalAmount: Number(raw.totalAmount) || 0, totalInWords: String(raw.totalInWords) }
    : calculateCustomInvoiceTotals(items, currency);
  const meta = {
    serial: String(raw?.meta?.serial || "001"),
    type: (raw?.meta?.type as CustomInvoiceType) || "proforma",
    date: String(raw?.meta?.date || new Date().toISOString().slice(0, 10)),
    partyName: String(raw?.meta?.partyName || "عميل غير محدد"),
    partyEnName: raw?.meta?.partyEnName ? String(raw.meta.partyEnName) : undefined,
    attn: raw?.meta?.attn ? String(raw.meta.attn) : undefined,
    phone: raw?.meta?.phone ? String(raw.meta.phone) : undefined,
    salutation: String(raw?.meta?.salutation || "بعد التحية والاحترام ،،،،،،،،"),
    closingNote: String(raw?.meta?.closingNote || "لكم جزيل الشكر والتقدير ،،،،،،،،،،،،،،،،،،،،،،،"),
    accountNumber: String(raw?.meta?.accountNumber || "3768914"),
    accountName: String(raw?.meta?.accountName || "طارق عثمان / تي ايه للدعايه والاعلان"),
    signatoryTitle: String(raw?.meta?.signatoryTitle || "الإدارة"),
    notes: raw?.meta?.notes ? String(raw.meta.notes) : undefined,
    language: raw?.meta?.language || "ar",
    currency,
    dueDate: raw?.meta?.dueDate ? String(raw.meta.dueDate) : undefined,
    discount: raw?.meta?.discount !== undefined ? Number(raw.meta.discount) : undefined,
  };

  return {
    id: String(raw?.id || `custom-inv-${Date.now()}`),
    meta,
    items,
    totalAmount: raw?.totalAmount !== undefined ? Number(raw.totalAmount) : totals.totalAmount,
    subtotal: raw?.subtotal !== undefined ? Number(raw.subtotal) : undefined,
    totalInWords: raw?.totalInWords || totals.totalInWords,
    currency,
    // The official reference is owned by the repository; the store only mirrors it.
    reference: raw?.reference ? String(raw.reference) : undefined,
    referenceAssignedAt: raw?.referenceAssignedAt ? String(raw.referenceAssignedAt) : undefined,
    projectId: raw?.projectId ? String(raw.projectId) : undefined,
    customerId: raw?.customerId ? String(raw.customerId) : undefined,
    supplierId: raw?.supplierId ? String(raw.supplierId) : undefined,
    supplierInvoiceNumber: raw?.supplierInvoiceNumber ? String(raw.supplierInvoiceNumber) : undefined,
    cancelledAt: raw?.cancelledAt ? String(raw.cancelledAt) : undefined,
    cancellationReason: raw?.cancellationReason ? String(raw.cancellationReason) : undefined,
    createdAt: raw?.createdAt || new Date().toISOString(),
    updatedAt: raw?.updatedAt || new Date().toISOString(),
  };
}

function loadFromStorage(): CustomInvoice[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_INVOICES);
  const safe = Array.isArray(list) ? list.map(sanitizeCustomInvoice) : INITIAL_DEMO_INVOICES;
  const seenIds = new Set<string>();
  const deduped: CustomInvoice[] = [];
  for (const inv of safe) {
    if (inv.cancelledAt) continue;
    // الهوية الحقيقية للفاتورة هي `id` وليس `meta.serial` (الذي يكون افتراضياً "001" بعد نظام المراجع الجديد)
    if (!seenIds.has(inv.id)) {
      seenIds.add(inv.id);
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
  setMemoryCacheJson(STORAGE_KEY, snapshot);
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

const inFlightCustomSaves = new Map<string, Promise<CustomInvoice>>();

async function executeSaveCustomInvoice(invoice: CustomInvoice): Promise<CustomInvoice> {
  // الهوية هي `id` فقط (PRD §5.3): الرقم التسلسلي القديم لم يعد معرّفاً بعد أن
  // أصبح المرجع الرسمي INV-/PINV-، فإزالة التكرار به كانت تدمج فواتير مختلفة
  // في سجل واحد وتفقد بيانات حقيقية.
  const existingIdx = snapshot.findIndex((inv) => inv.id === invoice.id);
  const now = new Date().toISOString();

  let record: CustomInvoice;
  if (existingIdx >= 0) {
    record = {
      ...snapshot[existingIdx],
      ...invoice,
      id: snapshot[existingIdx].id,
      // a reference already assigned is never replaced by the incoming value
      reference: snapshot[existingIdx].reference ?? invoice.reference,
      referenceAssignedAt: snapshot[existingIdx].referenceAssignedAt ?? invoice.referenceAssignedAt,
      updatedAt: now,
    };
  } else {
    record = {
      ...invoice,
      createdAt: invoice.createdAt || now,
      updatedAt: now,
    };
  }

  if (Capacitor.isNativePlatform()) {
    const result = await repoUpsertCustomInvoice(record);
    if (result?.reference) {
      record = {
        ...record,
        reference: result.reference,
        referenceAssignedAt: record.referenceAssignedAt ?? now,
      };
    }
  }

  // The record is now durable (or we are in the browser fallback): publish it.
  const finalIdx = snapshot.findIndex((inv) => inv.id === record.id);
  if (finalIdx >= 0) {
    const updated = [...snapshot];
    updated[finalIdx] = record;
    snapshot = updated;
  } else if (existingIdx >= 0) {
    const updated = [...snapshot];
    updated[existingIdx] = record;
    snapshot = updated;
  } else {
    snapshot = [record, ...snapshot];
  }
  notify();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("project-relations-changed"));
  }

  return record;
}

/**
 * Saves an invoice. Concurrent calls for the same `invoice.id` are serialized so
 * double-taps update the single record rather than inserting duplicates or
 * allocating multiple official references.
 *
 * The official reference (INV-/PINV-DDMMYYYY-NNN) is allocated by the repository
 * on the FIRST successful save and mirrored back into the in-memory snapshot, so
 * printing or exporting right after saving shows the real reference.
 * Later saves never change it (PRD §5.3.3).
 *
 * Persistence happens BEFORE the in-memory list is updated on Android, and a
 * failure is thrown to the caller: the invoice list must never show a record
 * that was not actually stored, and the UI must never report a fake success
 * (Blueprint §16.2, §10.2).
 */
export function saveCustomInvoice(invoice: CustomInvoice): Promise<CustomInvoice> {
  const lockKey = invoice.id;
  const previous = inFlightCustomSaves.get(lockKey);
  const run = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() =>
    executeSaveCustomInvoice(invoice)
  );
  inFlightCustomSaves.set(lockKey, run);
  return run.finally(() => {
    if (inFlightCustomSaves.get(lockKey) === run) {
      inFlightCustomSaves.delete(lockKey);
    }
  });
}

export async function deleteCustomInvoice(id: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await repoDeleteCustomInvoice(id);
  }
  snapshot = snapshot.filter((inv) => inv.id !== id);
  notify();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("project-relations-changed"));
  }
}

export function getCustomInvoice(id: string): CustomInvoice | undefined {
  return snapshot.find((inv) => inv.id === id);
}

export interface ConvertToSalesResult {
  salesInvoice: CustomInvoice;
  alreadyConverted: boolean;
}

const inFlightConversions = new Map<string, Promise<ConvertToSalesResult>>();

function isConvertedMatchFor(sourceId: string, candidateId: string): boolean {
  return candidateId === `sales-from-${sourceId}` || candidateId.startsWith(`sales-from-${sourceId}-r`);
}

async function executeConvertProformaToSales(
  source: CustomInvoice | ProformaInvoice,
  options?: { projectId?: string | null; customerId?: string | null }
): Promise<ConvertToSalesResult> {
  // 1. التحقق من عدم تحويل نفس الفاتورة المبدئية سابقاً إلى فاتورة مبيعات فعّالة
  const activeInMemory = snapshot.find(
    (inv) => inv.meta.type === "sales" && !inv.cancelledAt && isConvertedMatchFor(source.id, inv.id)
  );
  if (activeInMemory) {
    return { salesInvoice: activeInMemory, alreadyConverted: true };
  }

  let salesId = `sales-from-${source.id}`;
  if (Capacitor.isNativePlatform()) {
    const existingDb = await repoGetCustomInvoiceById(salesId).catch(() => undefined);
    if (existingDb && !existingDb.cancelledAt) {
      if (!snapshot.some((inv) => inv.id === existingDb.id)) {
        snapshot = [existingDb, ...snapshot];
        notify();
      }
      return { salesInvoice: existingDb, alreadyConverted: true };
    }
    if (existingDb?.cancelledAt) {
      salesId = `sales-from-${source.id}-r${Date.now().toString(36)}`;
    }
  }

  const todayDate = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();
  const isCustomProforma = "items" in source;

  let salesRecord: CustomInvoice;
  if (isCustomProforma) {
    const currency = source.currency || source.meta?.currency || "SDG";
    const items: CustomInvoiceItem[] = (source.items || []).map((item, idx) => ({
      id: `${salesId}-item-${idx}`,
      description: item.description,
      material: item.material,
      dimensions: item.dimensions,
      qty: Number(item.qty) || 1,
      unitPrice: item.unitPrice,
      total: Number(item.total) || 0,
    }));
    const { totalAmount, totalInWords } = calculateCustomInvoiceTotals(items, currency, source.meta?.language !== "en");
    const sourceRefLabel = source.reference || (source.meta?.serial ? `#${source.meta.serial}` : source.id);
    const baseNotes = (source.meta?.notes || "").trim();
    const conversionNote = `محوّلة من فاتورة مبدئية (${sourceRefLabel})`;

    salesRecord = {
      id: salesId,
      meta: {
        ...source.meta,
        type: "sales",
        date: todayDate,
        serial: source.meta?.serial || "001",
        currency,
        notes: baseNotes ? `${baseNotes}\n${conversionNote}` : conversionNote,
      },
      items,
      totalAmount,
      totalInWords,
      currency,
      projectId: source.projectId ?? options?.projectId ?? undefined,
      customerId: source.customerId ?? options?.customerId ?? undefined,
      reference: undefined,
      referenceAssignedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
  } else {
    const legacy = source as ProformaInvoice;
    const currency = legacy.currency || legacy.meta?.currency || "SDG";
    const items: CustomInvoiceItem[] = (legacy.lines || []).map((line, idx) => ({
      id: `${salesId}-item-${idx}`,
      description: line.description || "بند",
      material: line.material,
      dimensions:
        line.width && line.height ? `${line.width}×${line.height} سم` : undefined,
      qty: Number(line.qty) || 1,
      unitPrice: Number(line.unitPrice) || 0,
      total: Number(line.total) || 0,
    }));
    const { totalAmount, totalInWords } = calculateCustomInvoiceTotals(items, currency, legacy.meta?.language !== "en");
    const sourceRefLabel = legacy.meta?.serial ? `#${legacy.meta.serial}` : legacy.id;
    const baseNotes = (legacy.meta?.notes || "").trim();
    const conversionNote = `محوّلة من عرض سعر (${sourceRefLabel})`;

    salesRecord = {
      id: salesId,
      meta: {
        serial: legacy.meta?.serial || "001",
        type: "sales",
        date: todayDate,
        partyName:
          legacy.meta?.customerName?.trim() ||
          legacy.meta?.customerEnName?.trim() ||
          "عميل غير محدد",
        partyEnName: legacy.meta?.customerEnName?.trim() || undefined,
        attn: legacy.meta?.attn?.trim() || undefined,
        phone: legacy.meta?.phone?.trim() || undefined,
        language: legacy.meta?.language || "auto",
        currency,
        salutation: "بعد التحية والاحترام ،،،،،،،،",
        closingNote: "لكم جزيل الشكر والتقدير ،،،،،،،،،،،،،،،،،،،،،،،",
        accountNumber: "3283046",
        accountName: legacy.meta?.accountName || "طارق عثمان / تي ايه للدعايه والاعلان",
        signatoryTitle: "الإدارة",
        notes: baseNotes ? `${baseNotes}\n${conversionNote}` : conversionNote,
      },
      items,
      totalAmount,
      totalInWords,
      currency,
      projectId: legacy.projectId ?? options?.projectId ?? undefined,
      customerId: options?.customerId ?? undefined,
      reference: undefined,
      referenceAssignedAt: undefined,
      createdAt: now,
      updatedAt: now,
    };
  }

  const saved = await saveCustomInvoice(salesRecord);
  if (!isCustomProforma && Capacitor.isNativePlatform()) {
    await repoUpdateProformaStatus(source.id, "converted", saved.id).catch(() => undefined);
  }
  return { salesInvoice: saved, alreadyConverted: false };
}

/**
 * تحويل فاتورة مبدئية (عرض سعر) مباشرة إلى فاتورة مبيعات معتمدة
 * محفوظة في سجل فواتير المبيعات ومربوطة بنفس المشروع والعميل.
 */
export function convertProformaToSalesInvoice(
  source: CustomInvoice | ProformaInvoice,
  options?: { projectId?: string | null; customerId?: string | null }
): Promise<ConvertToSalesResult> {
  const existing = inFlightConversions.get(source.id);
  if (existing) return existing;

  const run = executeConvertProformaToSales(source, options).finally(() => {
    if (inFlightConversions.get(source.id) === run) {
      inFlightConversions.delete(source.id);
    }
  });
  inFlightConversions.set(source.id, run);
  return run;
}

/** تصفير حالة المتجر (للاختبارات فقط) — يحاكي إعادة تشغيل التطبيق. */
export function resetCustomInvoicesStoreForTests(): void {
  snapshot = [];
}

/**
 * ملاحظة (PRD §5.3.2): كان هذا الدالة تولّد رقماً بعدّ الفواتير المعروضة، وهو
 * ما يسبب تكرار المراجع بعد أي حذف. المرجع الرسمي الآن يُولَّد ذرّياً في
 * المستودع عند أول حفظ (`allocateInvoiceReference`)، ولا يُعرض في الواجهة قبل
 * الحفظ لأن المستند يمنع إسناده من حالة واجهة مؤقتة (§5.3.1).
 */
export function describeReferenceForType(type: CustomInvoiceType): string {
  const prefix = type === "purchase" ? "PINV" : type === "sales" ? "INV" : "";
  return prefix ? `${prefix}-DDMMYYYY-NNN` : "—";
}
