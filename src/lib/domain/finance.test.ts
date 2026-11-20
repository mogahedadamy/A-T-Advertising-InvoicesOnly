import { describe, expect, it } from "vitest";
import {
  buildAccountReport,
  buildCompanyProfitability,
  buildSettlement,
  deriveAccountBalance,
  deriveSettlementStatus,
  looksLikeDuplicatePayment,
  sanitizeMoney,
  validateAllocations,
  type FinancialAccount,
  type LedgerEntry,
} from "@/lib/domain/finance";

describe("Allocation rules (PRD §4.2, §12)", () => {
  const invoices = [
    { id: "inv-1", total: 250000, alreadyAllocated: 0 },
    { id: "inv-2", total: 100000, alreadyAllocated: 40000 },
  ];

  it("accepts a full allocation to one invoice", () => {
    const result = validateAllocations(250000, [{ invoiceId: "inv-1", amount: 250000 }], invoices);
    expect(result.ok).toBe(true);
    expect(result.totalAllocated).toBe(250000);
    expect(result.unallocated).toBe(0);
  });

  it("supports partial payments and multiple invoices on one payment", () => {
    const result = validateAllocations(
      100000,
      [
        { invoiceId: "inv-1", amount: 30000 },
        { invoiceId: "inv-2", amount: 60000 },
      ],
      invoices
    );
    expect(result.ok).toBe(true);
    expect(result.totalAllocated).toBe(90000);
    // the remaining 10,000 stays unallocated: a valid advance
    expect(result.unallocated).toBe(10000);
  });

  it("accepts a fully unallocated advance payment", () => {
    const result = validateAllocations(50000, [], invoices);
    expect(result.ok).toBe(true);
    expect(result.unallocated).toBe(50000);
  });

  it("refuses allocations beyond an invoice's outstanding balance", () => {
    // inv-2 has only 60,000 left
    const result = validateAllocations(100000, [{ invoiceId: "inv-2", amount: 70000 }], invoices);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("يتجاوز المتبقي");
  });

  it("refuses allocations that exceed the payment itself", () => {
    const result = validateAllocations(
      50000,
      [
        { invoiceId: "inv-1", amount: 30000 },
        { invoiceId: "inv-2", amount: 30000 },
      ],
      invoices
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("يتجاوز قيمة الدفعة");
  });

  it("refuses non-positive amounts", () => {
    expect(validateAllocations(0, [], invoices).ok).toBe(false);
    expect(validateAllocations(1000, [{ invoiceId: "inv-1", amount: 0 }], invoices).ok).toBe(false);
  });

  it("refuses an allocation to an unknown invoice", () => {
    const result = validateAllocations(1000, [{ invoiceId: "nope", amount: 1000 }], invoices);
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("غير موجودة");
  });

  it("refuses duplicate invoiceId allocations that collectively exceed invoice outstanding (FIN-08)", () => {
    // inv-2 has only 60,000 remaining; two rows of 40,000 each total 80,000 > 60,000.
    const result = validateAllocations(
      100000,
      [
        { invoiceId: "inv-2", amount: 40000 },
        { invoiceId: "inv-2", amount: 40000 },
      ],
      invoices
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("يتجاوز المتبقي");
  });

  it("refuses non-finite amounts (Infinity, -Infinity, NaN)", () => {
    expect(validateAllocations(Infinity, [{ invoiceId: "inv-1", amount: 100 }], invoices).ok).toBe(false);
    expect(validateAllocations(1000, [{ invoiceId: "inv-1", amount: Infinity }], invoices).ok).toBe(false);
    expect(validateAllocations(1000, [{ invoiceId: "inv-1", amount: -Infinity }], invoices).ok).toBe(false);
    expect(validateAllocations(NaN, [], invoices).ok).toBe(false);
    expect(sanitizeMoney(Infinity)).toBe(0);
    expect(sanitizeMoney(NaN)).toBe(0);
    expect(sanitizeMoney(12.345)).toBe(12.35);
  });

  it("eliminates the 100.009 sub-cent rounding exploit via integer minor units", () => {
    const smallInvoices = [{ id: "inv-small", total: 100, alreadyAllocated: 0 }];
    const overOutstanding = validateAllocations(200, [{ invoiceId: "inv-small", amount: 100.009 }], smallInvoices);
    expect(overOutstanding.ok).toBe(false);
    expect(overOutstanding.errors.join(" ")).toContain("يتجاوز المتبقي");

    const overPayment = validateAllocations(100, [{ invoiceId: "inv-small", amount: 100.009 }], [
      { id: "inv-small", total: 500, alreadyAllocated: 0 },
    ]);
    expect(overPayment.ok).toBe(false);
    expect(overPayment.errors.join(" ")).toContain("يتجاوز قيمة الدفعة");
  });
});

describe("Duplicate transaction detection (PRD §12.8)", () => {
  const existing = [{ amount: 100000, paidAt: "2026-11-11", method: "cash", invoiceIds: ["inv-1"] }];

  it("flags an identical transaction", () => {
    expect(
      looksLikeDuplicatePayment({ amount: 100000, paidAt: "2026-11-11", method: "cash", invoiceIds: ["inv-1"] }, existing)
    ).toBe(true);
  });

  it("does not flag a different amount, date, method or invoice", () => {
    expect(
      looksLikeDuplicatePayment({ amount: 100001, paidAt: "2026-11-11", method: "cash", invoiceIds: ["inv-1"] }, existing)
    ).toBe(false);
    expect(
      looksLikeDuplicatePayment({ amount: 100000, paidAt: "2026-11-12", method: "cash", invoiceIds: ["inv-1"] }, existing)
    ).toBe(false);
    expect(
      looksLikeDuplicatePayment({ amount: 100000, paidAt: "2026-11-11", method: "bank_transfer", invoiceIds: ["inv-1"] }, existing)
    ).toBe(false);
    expect(
      looksLikeDuplicatePayment({ amount: 100000, paidAt: "2026-11-11", method: "cash", invoiceIds: ["inv-2"] }, existing)
    ).toBe(false);
  });
});

describe("Account balances from real movements only (PRD §10.1)", () => {
  const account: FinancialAccount = {
    id: "acc-1",
    name: "الصندوق",
    kind: "cash",
    openingBalance: 10000,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  const entry = (kind: LedgerEntry["kind"], amount: number, reversedBy?: string): LedgerEntry => ({
    id: `tx-${kind}-${amount}-${reversedBy ?? ""}`,
    kind,
    amount,
    occurredAt: "2026-11-11",
    accountId: "acc-1",
    createdAt: "2026-11-11T00:00:00.000Z",
    reversedBy,
  });

  it("adds receipts and subtracts payments", () => {
    const balance = deriveAccountBalance(10000, [entry("receipt", 250000), entry("payment", 70000)]);
    expect(balance).toBe(190000);
  });

  it("moves money on transfers without treating them as income or expense", () => {
    const balance = deriveAccountBalance(0, [entry("transfer_in", 50000), entry("transfer_out", 20000)]);
    expect(balance).toBe(30000);

    const report = buildAccountReport(account, [entry("receipt", 100), entry("transfer_in", 50)]);
    expect(report.inflow).toBe(150);
    expect(report.outflow).toBe(0);
  });

  it("ignores reversed movements so a cancellation cannot double count", () => {
    const balance = deriveAccountBalance(0, [entry("receipt", 100000, "pay-1"), entry("receipt", 25000)]);
    expect(balance).toBe(25000);
  });

  it("reports a complete account picture", () => {
    const report = buildAccountReport(account, [entry("receipt", 300), entry("payment", 120), entry("transfer_out", 30)]);
    expect(report.balance).toBe(10000 + 300 - 120 - 30);
    expect(report.inflow).toBe(300);
    expect(report.outflow).toBe(150);
  });
});

describe("Derived payment status (PRD §4.2)", () => {
  it("is computed from records, never from stored flags", () => {
    expect(deriveSettlementStatus(250000, 0)).toBe("unpaid");
    expect(deriveSettlementStatus(250000, 100000)).toBe("partially_paid");
    expect(deriveSettlementStatus(250000, 250000)).toBe("fully_paid");
    // overpayment still counts as settled, and outstanding never goes negative
    const summary = buildSettlement(250000, 260000);
    expect(summary.status).toBe("fully_paid");
    expect(summary.outstanding).toBe(0);
  });

  it("keeps total, paid and outstanding consistent", () => {
    const summary = buildSettlement(250000, 100000);
    expect(summary.total).toBe(250000);
    expect(summary.paid).toBe(100000);
    expect(summary.outstanding).toBe(150000);
  });
});

describe("Company profitability (PRD §9.5)", () => {
  it("keeps direct costs and operating expenses apart", () => {
    const result = buildCompanyProfitability({ revenue: 500000, directCosts: 300000, operatingExpenses: 50000 });
    expect(result.grossMargin).toBe(200000);
    expect(result.netProfit).toBe(150000);
    // net profit is never the gross margin and never the revenue
    expect(result.netProfit).not.toBe(result.grossMargin);
    expect(result.netProfit).not.toBe(result.revenue);
  });

  it("can report a loss without hiding it", () => {
    const result = buildCompanyProfitability({ revenue: 100000, directCosts: 120000, operatingExpenses: 30000 });
    expect(result.grossMargin).toBe(-20000);
    expect(result.netProfit).toBe(-50000);
  });
});
