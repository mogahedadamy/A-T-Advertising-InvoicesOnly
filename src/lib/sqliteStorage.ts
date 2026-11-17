/**
 * ═══════════════════════════════════════════════════════════════
 * SQLite Storage Engine — T.A Advertising Invoice System
 * ═══════════════════════════════════════════════════════════════
 *
 * Drop-in async replacement for the previous 3-layer nativeStorage.
 * On Android: persists to SQLite (WAL mode, crash-safe).
 * On Web/Dev: falls back to localStorage gracefully.
 *
 * Architecture:
 *   Stores → sqliteStorage (this file) → Repositories → SQLite DB
 *
 * This module is intentionally thin — it bridges the
 * synchronous React external store pattern to the async
 * SQLite persistence layer, using an in-memory cache for
 * synchronous reads (required by useSyncExternalStore).
 */

import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { getDb } from "./database";
import { notifyDataChanged } from "./backup/notify";

const PROFILE_FAILSAFE_KEYS = new Set(["future_print_user_name", "future_print_onboarded"]);

// In-memory cache for synchronous reads (useSyncExternalStore requirement)
const memoryCache = new Map<string, string>();
// Structured object cache to eliminate redundant JSON.stringify / JSON.parse cycles
const parsedCache = new Map<string, any>();
let _ready = false;
const _readyListeners: (() => void)[] = [];

export function isStorageReady(): boolean {
  return _ready;
}

/** Clear all cached rows in memory so restored/reloaded snapshots start cleanly. */
export function clearSQLiteMemoryCache(): void {
  memoryCache.clear();
  parsedCache.clear();
  _ready = false;
}

/** Remove device profile failsafes before a full-replace restore so old Preferences never shadow the restored snapshot. */
export async function clearProfileFailsafePreferences(): Promise<void> {
  for (const key of PROFILE_FAILSAFE_KEYS) {
    memoryCache.delete(key);
    parsedCache.delete(key);
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key }).catch(() => {});
    }
  }
}

/** Update in-memory cache immediately with raw string (and localStorage on web) */
export function setMemoryCacheString(key: string, value: string): void {
  memoryCache.set(key, value);
  parsedCache.delete(key);
  if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}

/** Update in-memory cache immediately (and localStorage on web) without touching SQLite settings table */
export function setMemoryCacheJson<T>(key: string, data: T): void {
  parsedCache.set(key, data);
  if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {}
  }
}

/** Called by initSQLiteStorage() when DB is open and data is loaded */
function markReady() {
  _ready = true;
  _readyListeners.forEach((fn) => fn());
  _readyListeners.length = 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("native-storage-ready"));
  }
}

/**
 * Synchronous read from memory cache (required by useSyncExternalStore).
 * Returns fallback if key not yet loaded.
 */
export function getStoredSync(key: string, defaultValue: string = ""): string {
  if (memoryCache.has(key)) return memoryCache.get(key)!;
  // Browser or Native localStorage fast cache
  if (typeof window !== "undefined") {
    try {
      const val = localStorage.getItem(key);
      if (val !== null) {
        memoryCache.set(key, val);
        return val;
      }
    } catch {}
  }
  return defaultValue;
}

/** Safe JSON parse wrapper with structured cache lookup for synchronous reads */
export function getStoredJsonSync<T>(key: string, fallback: T): T {
  if (parsedCache.has(key)) {
    return parsedCache.get(key) as T;
  }
  const raw = getStoredSync(key, "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (parsed !== null && parsed !== undefined) {
      parsedCache.set(key, parsed);
      return parsed as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/**
 * Persist a string value to SQLite (async) + update memory cache.
 *
 * Non-entity data (password hash, license, profile, sequences, …) is stored in
 * the `settings` table. The two serial-counter keys are routed to `sequences`
 * because that is the table the app reads them from on startup — writing them
 * to `settings` was silently losing the invoice/proforma counters.
 */
export async function setStoredItem(key: string, value: string): Promise<void> {
  const previousValue = memoryCache.get(key);
  memoryCache.set(key, value);
  parsedCache.delete(key);

  if (!Capacitor.isNativePlatform()) {
    // Browser fallback
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      if (previousValue !== undefined) memoryCache.set(key, previousValue);
      else memoryCache.delete(key);
      console.error(`[SQLiteStorage] Failed to write localStorage for key ${key}:`, err);
      throw err;
    }
    return;
  }

  if (PROFILE_FAILSAFE_KEYS.has(key)) {
    Preferences.set({ key, value }).catch(() => {});
  }

  try {
    const db = await getDb();
    if (isSequenceKey(key)) {
      await db.run("INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)", [key, value]);
    }
    await db.run("INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)", [key, value]);
    notifyDataChanged();
  } catch (err) {
    // Roll back in-memory cache to maintain durability & consistency
    if (previousValue !== undefined) {
      memoryCache.set(key, previousValue);
    } else {
      memoryCache.delete(key);
    }
    console.error(`[SQLiteStorage] CRITICAL: setStoredItem failed for key ${key} — memory rolled back:`, err);
    throw err;
  }
}

/** Keys mirrored into the `sequences` table. */
export function isSequenceKey(key: string): boolean {
  return key === "future_invoice_seq" || key === "future_proforma_seq";
}

/** JSON serialize and persist */
export async function setStoredJson<T>(key: string, data: T): Promise<void> {
  await setStoredItem(key, JSON.stringify(data));
}

/** Remove a key from cache and DB */
export async function removeStoredItem(key: string): Promise<void> {
  memoryCache.delete(key);
  parsedCache.delete(key);

  if (!Capacitor.isNativePlatform()) {
    try {
      localStorage.removeItem(key);
    } catch {}
    return;
  }

  try {
    const db = await getDb();
    await db.run("DELETE FROM settings WHERE key = ?", [key]);
    if (isSequenceKey(key)) {
      await db.run("DELETE FROM sequences WHERE key = ?", [key]);
    }
  } catch {}
}

/**
 * Pre-load all entity data into memory cache on startup.
 * This is what enables synchronous reads in useSyncExternalStore.
 */
async function preloadEntityCaches(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Browser: load from localStorage (dev mode)
    const keys = [
      "future_custom_invoices_v2",
      "future_proforma_invoices_v2",
      "future_print_invoices_v2",
      "future_print_customers_v2",
      "future_print_orders_v2",
      "future_invoice_seq",
      "future_proforma_seq",
      "future_calc_app_password_hash",
      "future_print_sound_enabled",
      "future_print_user_name",
      "future_print_onboarded",
      "future_calculator_order_session",
      "future_print_license_v1",
      "future_print_install_id",
      "future_print_time_hwm",
      "future_print_license_pending",
      "future_print_renewal_pending",
    ];
    if (typeof window !== "undefined") {
      for (const key of keys) {
        try {
          const val = localStorage.getItem(key);
          if (val !== null) memoryCache.set(key, val);
        } catch {}
      }
    }
    return;
  }

  // On Android: load from repositories into cache-compatible JSON format
  try {
    const [
      { getAllCustomInvoices },
      { getAllCustomers },
      { getAllOrders },
      { getAllPrintInvoices },
      { getAllProformaInvoices },
      { getAllProjects },
      { getSequence },
    ] = await Promise.all([
      import("./repositories/CustomInvoiceRepository"),
      import("./repositories/CustomerRepository"),
      import("./repositories/OrderRepository"),
      import("./repositories/PrintInvoiceRepository"),
      import("./repositories/ProformaRepository"),
      import("./repositories/ProjectRepository"),
      import("./repositories/SettingsRepository"),
    ]);

    const [customInvoices, customers, orders, printInvoices, proformaInvoices, projects] =
      await Promise.all([
        getAllCustomInvoices().catch(() => []),
        getAllCustomers().catch(() => []),
        getAllOrders().catch(() => []),
        getAllPrintInvoices().catch(() => []),
        getAllProformaInvoices().catch(() => []),
        getAllProjects().catch(() => []),
      ]);

    parsedCache.set("future_custom_invoices_v2", customInvoices);
    parsedCache.set("future_print_customers_v2", customers);
    parsedCache.set("future_print_orders_v2", orders);
    parsedCache.set("future_print_invoices_v2", printInvoices);
    parsedCache.set("future_proforma_invoices_v2", proformaInvoices);
    parsedCache.set("future_print_projects_v1", projects);

    // Load sequences, falling back to the settings mirror written by older builds
    const db = await getDb();
    const [invSeq, proformaSeq] = await Promise.all([
      getSequence("future_invoice_seq").catch(() => ""),
      getSequence("future_proforma_seq").catch(() => ""),
    ]);
    const lookupSequenceInSettings = async (key: string): Promise<string> => {
      try {
        const res = await db.query("SELECT value FROM settings WHERE key = ?", [key]);
        return String(res.values?.[0]?.value ?? "");
      } catch {
        return "";
      }
    };
    const [invSeqFromSettings, proformaSeqFromSettings] = await Promise.all([
      invSeq ? Promise.resolve("") : lookupSequenceInSettings("future_invoice_seq"),
      proformaSeq ? Promise.resolve("") : lookupSequenceInSettings("future_proforma_seq"),
    ]);

    const resolvedInvSeq = invSeq || invSeqFromSettings;
    const resolvedProformaSeq = proformaSeq || proformaSeqFromSettings;

    if (resolvedInvSeq) memoryCache.set("future_invoice_seq", resolvedInvSeq);
    if (resolvedProformaSeq) memoryCache.set("future_proforma_seq", resolvedProformaSeq);

    // Repair the sequences table for installs affected by the old writer.
    if (!invSeq && resolvedInvSeq) {
      await db.run("INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)", ["future_invoice_seq", resolvedInvSeq]).catch(() => undefined);
    }
    if (!proformaSeq && resolvedProformaSeq) {
      await db.run("INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)", ["future_proforma_seq", resolvedProformaSeq]).catch(() => undefined);
    }

    // Load ALL settings rows into memoryCache (password hash, profile, license, sound, session, etc.)
    const settingsRes = await db.query("SELECT key, value FROM settings");
    for (const row of settingsRes.values || []) {
      if (row?.key && row?.value !== undefined && row?.value !== null) {
        memoryCache.set(String(row.key), String(row.value));
      }
    }

    // Keep onboarding/profile Preferences aligned with SQLite settings, and only
    // backfill from Preferences if SQLite has no value yet.
    for (const key of PROFILE_FAILSAFE_KEYS) {
      const fromDb = memoryCache.get(key);
      if (fromDb) {
        Preferences.set({ key, value: fromDb }).catch(() => {});
      } else {
        try {
          const pref = await Preferences.get({ key });
          if (pref.value) {
            memoryCache.set(key, pref.value);
            await db.run("INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)", [key, pref.value]).catch(() => {});
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn("[SQLiteStorage] Preload error:", err);
    // Keep onboarding state alive even if SQLite failed to preload
    for (const key of PROFILE_FAILSAFE_KEYS) {
      try {
        const pref = await Preferences.get({ key });
        if (pref.value) memoryCache.set(key, pref.value);
      } catch {}
    }
  }
}

/**
 * Initialize SQLite storage engine.
 * Call once at app startup BEFORE mounting React.
 * Replaces the old initNativeStorage() call in main.tsx.
 */
export async function initSQLiteStorage(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Initialize DB connection + schema
      const { getDb } = await import("./database");
      await getDb();

      // 2. Run one-time migration from localStorage → SQLite
      const { runMigration, isMigrationDone } = await import("./database/migration");
      const migrationAlreadyDone = await isMigrationDone();
      if (!migrationAlreadyDone) {
        const report = await runMigration();
        console.info("[Storage] Migration result:", report.migrated, "errors:", report.errors.length);
      }
    }

    // 3. Pre-load all entity data into memory cache
    await preloadEntityCaches();

    // 4. Signal readiness
    markReady();
  } catch (err) {
    console.error("[Storage] Init error:", err);
    // Still mark ready so app can function in degraded mode
    markReady();
  }
}

/** Invalidate a specific cache key and refresh from DB */
export async function refreshCache(cacheKey: string, fetchFn: () => Promise<any[]>): Promise<void> {
  try {
    const data = await fetchFn();
    parsedCache.set(cacheKey, data);
    memoryCache.delete(cacheKey);
  } catch (err) {
    console.warn(`[SQLiteStorage] refreshCache failed for ${cacheKey}:`, err);
  }
}

