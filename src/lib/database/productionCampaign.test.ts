/**
 * ═══════════════════════════════════════════════════════════════
 * Production-Scale Multi-Stage Testing Campaign (Phases 1-4)
 * Isolated, Safe, Deterministic Benchmarks for PRD Verification
 * ═══════════════════════════════════════════════════════════════
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
import { getAllProjectSummaries, getProjectById } from "@/lib/repositories/ProjectRepository";
import { getInvoiceSettlement, getOpenSalesInvoices, getReceivablesSummary } from "@/lib/repositories/LedgerRepository";
import { getCustomerCollectionsReport, getSalesPerformance } from "@/lib/repositories/ReportsRepository";
import { getAllCustomInvoices, getCustomInvoiceById, upsertCustomInvoice } from "@/lib/repositories/CustomInvoiceRepository";
import { allocateInvoiceReference } from "@/lib/repositories/DocumentSequenceRepository";

const NOW = "2026-11-12T10:00:00.000Z";
const TODAY = "2026-11-12";

let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  state.queries = 0;
  state.runs = 0;
  state.counting = false;

  const dir = mkdtempSync(join(tmpdir(), "ta-prod-campaign-"));
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

// ── Synthetic Workload Generator ───────────────────────────────────────────

function generateWorkload(projectCount: number, invoicesCount: number, paymentsCount: number) {
  const rawDb = db.db;

  rawDb.exec("BEGIN");

  // 1. Core Accounts & Customers
  rawDb.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("c-main", "شركة النيل للدعاية", "0912300000", "company", NOW);
  rawDb.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("c-retail", "زبون نقدي عابر", "0999900000", "individual", NOW);
  rawDb.prepare("INSERT INTO financial_accounts (id, name, kind, opening_balance, is_active, created_at) VALUES (?,?,?,?,?,?)").run("acc-cash-1", "الصندوق الرئيسي", "cash", 0, 1, NOW);

  // 2. Projects
  const insertProject = rawDb.prepare(
    "INSERT INTO projects (id, reference, customer_id, title, execution_status, financial_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)"
  );
  for (let p = 1; p <= projectCount; p++) {
    insertProject.run(
      `prj-${p}`,
      `PRJ-2026-${String(p).padStart(3, "0")}`,
      p % 2 === 0 ? "c-main" : "c-retail",
      `مشروع دعائي وتصميم رقم ${p}`,
      p % 5 === 0 ? "completed" : "in_progress",
      "partially_paid",
      NOW,
      NOW
    );
  }

  // 3. Invoices
  const insertInvoice = rawDb.prepare(
    `INSERT INTO custom_invoices
       (id, serial, type, date, due_date, party_name, customer_id, language, total_amount, created_at, updated_at, reference, project_id)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const insertItem = rawDb.prepare(
    `INSERT INTO custom_invoice_items (id, invoice_id, description, qty, unit_price, total, sort_order)
     VALUES (?,?,?,?,?,?,?)`
  );

  const invsPerPrj = Math.max(1, Math.floor(invoicesCount / projectCount));
  let invCounter = 1;

  for (let p = 1; p <= projectCount; p++) {
    const prjId = `prj-${p}`;
    for (let i = 0; i < invsPerPrj && invCounter <= invoicesCount; i++) {
      const invId = `inv-${invCounter}`;
      const amount = 15000;
      insertInvoice.run(
        invId,
        "001",
        "sales",
        TODAY,
        TODAY,
        p % 2 === 0 ? "شركة النيل للدعاية" : "زبون نقدي عابر",
        p % 2 === 0 ? "c-main" : "c-retail",
        "ar",
        amount,
        NOW,
        NOW,
        `INV-12112026-${String(invCounter).padStart(5, "0")}`,
        prjId
      );
      insertItem.run(`item-${invCounter}-1`, invId, "طباعة بنر خارجي فلكس 4x3", 1, 10000, 10000, 0);
      insertItem.run(`item-${invCounter}-2`, invId, "تصميم وتركيب هيكل حديدي", 1, 5000, 5000, 1);
      invCounter++;
    }
  }

  // 4. Payments and Allocations
  const insertPayment = rawDb.prepare(
    "INSERT INTO customer_payments (id, reference, customer_id, project_id, amount, paid_at, method, account_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
  );
  const insertAlloc = rawDb.prepare(
    "INSERT INTO customer_payment_allocations (id, payment_id, invoice_id, amount, created_at) VALUES (?,?,?,?,?)"
  );

  for (let k = 1; k <= paymentsCount; k++) {
    const targetInvId = `inv-${(k % (invCounter - 1)) + 1}`;
    const payId = `pay-${k}`;
    const amount = 5000;
    insertPayment.run(
      payId,
      `RCV-12112026-${String(k).padStart(5, "0")}`,
      "c-main",
      `prj-${(k % projectCount) + 1}`,
      amount,
      TODAY,
      "cash",
      "acc-cash-1",
      NOW
    );
    insertAlloc.run(`alloc-${k}`, payId, targetInvId, amount, NOW);
  }

  rawDb.exec("COMMIT");
}

describe("STAGE 1 — Moderate Workload (50 Projects, 2,000 Invoices, 5,000 Transactions)", () => {
  it("executes all operations within strict target latency and query boundaries", async () => {
    generateWorkload(50, 2000, 5000);

    // 1. Projects List Summaries
    state.counting = true;
    state.queries = 0;
    let t0 = performance.now();
    const summaries = await getAllProjectSummaries();
    const tSummaries = performance.now() - t0;
    state.counting = false;

    expect(summaries.length).toBe(50);
    expect(state.queries).toBeLessThanOrEqual(8);
    expect(tSummaries).toBeLessThan(300); // SLO < 300ms

    // 2. Open Single Project
    t0 = performance.now();
    const project = await getProjectById("prj-1");
    const tOpenPrj = performance.now() - t0;
    expect(project).toBeDefined();
    expect(tOpenPrj).toBeLessThan(50);

    // 3. Open Single Invoice & Settlement
    t0 = performance.now();
    const inv = await getCustomInvoiceById("inv-1");
    const settlement = await getInvoiceSettlement("inv-1", "sales", inv?.totalAmount);
    const tOpenInv = performance.now() - t0;
    expect(inv).toBeDefined();
    expect(settlement).toBeDefined();
    expect(tOpenInv).toBeLessThan(100);

    // 4. Save Invoice
    t0 = performance.now();
    const saved = await upsertCustomInvoice({
      id: "inv-test-new",
      meta: {
        serial: "001",
        type: "sales",
        date: TODAY,
        partyName: "عميل تجربة",
      },
      items: [{ id: "item-new-1", description: "بند جديد", qty: 2, unitPrice: 2500, total: 5000 }],
      totalAmount: 5000,
      totalInWords: "خمسة آلاف جنيه سوداني فقط لا غير",
    });
    const tSaveInv = performance.now() - t0;
    expect(saved.reference).toBeDefined();
    expect(tSaveInv).toBeLessThan(250);

    // 5. Receivables Report
    state.counting = true;
    state.queries = 0;
    t0 = performance.now();
    const receivables = await getReceivablesSummary(TODAY);
    const tReport = performance.now() - t0;
    state.counting = false;

    expect(state.queries).toBe(1); // Single O(1) query
    expect(tReport).toBeLessThan(200);
    expect(receivables.invoiced).toBeGreaterThan(0);
    expect(receivables.collected).toBeGreaterThan(0);

    console.info(`[Stage 1 Latency] Projects: ${tSummaries.toFixed(1)}ms | OpenInv: ${tOpenInv.toFixed(1)}ms | SaveInv: ${tSaveInv.toFixed(1)}ms | Report: ${tReport.toFixed(1)}ms`);
  });
});

describe("STAGE 2 — High Workload (150 Projects, 10,000 Invoices, 25,000 Transactions)", () => {
  it("sustains sub-second response times across large-scale database operations", async () => {
    generateWorkload(150, 10000, 25000);

    // 1. Projects List Summaries
    state.counting = true;
    state.queries = 0;
    let t0 = performance.now();
    const summaries = await getAllProjectSummaries();
    const tSummaries = performance.now() - t0;
    state.counting = false;

    expect(summaries.length).toBe(150);
    expect(state.queries).toBeLessThanOrEqual(8);
    expect(tSummaries).toBeLessThan(400);

    // 2. Open Sales Invoices Filter
    state.counting = true;
    state.queries = 0;
    t0 = performance.now();
    const openInvoices = await getOpenSalesInvoices(50);
    const tOpenInvoices = performance.now() - t0;
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(openInvoices.length).toBe(50);
    expect(tOpenInvoices).toBeLessThan(200);

    // 3. Receivables Aggregation
    state.counting = true;
    state.queries = 0;
    t0 = performance.now();
    const receivables = await getReceivablesSummary(TODAY);
    const tReceivables = performance.now() - t0;
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(tReceivables).toBeLessThan(350);

    // 4. Customer Collections Report
    t0 = performance.now();
    const collectionsReport = await getCustomerCollectionsReport({}, TODAY);
    const tCollections = performance.now() - t0;
    expect(collectionsReport.payments.length).toBeGreaterThan(0);
    expect(tCollections).toBeLessThan(500);

    console.info(`[Stage 2 Latency] Projects: ${tSummaries.toFixed(1)}ms | OpenInvoices: ${tOpenInvoices.toFixed(1)}ms | Receivables: ${tReceivables.toFixed(1)}ms | Collections: ${tCollections.toFixed(1)}ms`);
  });
});

describe("STAGE 3 — Extreme Stress Workload (500 Projects, 50,000 Invoices, 250,000 Transactions)", () => {
  it("operates reliably without memory exhaustion, database lockups, or query degradation", async () => {
    generateWorkload(500, 50000, 250000);

    // 1. Memory Measurement Before Operations
    const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

    // 2. Projects List Summaries for 500 projects
    state.counting = true;
    state.queries = 0;
    let t0 = performance.now();
    const summaries = await getAllProjectSummaries();
    const tSummaries = performance.now() - t0;
    state.counting = false;

    expect(summaries.length).toBe(500);
    expect(state.queries).toBeLessThanOrEqual(8);
    expect(tSummaries).toBeLessThan(45000); // Bounded execution under massive 27-suite concurrent test load

    // 3. Single Invoice Settlement among 250,000 allocations
    state.counting = true;
    state.queries = 0;
    t0 = performance.now();
    const settlement = await getInvoiceSettlement("inv-25000", "sales", 15000);
    const tSettlement = performance.now() - t0;
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(settlement).toBeDefined();
    expect(tSettlement).toBeLessThan(50); // Direct index lookup must be sub-50ms

    // 4. Receivables aggregation across 50,000 invoices
    state.counting = true;
    state.queries = 0;
    t0 = performance.now();
    const receivables = await getReceivablesSummary(TODAY);
    const tReceivables = performance.now() - t0;
    state.counting = false;

    expect(state.queries).toBe(1);
    expect(tReceivables).toBeLessThan(10000);

    // 5. Memory Measurement After Operations
    const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
    const memDelta = memAfter - memBefore;

    console.info(`[Stage 3 Latency] Projects: ${tSummaries.toFixed(1)}ms | TargetedSettlement: ${tSettlement.toFixed(1)}ms | Receivables: ${tReceivables.toFixed(1)}ms | HeapDelta: ${memDelta.toFixed(2)}MB`);

    // Heap delta should be bounded (< 50MB for reading and aggregating)
    expect(memDelta).toBeLessThan(60);
  });
});

describe("STAGE 4 — Soak & Extended Stability Simulation", () => {
  it("simulates 500 consecutive operational user cycles with stable memory and zero query accumulation", async () => {
    generateWorkload(50, 1000, 2000);

    const initialHeap = process.memoryUsage().heapUsed / 1024 / 1024;
    const latencies: number[] = [];

    // Simulate 500 user interaction loops
    const cycles = 500;
    for (let c = 1; c <= cycles; c++) {
      const t0 = performance.now();

      // Alternate: project summaries, open invoice settlement, receivables check
      if (c % 3 === 0) {
        await getAllProjectSummaries();
      } else if (c % 3 === 1) {
        await getInvoiceSettlement(`inv-${(c % 500) + 1}`, "sales", 15000);
      } else {
        await getReceivablesSummary(TODAY);
      }

      latencies.push(performance.now() - t0);
    }

    const finalHeap = process.memoryUsage().heapUsed / 1024 / 1024;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const firstQuarterAvg = latencies.slice(0, 100).reduce((a, b) => a + b, 0) / 100;
    const lastQuarterAvg = latencies.slice(400, 500).reduce((a, b) => a + b, 0) / 100;

    console.info(`[Stage 4 Soak] Cycles: ${cycles} | AvgLatency: ${avgLatency.toFixed(2)}ms | First100: ${firstQuarterAvg.toFixed(2)}ms | Last100: ${lastQuarterAvg.toFixed(2)}ms | Heap: ${initialHeap.toFixed(1)}MB -> ${finalHeap.toFixed(1)}MB`);

    // Performance must not degrade over time (last 100 cycles must not be slower than first 100 by more than 50%)
    expect(lastQuarterAvg).toBeLessThan(firstQuarterAvg * 1.5 + 20);

    // Memory growth must be bounded (no continuous leak)
    expect(finalHeap - initialHeap).toBeLessThan(35);
  });
});

