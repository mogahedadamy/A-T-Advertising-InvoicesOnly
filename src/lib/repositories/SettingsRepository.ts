/**
 * ═══════════════════════════════════════════════════════════════
 * Settings & Sequences Repository — SQLite CRUD
 * ═══════════════════════════════════════════════════════════════
 */

import { getDb } from "@/lib/database";
import { notifyDataChanged } from "@/lib/backup/notify";

export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  const db = await getDb();
  const res = await db.query("SELECT value FROM settings WHERE key = ?", [key]);
  return res.values?.[0]?.value ?? fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    "INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)",
    [key, value]
  );
  notifyDataChanged();
}

export async function getSequence(key: string): Promise<string> {
  const db = await getDb();
  const res = await db.query("SELECT value FROM sequences WHERE key = ?", [key]);
  return res.values?.[0]?.value ?? "";
}

export async function setSequence(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.run(
    "INSERT OR REPLACE INTO sequences(key, value) VALUES(?,?)",
    [key, value]
  );
  notifyDataChanged();
}

