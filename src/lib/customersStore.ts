import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "./sqliteStorage";
import {
  getAllCustomers as repoGetAllCustomers,
  upsertCustomer as repoUpsertCustomer,
  deleteCustomer as repoDeleteCustomer,
  archiveCustomer as repoArchiveCustomer,
  unarchiveCustomer as repoUnarchiveCustomer,
  canDeleteCustomer as repoCanDeleteCustomer,
  getCustomerFinancialSummary as repoGetCustomerFinancialSummary,
  getCustomerInvoicesList as repoGetCustomerInvoicesList,
  getAllCustomerFinancialSummaries as repoGetAllCustomerFinancialSummaries,
  type CustomerFinancialProfile,
  type CustomerInvoiceItemRow,
} from "./repositories/CustomerRepository";

export type CustomerType =
  | "company"
  | "institution"
  | "client"
  | "individual"
  | "agency"
  | "internal";

export const PRIMARY_CUSTOMER_TYPES = ["company", "institution", "client", "individual"] as const;

export interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  address: string;
  notes?: string;
  totalOrders: number;
  totalSpent: number;
  balance: number; // positive = credit/debt owed by client, negative = prepaid, 0 = settled
  createdAt: string;
  isArchived?: boolean;
  openingBalance?: number;
  openingBalanceCurrency?: string;
  openingBalanceDate?: string;
  openingBalanceType?: "debit" | "credit";
  openingBalanceNotes?: string;
}

export const CUSTOMER_TYPE_CONFIG: Record<CustomerType, { label: string; color: string; bg: string }> = {
  company: {
    label: "شركة",
    color: "text-[#0D4A39] dark:text-emerald-400",
    bg: "bg-[#0D4A39]/10 border-[#0D4A39]/20",
  },
  institution: {
    label: "مؤسسة",
    color: "text-[#C5A059] dark:text-[#dfbe7e]",
    bg: "bg-[#C5A059]/10 border-[#C5A059]/20",
  },
  client: {
    label: "زبون",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
  },
  individual: {
    label: "أفراد",
    color: "text-slate-700 dark:text-slate-300",
    bg: "bg-slate-500/10 border-slate-500/20",
  },
  // التوافق العكسي مع السجلات السابقة المخزنة مسبقاً
  agency: {
    label: "مؤسسة",
    color: "text-[#C5A059] dark:text-[#dfbe7e]",
    bg: "bg-[#C5A059]/10 border-[#C5A059]/20",
  },
  internal: {
    label: "مؤسسة",
    color: "text-[#C5A059] dark:text-[#dfbe7e]",
    bg: "bg-[#C5A059]/10 border-[#C5A059]/20",
  },
};

const STORAGE_KEY = "future_print_customers_v2";

const INITIAL_DEMO_CUSTOMERS: CustomerRecord[] = [];

function loadCustomersFromStorage(): CustomerRecord[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_CUSTOMERS);
  return Array.isArray(list) ? list : INITIAL_DEMO_CUSTOMERS;
}

let customersSnapshot: CustomerRecord[] = loadCustomersFromStorage();
const subscribers = new Set<() => void>();

export async function refreshCustomersFromDb(): Promise<void> {
  try {
    const list = await repoGetAllCustomers({ includeArchived: true });
    customersSnapshot = list;
    notify();
  } catch (err) {
    console.warn("[customersStore] refresh from DB skipped or failed:", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    customersSnapshot = loadCustomersFromStorage();
    void refreshCustomersFromDb();
    subscribers.forEach((fn) => fn());
  });
  window.addEventListener("finance-changed", () => {
    void refreshCustomersFromDb();
  });
}

function notify() {
  setMemoryCacheJson(STORAGE_KEY, customersSnapshot);
  subscribers.forEach((fn) => fn());
}

export function getCustomersSnapshot(): CustomerRecord[] {
  return customersSnapshot;
}

export function subscribeCustomers(fn: () => void) {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function useCustomers() {
  return useSyncExternalStore(subscribeCustomers, getCustomersSnapshot, () => INITIAL_DEMO_CUSTOMERS);
}

export async function addCustomer(
  data: Omit<CustomerRecord, "id" | "createdAt" | "totalOrders" | "totalSpent">
): Promise<CustomerRecord> {
  const customer: CustomerRecord = {
    ...data,
    id: `cust-${Date.now()}`,
    totalOrders: 0,
    totalSpent: 0,
    balance: data.balance ?? (data.openingBalanceType === "debit" ? data.openingBalance ?? 0 : -(data.openingBalance ?? 0)),
    createdAt: new Date().toISOString(),
    isArchived: false,
  };
  try {
    await repoUpsertCustomer(customer);
  } catch (err) {
    console.warn("[customersStore] repoUpsertCustomer warning:", err);
  }
  customersSnapshot = [customer, ...customersSnapshot];
  notify();
  return customer;
}

export async function updateCustomer(id: string, updates: Partial<CustomerRecord>): Promise<void> {
  const existing = customersSnapshot.find((c) => c.id === id);
  if (!existing) return;
  const updatedRecord: CustomerRecord = { ...existing, ...updates };
  try {
    await repoUpsertCustomer(updatedRecord);
  } catch (err) {
    console.warn("[customersStore] repoUpsertCustomer warning:", err);
  }
  customersSnapshot = customersSnapshot.map((c) => (c.id === id ? updatedRecord : c));
  notify();
}

/**
 * Checks whether customer deletion is permitted
 */
export async function checkCanDeleteCustomer(id: string) {
  try {
    return await repoCanDeleteCustomer(id);
  } catch {
    return { allowed: true, invoiceCount: 0, paymentCount: 0, projectCount: 0 };
  }
}

/**
 * Permanently deletes a customer if zero transactions exist.
 * Rejects with a descriptive error if historical transactions exist.
 */
export async function deleteCustomer(id: string): Promise<void> {
  const check = await repoCanDeleteCustomer(id);
  if (!check.allowed) {
    throw new Error(check.reason);
  }
  await repoDeleteCustomer(id);
  customersSnapshot = customersSnapshot.filter((c) => c.id !== id);
  notify();
}

export async function archiveCustomer(id: string): Promise<void> {
  await repoArchiveCustomer(id);
  customersSnapshot = customersSnapshot.map((c) => (c.id === id ? { ...c, isArchived: true } : c));
  notify();
}

export async function unarchiveCustomer(id: string): Promise<void> {
  await repoUnarchiveCustomer(id);
  customersSnapshot = customersSnapshot.map((c) => (c.id === id ? { ...c, isArchived: false } : c));
  notify();
}

export {
  repoGetCustomerFinancialSummary as getCustomerFinancialSummary,
  repoGetCustomerInvoicesList as getCustomerInvoicesList,
  repoGetAllCustomerFinancialSummaries as getAllCustomerFinancialSummaries,
  type CustomerFinancialProfile,
  type CustomerInvoiceItemRow,
};
