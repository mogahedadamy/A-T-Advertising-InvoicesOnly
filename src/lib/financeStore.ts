import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { getInvoicePaidMap } from "./repositories/LedgerRepository";
import type { SettlementSummary } from "./domain/finance";
import { buildSettlement } from "./domain/finance";

/**
 * مخزن التسويات — يعرض المدفوع والمتبقي لكل فاتورة مشتقاً من الدفعات الفعلية
 * (PRD §4.2). لا يُخزَّن أي مبلغ مدفوع، بل يُقرأ من التخصيصات ويُبطل عند أي
 * تغيير مالي ليسكن الجرد الفوري في القوائم.
 */
let paidByInvoice: Record<string, number> = {};
let version = 0;
const subscribers = new Set<() => void>();

function notify() {
  version += 1;
  subscribers.forEach((fn) => fn());
}

export function subscribeSettlements(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function getSettlementVersion(): number {
  return version;
}

/** يُبطل المخزن بعد أي عملية مالية لتُقرأ الأرصدة الجديدة. */
export async function refreshSettlements(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    notify();
    return;
  }
  try {
    paidByInvoice = { ...(await getInvoicePaidMap("sales")), ...(await getInvoicePaidMap("purchase")) };
  } catch (err) {
    console.warn("[FinanceStore] settlement refresh failed:", err);
    paidByInvoice = {};
  }
  notify();
}

export function settlementFor(invoiceId: string, total: number): SettlementSummary {
  return buildSettlement(total, paidByInvoice[invoiceId] ?? 0);
}

/** يقرأ المدفوع المخزّن مؤقتاً لفاتورة (لا يُخزَّن في قاعدة البيانات). */
export function getPaidAmount(invoiceId: string): number {
  return paidByInvoice[invoiceId] ?? 0;
}

export function resetSettlementsForTests(): void {
  paidByInvoice = {};
  version = 0;
}

export function useSettlementVersion(): number {
  return useSyncExternalStore(subscribeSettlements, getSettlementVersion, () => 0);
}

/** يعلن تحديث المالية والتسويات لباقي الصفحات فوراً (الفواتير، العملاء، الخزينة). */
export async function notifyFinanceUpdated(): Promise<void> {
  await refreshSettlements();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("finance-changed"));
  }
}

/** يُبطل التسويات عند حدث تحديث التخزين أو حدث مالي معلن. */
if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    void refreshSettlements();
  });
  window.addEventListener("finance-changed", () => {
    void refreshSettlements();
  });
}
