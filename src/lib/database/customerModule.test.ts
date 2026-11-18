import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

import { CREATE_SCHEMA_V1, DEFAULT_CASH_ACCOUNT } from "./schema";
import { runPendingMigrations } from "./migrations";
import { FixtureDatabase, closeAllFixtures } from "@/test/backup/fixtureDb";
import {
  upsertCustomer,
  getCustomerById,
  getAllCustomers,
  deleteCustomer,
  archiveCustomer,
  unarchiveCustomer,
  canDeleteCustomer,
  getCustomerFinancialSummary,
  reconcileCustomerInvoices,
} from "@/lib/repositories/CustomerRepository";
import { upsertCustomInvoice, getAllCustomInvoices } from "@/lib/repositories/CustomInvoiceRepository";
import { recordCustomerReceipt } from "@/lib/repositories/PaymentRepository";
import { getCustomerStatement } from "@/lib/repositories/ReportsRepository";

describe("Customer Management & Financial Account Module (PRD Acceptance & Integrity)", () => {
  beforeEach(async () => {
    closeAllFixtures();
    const dir = mkdtempSync(join(tmpdir(), "ta-cust-test-"));
    const path = join(dir, "test.db");
    const fx = new FixtureDatabase(path);
    state.db = fx;
    for (const stmt of CREATE_SCHEMA_V1) {
      await fx.execute(stmt + ";", false);
    }
    await runPendingMigrations(fx);
  });

  afterEach(() => {
    closeAllFixtures();
  });

  it("1) Adds a customer with opening balance and retrieves full profile", async () => {
    const customer = {
      id: "cust-test-1",
      name: "شركة النيل الدولية",
      phone: "0912345678",
      type: "company" as const,
      address: "الخرطوم - شارع الستين",
      notes: "عميل استراتيجي",
      totalOrders: 0,
      totalSpent: 0,
      balance: 150000,
      createdAt: "2026-01-01T00:00:00.000Z",
      openingBalance: 150000,
      openingBalanceCurrency: "SDG",
      openingBalanceType: "debit" as const,
      openingBalanceDate: "2026-01-01",
      openingBalanceNotes: "رصيد مرحل من 2025",
    };

    await upsertCustomer(customer);
    const loaded = await getCustomerById("cust-test-1");

    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe("شركة النيل الدولية");
    expect(loaded?.openingBalance).toBe(150000);
    expect(loaded?.openingBalanceType).toBe("debit");
    expect(loaded?.openingBalanceCurrency).toBe("SDG");
  });

  it("2) Zero-Balance Deletion Ban: Blocks deleting a customer with historical transactions even if balance is 0", async () => {
    // 1. Create customer
    const customer = {
      id: "cust-test-2",
      name: "وكالة الإبداع",
      phone: "0999999999",
      type: "agency" as const,
      address: "بورتسودان",
      totalOrders: 0,
      totalSpent: 0,
      balance: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await upsertCustomer(customer);

    // 2. Issue a sales invoice of 500,000 SDG
    await upsertCustomInvoice({
      id: "inv-test-1",
      meta: {
        serial: "001",
        type: "sales",
        date: "2026-01-05",
        partyName: "وكالة الإبداع",
        language: "ar",
        currency: "SDG",
      },
      items: [{ id: "item-1", description: "طباعة لافتات", qty: 1, unitPrice: 500000, total: 500000 }],
      totalAmount: 500000,
      currency: "SDG",
      customerId: "cust-test-2",
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    });

    // 3. Fully settle the invoice with a receipt
    await recordCustomerReceipt({
      customerId: "cust-test-2",
      amount: 500000,
      paidAt: "2026-01-06",
      accountId: DEFAULT_CASH_ACCOUNT.id,
      allocations: [{ invoiceId: "inv-test-1", amount: 500000 }],
    });

    // 4. Verify balance is indeed zero
    const summary = await getCustomerFinancialSummary("cust-test-2");
    expect(summary.summariesByCurrency["SDG"].outstanding).toBe(0);
    expect(summary.summariesByCurrency["SDG"].paidInvoicesCount).toBe(1);

    // 5. Attempting to delete MUST be strictly blocked
    const canDelete = await canDeleteCustomer("cust-test-2");
    expect(canDelete.allowed).toBe(false);
    expect(canDelete.invoiceCount).toBe(1);
    expect(canDelete.paymentCount).toBe(1);

    await expect(deleteCustomer("cust-test-2")).rejects.toThrow(/لا يمكن حذف هذا العميل/);

    // 6. Archiving is allowed and preserves history
    await archiveCustomer("cust-test-2");
    const archived = await getCustomerById("cust-test-2");
    expect(archived?.isArchived).toBe(true);

    // Active query excludes archived, full query includes it
    const activeList = await getAllCustomers({ includeArchived: false });
    expect(activeList.some((c) => c.id === "cust-test-2")).toBe(false);

    const fullList = await getAllCustomers({ includeArchived: true });
    expect(fullList.some((c) => c.id === "cust-test-2")).toBe(true);
  });

  it("3) Multi-Currency Separation: Keeps SDG and USD balances completely independent", async () => {
    const customer = {
      id: "cust-multi-cur",
      name: "شركة التصدير العالمية",
      phone: "0123456789",
      type: "company" as const,
      address: "الخرطوم",
      totalOrders: 0,
      totalSpent: 0,
      balance: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await upsertCustomer(customer);

    // Invoice 1: 1,000,000 SDG
    await upsertCustomInvoice({
      id: "inv-sdg-1",
      meta: {
        serial: "001",
        type: "sales",
        date: "2026-01-10",
        partyName: "شركة التصدير العالمية",
        language: "ar",
        currency: "SDG",
      },
      items: [{ id: "it-1", description: "طباعة محلية", qty: 1, unitPrice: 1000000, total: 1000000 }],
      totalAmount: 1000000,
      currency: "SDG",
      customerId: "cust-multi-cur",
      createdAt: "2026-01-10T00:00:00.000Z",
      updatedAt: "2026-01-10T00:00:00.000Z",
    });

    // Invoice 2: 2,500 USD
    await upsertCustomInvoice({
      id: "inv-usd-1",
      meta: {
        serial: "002",
        type: "sales",
        date: "2026-01-11",
        partyName: "شركة التصدير العالمية",
        language: "en",
        currency: "USD",
      },
      items: [{ id: "it-2", description: "Booth Branding", qty: 1, unitPrice: 2500, total: 2500 }],
      totalAmount: 2500,
      currency: "USD",
      customerId: "cust-multi-cur",
      createdAt: "2026-01-11T00:00:00.000Z",
      updatedAt: "2026-01-11T00:00:00.000Z",
    });

    // Partial collection in SDG: 400,000 SDG
    await recordCustomerReceipt({
      customerId: "cust-multi-cur",
      amount: 400000,
      paidAt: "2026-01-12",
      accountId: DEFAULT_CASH_ACCOUNT.id,
      allocations: [{ invoiceId: "inv-sdg-1", amount: 400000 }],
    });

    const summary = await getCustomerFinancialSummary("cust-multi-cur");

    // SDG balance verification
    expect(summary.summariesByCurrency["SDG"].totalInvoiced).toBe(1000000);
    expect(summary.summariesByCurrency["SDG"].totalPaid).toBe(400000);
    expect(summary.summariesByCurrency["SDG"].outstanding).toBe(600000);

    // USD balance verification (remains untouched by SDG payment)
    expect(summary.summariesByCurrency["USD"].totalInvoiced).toBe(2500);
    expect(summary.summariesByCurrency["USD"].totalPaid).toBe(0);
    expect(summary.summariesByCurrency["USD"].outstanding).toBe(2500);
  });

  it("4) Name Edits & Historical Integrity: Modifying customer name preserves ID and all past transactions", async () => {
    const customer = {
      id: "cust-rename-test",
      name: "شركة النيل القديمة",
      phone: "0911111111",
      type: "company" as const,
      address: "أم درمان",
      totalOrders: 0,
      totalSpent: 0,
      balance: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await upsertCustomer(customer);

    await upsertCustomInvoice({
      id: "inv-rename-1",
      meta: {
        serial: "001",
        type: "sales",
        date: "2026-01-05",
        partyName: "شركة النيل القديمة",
        language: "ar",
        currency: "SDG",
      },
      items: [{ id: "item-1", description: "عمل إعلاني", qty: 1, unitPrice: 300000, total: 300000 }],
      totalAmount: 300000,
      currency: "SDG",
      customerId: "cust-rename-test",
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    });

    // User renames the customer in their master profile
    await upsertCustomer({
      ...customer,
      name: "شركة النيل الحديثة المتحدة",
    });

    const updatedCustomer = await getCustomerById("cust-rename-test");
    expect(updatedCustomer?.name).toBe("شركة النيل الحديثة المتحدة");

    // Past invoice still has its historical party_name
    const loadedInvoices = await getAllCustomInvoices();
    const inv = loadedInvoices.find((i) => i.id === "inv-rename-1");
    expect(inv?.meta.partyName).toBe("شركة النيل القديمة");
    expect(inv?.customerId).toBe("cust-rename-test");

    // But customer's financial profile still finds and calculates the invoice
    const finSummary = await getCustomerFinancialSummary("cust-rename-test");
    expect(finSummary.summariesByCurrency["SDG"].outstanding).toBe(300000);
  });

  it("5) Safe Reconciliation: Automatically associates legacy invoices with customer_id IS NULL", async () => {
    const customer = {
      id: "cust-reconcile-test",
      name: "مستشفى السلام التخصصي",
      phone: "0922222222",
      type: "company" as const,
      address: "الخرطوم",
      totalOrders: 0,
      totalSpent: 0,
      balance: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    await upsertCustomer(customer);

    // Old invoice created with raw text and customerId = null
    await upsertCustomInvoice({
      id: "inv-legacy-orphan",
      meta: {
        serial: "099",
        type: "sales",
        date: "2026-01-02",
        partyName: "مستشفى السلام التخصصي",
        language: "ar",
        currency: "SDG",
      },
      items: [{ id: "item-1", description: "لوحات إرشادية", qty: 1, unitPrice: 2050000, total: 2050000 }],
      totalAmount: 2050000,
      currency: "SDG",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    // Run reconciliation
    const reconciledCount = await reconcileCustomerInvoices("cust-reconcile-test", "مستشفى السلام التخصصي");
    expect(reconciledCount).toBe(1);

    // Verify invoice now has customer_id linked
    const db = state.db;
    const invCheck = await db.query("SELECT customer_id FROM custom_invoices WHERE id = 'inv-legacy-orphan'");
    expect(invCheck.values?.[0]?.customer_id).toBe("cust-reconcile-test");

    // Verify customer financial summary reflects the 2,050,000 SDG
    const fin = await getCustomerFinancialSummary("cust-reconcile-test");
    expect(fin.summariesByCurrency["SDG"].totalInvoiced).toBe(2050000);
    expect(fin.summariesByCurrency["SDG"].outstanding).toBe(2050000);
  });

  it("6) Chronological Account Statement: Accurately renders opening balance, invoices, receipts and running balance", async () => {
    const customer = {
      id: "cust-stmt-test",
      name: "وكالة النجوم",
      phone: "0933333333",
      type: "agency" as const,
      address: "بحري",
      totalOrders: 0,
      totalSpent: 0,
      balance: 100000,
      createdAt: "2026-01-01T00:00:00.000Z",
      openingBalance: 100000,
      openingBalanceCurrency: "SDG",
      openingBalanceType: "debit" as const,
      openingBalanceDate: "2026-01-01",
    };
    await upsertCustomer(customer);

    // Invoice on 2026-01-05 for 250,000
    await upsertCustomInvoice({
      id: "inv-stmt-1",
      meta: {
        serial: "001",
        type: "sales",
        date: "2026-01-05",
        partyName: "وكالة النجوم",
        language: "ar",
        currency: "SDG",
      },
      items: [{ id: "it-1", description: "بنر", qty: 1, unitPrice: 250000, total: 250000 }],
      totalAmount: 250000,
      currency: "SDG",
      customerId: "cust-stmt-test",
      createdAt: "2026-01-05T00:00:00.000Z",
      updatedAt: "2026-01-05T00:00:00.000Z",
    });

    // Payment on 2026-01-07 for 150,000
    await recordCustomerReceipt({
      customerId: "cust-stmt-test",
      amount: 150000,
      paidAt: "2026-01-07",
      accountId: DEFAULT_CASH_ACCOUNT.id,
      allocations: [{ invoiceId: "inv-stmt-1", amount: 150000 }],
    });

    const stmt = await getCustomerStatement("cust-stmt-test", {}, "SDG");

    expect(stmt.lines.length).toBe(3);
    // Line 0: Opening balance (debit 100,000, balance 100,000)
    expect(stmt.lines[0].kind).toBe("opening_balance");
    expect(stmt.lines[0].debit).toBe(100000);
    expect(stmt.lines[0].runningBalance).toBe(100000);

    // Line 1: Invoice (debit 250,000, balance 350,000)
    expect(stmt.lines[1].kind).toBe("invoice");
    expect(stmt.lines[1].debit).toBe(250000);
    expect(stmt.lines[1].runningBalance).toBe(350000);

    // Line 2: Receipt (credit 150,000, balance 200,000)
    expect(stmt.lines[2].kind).toBe("receipt");
    expect(stmt.lines[2].credit).toBe(150000);
    expect(stmt.lines[2].runningBalance).toBe(200000);

    expect(stmt.outstanding).toBe(200000);
  });
});
