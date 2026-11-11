/**
 * Real SQLite fixture backend for the Node test-suite (test-only).
 *
 * Implements the subset of the @capacitor-community/sqlite API that the
 * repositories and storage layer use — query/run/execute/executeSet — against a
 * REAL SQLite database via node:sqlite. This is what makes the end-to-end tests
 * meaningful: no mocked SQL, no fake rows, actual constraints and foreign keys.
 *
 * It also mirrors the Android plugin's behaviour where the app depends on it:
 *  - the database file is named `<name>SQLite.db` (the plugin appends the suffix);
 *  - foreign keys are enforced on every connection;
 *  - WAL mode can be enabled like the app does at startup.
 */

import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";

export interface FixtureDbOptions {
  dir: string;
  name?: string;
  wal?: boolean;
  /** SQL executed right after opening (e.g. to corrupt/upgrade a fixture). */
  bootstrapSql?: string;
}

/**
 * Open fixture handles, keyed by db file path.
 * The app code (stores, storage layer) caches its `getDb()` result, so the
 * harness must be able to close the underlying SQLite handle before replacing
 * the file — exactly what the Android engine does to the Capacitor connection.
 */
const openHandles = new Map<string, Set<FixtureDatabase>>();

function registerHandle(handle: FixtureDatabase): void {
  let set = openHandles.get(handle.dbPath);
  if (!set) {
    set = new Set();
    openHandles.set(handle.dbPath, set);
  }
  set.add(handle);
}

function unregisterHandle(handle: FixtureDatabase): void {
  const set = openHandles.get(handle.dbPath);
  if (!set) return;
  set.delete(handle);
  if (set.size === 0) openHandles.delete(handle.dbPath);
}

export function closeFixture(dir: string, name = "ta_invoicing_db"): void {
  const key = join(dir, `${name}SQLite.db`);
  const set = openHandles.get(key);
  if (!set) return;
  openHandles.delete(key);
  for (const handle of Array.from(set)) {
    try {
      handle.db.close();
    } catch {
      // already closed by a failed restore path
    }
  }
}

export function closeAllFixtures(): void {
  for (const key of Array.from(openHandles.keys())) {
    const set = openHandles.get(key);
    openHandles.delete(key);
    if (!set) continue;
    for (const handle of Array.from(set)) {
      try {
        handle.db.close();
      } catch {
        // ignore
      }
    }
  }
}

export class FixtureDatabase {
  readonly dbPath: string;
  readonly db: DatabaseSync;

  constructor(dir: string, name = "ta_invoicing_db") {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.dbPath = join(dir, `${name}SQLite.db`);
    this.db = new DatabaseSync(this.dbPath);
    this.db.exec("PRAGMA foreign_keys=ON;");
    registerHandle(this);
  }

  static open(options: FixtureDbOptions): FixtureDatabase {
    const instance = new FixtureDatabase(options.dir, options.name);
    if (options.wal) instance.db.exec("PRAGMA journal_mode=WAL;");
    if (options.bootstrapSql) instance.db.exec(options.bootstrapSql);
    return instance;
  }

  /** Applies the production schema DDL (passed in by the test from schema.ts). */
  applySchema(statements: string[]): void {
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed) continue;
      this.db.exec(trimmed.endsWith(";") ? trimmed : trimmed + ";");
    }
  }

  // ── API surface used by the app code ──────────────────────────────────

  /** Mirrors the plugin's explicit transaction API. */
  transactionDepth = 0;

  async beginTransaction(): Promise<{ changes: { changes: number } }> {
    this.db.exec("BEGIN IMMEDIATE");
    this.transactionDepth++;
    return { changes: { changes: 0 } };
  }

  async commitTransaction(): Promise<{ changes: { changes: number } }> {
    this.db.exec("COMMIT");
    this.transactionDepth = Math.max(0, this.transactionDepth - 1);
    return { changes: { changes: 0 } };
  }

  async rollbackTransaction(): Promise<{ changes: { changes: number } }> {
    try {
      this.db.exec("ROLLBACK");
    } catch {
      // SQLite already rolled back (statement error auto-aborts)
    }
    this.transactionDepth = Math.max(0, this.transactionDepth - 1);
    return { changes: { changes: 0 } };
  }

  serializeValue(value: unknown): number | string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return value;
    return String(value);
  }

  prepareStatement(statement: string, values: unknown[] = []) {
    const stmt = this.db.prepare(statement);
    return { stmt, params: values.map((v) => this.serializeValue(v)) };
  }

  query(statement: string, values: unknown[] = []): { values: any[] } {
    const { stmt, params } = this.prepareStatement(statement, values);
    // node:sqlite distinguishes reader vs writer; use all() only for readers.
    if (stmt.all && /^\s*(select|pragma|with)\b/i.test(statement)) {
      return { values: (stmt.all as (...p: any[]) => any[])(...params) };
    }
    try {
      return { values: (stmt.all as (...p: any[]) => any[])(...params) };
    } catch {
      return { values: [] };
    }
  }

  run(statement: string, values: unknown[] = []): { changes: { changes: number; lastId: number } } {
    const { stmt, params } = this.prepareStatement(statement, values);
    const result = (stmt.run as (...p: any[]) => { changes: number | bigint; lastInsertRowid: number | bigint })(...params);
    return { changes: { changes: Number(result.changes), lastId: Number(result.lastInsertRowid) } };
  }

  execute(statements: string, _transaction = false): { changes: { changes: number; lastId: number } } {
    this.db.exec(statements);
    return { changes: { changes: 0, lastId: 0 } };
  }

  executeSet(set: { statement: string; values?: unknown[] }[], transaction = true): void {
    const runAll = () => {
      for (const item of set) this.run(item.statement, item.values ?? []);
    };
    if (!transaction) return runAll();
    this.db.exec("BEGIN");
    try {
      runAll();
      this.db.exec("COMMIT");
    } catch (err) {
      try {
        this.db.exec("ROLLBACK");
      } catch {
        // transaction already resolved
      }
      throw err;
    }
  }

  quickCheck(): string {
    const row = this.db.prepare("PRAGMA quick_check").get() as any;
    return String(row?.quick_check ?? Object.values(row ?? {})[0] ?? "");
  }

  count(table: string): number {
    const row = this.db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as any;
    return Number(row.c);
  }

  close(): void {
    unregisterHandle(this);
    try {
      this.db.close();
    } catch {
      // already closed
    }
  }

  /** Copies the on-disk file (SQLite-consistent after a checkpoint). */
  checkpoint(): void {
    try {
      this.db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
    } catch {
      // not in WAL mode
    }
  }

  snapshotTo(targetPath: string): void {
    const escaped = targetPath.replace(/\\/g, "/").replace(/'/g, "''");
    this.db.exec(`VACUUM INTO '${escaped}'`);
  }
}

export function readFileBytes(path: string): Uint8Array {
  return new Uint8Array(readFileSync(path));
}

export function writeFileBytes(path: string, bytes: Uint8Array): void {
  writeFileSync(path, bytes);
}

export function copyFile(from: string, to: string): void {
  copyFileSync(from, to);
}
