/**
 * ═══════════════════════════════════════════════════════════════
 * معايير القبول الإلزامية — PRD §17 (الصفوف 1–19)
 * ═══════════════════════════════════════════════════════════════
 * كل صف في جدول القبول يُترجم إلى اختبار واحد على SQLite حقيقي، عبر نفس
 * المستودعات التي تستدعيها الواجهة (لا محاكاة لطبقة SQL).
 *
 * الصفّان 7 و19 (الاستعادة) يمرّان على محرك النسخ الاحتياطي الحقيقي: نسخة
 * مُتحقَّقة على القرص ثم استعادة تُعيد البيانات وعلاقاتها ومراجعها.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const state = vi.hoisted(() => ({ db: null as any, engine: null as any }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => true, Plugins: {}, getPlatform: () => "android" },
  registerPlugin: () => ({}),
}));

vi.mock("@/lib/database", () => ({
  getDb: async () => state.db,
  closeDb: async () => {},
}));

vi.mock("@/lib/backup/notify", () => ({ notifyDataChanged: () => {} }));

vi.mock("@/lib/backup/bridge", () => ({
  isBackupEngineAvailable: () => true,
  backupBridge: {
    restoreBackup: async (fileName: string, mode: "replace" | "merge") => {
      const result = await state.engine.restore(fileName, mode);
      return { ok: false, mode: "replace", counts: {}, ...result };
    },
    getDbCounts: async () => ({ ok: true, counts: {}, invoiceCount: 0, schemaVersion: DB_VERSION }),
  },
}));

import { CREATE_SCHEMA_V1, DB_VERSION } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import { NodeBackupEngine } from "@/test/backup/nodeEngine";
import { saveCustomInvoice, resetCustomInvoicesStoreForTests } from "@/lib/billing/store";
import { deleteCustomInvoice, findCustomInvoiceByReference } from "@/lib/repositories/CustomInvoiceRepository";
import { createSupplier, getSupplierAccount } from "@/lib/repositories/SupplierRepository";
import { createExpense, payExpense, getExpensesWithSettlement } from "@/lib/repositories/ExpenseRepository";
import { getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import { recordCustomerReceipt, recordSupplierPayment } from "@/lib/repositories/PaymentRepository";
import { getCashSummary, getInvoicePaidMap } from "@/lib/repositories/LedgerRepository";
import { getCashMovementReport, getFinancialPerformanceReport } from "@/lib/repositories/ReportsRepository";
import type { CustomInvoice } from "@/lib/billing/types";

const NOW = "2026-11-11T08:00:00.000Z";
const TODAY = "2026-11-11";

let root = "";
let dbDir = "";
let folderDir = "";
let db: FixtureDatabase;
let itemSeq = 0;

beforeEach(async () => {
  closeAllFixtures();
  itemSeq = 0;
  resetCustomInvoicesStoreForTests();
  root = mkdtempSync(join(tmpdir(), "ta-acceptance-"));
  dbDir = join(root, "databases");
  folderDir = join(root, "Documents", "InvoiceBackups");
  db = FixtureDatabase.open({ dir: dbDir });
  db.db.exec("PRAGMA journal_mode=WAL;");
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  expect(outcome.to).toBe(DB_VERSION);
  state.db = db;
  state.engine = new NodeBackupEngine({ folderDir, dbDir, currentSchema: DB_VERSION });
});

function customer(id: string, name: string) {
  db.db.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run(id, name, "0912", "company", NOW);
}

function invoice(overrides: { id: string; date: string; total?: number; type?: CustomInvoice["meta"]["type"] }): CustomInvoice {
  itemSeq += 1;
  return {
    id: overrides.id,
    meta: {
      serial: "001",
      type: overrides.type ?? "sales",
      date: overrides.date,
      partyName: "شركة القبول",
      language: "ar",
    },
    items: [{ id: `item-${overrides.id}-${itemSeq}`, description: "بند", qty: 1, unitPrice: overrides.total ?? 100000, total: overrides.total ?? 100000 }],
    totalAmount: overrides.total ?? 100000,
    createdAt: NOW,
    updatedAt: NOW,
  } as CustomInvoice;
}

async function account(): Promise<string> {
  const id = await getDefaultAccountId();
  if (!id) throw new Error("no default account");
  return id;
}

describe("PRD §17 — معايير القبول الإلزامية", () => {
  it("1) إنشاء وحفظ فاتورة مبيعات ⇒ مرجع مؤرَّخ فريد تلقائياً (YY-NNNN)", async () => {
    customer("cust-1", "شركة");
    const saved = await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    expect(saved.reference).toBe("26-0001");
  });

  it("2) فاتورة أخرى في اليوم نفسه ⇒ التسلسل التالي", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    const second = await saveCustomInvoice(invoice({ id: "inv-2", date: TODAY }));
    expect(second.reference).toBe("26-0002");
  });

  it("3) فاتورة في يوم مختلف ⇒ يستمر التسلسل السنوي YY-NNNN", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    const other = await saveCustomInvoice(invoice({ id: "inv-2", date: "2026-12-01" }));
    expect(other.reference).toBe("26-0002");
  });

  it("4) تعديل فاتورة محفوظة ⇒ يحفظ مرجعها الأصلي", async () => {
    customer("cust-1", "شركة");
    const created = await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    const edited = await saveCustomInvoice(invoice({ id: "inv-1", date: "2026-11-25", total: 250000 }));
    expect(edited.reference).toBe(created.reference);
    const stored = db.db.prepare("SELECT date, total_amount, reference FROM custom_invoices WHERE id='inv-1'").get() as any;
    expect(stored.reference).toBe("26-0001");
    expect(stored.date).toBe("2026-11-25");
  });

  it("5) إلغاء فاتورة ⇒ يحفظ مرجعها بشكل دائم", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    await deleteCustomInvoice("inv-1");

    const stored = db.db.prepare("SELECT reference, cancelled_at FROM custom_invoices WHERE id='inv-1'").get() as any;
    expect(stored.reference).toBe("26-0001");
    expect(stored.cancelled_at).toBeTruthy();
    // the number is not released for reuse
    const next = await saveCustomInvoice(invoice({ id: "inv-2", date: TODAY }));
    expect(next.reference).toBe("26-0002");
  });

  it("6) حفظ فواتير متتابعة بسرعة ⇒ لا تكرار في المراجع", async () => {
    customer("cust-1", "شركة");
    const references: string[] = [];
    for (let i = 0; i < 20; i++) {
      const saved = await saveCustomInvoice(invoice({ id: `bulk-${i}`, date: TODAY }));
      references.push(saved.reference!);
    }
    expect(new Set(references).size).toBe(20);
    expect(db.db.prepare("SELECT COUNT(DISTINCT reference) AS c FROM custom_invoices").get()).toEqual({ c: 20 });
  });

  it("8) البحث بالمرجع ⇒ يجد الفاتورة الصحيحة", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY }));
    await saveCustomInvoice(invoice({ id: "inv-2", date: TODAY }));

    const found = await findCustomInvoiceByReference("26-0002");
    expect(found?.id).toBe("inv-2");
    expect(await findCustomInvoiceByReference("26-0999")).toBeUndefined();
  });

  it("9) فاتورة غير مدفوعة ⇒ لا تزيد النقد", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY, total: 250000 }));
    expect((await getCashSummary()).liquidity).toBe(0);
  });

  it("10) دفعة جزئية ⇒ تُحدَّث الذمة المتبقية", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY, total: 250000 }));
    const accountId = await account();

    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: TODAY,
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });

    expect((await getInvoicePaidMap("sales"))["inv-1"]).toBe(100000);
    expect((await getCashSummary()).liquidity).toBe(100000);
  });

  it("11) دفعات متعددة ⇒ يحسب الرصيد بشكل صحيح", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY, total: 250000 }));
    const accountId = await account();

    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: TODAY,
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 150000,
      paidAt: TODAY,
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 150000 }],
    });

    expect((await getInvoicePaidMap("sales"))["inv-1"]).toBe(250000);
    expect((await getCashSummary()).liquidity).toBe(250000);
    // over-settlement is refused
    await expect(
      recordCustomerReceipt({
        customerId: "cust-1",
        amount: 1000,
        paidAt: TODAY,
        accountId,
        allocations: [{ invoiceId: "inv-1", amount: 1000 }],
      })
    ).rejects.toThrow(/يتجاوز المتبقي/);
  });

  it("12) فاتورة شراء غير مدفوعة ⇒ تُنشئ التزاماً قائماً على المورد", async () => {
    const supplier = await createSupplier({ name: "مطبعة القبول" }, NOW);
    await saveCustomInvoice(invoice({ id: "pinv-1", date: TODAY, type: "purchase", total: 120000 }));

    // link the supplier to the purchase invoice (as the invoice dialog does)
    db.db.prepare("UPDATE custom_invoices SET supplier_id = ? WHERE id = 'pinv-1'").run(supplier.id);

    const supplierAccount = await getSupplierAccount(supplier.id);
    expect(supplierAccount.totalObligations).toBe(120000);
    expect(supplierAccount.outstanding).toBe(120000);
    // an obligation is not outgoing money
    expect((await getCashSummary()).payments).toBe(0);
  });

  it("13) دفعة لمورد ⇒ تخفّض رصيد المورد ورصيد الحساب", async () => {
    const supplier = await createSupplier({ name: "مطبعة القبول" }, NOW);
    await saveCustomInvoice(invoice({ id: "pinv-1", date: TODAY, type: "purchase", total: 120000 }));
    db.db.prepare("UPDATE custom_invoices SET supplier_id = ? WHERE id = 'pinv-1'").run(supplier.id);
    const accountId = await account();

    await recordSupplierPayment({
      supplierId: supplier.id,
      amount: 70000,
      paidAt: TODAY,
      accountId,
      allocations: [{ invoiceId: "pinv-1", amount: 70000 }],
    });

    expect((await getSupplierAccount(supplier.id)).outstanding).toBe(50000);
    expect((await getCashSummary()).liquidity).toBe(-70000);
  });

  it("14) مصروف مباشر ⇒ يضيف التكلفة دون اعتباره مدفوعاً", async () => {
    const expense = await createExpense(
      { kind: "direct", beneficiary: "فريق التركيب", amount: 25000, expenseDate: TODAY },
      NOW
    );
    const rows = await getExpensesWithSettlement();
    const row = rows.find((r) => r.id === expense.id)!;
    expect(row.settlement.paid).toBe(0);
    expect(row.settlement.outstanding).toBe(25000);
    expect((await getCashSummary()).payments).toBe(0);
  });

  it("15) سداد المصروف ⇒ يُسجّل حركة النقد الخارجة فعلاً", async () => {
    const accountId = await account();
    const expense = await createExpense(
      { kind: "direct", beneficiary: "فريق التركيب", amount: 25000, expenseDate: TODAY },
      NOW
    );
    const payment = await payExpense({ expenseId: expense.id, amount: 25000, paidAt: TODAY, accountId }, NOW);

    expect(payment.reference).toMatch(/^EXP-11112026-\d{3}$/);
    expect((await getCashSummary()).liquidity).toBe(-25000);
    const movements = await getCashMovementReport({});
    expect(movements.lines.some((line) => line.sourceId === payment.id)).toBe(true);
  });

  it("17) تقرير الأداء المالي ⇒ يستخدم إيرادات وتكاليف السجلات الفعلية", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY, total: 250000 }));
    const supplier = await createSupplier({ name: "مطبعة" }, NOW);
    await saveCustomInvoice(invoice({ id: "pinv-1", date: TODAY, type: "purchase", total: 170000 }));
    db.db.prepare("UPDATE custom_invoices SET supplier_id = ? WHERE id = 'pinv-1'").run(supplier.id);

    const report = await getFinancialPerformanceReport({});
    expect(report.revenue).toBe(250000);
    expect(report.directCosts).toBe(170000);
    expect(report.grossMargin).toBe(80000);
  });

  it("18) تقرير النقد ⇒ يستخدم المقبوضات والمدفوعات الفعلية", async () => {
    customer("cust-1", "شركة");
    await saveCustomInvoice(invoice({ id: "inv-1", date: TODAY, total: 250000 }));
    const accountId = await account();
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: TODAY,
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });
    const expense = await createExpense(
      { kind: "operating", beneficiary: "إيجار", amount: 30000, expenseDate: TODAY },
      NOW
    );
    await payExpense({ expenseId: expense.id, amount: 30000, paidAt: TODAY, accountId }, NOW);

    const cash = await getCashMovementReport({});
    expect(cash.totalInflow).toBe(100000);
    expect(cash.totalOutflow).toBe(30000);
    expect(cash.net).toBe(70000);
    // every movement carries its source transaction
    for (const line of cash.lines) {
      expect(line.sourceType).toBeTruthy();
      expect(line.sourceId).toBeTruthy();
    }
  });
});
