/**
 * ═══════════════════════════════════════════════════════════════
 * Restore orchestration (web side)
 * ═══════════════════════════════════════════════════════════════
 * The native engine owns snapshot validation and the atomic file swap.
 * This module owns everything the WebView must do around it:
 *
 *  1. Pre-update protection: before the database schema is upgraded by this
 *     release, take a verified backup of the old database (type E).
 *  2. After a native restore: drop the SQLite connection, reopen, run any
 *     pending schema migration, and reload every in-memory store so the UI
 *     shows restored data without a restart.
 *  3. Legacy JSON import (pre-engine exports) in a single transaction.
 */

import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { closeDb, getDb } from "@/lib/database";
import { DB_VERSION } from "@/lib/database/schema";
import { backupBridge, isBackupEngineAvailable } from "./bridge";
import { getBackupSettingsSnapshot, loadBackupSettings, saveBackupSettings } from "./settingsStore";
import { normalizeLegacyBackup, detectLegacyBackup } from "./legacyImport";
import type { RestoreMode, RestoreResult } from "./types";

const PRE_UPDATE_MARKER = "backup_pre_update_done_v";

/** True on the first launch after the app version changed (checked natively). */
export async function runPreUpdateBackupIfNeeded(allowed = true): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || !isBackupEngineAvailable() || !allowed) return false;
  try {
    await loadBackupSettings();
    const settings = getBackupSettingsSnapshot();
    if (!settings.folderUri) return false;
    const info = await backupBridge.getEngineInfo();
    if (!info?.ok) return false;
    const versionKey = PRE_UPDATE_MARKER + info.engineVersion;
    if (settings.lastPreUpdateVersion === versionKey) return false;
    // Record the attempt first: a failing backup must not retry on every launch,
    // it surfaces through the dashboard warning instead.
    await saveBackupSettings({ lastPreUpdateVersion: versionKey });
    const result = await backupBridge.createBackup("pre-update", {
      skipIfUnchanged: true,
      encrypt: settings.encryptionEnabled,
    });
    if (result.ok) {
      await saveBackupSettings({ lastBackupAt: new Date().toISOString(), lastBackupStatus: "ok", lastBackupMessage: null });
      if (!result.skipped) {
        console.info("[Backup] pre-update backup created:", result.fileName);
      }
    } else {
      console.warn("[Backup] pre-update backup failed:", result.message);
    }
    return result.ok;
  } catch (err) {
    console.warn("[Backup] pre-update check failed:", err);
    return false;
  }
}

/**
 * Reloads the whole application state from the database after it changed
 * outside the normal store flow (restore, legacy import, pending migration).
 */
export async function reloadAllStoresFromDatabase(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { initSQLiteStorage } = await import("@/lib/sqliteStorage");
    await closeDb();
    await getDb();
    // initSQLiteStorage re-runs the localStorage → SQLite migration only when its
    // marker is absent, which is exactly what a restored older snapshot needs.
    await initSQLiteStorage();
    // Signal every store hook (useSyncExternalStore) to re-read the cache.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("native-storage-ready"));
    }
  } catch (err) {
    console.error("[Backup] reload after restore failed:", err);
    toast.error("تمت الاستعادة لكن تعذّر تحديث الواجهة — أعد تشغيل التطبيق.");
  }
}

/**
 * Runs a restore and, on success, refreshes the UI.
 * A failed restore leaves the current database untouched (native guarantee).
 */
export async function restoreBackup(fileName: string, mode: RestoreMode): Promise<RestoreResult> {
  if (!isBackupEngineAvailable()) {
    return { ok: false, mode, counts: {}, errorCode: "UNSUPPORTED", message: "الاستعادة متاحة داخل تطبيق أندرويد فقط." };
  }
  const result = await backupBridge.restoreBackup(fileName, mode);
  if (result.ok) {
    // Reopen the (possibly older-schema) restored database and migrate it.
    await closeDb();
    try {
      await getDb();
    } catch (err) {
      console.error("[Backup] reopening restored database failed:", err);
    }
    await reloadAllStoresFromDatabase();
  }
  return result;
}

/** Reads the live physical schema version, defaulting to the compiled one. */
export async function getCurrentSchemaVersion(): Promise<number> {
  try {
    const counts = await backupBridge.getDbCounts();
    if (counts?.ok && counts.schemaVersion > 0) return counts.schemaVersion;
  } catch {
    // fall through
  }
  return DB_VERSION;
}

/**
 * Imports a legacy JSON export in ONE transaction.
 * Any error rolls the whole import back, so a half-imported file is impossible.
 */
export async function importLegacyJson(text: string): Promise<{ ok: boolean; message: string; added: number }> {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return { ok: false, message: "الملف ليس JSON صالحاً.", added: 0 };
  }
  const detection = detectLegacyBackup(doc);
  if (!detection.ok) return { ok: false, message: detection.reason || "ملف نسخة غير معروف.", added: 0 };

  // Tamper check: the legacy format carried a checksum over `data`.
  const root = doc as any;
  if (root.checksum && root.data) {
    const expected = await sha256Of(JSON.stringify(root.data));
    if (expected && expected !== root.checksum) {
      return { ok: false, message: "فشل التحقق من بصمة الملف القديم — الملف تالف أو معدّل.", added: 0 };
    }
  }

  const normalized = normalizeLegacyBackup(doc, new Date().toISOString());
  const db = await getDb();

  // Conflict pre-flight: a row that already exists with the same id but
  // different data cannot be imported by INSERT OR IGNORE. Importing silently
  // would report a success the user did not get, so we refuse the whole file
  // and tell them exactly what conflicts.
  const conflicts = await findConflicts(db, normalized);
  if (conflicts.length > 0) {
    return {
      ok: false,
      added: 0,
      message:
        "تعارض بيانات: " + conflicts.length + " سجل موجود في الجهاز بمحتوى مختلف عن الملف (مثال: " + conflicts[0] + "). لم يتم استيراد أي شيء.",
    };
  }

  let added = 0;
  // The plugin tracks transactions per connection; use its explicit API so a
  // constraint violation in row N rolls back rows 1..N-1 too.
  await db.beginTransaction();
  try {
    for (const inv of normalized.customInvoices) {
      await db.run(
        `INSERT OR IGNORE INTO custom_invoices
          (id, serial, type, date, party_name, party_en_name, attn, phone, salutation,
           closing_note, account_number, account_name, signatory_title, notes, language,
           total_amount, total_in_words, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          inv.id, inv.serial, inv.type, inv.date, inv.partyName, inv.partyEnName, inv.attn, inv.phone,
          inv.salutation, inv.closingNote, inv.accountNumber, inv.accountName, inv.signatoryTitle,
          inv.notes, inv.language, inv.totalAmount, inv.totalInWords, inv.createdAt, inv.updatedAt,
        ]
      );
      added += await changes(db);
    }
    for (const row of normalized.customInvoiceItems) {
      const it = row.item;
      await db.run(
        `INSERT OR IGNORE INTO custom_invoice_items
          (id, invoice_id, description, material, dimensions, qty, unit_price, total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          String(it?.id || `imp-${row.invoiceId}-${row.sortOrder}`), row.invoiceId, String(it?.description || ""),
          it?.material ?? null, it?.dimensions ?? null, Number(it?.qty) || 1,
          it?.unitPrice != null ? Number(it.unitPrice) : null, Number(it?.total) || 0, row.sortOrder,
        ]
      );
    }
    for (const p of normalized.proformaInvoices) {
      await db.run(
        `INSERT OR IGNORE INTO proforma_invoices
          (id, serial, date, customer_name, customer_en_name, attn, phone, branch, notes,
           validity_days, account_name, language, status, converted_order_id, total_area,
           total_qty, total_amount, total_in_words, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          p.id, p.serial, p.date, p.customerName, p.customerEnName, p.attn, p.phone, p.branch, p.notes,
          p.validityDays, p.accountName, p.language, p.status, p.convertedOrderId, p.totalArea,
          p.totalQty, p.totalAmount, p.totalInWords, p.createdAt, p.updatedAt,
        ]
      );
      added += await changes(db);
    }
    for (const row of normalized.proformaLines) {
      const l = row.line;
      await db.run(
        `INSERT OR IGNORE INTO proforma_lines
          (id, proforma_id, description, material, width, height, qty, roll_used, area,
           unit_price, total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          String(l?.id || `imp-pl-${row.proformaId}-${row.sortOrder}`), row.proformaId, String(l?.description || ""),
          l?.material ?? null, Number(l?.width) || 0, Number(l?.height) || 0, Number(l?.qty) || 1,
          l?.rollUsed ?? null, Number(l?.area) || 0, Number(l?.unitPrice) || 0, Number(l?.total) || 0, row.sortOrder,
        ]
      );
    }
    for (const inv of normalized.printInvoices) {
      await db.run(
        `INSERT OR IGNORE INTO print_invoices
          (id, serial, date, customer_name, phone, branch, ship_to, client_types, total,
           paid_amount, payment_status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          inv.id, inv.serial, inv.date, inv.customerName, inv.phone, inv.branch, inv.shipTo,
          inv.clientTypes, inv.total, inv.paidAmount, inv.paymentStatus, inv.createdAt,
        ]
      );
      added += await changes(db);
    }
    for (const row of normalized.printInvoiceLines) {
      const l = row.line;
      await db.run(
        `INSERT OR IGNORE INTO print_invoice_lines
          (id, invoice_id, description, material, width, height, qty, unit_price, total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          `pil-${row.invoiceId}-${row.sortOrder}`, row.invoiceId, String(l?.description || ""),
          String(l?.material || ""), Number(l?.width) || 0, Number(l?.height) || 0, Number(l?.qty) || 1,
          Number(l?.unitPrice) || 0, Number(l?.total) || 0, row.sortOrder,
        ]
      );
    }
    for (const c of normalized.customers) {
      await db.run(
        `INSERT OR IGNORE INTO customers
          (id, name, phone, type, address, notes, total_orders, total_spent, balance, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [c.id, c.name, c.phone, c.type, c.address, c.notes, c.totalOrders, c.totalSpent, c.balance, c.createdAt]
      );
      added += await changes(db);
    }
    for (const o of normalized.orders) {
      await db.run(
        `INSERT OR IGNORE INTO orders
          (id, order_number, customer_name, customer_phone, client_type, status, priority,
           created_at, delivery_date, total_area, total_cost, paid_amount, branch, notes, invoice_serial)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          o.id, o.orderNumber, o.customerName, o.customerPhone, o.clientType, o.status, o.priority,
          o.createdAt, o.deliveryDate, o.totalArea, o.totalCost, o.paidAmount, o.branch, o.notes, o.invoiceSerial,
        ]
      );
      added += await changes(db);
    }
    for (const row of normalized.orderItems) {
      const it = row.item;
      await db.run(
        `INSERT OR IGNORE INTO order_items
          (id, order_id, description, material, width, height, qty, roll_used, area,
           unit_price, total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          String(it?.id || `imp-oi-${row.orderId}-${row.sortOrder}`), row.orderId, String(it?.description || ""),
          it?.material ?? null, Number(it?.width) || 0, Number(it?.height) || 0, Number(it?.qty) || 1,
          it?.rollUsed ?? null, Number(it?.area) || 0, Number(it?.unitPrice) || 0, Number(it?.total) || 0, row.sortOrder,
        ]
      );
    }
    for (const seq of normalized.sequences) {
      await db.run(
        "INSERT INTO sequences(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value = CASE WHEN CAST(excluded.value AS INTEGER) > CAST(value AS INTEGER) THEN excluded.value ELSE value END",
        [seq.key, seq.value]
      );
    }
    await db.commitTransaction();
  } catch (err: any) {
    try {
      await db.rollbackTransaction();
    } catch {
      // transaction already resolved
    }
    console.error("[Backup] legacy import rolled back:", err);
    return { ok: false, message: "فشلت الاستعادة وتم التراجع عنها بالكامل: " + (err?.message ?? err), added: 0 };
  }

  await reloadAllStoresFromDatabase();
  return {
    ok: true,
    added,
    message:
      "تمت استعادة الملف القديم: أضيفت " +
      normalized.counts.custom_invoices +
      " فاتورة مبيعات، " +
      normalized.counts.proforma_invoices +
      " عرض أسعار، " +
      normalized.counts.print_invoices +
      " فاتورة حاسبة" +
      (normalized.warnings.length ? " (مع " + normalized.warnings.length + " ملاحظة)" : "") +
      ".",
  };
}

async function changes(db: any): Promise<number> {
  try {
    const res = await db.query("SELECT changes() AS c");
    return Number(res.values?.[0]?.c ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Reports records whose id already exists locally with a different payload.
 * Compares the fields that carry business meaning, so a pure formatting change
 * (e.g. a null vs empty string) does not block an otherwise identical file.
 */
async function findConflicts(db: any, normalized: ReturnType<typeof normalizeLegacyBackup>): Promise<string[]> {
  const conflicts: string[] = [];
  const push = (label: string) => {
    if (conflicts.length < 20) conflicts.push(label);
  };

  for (const inv of normalized.customInvoices) {
    const res = await db.query(
      "SELECT serial, party_name, total_amount FROM custom_invoices WHERE id = ?",
      [inv.id]
    );
    const existing = res.values?.[0];
    if (!existing) continue;
    if (
      String(existing.serial) !== String(inv.serial) ||
      String(existing.party_name ?? "") !== String(inv.partyName ?? "") ||
      Math.abs(Number(existing.total_amount) - Number(inv.totalAmount)) > 0.009
    ) {
      push(`فاتورة ${inv.serial}`);
    }
  }

  for (const p of normalized.proformaInvoices) {
    const res = await db.query(
      "SELECT serial, customer_name, total_amount FROM proforma_invoices WHERE id = ?",
      [p.id]
    );
    const existing = res.values?.[0];
    if (!existing) continue;
    if (
      String(existing.serial) !== String(p.serial) ||
      String(existing.customer_name ?? "") !== String(p.customerName ?? "") ||
      Math.abs(Number(existing.total_amount) - Number(p.totalAmount)) > 0.009
    ) {
      push(`عرض سعر ${p.serial}`);
    }
  }

  for (const inv of normalized.printInvoices) {
    const res = await db.query(
      "SELECT serial, customer_name, total FROM print_invoices WHERE id = ?",
      [inv.id]
    );
    const existing = res.values?.[0];
    if (!existing) continue;
    if (
      String(existing.serial) !== String(inv.serial) ||
      String(existing.customer_name ?? "") !== String(inv.customerName ?? "") ||
      Math.abs(Number(existing.total) - Number(inv.total)) > 0.009
    ) {
      push(`فاتورة حاسبة ${inv.serial}`);
    }
  }

  return conflicts;
}

async function sha256Of(text: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
