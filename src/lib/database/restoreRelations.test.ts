/**
 * معيارا القبول 7 و19 (PRD §17): الاستعادة تحفظ مراجع الفواتير **وعلاقات
 * الكيانات** (مشروع ← فاتورة ← دفعة ← تكلفة).
 * مرّ الاختبار على محرك النسخ الاحتياطي الحقيقي: لقطة مُتحقَّقة على القرص ثم
 * استعادة استبدالية، ثم التحقق من العلاقات والمعاملات بعد الاستعادة.
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

import { CREATE_SCHEMA_V1 } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import { NodeBackupEngine } from "@/test/backup/nodeEngine";
import { saveCustomInvoice, resetCustomInvoicesStoreForTests } from "@/lib/billing/store";
import { createProject, getProjectRelations, getProjectFinancialSummary } from "@/lib/repositories/ProjectRepository";
import { createSupplier, getSupplierAccount } from "@/lib/repositories/SupplierRepository";
import { createExpense } from "@/lib/repositories/ExpenseRepository";
import { getDefaultAccountId, getAccountBalances } from "@/lib/repositories/FinancialAccountRepository";
import { recordCustomerReceipt, recordSupplierPayment } from "@/lib/repositories/PaymentRepository";
import { getCashSummary, getInvoicePaidMap } from "@/lib/repositories/LedgerRepository";
import type { CustomInvoice } from "@/lib/billing/types";

const NOW = "2026-11-11T08:00:00.000Z";
const TODAY = "2026-11-11";

let root = "";
let dbDir = "";
let folderDir = "";
let db: FixtureDatabase;
let seq = 0;

beforeEach(async () => {
  closeAllFixtures();
  resetCustomInvoicesStoreForTests();
  seq = 0;
  root = mkdtempSync(join(tmpdir(), "ta-restore-rel-"));
  dbDir = join(root, "databases");
  folderDir = join(root, "Documents", "InvoiceBackups");
  db = FixtureDatabase.open({ dir: dbDir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  state.db = db;
  state.engine = new NodeBackupEngine({ folderDir, dbDir, currentSchema: 3 });
});

function makeInvoice(id: string, total: number, projectId?: string, type: CustomInvoice["meta"]["type"] = "sales"): CustomInvoice {
  seq += 1;
  return {
    id,
    meta: { serial: "001", type, date: TODAY, partyName: "شركة العلاقات", language: "ar" },
    items: [{ id: `it-${id}-${seq}`, description: "بند", qty: 1, unitPrice: total, total }],
    totalAmount: total,
    projectId,
    createdAt: NOW,
    updatedAt: NOW,
  } as CustomInvoice;
}

describe("PRD §17 (7, 19) — الاستعادة تحفظ المراجع والعلاقات", () => {
  it("يعيد المشروع وفواتيره ودفعاته وتكاليفه وأرصدته كما كانت", async () => {
    db.db.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("cust-1", "شركة", "0912", "company", NOW);
    const project = await createProject({ customerId: "cust-1", title: "حملة العلاقات" }, NOW);
    const supplier = await createSupplier({ name: "مطبعة العلاقات" }, NOW);

    await saveCustomInvoice(makeInvoice("inv-1", 250000, project.id));
    await saveCustomInvoice(makeInvoice("pinv-1", 120000, project.id, "purchase"));
    db.db.prepare("UPDATE custom_invoices SET supplier_id = ? WHERE id = 'pinv-1'").run(supplier.id);

    const accountId = await getDefaultAccountId();
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: TODAY,
      accountId: accountId!,
      projectId: project.id,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });
    await recordSupplierPayment({
      supplierId: supplier.id,
      amount: 70000,
      paidAt: TODAY,
      accountId: accountId!,
      projectId: project.id,
      allocations: [{ invoiceId: "pinv-1", amount: 70000 }],
    });
    const expense = await createExpense(
      { kind: "direct", projectId: project.id, beneficiary: "فريق تركيب", amount: 25000, expenseDate: TODAY },
      NOW
    );

    // لقطة كاملة قبل أي استعادة
    const created = await state.engine.create({ kind: "manual" });
    expect(created.ok).toBe(true);
    expect(created.manifest?.counts?.projects).toBe(1);
    expect(created.manifest?.counts?.customer_payments).toBe(1);
    expect(created.manifest?.counts?.supplier_payments).toBe(1);
    expect(created.manifest?.counts?.expenses).toBe(1);

    const before = {
      relations: await getProjectRelations(project.id),
      summary: await getProjectFinancialSummary(project.id),
      supplier: await getSupplierAccount(supplier.id),
      paid: await getInvoicePaidMap("sales"),
      cash: await getCashSummary(),
      accounts: (await getAccountBalances()).length,
    };

    // فقدان كل شيء ثم استعادة النسخة (محاكاة إعادة تثبيت / تلف القاعدة)
    closeAllFixtures();
    state.db = null;
    const restored = await state.engine.restore(created.fileName!, "replace");
    expect(restored.ok).toBe(true);
    db = FixtureDatabase.open({ dir: dbDir });
    state.db = db;

    // 7) المراجع الرسمية كما هي (YY-NNNN)
    const references = db.db.prepare("SELECT id, reference FROM custom_invoices ORDER BY id").all() as any[];
    expect(references).toEqual([
      { id: "inv-1", reference: "26-0001" },
      { id: "pinv-1", reference: "26-0002" },
    ]);

    // 19) العلاقات والكيانات
    const after = {
      relations: await getProjectRelations(project.id),
      summary: await getProjectFinancialSummary(project.id),
      supplier: await getSupplierAccount(supplier.id),
      paid: await getInvoicePaidMap("sales"),
      cash: await getCashSummary(),
      accounts: (await getAccountBalances()).length,
    };

    expect(after.relations.salesInvoices.length).toBe(1);
    expect(after.relations.salesInvoices[0].reference).toBe("26-0001");
    expect(after.relations.invoicedAmount).toBe(250000);
    expect(after.relations.collectedAmount).toBe(100000);
    expect(after.relations.paymentCount).toBe(1);

    // الملخص المالي نفسه قبل الاستعادة وبعدها — بما فيه الهامش والحالة
    expect(after.summary.invoicedAmount).toBe(before.summary.invoicedAmount);
    expect(after.summary.directCosts).toBe(before.summary.directCosts);
    expect(after.summary.margin).toBe(before.summary.margin);
    expect(after.summary.collectedAmount).toBe(before.summary.collectedAmount);
    expect(after.summary.customerOutstanding).toBe(before.summary.customerOutstanding);
    expect(after.summary.supplierOutstanding).toBe(before.summary.supplierOutstanding);
    expect(after.summary.suggestedFinancialStatus).toBe(before.summary.suggestedFinancialStatus);

    expect(after.supplier.outstanding).toBe(before.supplier.outstanding);
    expect(after.paid["inv-1"]).toBe(before.paid["inv-1"]);
    expect(after.cash.liquidity).toBe(before.cash.liquidity);
    expect(after.accounts).toBe(before.accounts);

    // المصروف والتكلفة محفوظان
    const expenseRow = db.db.prepare("SELECT amount, project_id FROM expenses WHERE id = ?").get(expense.id) as any;
    expect(expenseRow.amount).toBe(25000);
    expect(expenseRow.project_id).toBe(project.id);
  });

  it("يبقى الترقيم مستمراً بعد الاستعادة بلا إصدار مرجع مستخدم", async () => {
    db.db.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run("cust-1", "شركة", "0912", "company", NOW);
    await saveCustomInvoice(makeInvoice("inv-1", 100000));
    await saveCustomInvoice(makeInvoice("inv-2", 100000));

    const created = await state.engine.create({ kind: "manual" });
    expect(created.ok).toBe(true);

    // استعادة بعد أن اختفت عدّادات التسلسل (نسخة قديمة)
    closeAllFixtures();
    state.db = null;
    const restored = await state.engine.restore(created.fileName!, "replace");
    expect(restored.ok).toBe(true);
    db = FixtureDatabase.open({ dir: dbDir });
    state.db = db;
    db.db.exec("DELETE FROM document_sequences");

    const next = await saveCustomInvoice(makeInvoice("inv-3", 100000));
    expect(next.reference).toBe("26-0003");

    const count = db.db.prepare("SELECT COUNT(DISTINCT reference) AS c FROM custom_invoices").get() as any;
    expect(Number(count.c)).toBe(3);
  });
});
