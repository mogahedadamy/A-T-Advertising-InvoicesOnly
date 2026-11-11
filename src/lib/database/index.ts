/**
 * ═══════════════════════════════════════════════════════════════
 * SQLite Database Connection — T.A Advertising Invoice System
 * ═══════════════════════════════════════════════════════════════
 * Singleton connection manager using @capacitor-community/sqlite v7
 * Enables WAL mode for crash safety + foreign key enforcement
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from "@capacitor-community/sqlite";
import { Capacitor } from "@capacitor/core";
import { DB_NAME, DB_VERSION, CREATE_SCHEMA_V1 } from "./schema";

const sqlite = new SQLiteConnection(CapacitorSQLite);
let _db: SQLiteDBConnection | null = null;
let _initPromise: Promise<SQLiteDBConnection> | null = null;

/**
 * Returns the singleton DB connection, initializing it on first call.
 * All callers await this — it is safe to call concurrently.
 */
export async function getDb(): Promise<SQLiteDBConnection> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = _initialize();
  _db = await _initPromise;
  return _db;
}

async function _initialize(): Promise<SQLiteDBConnection> {
  // Web / browser fallback: use in-memory mock (dev only)
  if (!Capacitor.isNativePlatform()) {
    console.warn("[DB] Running in browser — SQLite not available; using no-op mode.");
    throw new Error("SQLite only available on native Android platform.");
  }

  try {
    // Check if connection already exists
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

    let db: SQLiteDBConnection;
    if (isConn) {
      db = await sqlite.retrieveConnection(DB_NAME, false);
    } else {
      db = await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
    }

    await db.open();

    // Enable WAL mode for crash safety (must run outside transaction on SQLite)
    await db.execute("PRAGMA journal_mode=WAL;", false);
    // Enforce foreign key constraints
    await db.execute("PRAGMA foreign_keys=ON;", false);
    // Improve write performance
    await db.execute("PRAGMA synchronous=NORMAL;", false);

    // Create schema if not exists (idempotent)
    await _ensureSchema(db);

    console.info("[DB] SQLite database initialized:", DB_NAME, "v" + DB_VERSION);
    return db;
  } catch (err) {
    _initPromise = null;
    _db = null;
    throw err;
  }
}

async function _ensureSchema(db: SQLiteDBConnection): Promise<void> {
  // Execute all CREATE TABLE / INDEX statements atomically in a single batch
  const batch = CREATE_SCHEMA_V1.join(";\n") + ";";
  try {
    await db.execute(batch, true);
  } catch {
    // Fallback: execute individually if any single statement warns
    for (const stmt of CREATE_SCHEMA_V1) {
      try {
        await db.execute(stmt + ";", false);
      } catch (err) {
        console.warn("[DB] Schema statement warning:", err, "\nStatement:", stmt.slice(0, 80));
      }
    }
  }
}

/**
 * Close the connection (call on app termination if needed).
 */
export async function closeDb(): Promise<void> {
  if (_db) {
    try {
      await sqlite.closeConnection(DB_NAME, false);
    } catch {}
    _db = null;
    _initPromise = null;
  }
}

