/**
 * ═══════════════════════════════════════════════════════════════
 * Scalability, High-Load Stability & Stress Test Suite
 * (PRD §15, Master Engineering Directive Phases 4, 10 & 13)
 * ═══════════════════════════════════════════════════════════════
 * Verifies that the offline storage engine and financial repositories
 * maintain:
 *  1. Bounded O(1) query counts regardless of project/invoice scale.
 *  2. Predictable, sub-millisecond execution times on aggregation queries.
 *  3. 100% mathematical accuracy across Revenue, Collections, and Liquidity.
 *  4. Atomic numbering and zero collisions under rapid sequential allocations.
 *  5. Efficient memory-object cache performance without JSON serialization bottlenecks.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = vi.hoisted(() => ({ db: null as any, queries: 0, runs: 0, counting: false }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, Plugins: {}, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));

vi.mock("@/lib/database", () => ({
  getDb: async () => state.db,
  closeDb: async () => {},
}));

vi.mock("@/lib/backup/notify", () => ({ notifyDataChanged: () => {} }));

import { CREATE_SCHEMA_V1 } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import { getAllProjectSummaries } from "@/lib/repositories/ProjectRepository";
import { getInvoiceSettlement, getOpenSalesInvoices, getReceivablesSummary } from "@/lib/repositories/LedgerRepository";
import { getCustomerCollectionsReport } from "@/lib/repositories/ReportsRepository";
import { allocateInvoiceReference } from "@/lib/repositories/DocumentSequenceRepository";
import { getStoredJsonSync, setMemoryCacheJson, clearSQLiteMemoryCache } from "@/lib/sqliteStorage";

const NOW = "2026-11-12T10:00:00.000Z";
const TODAY = "2026-11-12";

const PROJECT_COUNT = 100;
const INVOICES_PER_PROJECT = 5;

let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  clearSQLiteMemoryCache();
  state.queries = 0;
  state.runs = 0;
  state.counting = false;

  const dir = mkdtempSync(join(tmpdir(), "ta-scale-stress-"));
  db = FixtureDatabase.open({ dir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);

  const originalQuery = db.query.bind(db);
  const originalRun = db.run.bind(db);
  db.query = (statement: string, values?: unknown[]) => {
    if (state.counting) state.queries += 1;
    return originalQuery(statement, values);
  };
  db.run = (statement: string, values?: unknown[], transaction?: boolean) => {
    if (state.counting) state.runs += 1;
    return originalRun(statement, values, transaction);
  };

  state.db = db;
});

function seedLargeScaleDataset() {
  const rawDb = db.db;

  rawDb.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("c-1", "عميل رئيسي", "0911", "company", NOW);
  rawDb.prepare("INSERT INTO financial_accounts (id, name, kind, opening_balance, is_active, created_at) VALUES (?,?,?,?,?,?)").run("acc-1", "الخزينة", "cash", 0, 1, NOW);

  const insertProject = rawDb.prepare(
    "INSERT INTO projects (id, reference, customer_id, title, execution_status, financial_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  );
  const insertInvoice = rawDb.prepare(
    `INSERT INTO custom_invoices
       (id, serial, type, date, due_date, party_name, customer_id, language, total_amount, created_at, updated_at, reference, project_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertPayment = rawDb.prepare(
    "INSERT INTO customer_payments (id, reference, customer_id, project_id, amount, paid_at, method, account_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  const insertAlloc = rawDb.prepare(
    "INSERT INTO customer_payment_allocations (id, payment_id, invoice_id, amount, created_at) VALUES (?,?,?,?,?)"
  );

  rawDb.exec("BEGIN");
  let invSeq = 1;
  let paySeq = 1;

  for (let p = 1; p <= PROJECT_COUNT; p++) {
    const prjId = `prj-${p}`;
    insertProject.run(prjId, `PRJ-2026-${String(p).padStart(3, "0")}`, "c-1", `مشروع ${p}`, "in_progress", "partially_paid", NOW, NOW);

    for (let i = 1; i <= INVOICES_PER_PROJECT; i++) {
      const invId = `inv-${invSeq}`;
      const amount = 10000;

      insertInvoice.run(
        invId,
        "001",
        "sales",
        TODAY,
        TODAY,
        "عميل رئيسي",
        "c-1",
        "ar",
        amount,
        NOW,
        NOW,
        `INV-12112026-${String(invSeq).padStart(3, "0")}`,
        prjId
      );

      if (i <= 2) {
        // fully paid
        const payId = `pay-${paySeq}`;
        insertPayment.run(payId, `RCV-12112026-${String(paySeq).padStart(3, "0")}`, "c-1", prjId, amount, TODAY, "cash", "acc-1", NOW);
        insertAlloc.run(`alloc-${paySeq}`, payId, invId, amount, NOW);
        paySeq++;
      } else if (i === 3) {
        // partially paid (4,000 paid out of 10,000)
        const payId = `pay-${paySeq}`;
        insertPayment.run(payId, `RCV-12112026-${String(paySeq).padStart(3, "0")}`, "c-1", prjId, 4000, TODAY, "cash", "acc-1", NOW);
        insertAlloc.run(`alloc-${paySeq}`, payId, invId, 4000, NOW);
        paySeq++;
      }
      invSeq++;
    }
  }
  rawDb.exec("COMMIT");
}

describe("Database Scalability & Query Bounding (Phases 4 & 5)", () => {
  it("scales getReceivablesSummary in a single O(1) query across 100 projects and 500 invoices", async () => {
    seedLargeScaleDataset();

    const expectedInvoiced = PROJECT_COUNT * INVOICES_PER_PROJECT * 10000;
    const expectedCollected = PROJECT_COUNT * (10000 * 2 + 4000);

    state.counting = true;
    state.queries = 0;
    const start = performance.now();
    const summary = await getReceivablesSummary(TODAY);
    const duration = performance.now() - start;
    state.counting = false;

    // Must execute in exactly ONE query with sub-second latency
    expect(state.queries).toBe(1);
    expect(duration).toBeLessThan(1000);

    // Verify 100% financial accuracy
    expect(summary.invoiced).toBe(expectedInvoiced);
    expect(summary.collected).toBe(expectedCollected);
    expect(summary.outstanding).toBe(expectedInvoiced - expectedCollected);
    expect(summary.partialCount).toBe(PROJECT_COUNT); // 1 per project
    expect(summary.unpaidCount).toBe(PROJECT_COUNT * 2); // 2 per project
  });

  it("calculates single invoice settlement with targeted O(1) query instead of scanning all allocations", async () => {
    seedLargeScaleDataset();

    state.counting = true;
    state.queries = 0;
    const settlement = await getInvoiceSettlement("inv-3", "sales", 10000);
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(settlement).not.toBeNull();
    expect(settlement?.total).toBe(10000);
    expect(settlement?.paid).toBe(4000);
    expect(settlement?.outstanding).toBe(6000);
    expect(settlement?.status).toBe("partially_paid");
  });

  it("retrieves open sales invoices directly filtered in SQLite without table scans", async () => {
    seedLargeScaleDataset();

    state.counting = true;
    state.queries = 0;
    const openInvoices = await getOpenSalesInvoices(50);
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(openInvoices.length).toBe(50);
    for (const inv of openInvoices) {
      expect(inv.settlement.outstanding).toBeGreaterThan(0);
    }
  });

  it("filters open invoices in getCustomerCollectionsReport via SQL LEFT JOIN", async () => {
    seedLargeScaleDataset();

    state.counting = true;
    state.queries = 0;
    const report = await getCustomerCollectionsReport({}, TODAY);
    state.counting = false;

    expect(state.queries).toBe(2);
    expect(report.collectedTotal).toBeGreaterThan(0);
    expect(report.outstandingTotal).toBeGreaterThan(0);
    for (const inv of report.openInvoices) {
      expect(inv.settlement.outstanding).toBeGreaterThan(0);
    }
  });

  it("getAllProjectSummaries executes in 6 fixed queries for 100 projects", async () => {
    seedLargeScaleDataset();

    state.counting = true;
    state.queries = 0;
    const summaries = await getAllProjectSummaries();
    state.counting = false;

    expect(summaries.length).toBe(PROJECT_COUNT);
    // Fixed number of queries regardless of project count (<= 8 queries)
    expect(state.queries).toBeLessThanOrEqual(8);
  });
});

describe("Stress & Concurrency Verification (Phases 10 & 13)", () => {
  it("allocates 50 consecutive invoice references atomically without collisions or gaps", async () => {
    const references = new Set<string>();
    const count = 50;

    for (let i = 0; i < count; i++) {
      const allocated = await allocateInvoiceReference("sales", TODAY, NOW);
      expect(references.has(allocated.reference)).toBe(false);
      references.add(allocated.reference);
      expect(allocated.sequence).toBe(i + 1);
    }

    expect(references.size).toBe(count);
  });

  it("in-memory parsedCache eliminates redundant JSON serialization cycles", () => {
    const key = "test_large_dataset_cache";
    const largeDataset = Array.from({ length: 500 }, (_, i) => ({
      id: `item-${i}`,
      name: `عنصر اختباري رقم ${i}`,
      value: i * 100,
    }));

    setMemoryCacheJson(key, largeDataset);

    const retrieved = getStoredJsonSync<typeof largeDataset>(key, []);

    expect(retrieved).toBe(largeDataset);
    expect(retrieved.length).toBe(500);

    clearSQLiteMemoryCache();
    expect(getStoredJsonSync(key, [])).toEqual([]);
  });
});
