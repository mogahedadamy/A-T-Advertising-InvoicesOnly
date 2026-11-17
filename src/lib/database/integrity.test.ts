/**
 * فحص سلامة التخزين (Phase 9 / PRD §12):
 * لا يُقال «سليمة» إلا بعد فحص فعلي، ويُكتشف الخلل الحقيقي (علاقة مكسورة أو
 * مخطط غير مُرقّى) بدل إخفائه.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = vi.hoisted(() => ({ db: null as any }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, Plugins: {}, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));

vi.mock("@/lib/database", () => ({
  getDb: async () => state.db,
  closeDb: async () => {},
}));

import { CREATE_SCHEMA_V1 } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import { optimizeStorage, runIntegrityCheck } from "@/lib/repositories/MaintenanceRepository";

const NOW = "2026-11-11T10:00:00.000Z";

let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  const dir = mkdtempSync(join(tmpdir(), "ta-integrity-"));
  db = FixtureDatabase.open({ dir });
  // the device runs in WAL mode; mirror it so the report reflects reality
  db.db.exec("PRAGMA journal_mode=WAL;");
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  state.db = db;
});

describe("Storage integrity (PRD §12)", () => {
  it("reports a sound database with its real schema version", async () => {
    const report = await runIntegrityCheck();
    expect(report.quickCheck).toBe("ok");
    expect(report.foreignKeyViolations).toEqual([]);
    expect(report.schemaVersion).toBe(3);
    expect(report.appSchemaVersion).toBe(3);
    expect(report.ok).toBe(true);
    expect(report.message).toContain("سليمة");
    // WAL is the mode the app runs in
    expect(report.journalMode.toLowerCase()).toBe("wal");
  });

  it("counts the rows that actually exist per table", async () => {
    db.db
      .prepare(
        `INSERT INTO custom_invoices (id, serial, type, date, party_name, total_amount, created_at, updated_at, reference)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run("inv-1", "001", "sales", "2026-11-11", "عميل", 1000, NOW, NOW, "INV-11112026-001");
    db.db.prepare("INSERT INTO customers (id, name, created_at) VALUES (?,?,?)").run("cust-1", "عميل", NOW);

    const report = await runIntegrityCheck();
    const find = (table: string) => report.counts.find((row) => row.table === table)?.rows ?? -1;
    expect(find("custom_invoices")).toBe(1);
    expect(find("customers")).toBe(1);
    expect(report.totalRows).toBeGreaterThanOrEqual(2);
  });

  it("detects a broken relationship instead of claiming everything is fine", async () => {
    // Orphaned rows can exist in data restored from an older/hand-edited backup
    // where foreign keys were not enforced when the row was written.
    db.db.exec("PRAGMA foreign_keys=OFF;");
    db.db
      .prepare(
        `INSERT INTO custom_invoice_items (id, invoice_id, description, qty, total, sort_order)
         VALUES (?,?,?,?,?,?)`
      )
      .run("item-orphan", "missing-invoice", "بند يتيم", 1, 100, 0);
    db.db.exec("PRAGMA foreign_keys=ON;");

    const report = await runIntegrityCheck();
    expect(report.foreignKeyViolations.length).toBeGreaterThan(0);
    expect(report.foreignKeyViolations.some((v) => v.table === "custom_invoice_items")).toBe(true);
    expect(report.ok).toBe(false);
    expect(report.message).toContain("علاقة مكسورة");
  });

  it("enforces relationships while the app is running", () => {
    expect(() =>
      db.db
        .prepare(
          `INSERT INTO custom_invoice_items (id, invoice_id, description, qty, total, sort_order)
           VALUES (?,?,?,?,?,?)`
        )
        .run("item-orphan-2", "missing-invoice", "بند يتيم", 1, 100, 0)
    ).toThrow();
  });

  it("flags a schema that still needs upgrading", async () => {
    db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','2')").run();
    const report = await runIntegrityCheck();
    expect(report.ok).toBe(false);
    expect(report.message).toContain("سيُرقّى");
  });

  it("optimizes the database without touching data", async () => {
    db.db.prepare("INSERT INTO customers (id, name, created_at) VALUES (?,?,?)").run("cust-1", "عميل", NOW);
    const result = await optimizeStorage();
    expect(result.ok).toBe(true);
    expect(db.count("customers")).toBe(1);
  });
});
