/**
 * تقارير المرحلة 7 على SQLite حقيقي (PRD §11):
 * كل رقم يجب أن يطابق معاملاته، والتصفية بالتاريخ تعمل، والتتبّع ممكن.
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

vi.mock("@/lib/backup/notify", () => ({ notifyDataChanged: () => {} }));

import { CREATE_SCHEMA_V1, DB_VERSION } from "@/lib/database/schema";
import { runPendingMigrations } from "@/lib/database/migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import { createSupplier } from "@/lib/repositories/SupplierRepository";
import { createExpense, payExpense } from "@/lib/repositories/ExpenseRepository";
import { recordCustomerReceipt, recordSupplierPayment, recordTransfer } from "@/lib/repositories/PaymentRepository";
import { getDefaultAccountId, createAccount } from "@/lib/repositories/FinancialAccountRepository";
import {
  getCashMovementReport,
  getCustomerCollectionsReport,
  getCustomerStatement,
  getFinancialPerformanceReport,
  getPurchasesReport,
  getSalesPerformance,
  getSupplierStatement,
} from "@/lib/repositories/ReportsRepository";

const NOW = "2026-11-11T10:00:00.000Z";

let dir = "";
let db: FixtureDatabase;

beforeEach(async () => {
  closeAllFixtures();
  dir = mkdtempSync(join(tmpdir(), "ta-reports-"));
  db = FixtureDatabase.open({ dir });
  db.applySchema(CREATE_SCHEMA_V1);
  db.db.prepare("INSERT OR REPLACE INTO db_meta(key, value) VALUES('schema_version','1')").run();
  const outcome = await runPendingMigrations(db, { nowIso: NOW });
  expect(outcome.warnings).toEqual([]);
  expect(outcome.to).toBe(DB_VERSION);
  state.db = db;
});

function addCustomer(id: string, name: string) {
  db.db.prepare("INSERT INTO customers (id, name, phone, type, created_at) VALUES (?,?,?,?,?)").run(id, name, "0912", "company", NOW);
}

function addSalesInvoice(id: string, reference: string, date: string, total: number, customerId: string, partyName: string, discount = 0) {
  db.db
    .prepare(
      `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, customer_id, language, total_amount, discount, created_at, updated_at, reference)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(id, "001", "sales", date, partyName, customerId, "ar", total, discount, NOW, NOW, reference);
}

function addPurchaseInvoice(id: string, reference: string, date: string, total: number, supplierId: string) {
  db.db
    .prepare(
      `INSERT INTO custom_invoices
        (id, serial, type, date, party_name, supplier_id, language, total_amount, created_at, updated_at, reference)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(id, "001", "purchase", date, "مورد", supplierId, "ar", total, NOW, NOW, reference);
}

async function defaultAccount(): Promise<string> {
  const id = await getDefaultAccountId();
  if (!id) throw new Error("no default account");
  return id;
}

describe("Sales performance report (PRD §11.1)", () => {
  it("totals match the invoices and can be drilled down", async () => {
    addCustomer("cust-1", "شركة النيل");
    addSalesInvoice("inv-1", "INV-10112026-001", "2026-11-10", 100000, "cust-1", "شركة النيل");
    addSalesInvoice("inv-2", "INV-11112026-001", "2026-11-11", 250000, "cust-1", "شركة النيل", 5000);
    addSalesInvoice("inv-3", "INV-20112026-001", "2026-11-20", 40000, "cust-1", "شركة النيل");

    const all = await getSalesPerformance();
    expect(all.invoiceCount).toBe(3);
    expect(all.totalSales).toBe(390000);
    expect(all.totalDiscount).toBe(5000);
    // the drilled-down rows are the source transactions
    expect(all.invoices.reduce((sum, inv) => sum + inv.total, 0)).toBe(all.totalSales);
    expect(all.byCustomer[0].name).toBe("شركة النيل");
    expect(all.byCustomer[0].total).toBe(390000);

    // date filter narrows the period
    const withinRange = await getSalesPerformance({ from: "2026-11-11", to: "2026-11-20" });
    expect(withinRange.invoiceCount).toBe(2);
    expect(withinRange.totalSales).toBe(290000);
  });
});

describe("Customer collections report (PRD §11.2)", () => {
  it("separates collected money from outstanding balances", async () => {
    addCustomer("cust-1", "شركة");
    addSalesInvoice("inv-1", "INV-11112026-001", "2026-11-11", 250000, "cust-1", "شركة");
    const accountId = await defaultAccount();

    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: "2026-11-11",
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });

    const report = await getCustomerCollectionsReport({});
    expect(report.collectedTotal).toBe(100000);
    expect(report.outstandingTotal).toBe(150000);
    expect(report.payments.length).toBe(1);
    expect(report.openInvoices.length).toBe(1);
    expect(report.openInvoices[0].settlement.status).toBe("partially_paid");
  });

  it("flags overdue invoices and honours the date range on payments", async () => {
    addCustomer("cust-1", "شركة");
    addSalesInvoice("inv-1", "INV-01102026-001", "2026-10-01", 50000, "cust-1", "شركة");
    const accountId = await defaultAccount();
    // A partial payment must be ALLOCATED to settle part of the invoice:
    // an unallocated amount is a credit balance, not a settlement (PRD §4.2).
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 20000,
      paidAt: "2026-10-05",
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 20000 }],
    });

    const report = await getCustomerCollectionsReport({ from: "2026-11-01", to: "2026-11-30" }, "2026-11-11");
    // payment outside the range is excluded from the period total
    expect(report.collectedTotal).toBe(0);
    // the open balance is a current state and is always shown
    expect(report.outstandingTotal).toBe(30000);
    expect(report.openInvoices[0].overdue).toBe(true);
    expect(report.overdueTotal).toBe(30000);
  });
});

describe("Purchases and execution costs report (PRD §11.3)", () => {
  it("reports obligations, payments and direct expenses separately", async () => {
    addCustomer("cust-1", "شركة");
    const supplier = await createSupplier({ name: "مطبعة النور" }, NOW);
    addPurchaseInvoice("pinv-1", "PINV-11112026-001", "2026-11-11", 120000, supplier.id);
    const accountId = await defaultAccount();

    await recordSupplierPayment({
      supplierId: supplier.id,
      amount: 70000,
      paidAt: "2026-11-11",
      accountId,
      allocations: [{ invoiceId: "pinv-1", amount: 70000 }],
    });
    const expense = await createExpense(
      { kind: "direct", beneficiary: "فريق التركيب", amount: 25000, expenseDate: "2026-11-11" },
      NOW
    );
    await payExpense({ expenseId: expense.id, amount: 25000, paidAt: "2026-11-11", accountId }, NOW);

    const report = await getPurchasesReport({});
    expect(report.purchaseCount).toBe(1);
    expect(report.purchaseTotal).toBe(120000);
    expect(report.paidTotal).toBe(70000);
    expect(report.outstandingTotal).toBe(50000);
    expect(report.supplierPayments[0].amount).toBe(70000);
    expect(report.directExpenses[0].amount).toBe(25000);
    expect(report.directExpenses[0].paid).toBe(25000);
  });
});

describe("Financial performance report (PRD §11.4)", () => {
  it("keeps revenue, liquidity and operating expenses apart", async () => {
    addCustomer("cust-1", "شركة");
    const supplier = await createSupplier({ name: "مطبعة" }, NOW);
    addSalesInvoice("inv-1", "INV-11112026-001", "2026-11-11", 250000, "cust-1", "شركة");
    addPurchaseInvoice("pinv-1", "PINV-11112026-001", "2026-11-11", 170000, supplier.id);
    await createExpense({ kind: "operating", beneficiary: "إيجار", amount: 20000, expenseDate: "2026-11-11" }, NOW);
    const accountId = await defaultAccount();
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: "2026-11-11",
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });

    const report = await getFinancialPerformanceReport({});
    expect(report.revenue).toBe(250000);
    expect(report.directCosts).toBe(170000);
    expect(report.operatingExpenses).toBe(20000);
    expect(report.grossMargin).toBe(80000);
    expect(report.netProfit).toBe(60000);
    // liquidity is only the money actually received
    expect(report.liquidity).toBe(100000);
    expect(report.receiptsTotal).toBe(100000);
    expect(report.operatingExpenseRows.length).toBe(1);
  });

  it("does not let an internal transfer change profitability", async () => {
    const cashId = await defaultAccount();
    addCustomer("cust-1", "شركة");
    await recordCustomerReceipt({ customerId: "cust-1", amount: 50000, paidAt: "2026-11-11", accountId: cashId });
    const bank = await createAccount({ name: "بنك", kind: "bank" }, NOW as any);

    const before = await getFinancialPerformanceReport({});
    await recordTransfer({ fromAccountId: cashId, toAccountId: bank.id, amount: 20000, occurredAt: "2026-11-11" }, NOW);
    const after = await getFinancialPerformanceReport({});

    expect(after.netProfit).toBe(before.netProfit);
    expect(after.liquidity).toBe(before.liquidity);
  });
});

describe("Cash movement report (PRD §11.5 D)", () => {
  it("lists each movement with its source and excludes reversed ones from the totals", async () => {
    addCustomer("cust-1", "شركة");
    addSalesInvoice("inv-1", "INV-11112026-001", "2026-11-11", 250000, "cust-1", "شركة");
    const accountId = await defaultAccount();
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 100000,
      paidAt: "2026-11-11",
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 100000 }],
    });

    const report = await getCashMovementReport({});
    expect(report.totalInflow).toBe(100000);
    expect(report.totalOutflow).toBe(0);
    expect(report.net).toBe(100000);
    expect(report.lines[0].sourceType).toBe("customer_payment");
    expect(report.lines[0].sourceId).toBeTruthy();

    // date range excludes the movement
    const outOfRange = await getCashMovementReport({ from: "2026-12-01" });
    expect(outOfRange.lines.length).toBe(0);
  });
});

describe("Statements (PRD §11.5 B and C)", () => {
  it("builds a customer statement with a running balance", async () => {
    addCustomer("cust-1", "شركة");
    addSalesInvoice("inv-1", "INV-10112026-001", "2026-11-10", 200000, "cust-1", "شركة");
    const accountId = await defaultAccount();
    await recordCustomerReceipt({
      customerId: "cust-1",
      amount: 50000,
      paidAt: "2026-11-12",
      accountId,
      allocations: [{ invoiceId: "inv-1", amount: 50000 }],
    });

    const statement = await getCustomerStatement("cust-1");
    expect(statement.lines.length).toBe(2);
    expect(statement.lines[0].runningBalance).toBe(200000);
    expect(statement.lines[1].runningBalance).toBe(150000);
    expect(statement.totalInvoiced).toBe(200000);
    expect(statement.totalCollected).toBe(50000);
    expect(statement.outstanding).toBe(150000);
  });

  it("builds a supplier statement with a running balance", async () => {
    const supplier = await createSupplier({ name: "مطبعة" }, NOW);
    addPurchaseInvoice("pinv-1", "PINV-10112026-001", "2026-11-10", 90000, supplier.id);
    const accountId = await defaultAccount();
    await recordSupplierPayment({
      supplierId: supplier.id,
      amount: 40000,
      paidAt: "2026-11-12",
      accountId,
      allocations: [{ invoiceId: "pinv-1", amount: 40000 }],
    });

    const statement = await getSupplierStatement(supplier.id);
    expect(statement.totalPurchased).toBe(90000);
    expect(statement.totalPaid).toBe(40000);
    expect(statement.outstanding).toBe(50000);
    expect(statement.lines[1].runningBalance).toBe(50000);
  });

  it("includes unallocated advance payments in the customer statement", async () => {
    addCustomer("cust-1", "شركة");
    const accountId = await defaultAccount();
    await recordCustomerReceipt({ customerId: "cust-1", amount: 30000, paidAt: "2026-11-11", accountId });

    const statement = await getCustomerStatement("cust-1");
    expect(statement.totalCollected).toBe(30000);
    // an advance is money received, so the balance is negative (customer in credit)
    expect(statement.lines[0].runningBalance).toBe(-30000);
    expect(statement.netBalance).toBe(-30000);
  });

  it("computes brought-forward balance accurately when filtered by date range", async () => {
    addCustomer("cust-bf", "شركة الرصيد المرحل");
    addSalesInvoice("inv-jan", "26-0001", "2026-01-10", 200000, "cust-bf", "شركة الرصيد المرحل");
    const accountId = await defaultAccount();
    await recordCustomerReceipt({
      customerId: "cust-bf",
      amount: 50000,
      paidAt: "2026-01-15",
      accountId,
      allocations: [{ invoiceId: "inv-jan", amount: 50000 }],
    });
    addSalesInvoice("inv-feb", "26-0002", "2026-02-05", 100000, "cust-bf", "شركة الرصيد المرحل");

    const febStmt = await getCustomerStatement("cust-bf", { from: "2026-02-01", to: "2026-02-28" }, "SDG");
    expect(febStmt.lines.length).toBe(2);
    expect(febStmt.lines[0].kind).toBe("opening_balance");
    expect(febStmt.lines[0].debit).toBe(150000);
    expect(febStmt.lines[0].runningBalance).toBe(150000);
    expect(febStmt.lines[1].id).toBe("inv-feb");
    expect(febStmt.lines[1].runningBalance).toBe(250000);
    expect(febStmt.outstanding).toBe(250000);
    expect(febStmt.netBalance).toBe(250000);
  });
});
