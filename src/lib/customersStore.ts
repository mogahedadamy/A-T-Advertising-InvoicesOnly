import { useSyncExternalStore } from "react";

export type CustomerType = "agency" | "company" | "individual" | "internal";

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
}

export const CUSTOMER_TYPE_CONFIG: Record<CustomerType, { label: string; color: string; bg: string }> = {
  agency: {
    label: "وكالة دعاية (أ)",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
  company: {
    label: "شركة تجارية (ب)",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  individual: {
    label: "زبون عابر / نقدي",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  internal: {
    label: "تشغيل داخلي",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
};

import { Capacitor } from "@capacitor/core";
import { getStoredJsonSync, setMemoryCacheJson } from "./sqliteStorage";
import {
  upsertCustomer as repoUpsertCustomer,
  deleteCustomer as repoDeleteCustomer,
} from "./repositories/CustomerRepository";

const STORAGE_KEY = "future_print_customers_v2";

const INITIAL_DEMO_CUSTOMERS: CustomerRecord[] = [];

function loadCustomersFromStorage(): CustomerRecord[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, INITIAL_DEMO_CUSTOMERS);
  return Array.isArray(list) ? list : INITIAL_DEMO_CUSTOMERS;
}

let customersSnapshot: CustomerRecord[] = loadCustomersFromStorage();
const subscribers = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    customersSnapshot = loadCustomersFromStorage();
    subscribers.forEach((fn) => fn());
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
    createdAt: new Date().toISOString(),
  };
  if (Capacitor.isNativePlatform()) {
    await repoUpsertCustomer(customer);
  }
  customersSnapshot = [customer, ...customersSnapshot];
  notify();
  return customer;
}

export async function updateCustomer(id: string, updates: Partial<CustomerRecord>): Promise<void> {
  const existing = customersSnapshot.find((c) => c.id === id);
  if (!existing) return;
  const updatedRecord: CustomerRecord = { ...existing, ...updates };
  if (Capacitor.isNativePlatform()) {
    await repoUpsertCustomer(updatedRecord);
  }
  customersSnapshot = customersSnapshot.map((c) => (c.id === id ? updatedRecord : c));
  notify();
}

export async function deleteCustomer(id: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await repoDeleteCustomer(id);
  }
  customersSnapshot = customersSnapshot.filter((c) => c.id !== id);
  notify();
}
