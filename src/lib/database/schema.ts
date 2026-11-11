/**
 * ═══════════════════════════════════════════════════════════════
 * SQLite Database Schema — T.A Advertising Invoice Management System
 * ═══════════════════════════════════════════════════════════════
 * Version 1 — Initial schema migration from localStorage/SharedPreferences
 * Uses WAL journal mode for crash safety and atomic transactions.
 */

export const DB_NAME = "ta_invoicing_db";
export const DB_VERSION = 1;

/**
 * Complete DDL for version 1.
 * All statements executed inside a transaction on first launch.
 */
export const CREATE_SCHEMA_V1: string[] = [
  // ── Custom Invoices (Sales / Purchase / Proforma-Billing) ──────────────
  `CREATE TABLE IF NOT EXISTS custom_invoices (
    id              TEXT PRIMARY KEY NOT NULL,
    serial          TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'sales',
    date            TEXT NOT NULL,
    party_name      TEXT NOT NULL DEFAULT '',
    party_en_name   TEXT,
    attn            TEXT,
    phone           TEXT,
    salutation      TEXT,
    closing_note    TEXT,
    account_number  TEXT,
    account_name    TEXT,
    signatory_title TEXT,
    notes           TEXT,
    language        TEXT DEFAULT 'ar',
    total_amount    REAL NOT NULL DEFAULT 0,
    total_in_words  TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_custom_invoices_type_serial
     ON custom_invoices(type, serial)`,

  `CREATE INDEX IF NOT EXISTS idx_custom_invoices_date
     ON custom_invoices(date DESC)`,

  // ── Custom Invoice Items ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS custom_invoice_items (
    id          TEXT PRIMARY KEY NOT NULL,
    invoice_id  TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    material    TEXT,
    dimensions  TEXT,
    qty         REAL NOT NULL DEFAULT 1,
    unit_price  REAL,
    total       REAL NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES custom_invoices(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_custom_invoice_items_invoice
     ON custom_invoice_items(invoice_id)`,

  // ── Proforma Invoices (Legacy proforma with area/dimensions) ──────────
  `CREATE TABLE IF NOT EXISTS proforma_invoices (
    id                 TEXT PRIMARY KEY NOT NULL,
    serial             TEXT NOT NULL UNIQUE,
    date               TEXT NOT NULL,
    customer_name      TEXT NOT NULL DEFAULT '',
    customer_en_name   TEXT,
    attn               TEXT,
    phone              TEXT,
    branch             TEXT,
    notes              TEXT,
    validity_days      INTEGER DEFAULT 7,
    account_name       TEXT,
    language           TEXT DEFAULT 'ar',
    status             TEXT DEFAULT 'draft',
    converted_order_id TEXT,
    total_area         REAL DEFAULT 0,
    total_qty          INTEGER DEFAULT 0,
    total_amount       REAL DEFAULT 0,
    total_in_words     TEXT DEFAULT '',
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_proforma_date
     ON proforma_invoices(date DESC)`,

  // ── Proforma Lines ─────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS proforma_lines (
    id           TEXT PRIMARY KEY NOT NULL,
    proforma_id  TEXT NOT NULL,
    description  TEXT NOT NULL DEFAULT '',
    material     TEXT,
    width        REAL DEFAULT 0,
    height       REAL DEFAULT 0,
    qty          INTEGER DEFAULT 1,
    roll_used    TEXT,
    area         REAL DEFAULT 0,
    unit_price   REAL DEFAULT 0,
    total        REAL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (proforma_id) REFERENCES proforma_invoices(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_proforma_lines_proforma
     ON proforma_lines(proforma_id)`,

  // ── Print Invoices (Legacy calculator-generated invoices) ─────────────
  `CREATE TABLE IF NOT EXISTS print_invoices (
    id             TEXT PRIMARY KEY NOT NULL,
    serial         TEXT NOT NULL UNIQUE,
    date           TEXT NOT NULL,
    customer_name  TEXT NOT NULL DEFAULT '',
    phone          TEXT,
    branch         TEXT,
    ship_to        TEXT,
    client_types   TEXT DEFAULT '[]',
    total          REAL DEFAULT 0,
    paid_amount    REAL DEFAULT 0,
    payment_status TEXT DEFAULT 'paid',
    created_at     TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_print_invoices_date
     ON print_invoices(date DESC)`,

  // ── Print Invoice Lines ────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS print_invoice_lines (
    id          TEXT PRIMARY KEY NOT NULL,
    invoice_id  TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    material    TEXT NOT NULL DEFAULT '',
    width       REAL DEFAULT 0,
    height      REAL DEFAULT 0,
    qty         INTEGER DEFAULT 1,
    unit_price  REAL DEFAULT 0,
    total       REAL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES print_invoices(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_print_invoice_lines_invoice
     ON print_invoice_lines(invoice_id)`,

  // ── Customers ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS customers (
    id           TEXT PRIMARY KEY NOT NULL,
    name         TEXT NOT NULL DEFAULT '',
    phone        TEXT,
    type         TEXT DEFAULT 'individual',
    address      TEXT,
    notes        TEXT,
    total_orders INTEGER DEFAULT 0,
    total_spent  REAL DEFAULT 0,
    balance      REAL DEFAULT 0,
    created_at   TEXT NOT NULL
  )`,

  `CREATE INDEX IF NOT EXISTS idx_customers_name
     ON customers(name)`,

  // ── Orders (Kanban production board) ──────────────────────────────────
  `CREATE TABLE IF NOT EXISTS orders (
    id              TEXT PRIMARY KEY NOT NULL,
    order_number    TEXT NOT NULL,
    customer_name   TEXT NOT NULL DEFAULT '',
    customer_phone  TEXT,
    client_type     TEXT DEFAULT 'takeaway',
    status          TEXT DEFAULT 'new',
    priority        TEXT DEFAULT 'normal',
    created_at      TEXT NOT NULL,
    delivery_date   TEXT,
    total_area      REAL DEFAULT 0,
    total_cost      REAL DEFAULT 0,
    paid_amount     REAL DEFAULT 0,
    branch          TEXT,
    notes           TEXT,
    invoice_serial  TEXT
  )`,

  `CREATE INDEX IF NOT EXISTS idx_orders_status
     ON orders(status)`,

  `CREATE INDEX IF NOT EXISTS idx_orders_date
     ON orders(created_at DESC)`,

  // ── Order Items ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS order_items (
    id          TEXT PRIMARY KEY NOT NULL,
    order_id    TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    material    TEXT,
    width       REAL DEFAULT 0,
    height      REAL DEFAULT 0,
    qty         INTEGER DEFAULT 1,
    roll_used   TEXT,
    area        REAL DEFAULT 0,
    unit_price  REAL DEFAULT 0,
    total       REAL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
  )`,

  `CREATE INDEX IF NOT EXISTS idx_order_items_order
     ON order_items(order_id)`,

  // ── Sequences / Counters ───────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS sequences (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT ''
  )`,

  // ── App Settings ───────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT ''
  )`,

  // ── Schema Version Tracker ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS db_meta (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT ''
  )`,

  `INSERT OR IGNORE INTO db_meta(key, value) VALUES('schema_version', '1')`,
  `INSERT OR IGNORE INTO db_meta(key, value) VALUES('created_at', datetime('now'))`,
];

/** Keys used in the sequences table */
export const SEQ_KEYS = {
  INVOICE: "future_invoice_seq",
  PROFORMA: "future_proforma_seq",
} as const;

/** Keys used in the settings table */
export const SETTINGS_KEYS = {
  PASSWORD_HASH: "future_calc_app_password_hash",
  SOUND_ENABLED: "future_print_sound_enabled",
  MIGRATION_DONE: "sqlite_migration_done",
  USER_PROFILE: "future_user_profile",
  LICENSE: "future_license_key",
} as const;

