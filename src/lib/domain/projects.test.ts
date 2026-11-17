import { describe, expect, it } from "vitest";
import {
  buildProjectFinancialSummary,
  deriveFinancialStatus,
  EXECUTION_STATUS_LABELS,
  FINANCIAL_STATUS_LABELS,
  PROJECT_EXECUTION_STATUSES,
  PROJECT_FINANCIAL_STATUSES,
  resolveFinancialStatus,
  validateProjectDraft,
  type ProjectFinancialInputs,
} from "@/lib/domain/projects";

function inputs(overrides: Partial<ProjectFinancialInputs> = {}): ProjectFinancialInputs {
  return {
    invoicedAmount: 0,
    collectedAmount: 0,
    directCosts: 0,
    paidToSuppliers: 0,
    invoiceCount: 0,
    quotationCount: 0,
    orderCount: 0,
    paymentCount: 0,
    costRecordCount: 0,
    ...overrides,
  };
}

describe("Project status vocabularies (PRD §4.4)", () => {
  it("keeps execution and financial statuses separate and complete", () => {
    expect(PROJECT_EXECUTION_STATUSES).toEqual([
      "new",
      "quotation_pending",
      "approved",
      "in_progress",
      "partially_delivered",
      "completed",
      "cancelled",
    ]);
    expect(PROJECT_FINANCIAL_STATUSES).toEqual([
      "not_invoiced",
      "unpaid",
      "partially_paid",
      "fully_paid",
      "partially_settled",
      "financially_closed",
    ]);
    // no status may exist in both vocabularies
    const overlap = PROJECT_EXECUTION_STATUSES.filter((s) =>
      (PROJECT_FINANCIAL_STATUSES as readonly string[]).includes(s)
    );
    expect(overlap).toEqual([]);
  });

  it("labels every status in Arabic", () => {
    for (const status of PROJECT_EXECUTION_STATUSES) {
      expect(EXECUTION_STATUS_LABELS[status]).toBeTruthy();
    }
    for (const status of PROJECT_FINANCIAL_STATUSES) {
      expect(FINANCIAL_STATUS_LABELS[status]).toBeTruthy();
    }
  });
});

describe("Financial status derivation from records (PRD §4.4, §12)", () => {
  it("reports not invoiced when there is no invoice", () => {
    expect(deriveFinancialStatus(inputs())).toBe("not_invoiced");
    // costs alone never create an invoice status
    expect(deriveFinancialStatus(inputs({ directCosts: 500, costRecordCount: 1 }))).toBe("not_invoiced");
  });

  it("reports unpaid when an invoice exists but nothing was collected", () => {
    expect(deriveFinancialStatus(inputs({ invoicedAmount: 250000, invoiceCount: 1 }))).toBe("unpaid");
  });

  it("never treats an invoice as collected money (PRD §12.1)", () => {
    const summary = buildProjectFinancialSummary(inputs({ invoicedAmount: 250000, invoiceCount: 1 }));
    expect(summary.collectedAmount).toBe(0);
    expect(summary.customerOutstanding).toBe(250000);
    expect(summary.suggestedFinancialStatus).toBe("unpaid");
    expect(summary.completenessNotes.join(" ")).toContain("ذمم");
  });

  it("moves through partial payments to fully paid", () => {
    expect(
      deriveFinancialStatus(inputs({ invoicedAmount: 250000, collectedAmount: 100000, invoiceCount: 1, paymentCount: 1 }))
    ).toBe("partially_paid");
    expect(
      deriveFinancialStatus(inputs({ invoicedAmount: 250000, collectedAmount: 250000, invoiceCount: 1, paymentCount: 3 }))
    ).toBe("fully_paid");
  });

  it("keeps the supplier side visible after the customer paid", () => {
    const partiallySettled = deriveFinancialStatus(
      inputs({
        invoicedAmount: 250000,
        collectedAmount: 250000,
        directCosts: 170000,
        paidToSuppliers: 90000,
        invoiceCount: 1,
        paymentCount: 1,
        costRecordCount: 2,
      })
    );
    expect(partiallySettled).toBe("partially_settled");
  });

  it("closes financially only after an explicit review with no balances left", () => {
    const settled = inputs({
      invoicedAmount: 250000,
      collectedAmount: 250000,
      directCosts: 170000,
      paidToSuppliers: 170000,
      invoiceCount: 1,
      paymentCount: 1,
      costRecordCount: 2,
    });
    // nobody reviewed it yet → not closed
    expect(deriveFinancialStatus(settled)).toBe("fully_paid");
    // reviewed → closed
    expect(deriveFinancialStatus({ ...settled, closedByUser: true })).toBe("financially_closed");
    // even with the user flag, an outstanding balance must block closure
    expect(
      deriveFinancialStatus({ ...settled, closedByUser: true, collectedAmount: 200000 })
    ).toBe("partially_paid");
  });

  it("corrects a stale stored status against the records (PRD §10.2)", () => {
    // Stored says fully paid, records say nothing was collected → derived wins.
    expect(resolveFinancialStatus("fully_paid", "unpaid")).toBe("unpaid");
    // An explicit closure is respected while records still support it.
    expect(resolveFinancialStatus("financially_closed", "fully_paid")).toBe("financially_closed");
    expect(resolveFinancialStatus("financially_closed", "not_invoiced")).toBe("not_invoiced");
    expect(resolveFinancialStatus("unpaid", "partially_paid")).toBe("partially_paid");
  });
});

describe("Financial summary (PRD §9)", () => {
  it("computes margin, receivables, payables and net cash separately", () => {
    const summary = buildProjectFinancialSummary(
      inputs({
        invoicedAmount: 250000,
        collectedAmount: 100000,
        directCosts: 170000,
        paidToSuppliers: 70000,
        invoiceCount: 1,
        paymentCount: 1,
        costRecordCount: 3,
      })
    );

    expect(summary.invoicedAmount).toBe(250000);
    expect(summary.collectedAmount).toBe(100000);
    expect(summary.customerOutstanding).toBe(150000);
    expect(summary.margin).toBe(80000); // 250000 - 170000
    expect(summary.supplierOutstanding).toBe(100000); // 170000 - 70000
    expect(summary.netCash).toBe(30000); // 100000 - 70000
    // three different measurements, never merged
    expect(summary.margin).not.toBe(summary.netCash);
    expect(summary.isComplete).toBe(false);
    expect(summary.completenessNotes.join(" ")).toContain("لم تُسدَّد بالكامل");
  });

  it("flags missing costs instead of reporting a final profit (PRD §9.6)", () => {
    const summary = buildProjectFinancialSummary(
      inputs({ invoicedAmount: 100000, collectedAmount: 100000, invoiceCount: 1, paymentCount: 1 })
    );
    expect(summary.isComplete).toBe(false);
    expect(summary.completenessNotes.join(" ")).toContain("الهامش المعروض غير مكتمل");
    expect(summary.margin).toBe(100000); // arithmetic only, and labelled incomplete
  });

  it("reports completeness only when every side is recorded", () => {
    const summary = buildProjectFinancialSummary(
      inputs({
        invoicedAmount: 100000,
        collectedAmount: 100000,
        directCosts: 60000,
        paidToSuppliers: 60000,
        invoiceCount: 1,
        paymentCount: 1,
        costRecordCount: 2,
      })
    );
    expect(summary.isComplete).toBe(true);
    expect(summary.completenessNotes).toEqual([]);
    expect(summary.supplierOutstanding).toBe(0);
    expect(summary.customerOutstanding).toBe(0);
  });

  it("notes a quotation that never became an invoice", () => {
    const summary = buildProjectFinancialSummary(inputs({ quotationCount: 1 }));
    expect(summary.completenessNotes.join(" ")).toContain("عرض سعر بدون فاتورة");
  });
});

describe("Project validation (PRD §4.1)", () => {
  it("requires a title and a customer", () => {
    expect(validateProjectDraft({}).ok).toBe(false);
    expect(validateProjectDraft({ title: "حملة", customerId: "" }).errors).toContain("يجب اختيار العميل");
    expect(validateProjectDraft({ title: "   ", customerId: "c1" }).ok).toBe(false);
    expect(validateProjectDraft({ title: "حملة إعلانية", customerId: "c1" }).ok).toBe(true);
  });

  it("rejects unknown statuses and malformed dates", () => {
    expect(validateProjectDraft({ title: "x", customerId: "c", executionStatus: "bogus" as any }).ok).toBe(false);
    expect(validateProjectDraft({ title: "x", customerId: "c", deliveryDate: "11/11/2026" }).ok).toBe(false);
    expect(validateProjectDraft({ title: "x", customerId: "c", deliveryDate: "2026-11-11" }).ok).toBe(true);
  });
});
