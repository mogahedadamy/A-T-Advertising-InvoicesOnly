import { useSyncExternalStore } from "react";
import type { OrderItem } from "@/lib/invoice/fromCalc";
import { getStoredJsonSync, setStoredJson } from "@/lib/sqliteStorage";

export type { OrderItem } from "@/lib/invoice/fromCalc";

const STORAGE_KEY = "future_calculator_order_session";

function loadSessionFromStorage(): OrderItem[] {
  const list = getStoredJsonSync<any[]>(STORAGE_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.map((it) => ({
    width: Number(it.width) || 0,
    height: Number(it.height) || 0,
    qty: Number(it.qty) || 1,
    displayRoll: String(it.displayRoll || it.roll || ""),
    type: String(it.type || "رول"),
    material: (it.material || "flex") as any,
    unitPrice: Number(it.unitPrice) || 0,
    area: Number(it.area) || 0,
    cost: Number(it.cost) || 0,
    description: String(it.description || ""),
  }));
}

let items: OrderItem[] = loadSessionFromStorage();
let snapshot: OrderItem[] = items;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    items = loadSessionFromStorage();
    snapshot = items;
    listeners.forEach((l) => l());
  });
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

export function setOrderItems(
  next: OrderItem[] | ((prev: OrderItem[]) => OrderItem[])
) {
  const value = typeof next === "function" ? next(items) : next;
  if (value === items) return;
  items = value;
  snapshot = value;
  setStoredJson(STORAGE_KEY, value).catch(() => {});
  listeners.forEach((l) => l());
}

export function useOrderSession() {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => []);
  return [current, setOrderItems] as const;
}
