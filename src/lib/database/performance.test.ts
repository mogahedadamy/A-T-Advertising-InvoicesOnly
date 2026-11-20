/**
 * تقييم الأداء (Phase 9 / Blueprint §15):
 * يثبت أن تكلفة التقارير لا تنمو بعدد الاستعلامات مع نمو البيانات، وأن
 * الإجماليات تبقى مطابقة للسجلات المصدر على مجموعة بيانات أكبر.
 *
 * القياس حتمي: نعدّ استعلامات قاعدة البيانات الفعلية بدل الاعتماد على زمن
 * تشغيل متذبذب بين الأجهزة.
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
import { createSupplier } from "@/lib/repositories/SupplierRepository";
import { getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import { recordCustomerReceipt } from "@/lib/repositories/PaymentRepository";
import {
  getCustomerCollectionsReport,
  getFinancialPerformanceReport,
  getSalesPerformance,
} from "@/lib/repositories/ReportsRepository";

const NOW = "2026-11-11T08:00:00.000Z";
const TODAY = "2026-11-11";

/** 40 دفعة عمل، كل واحدة بفاتورة ودفعة جزئية — حجم واقعي متعدد الأضعاف. */
const BATCH_COUNT = 40;

let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  state.queries = 0;
  state.runs = 0;
  const dir = mkdtempSync(join(tmpdir(), "ta-perf-"));
  db = FixtureDatabase.open({ dir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);

  // Instrument the database handle so every statement is counted.
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

/** Builds the dataset directly (fast) — the report code is what is under test. */
async function seedDataset(): Promise<void> {
  db.db.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("cust-1", "شركة", "0912", "company", NOW);
  const supplier = await createSupplier({ name: "مطبعة" }, NOW);
  const accountId = await getDefaultAccountId();

  const insertInvoice = db.db.prepare(
    `INSERT INTO custom_invoices
       (id, serial, type, date, party_name, customer_id, supplier_id, language, total_amount, created_at, updated_at, reference)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  for (let i = 1; i <= BATCH_COUNT; i++) {
    insertInvoice.run(`inv-${i}`, "001", "sales", TODAY, "شركة", "cust-1", null, "ar", 100000, NOW, NOW, `INV-11112026-${String(i).padStart(3, "0")}`);
    insertInvoice.run(`pinv-${i}`, "001", "purchase", TODAY, "مطبعة", null, supplier.id, "ar", 60000, NOW, NOW, `PINV-11112026-${String(i).padStart(3, "0")}`);
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 40000,
      paidAt: TODAY,
      accountId: accountId!,
      allocations: [{ invoiceId: `inv-${i}`, amount: 40000 }],
    });
  }
}

describe("Performance — التقارير لا تتحول إلى N+1", () => {
  it("يبني تقرير الأداء المالي بعدد ثابت من الاستعلامات", async () => {
    await seedDataset();

    state.queries = 0;
    state.runs = 0;
    state.counting = true;
    const report = await getFinancialPerformanceReport({});
    state.counting = false;

    expect(report.revenue).toBe(BATCH_COUNT * 100000);
    expect(report.directCosts).toBe(BATCH_COUNT * 60000);
    expect(report.grossMargin).toBe(BATCH_COUNT * 40000);
    expect(report.receiptsTotal).toBe(BATCH_COUNT * 40000);

    // القياس: عدد الاستعلامات ثابت ولا ينمو مع عدد الفواتير
    const statements = state.queries + state.runs;
    expect(statements).toBeLessThan(BATCH_COUNT);
    // eslint-disable-next-line no-console
    console.info(`[perf] financial performance for ${BATCH_COUNT} batches used ${statements} statements`);
  });

  it("يبني تقرير التحصيلات بعدد استعلامات صغير", async () => {
    await seedDataset();

    state.queries = 0;
    state.runs = 0;
    state.counting = true;
    const collections = await getCustomerCollectionsReport({});
    const statementsForCollections = state.queries + state.runs;
    state.counting = false;

    expect(collections.payments.length).toBe(BATCH_COUNT);
    expect(collections.collectedTotal).toBe(BATCH_COUNT * 40000);
    expect(collections.outstandingTotal).toBe(BATCH_COUNT * 60000);

    expect(statementsForCollections).toBeLessThan(12);
    // eslint-disable-next-line no-console
    console.info(
      `[perf] collections=${statementsForCollections} statements (${BATCH_COUNT} batches)`
    );
  });

  it("يبقى تقرير المبيعات خطياً بعدد الفواتير لا أُسّياً", async () => {
    await seedDataset();

    state.queries = 0;
    state.runs = 0;
    state.counting = true;
    const sales = await getSalesPerformance({});
    state.counting = false;

    expect(sales.invoiceCount).toBe(BATCH_COUNT);
    expect(sales.totalSales).toBe(BATCH_COUNT * 100000);
    expect(state.queries + state.runs).toBeLessThanOrEqual(4);
  });
});
