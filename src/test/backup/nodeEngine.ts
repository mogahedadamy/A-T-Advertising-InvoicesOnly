/**
 * Node port of the native engine's external behaviour (test-only).
 *
 * It is NOT a second production implementation — the shipped engine is the
 * Java one. This harness exists so the acceptance scenarios (interrupted
 * backup, corrupted file, insufficient storage, retention, foreign device,
 * merge vs replace) can be executed against REAL SQLite files and REAL
 * archives in CI, using the same pure TypeScript format/verification modules
 * that the Java engine is validated against.
 *
 * Where it intentionally re-implements logic, the test asserts the two agree
 * by round-tripping archives produced in the "Java shape".
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeArchive, openArchive } from "@/lib/backup/codec";
import { bytesToBase64, deriveKeyId, sha256Hex, utf8Encode } from "@/lib/backup/crypto";
import type { BackupFileInfo, BackupKind, BackupManifest, RetentionPolicy, TableCounts } from "@/lib/backup/types";
import { planRetention } from "@/lib/backup/retention";
import { isSchemaCompatible, isValidRestoreCounts } from "./engineAssertions";
import { closeFixture, FixtureDatabase } from "./fixtureDb";

const TABLES = [
  "custom_invoices",
  "custom_invoice_items",
  "proforma_invoices",
  "proforma_lines",
  "print_invoices",
  "print_invoice_lines",
  "customers",
  "orders",
  "order_items",
  "projects",
  "suppliers",
  "financial_accounts",
  "customer_payments",
  "customer_payment_allocations",
  "supplier_payments",
  "supplier_payment_allocations",
  "expenses",
  "expense_payments",
  "financial_transactions",
  "document_sequences",
  "audit_log",
  "sequences",
  "settings",
  "db_meta",
];

function countsOf(db: FixtureDatabase): TableCounts {
  const counts: TableCounts = {};
  for (const table of TABLES) {
    try {
      counts[table as keyof TableCounts] = db.count(table);
    } catch {
      // table absent in an older snapshot
    }
  }
  return counts;
}

export interface EngineOptions {
  /** Directory acting as the SAF folder. */
  folderDir: string;
  dbDir: string;
  dbName?: string;
  currentSchema: number;
  key?: Uint8Array;
  retention?: RetentionPolicy;
  /** Simulates storage pressure: free bytes reported by the "device". */
  freeBytes?: number;
  appVersion?: string;
  /** Simulates a database written by a newer release (migration tests). */
  overrideSchemaVersion?: number;
}

export interface CreateOptions {
  kind: BackupKind;
  skipIfUnchanged?: boolean;
  /** Test hook: throw after N bytes are written (interrupted write). */
  interruptAfterBytes?: number;
  /** Test hook: flip a byte after writing (silent corruption). */
  corruptAfterWrite?: boolean;
}

const FILE_PREFIX = "ta-backup-";
const FILE_SUFFIX = ".tabk";

export class NodeBackupEngine {
  constructor(private readonly options: EngineOptions) {}

  private dbFile(): string {
    return join(this.options.dbDir, `${this.options.dbName ?? "ta_invoicing_db"}SQLite.db`);
  }

  private ensureFolder(): string {
    if (!existsSync(this.options.folderDir)) mkdirSync(this.options.folderDir, { recursive: true });
    return this.options.folderDir;
  }

  private backupId(kind: BackupKind): string {
    const stamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    return `${stamp}-${kind}-${Math.random().toString(16).slice(2, 8)}`;
  }

  private counts(): { counts: TableCounts; schema: number; invoiceCount: number } {
    const db = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      const counts = countsOf(db);
      const schemaRow = db.db.prepare("PRAGMA user_version").get() as any;
      let schema = Number(schemaRow?.user_version ?? 0);
      if (!Number.isFinite(schema) || schema <= 0) {
        const meta = db.db.prepare("SELECT value FROM db_meta WHERE key='schema_version'").get() as any;
        const parsed = Number(meta?.value ?? 1);
        schema = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
      }
      return {
        counts,
        schema,
        invoiceCount: (counts.custom_invoices ?? 0) + (counts.proforma_invoices ?? 0) + (counts.print_invoices ?? 0),
      };
    } finally {
      db.close();
    }
  }

  // ── create ────────────────────────────────────────────────────────────

  async create(options: CreateOptions): Promise<{
    ok: boolean;
    backupId?: string;
    fileName?: string;
    sizeBytes?: number;
    manifest?: BackupManifest;
    skipped?: boolean;
    errorCode?: string;
    message?: string;
  }> {
    const folder = this.ensureFolder();
    if (!existsSync(this.dbFile())) {
      return { ok: false, errorCode: "DATABASE_UNREADABLE", message: "database does not exist" };
    }
    // Snapshot the database exactly like VACUUM INTO does on device.
    const snapshotPath = join(folder, `.snapshot-${Date.now()}.db`);
    const live = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    let image: Uint8Array;
    let schema: number;
    let quick: string;
    try {
      live.snapshotTo(snapshotPath);
      image = new Uint8Array(readFileSync(snapshotPath));
    } finally {
      live.close();
    }
    const { DatabaseSync } = await import("node:sqlite");
    const inspect = new DatabaseSync(snapshotPath);
    try {
      quick = String((inspect.prepare("PRAGMA quick_check").get() as any).quick_check);
      schema = Number((inspect.prepare("PRAGMA user_version").get() as any).user_version) || 1;
    } finally {
      inspect.close();
    }
    // A database created by a newer release keeps its schema marker; the test
    // hook lets us simulate that without inventing a fake schema.
    schema = this.options.overrideSchemaVersion ?? schema;
    unlinkSync(snapshotPath);
    if (quick.toLowerCase() !== "ok") {
      return { ok: false, errorCode: "INTEGRITY_FAILED", message: "snapshot failed quick_check: " + quick };
    }
    const meta = this.counts();
    const counts = meta.counts;
    const invoiceCount = meta.invoiceCount;

    const payloadSha = await sha256Hex(image);

    if (options.skipIfUnchanged) {
      const newest = (await this.list()).filter((b) => b.status === "verified")[0];
      if (newest?.manifest && newest.manifest.sha256 === payloadSha) {
        return { ok: true, skipped: true, backupId: newest.manifest.backupId };
      }
    }

    const id = this.backupId(options.kind);
    const manifest: BackupManifest = {
      format: "TA-BACKUP",
      manifestVersion: 1,
      backupId: id,
      kind: options.kind,
      createdAt: new Date().toISOString(),
      appVersion: this.options.appVersion ?? "1.3.1-INVOICE",
      databaseSchemaVersion: schema,
      databaseSchemaCurrent: this.options.currentSchema,
      databaseFilename: `${this.options.dbName ?? "ta_invoicing_db"}SQLite.db`,
      sha256: payloadSha,
      sizeBytes: image.length,
      payloadSha256: payloadSha,
      encrypted: Boolean(this.options.key),
      keyId: "",
      databaseMagic: "SQLite format 3\0",
      counts,
      quickCheck: "ok",
      integrity: "ok",
      invoiceCount,
      installationId: "test-install",
      appId: "com.taadvertising.invoicing",
      device: "node-test",
    };
    const envelope = utf8Encode(JSON.stringify({ header: manifest, databaseBase64: bytesToBase64(image) }));
    const keyId = this.options.key ? await deriveKeyId(this.options.key) : undefined;
    const archive = await encodeArchive(envelope, { rawKey: this.options.key, keyId });

    const free = this.options.freeBytes ?? Number.MAX_SAFE_INTEGER;
    const required = Math.ceil(archive.length * 1.35) + 8 * 1024 * 1024;
    if (free < required) {
      return { ok: false, errorCode: "INSUFFICIENT_STORAGE", message: `need ${required} have ${free}` };
    }

    const fileName = `${FILE_PREFIX}${id}${FILE_SUFFIX}`;
    const staging = join(folder, fileName + ".tmp");
    let bytes = archive;
    if (options.corruptAfterWrite) {
      bytes = new Uint8Array(archive);
      bytes[bytes.length - 20] ^= 0xff;
    }
    if (options.interruptAfterBytes != null) {
      writeFileSync(staging, bytes.subarray(0, options.interruptAfterBytes));
      // Interrupted write leaves a .tmp file and NO final file — the engine must
      // not treat it as a backup, and must never delete anything before this.
      return { ok: false, errorCode: "IO_FAILED", message: "interrupted write" };
    }
    writeFileSync(staging, bytes);
    const stored = new Uint8Array(readFileSync(staging));
    if ((await sha256Hex(stored)) !== (await sha256Hex(bytes))) {
      unlinkSync(staging);
      return { ok: false, errorCode: "VERIFY_FAILED", message: "write verification failed" };
    }
    renameSync(staging, join(folder, fileName));

    if (options.corruptAfterWrite) {
      return { ok: false, errorCode: "VERIFY_FAILED", message: "stored archive failed verification" };
    }

    // Prune only after the new file is committed and verified.
    const policy = this.options.retention ?? { daily: 7, weekly: 4, monthly: 12, keepMinimum: 2 };
    const records = await this.list();
    const decision = planRetention(records, policy, new Date().getTimezoneOffset());
    for (const name of decision.prune) {
      if (name === fileName) continue;
      const p = join(folder, name);
      if (existsSync(p)) unlinkSync(p);
    }

    return { ok: true, backupId: id, fileName, sizeBytes: archive.length, manifest };
  }

  // ── list / verify ─────────────────────────────────────────────────────

  async list(): Promise<BackupFileInfo[]> {
    const folder = this.ensureFolder();
    const names = readdirSync(folder).filter((n) => n.startsWith(FILE_PREFIX) && n.endsWith(FILE_SUFFIX));
    const out: BackupFileInfo[] = [];
    for (const name of names) {
      out.push(await this.inspect(join(folder, name), name));
    }
    return out.sort((a, b) => Date.parse(b.manifest?.createdAt ?? "0") - Date.parse(a.manifest?.createdAt ?? "0"));
  }

  private async inspect(path: string, name: string): Promise<BackupFileInfo> {
    const size = statSync(path).size;
    const base: BackupFileInfo = {
      manifest: null,
      fileName: name,
      uri: "file://" + path,
      sizeBytes: size,
      modifiedAt: statSync(path).mtimeMs,
      sha256Ok: false,
      quickCheckOk: false,
      status: "corrupt",
    };
    try {
      const bytes = new Uint8Array(readFileSync(path));
      const opened = await openArchive(bytes, this.options.key);
      const manifest = opened.manifest;
      if (!isSchemaCompatible(manifest.databaseSchemaVersion, this.options.currentSchema)) {
        return { ...base, manifest, status: "incompatible", issue: "schema newer than app" };
      }
      const sha = await sha256Hex(opened.database);
      if (sha !== manifest.sha256) {
        return { ...base, manifest, status: "corrupt", issue: "sha256 mismatch" };
      }
      return { ...base, manifest, status: "verified", sha256Ok: true, quickCheckOk: true };
    } catch (err: any) {
      const encrypted = /ENCRYPTED_NEEDS_KEY/.test(String(err?.message));
      return { ...base, status: encrypted ? "encrypted" : "corrupt", issue: String(err?.message ?? err) };
    }
  }

  // ── restore ───────────────────────────────────────────────────────────

  async restore(fileName: string, mode: "replace" | "merge"): Promise<{
    ok: boolean;
    safetyBackupId?: string;
    counts?: TableCounts;
    errorCode?: string;
    message?: string;
  }> {
    const folder = this.ensureFolder();
    const path = join(folder, fileName);
    if (!existsSync(path)) return { ok: false, errorCode: "IO_FAILED", message: "missing file" };
    const bytes = new Uint8Array(readFileSync(path));
    let opened;
    try {
      opened = await openArchive(bytes, this.options.key);
    } catch (err: any) {
      return { ok: false, errorCode: "CORRUPT_ARCHIVE", message: String(err?.message ?? err) };
    }
    const image = opened.database;
    const sha = await sha256Hex(image);
    if (sha !== opened.manifest.sha256) {
      return { ok: false, errorCode: "CORRUPT_ARCHIVE", message: "sha mismatch before restore" };
    }
    if (!isSchemaCompatible(opened.manifest.databaseSchemaVersion, this.options.currentSchema)) {
      return { ok: false, errorCode: "INCOMPATIBLE_BACKUP", message: "schema newer than app" };
    }

    // Mandatory pre-restore safety copy.
    const safety = await this.create({ kind: "pre-restore" });
    if (!safety.ok) {
      return { ok: false, errorCode: "RESTORE_FAILED", message: "safety backup failed" };
    }

    let counts: TableCounts;
    try {
      if (mode === "replace") {
        counts = this.replaceWith(image);
      } else {
        counts = await this.merge(image);
      }
    } catch (err: any) {
      return { ok: false, errorCode: "RESTORE_FAILED", message: String(err?.message ?? err) };
    }

    if (!isValidRestoreCounts(counts)) {
      return { ok: false, errorCode: "RESTORE_FAILED", message: "restored counts inconsistent" };
    }
    return { ok: true, safetyBackupId: safety.backupId, counts };
  }

  /**
   * Atomically swaps the database image in.
   * On device the WebView connection is closed first; here we close the test
   * fixture (the app-side handle), on every platform, before touching the file.
   */
  private replaceWith(image: Uint8Array): TableCounts {
    closeFixture(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    const target = this.dbFile();
    const staging = target + ".restore-new";
    writeFileSync(staging, image);
    if (existsSync(target)) rmSync(target, { force: true });
    for (const suffix of ["-wal", "-shm", "-journal"]) {
      if (existsSync(target + suffix)) rmSync(target + suffix, { force: true });
    }
    renameSync(staging, target);
    const check = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      const quick = check.quickCheck();
      if (quick.toLowerCase() !== "ok") throw new Error(quick);
      return countsOf(check);
    } finally {
      check.close();
    }
  }

  /** Merge: inserts only missing rows, in one transaction, never overwrites. */
  private async merge(image: Uint8Array): Promise<TableCounts> {
    closeFixture(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    const staging = join(this.options.dbDir, ".merge-source.db");
    writeFileSync(staging, image);
    const live = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      // ATTACH with an alias: the schema-qualified statements below need "bk".
      live.db.prepare("ATTACH DATABASE ? AS bk").run(staging);
      const tables = [
        "settings",
        "sequences",
        "db_meta",
        "financial_accounts",
        "customers",
        "suppliers",
        "projects",
        "orders",
        "order_items",
        "custom_invoices",
        "custom_invoice_items",
        "proforma_invoices",
        "proforma_lines",
        "print_invoices",
        "print_invoice_lines",
        "customer_payments",
        "customer_payment_allocations",
        "supplier_payments",
        "supplier_payment_allocations",
        "expenses",
        "expense_payments",
        "financial_transactions",
        "document_sequences",
        "audit_log",
      ];
      const existingBk = new Set<string>(
        (live.db.prepare("SELECT name FROM bk.sqlite_master WHERE type='table'").all() as any[]).map((r) => String(r.name))
      );
      live.db.exec("BEGIN");
      try {
        for (const table of tables) {
          if (!existingBk.has(table)) continue;
          if (table === "settings" || table === "sequences" || table === "db_meta") {
            live.db.exec(
              `INSERT OR IGNORE INTO main."${table}"(key, value) SELECT key, value FROM bk."${table}" WHERE key NOT IN (SELECT key FROM main."${table}")`
            );
            if (table === "sequences") {
              live.db.exec(
                `UPDATE main."sequences" SET value = (SELECT b.value FROM bk."sequences" b WHERE b.key = main."sequences".key) WHERE EXISTS (SELECT 1 FROM bk."sequences" b WHERE b.key = main."sequences".key AND CAST(b.value AS INTEGER) > CAST(main."sequences".value AS INTEGER))`
              );
            }
          } else {
            const liveCols = (live.db.prepare(`PRAGMA main.table_info("${table}")`).all() as any[]).map((c) => String(c.name));
            const bkCols = new Set((live.db.prepare(`PRAGMA bk.table_info("${table}")`).all() as any[]).map((c) => String(c.name)));
            const shared = liveCols.filter((c) => bkCols.has(c));
            if (shared.length === 0) continue;
            const colList = shared.map((c) => `"${c}"`).join(",");
            live.db.exec(`INSERT OR IGNORE INTO main."${table}" (${colList}) SELECT ${colList} FROM bk."${table}"`);
            if (table === "document_sequences") {
              live.db.exec(
                `UPDATE main."document_sequences" SET last_number = (SELECT b.last_number FROM bk."document_sequences" b WHERE b.scope = main."document_sequences".scope AND b.date_key = main."document_sequences".date_key) WHERE EXISTS (SELECT 1 FROM bk."document_sequences" b WHERE b.scope = main."document_sequences".scope AND b.date_key = main."document_sequences".date_key AND b.last_number > main."document_sequences".last_number)`
              );
            }
          }
        }
        live.db.exec("COMMIT");
      } catch (err) {
        live.db.exec("ROLLBACK");
        throw err;
      } finally {
        live.db.exec("DETACH DATABASE bk");
      }
      return countsOf(live);
    } finally {
      live.close();
      rmSync(staging, { force: true });
    }
  }

  /** Reads one invoice with its items, proving full content round-trip. */
  readInvoice(serial: string): { serial: string; party: string; total: number; items: { description: string; dimensions: string | null; qty: number; total: number }[] } | null {
    const db = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      const row = db.db.prepare("SELECT * FROM custom_invoices WHERE serial = ?").get(serial) as any;
      if (!row) return null;
      const items = db.db
        .prepare("SELECT description, dimensions, qty, total FROM custom_invoice_items WHERE invoice_id = ? ORDER BY sort_order")
        .all(row.id) as any[];
      return {
        serial: row.serial,
        party: row.party_name,
        total: Number(row.total_amount),
        items: items.map((i) => ({ description: i.description, dimensions: i.dimensions, qty: Number(i.qty), total: Number(i.total) })),
      };
    } finally {
      db.close();
    }
  }

  getSequence(key: string): string {
    const db = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      const row = db.db.prepare("SELECT value FROM sequences WHERE key = ?").get(key) as any;
      return row ? String(row.value) : "";
    } finally {
      db.close();
    }
  }

  getSetting(key: string): string {
    const db = new FixtureDatabase(this.options.dbDir, this.options.dbName ?? "ta_invoicing_db");
    try {
      const row = db.db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
      return row ? String(row.value) : "";
    } finally {
      db.close();
    }
  }
}
