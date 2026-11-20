/**
 * ═══════════════════════════════════════════════════════════════
 * One-Time Data Migration: localStorage → SQLite
 * ═══════════════════════════════════════════════════════════════
 * Runs ONCE on first launch after SQLite is installed.
 * Reads all existing data from localStorage + Capacitor Preferences,
 * writes to SQLite, then marks migration complete.
 * Zero data loss guaranteed — existing data is NOT deleted.
 */

import { Preferences } from "@capacitor/preferences";
import { getDb } from "./index";
import { SETTINGS_KEYS, SEQ_KEYS } from "./schema";

/** Legacy storage keys from the old nativeStorage layer */
const LEGACY_KEYS = {
  CUSTOM_INVOICES: "future_custom_invoices_v2",
  PROFORMA_INVOICES: "future_proforma_invoices_v2",
  PRINT_INVOICES: "future_print_invoices_v2",
  CUSTOMERS: "future_print_customers_v2",
  ORDERS: "future_print_orders_v2",
  INVOICE_SEQ: "future_invoice_seq",
  PROFORMA_SEQ: "future_proforma_seq",
  PASSWORD_HASH: "future_calc_app_password_hash",
  SOUND_ENABLED: "future_print_sound_enabled",
  USER_NAME: "future_print_user_name",
  ONBOARDED: "future_print_onboarded",
  ORDER_SESSION: "future_calculator_order_session",
  LICENSE: "future_print_license_v1",
  INSTALL_ID: "future_print_install_id",
  TIME_HWM: "future_print_time_hwm",
  LICENSE_PENDING: "future_print_license_pending",
  RENEWAL_PENDING: "future_print_renewal_pending",
};

type MigrationReport = {
  success: boolean;
  migrated: {
    customInvoices: number;
    proformaInvoices: number;
    printInvoices: number;
    customers: number;
    orders: number;
  };
  errors: string[];
};

/**
 * Check if migration has already been performed.
 */
export async function isMigrationDone(): Promise<boolean> {
  try {
    const db = await getDb();
    const res = await db.query(
      "SELECT value FROM settings WHERE key = ?",
      [SETTINGS_KEYS.MIGRATION_DONE]
    );
    return res.values?.[0]?.value === "true";
  } catch {
    return false;
  }
}

/**
 * Read a JSON array from localStorage or Preferences (best-effort).
 */
async function readLegacyArray(key: string): Promise<any[]> {
  // Try localStorage first (most recent)
  if (typeof window !== "undefined") {
    try {
      const val = localStorage.getItem(key);
      if (val && val !== "[]") {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
  }
  // Fallback to Capacitor Preferences (Android SharedPreferences)
  try {
    const res = await Preferences.get({ key });
    if (res.value && res.value !== "[]") {
      const parsed = JSON.parse(res.value);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

/**
 * Read a string setting from localStorage or Preferences.
 */
async function readLegacyString(key: string): Promise<string> {
  if (typeof window !== "undefined") {
    try {
      const val = localStorage.getItem(key);
      if (val) return val;
    } catch {}
  }
  try {
    const res = await Preferences.get({ key });
    return res.value || "";
  } catch {
    return "";
  }
}

/**
 * Perform the full one-time migration.
 * Safe to call multiple times — will no-op if already done.
 */
export async function runMigration(): Promise<MigrationReport> {
  const report: MigrationReport = {
    success: false,
    migrated: { customInvoices: 0, proformaInvoices: 0, printInvoices: 0, customers: 0, orders: 0 },
    errors: [],
  };

  try {
    // Guard: skip if already done
    if (await isMigrationDone()) {
      report.success = true;
      return report;
    }

    const db = await getDb();

    // Read all legacy payloads BEFORE opening the SQLite transaction so we never
    // hold a write lock across async Preferences/localStorage bridge calls.
    const settingsKeysToMigrate = [
      LEGACY_KEYS.PASSWORD_HASH,
      LEGACY_KEYS.SOUND_ENABLED,
      LEGACY_KEYS.USER_NAME,
      LEGACY_KEYS.ONBOARDED,
      LEGACY_KEYS.ORDER_SESSION,
      LEGACY_KEYS.LICENSE,
      LEGACY_KEYS.INSTALL_ID,
      LEGACY_KEYS.TIME_HWM,
      LEGACY_KEYS.LICENSE_PENDING,
      LEGACY_KEYS.RENEWAL_PENDING,
    ];

    const customInvoices = await readLegacyArray(LEGACY_KEYS.CUSTOM_INVOICES);
    const proformas = await readLegacyArray(LEGACY_KEYS.PROFORMA_INVOICES);
    const printInvoices = await readLegacyArray(LEGACY_KEYS.PRINT_INVOICES);
    const customers = await readLegacyArray(LEGACY_KEYS.CUSTOMERS);
    const orders = await readLegacyArray(LEGACY_KEYS.ORDERS);
    const invoiceSeq = await readLegacyString(LEGACY_KEYS.INVOICE_SEQ);
    const proformaSeq = await readLegacyString(LEGACY_KEYS.PROFORMA_SEQ);
    const settingsPairs: [string, string][] = [];
    for (const sKey of settingsKeysToMigrate) {
      const val = await readLegacyString(sKey);
      if (val) settingsPairs.push([sKey, val]);
    }

    // Wrap all migration inserts in an explicit SQLite transaction (transaction=false on db.run).
    await db.beginTransaction();
    let txCommitted = false;
    try {
      // ── 1. Migrate Custom Invoices ────────────────────────────────────────
      for (let idx = 0; idx < customInvoices.length; idx++) {
        const inv = customInvoices[idx];
        const invoiceId = String(inv?.id || `mig-ci-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
        try {
          await db.run(
            `INSERT OR IGNORE INTO custom_invoices
              (id, serial, type, date, party_name, party_en_name, attn, phone,
               salutation, closing_note, account_number, account_name,
               signatory_title, notes, language, total_amount, total_in_words,
               created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              invoiceId,
              String(inv?.meta?.serial || "001"),
              String(inv?.meta?.type || "sales"),
              String(inv?.meta?.date || new Date().toISOString().slice(0, 10)),
              String(inv?.meta?.partyName || ""),
              inv?.meta?.partyEnName || null,
              inv?.meta?.attn || null,
              inv?.meta?.phone || null,
              inv?.meta?.salutation || null,
              inv?.meta?.closingNote || null,
              inv?.meta?.accountNumber || null,
              inv?.meta?.accountName || null,
              inv?.meta?.signatoryTitle || null,
              inv?.meta?.notes || null,
              inv?.meta?.language || "ar",
              Number(inv?.totalAmount) || 0,
              inv?.totalInWords || null,
              inv?.createdAt || new Date().toISOString(),
              inv?.updatedAt || new Date().toISOString(),
            ],
            false
          );

          if (Array.isArray(inv?.items)) {
            for (let i = 0; i < inv.items.length; i++) {
              const item = inv.items[i];
              await db.run(
                `INSERT OR IGNORE INTO custom_invoice_items
                  (id, invoice_id, description, material, dimensions, qty, unit_price, total, sort_order)
                 VALUES (?,?,?,?,?,?,?,?,?)`,
                [
                  String(item?.id || `mig-item-${invoiceId}-${i}`),
                  invoiceId,
                  String(item?.description || ""),
                  item?.material ?? null,
                  item?.dimensions ?? null,
                  Number(item?.qty) || 1,
                  item?.unitPrice !== undefined ? Number(item.unitPrice) : null,
                  Number(item?.total) || 0,
                  i,
                ],
                false
              );
            }
          }
          report.migrated.customInvoices++;
        } catch (itemErr) {
          report.errors.push(`Custom invoice ${invoiceId}: ${itemErr}`);
        }
      }

      // ── 2. Migrate Proforma Invoices ──────────────────────────────────────
      for (let idx = 0; idx < proformas.length; idx++) {
        const p = proformas[idx];
        const proformaId = String(p?.id || `mig-pf-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
        try {
          await db.run(
            `INSERT OR IGNORE INTO proforma_invoices
              (id, serial, date, customer_name, customer_en_name, attn, phone, branch,
               notes, validity_days, account_name, language, status, converted_order_id,
               total_area, total_qty, total_amount, total_in_words,
               created_at, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              proformaId,
              String(p?.meta?.serial || "001"),
              String(p?.meta?.date || new Date().toISOString().slice(0, 10)),
              String(p?.meta?.customerName || ""),
              p?.meta?.customerEnName || null,
              p?.meta?.attn || null,
              p?.meta?.phone || null,
              p?.meta?.branch || null,
              p?.meta?.notes || null,
              Number(p?.meta?.validityDays) || 7,
              p?.meta?.accountName || null,
              p?.meta?.language || "ar",
              p?.status || "draft",
              p?.convertedOrderId || null,
              Number(p?.totalArea) || 0,
              Number(p?.totalQty) || 0,
              Number(p?.totalAmount) || 0,
              p?.totalInWords || "",
              p?.createdAt || new Date().toISOString(),
              p?.updatedAt || new Date().toISOString(),
            ],
            false
          );

          if (Array.isArray(p?.lines)) {
            for (let i = 0; i < p.lines.length; i++) {
              const l = p.lines[i];
              await db.run(
                `INSERT OR IGNORE INTO proforma_lines
                  (id, proforma_id, description, material, width, height,
                   qty, roll_used, area, unit_price, total, sort_order)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  String(l?.id || `mig-pl-${proformaId}-${i}`),
                  proformaId,
                  String(l?.description || ""),
                  l?.material || null,
                  Number(l?.width) || 0,
                  Number(l?.height) || 0,
                  Number(l?.qty) || 1,
                  l?.rollUsed || null,
                  Number(l?.area) || 0,
                  Number(l?.unitPrice) || 0,
                  Number(l?.total) || 0,
                  i,
                ],
                false
              );
            }
          }
          report.migrated.proformaInvoices++;
        } catch (pErr) {
          report.errors.push(`Proforma ${proformaId}: ${pErr}`);
        }
      }

      // ── 3. Migrate Print Invoices ─────────────────────────────────────────
      for (let idx = 0; idx < printInvoices.length; idx++) {
        const inv = printInvoices[idx];
        const printInvoiceId = String(inv?.id || `mig-pi-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
        try {
          await db.run(
            `INSERT OR IGNORE INTO print_invoices
              (id, serial, date, customer_name, phone, branch, ship_to,
               client_types, total, paid_amount, payment_status, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              printInvoiceId,
              String(inv?.serial || "001"),
              String(inv?.date || new Date().toISOString().slice(0, 10)),
              String(inv?.customerName || ""),
              inv?.phone || null,
              inv?.branch || null,
              inv?.shipTo || null,
              JSON.stringify(Array.isArray(inv?.clientTypes) ? inv.clientTypes : []),
              Number(inv?.total) || 0,
              Number(inv?.paidAmount) || 0,
              inv?.paymentStatus || "paid",
              inv?.createdAt || new Date().toISOString(),
            ],
            false
          );

          if (Array.isArray(inv?.lines)) {
            for (let i = 0; i < inv.lines.length; i++) {
              const l = inv.lines[i];
              await db.run(
                `INSERT OR IGNORE INTO print_invoice_lines
                  (id, invoice_id, description, material, width, height, qty, unit_price, total, sort_order)
                 VALUES (?,?,?,?,?,?,?,?,?,?)`,
                [
                  `mig-pil-${printInvoiceId}-${i}`,
                  printInvoiceId,
                  String(l?.description || ""),
                  String(l?.material || ""),
                  Number(l?.width) || 0,
                  Number(l?.height) || 0,
                  Number(l?.qty) || 1,
                  Number(l?.unitPrice) || 0,
                  Number(l?.total) || 0,
                  i,
                ],
                false
              );
            }
          }
          report.migrated.printInvoices++;
        } catch (piErr) {
          report.errors.push(`Print invoice ${printInvoiceId}: ${piErr}`);
        }
      }

      // ── 4. Migrate Customers ──────────────────────────────────────────────
      for (let idx = 0; idx < customers.length; idx++) {
        const c = customers[idx];
        const customerId = String(c?.id || `mig-c-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
        try {
          await db.run(
            `INSERT OR IGNORE INTO customers
              (id, name, phone, type, address, notes,
               total_orders, total_spent, balance, created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?)`,
            [
              customerId,
              String(c?.name || ""),
              c?.phone || null,
              c?.type || "individual",
              c?.address || null,
              c?.notes || null,
              Number(c?.totalOrders) || 0,
              Number(c?.totalSpent) || 0,
              Number(c?.balance) || 0,
              c?.createdAt || new Date().toISOString(),
            ],
            false
          );
          report.migrated.customers++;
        } catch (cErr) {
          report.errors.push(`Customer ${customerId}: ${cErr}`);
        }
      }

      // ── 5. Migrate Orders ─────────────────────────────────────────────────
      for (let idx = 0; idx < orders.length; idx++) {
        const o = orders[idx];
        const orderId = String(o?.id || `mig-o-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`);
        try {
          await db.run(
            `INSERT OR IGNORE INTO orders
              (id, order_number, customer_name, customer_phone, client_type,
               status, priority, created_at, delivery_date,
               total_area, total_cost, paid_amount, branch, notes, invoice_serial)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [
              orderId,
              String(o?.orderNumber || "001"),
              String(o?.customerName || ""),
              o?.customerPhone || null,
              o?.clientType || "takeaway",
              o?.status || "new",
              o?.priority || "normal",
              o?.createdAt || new Date().toISOString(),
              o?.deliveryDate || null,
              Number(o?.totalArea) || 0,
              Number(o?.totalCost) || 0,
              Number(o?.paidAmount) || 0,
              o?.branch || null,
              o?.notes || null,
              o?.invoiceSerial || null,
            ],
            false
          );

          if (Array.isArray(o?.items)) {
            for (let i = 0; i < o.items.length; i++) {
              const item = o.items[i];
              await db.run(
                `INSERT OR IGNORE INTO order_items
                  (id, order_id, description, material, width, height,
                   qty, roll_used, area, unit_price, total, sort_order)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  String(item?.id || `mig-oi-${orderId}-${i}`),
                  orderId,
                  String(item?.description || ""),
                  item?.material || null,
                  Number(item?.width) || 0,
                  Number(item?.height) || 0,
                  Number(item?.qty) || 1,
                  item?.rollUsed || null,
                  Number(item?.area) || 0,
                  Number(item?.unitPrice) || 0,
                  Number(item?.total) || 0,
                  i,
                ],
                false
              );
            }
          }
          report.migrated.orders++;
        } catch (oErr) {
          report.errors.push(`Order ${orderId}: ${oErr}`);
        }
      }

      // ── 6. Migrate Sequences ──────────────────────────────────────────────
      try {
        if (invoiceSeq) {
          await db.run(
            "INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)",
            [SEQ_KEYS.INVOICE, invoiceSeq],
            false
          );
        }
        if (proformaSeq) {
          await db.run(
            "INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)",
            [SEQ_KEYS.PROFORMA, proformaSeq],
            false
          );
        }
      } catch (err) {
        report.errors.push(`Sequences: ${err}`);
      }

      // ── 7. Migrate Settings ───────────────────────────────────────────────
      try {
        for (const [sKey, val] of settingsPairs) {
          await db.run(
            "INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)",
            [sKey, val],
            false
          );
        }
      } catch (err) {
        report.errors.push(`Settings: ${err}`);
      }

      await db.commitTransaction();
      txCommitted = true;
    } catch (txErr) {
      if (!txCommitted) {
        try {
          await db.rollbackTransaction();
        } catch (rbErr) {
          console.warn("[DB Migration] Rollback warning:", rbErr);
        }
      }
      throw txErr;
    }

    // ── 8. Assign official references to the imported invoices ────────────
    // Runs after the bulk migration transaction commits because backfill opens
    // its own per-row numbering transactions.
    try {
      const { backfillReferencesOnly } = await import("./migrations");
      const backfill = await backfillReferencesOnly(db);
      if (backfill.assigned > 0) {
        console.info("[DB Migration] References assigned:", backfill.assigned);
      }
    } catch (err) {
      report.errors.push(`Reference backfill: ${err}`);
    }

    // ── 9. Mark migration complete ONLY when zero errors occurred ─────────
    if (report.errors.length === 0) {
      await db.run(
        "INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)",
        [SETTINGS_KEYS.MIGRATION_DONE, "true"]
      );
      report.success = true;
    } else {
      report.success = false;
    }

    console.info(
      "[DB Migration] Complete:",
      `${report.migrated.customInvoices} custom, ${report.migrated.proformaInvoices} proforma,`,
      `${report.migrated.printInvoices} print, ${report.migrated.customers} customers,`,
      `${report.migrated.orders} orders.`,
      report.errors.length > 0 ? `Errors: ${report.errors.length}` : "No errors."
    );

    if (report.errors.length > 0) {
      console.warn("[DB Migration] Partial errors:", report.errors);
    }

    return report;
  } catch (fatal) {
    report.errors.push(`Fatal: ${fatal}`);
    console.error("[DB Migration] Fatal error:", fatal);
    return report;
  }
}

