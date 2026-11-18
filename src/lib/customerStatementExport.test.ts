import { describe, it, expect } from "vitest";
import { buildStatementDomElement } from "./customerStatementExport";
import type { CustomerStatement } from "./repositories/ReportsRepository";
import type { CustomerRecord } from "./customersStore";

describe("customerStatementExport", () => {
  const mockCustomer: CustomerRecord = {
    id: "cust-test-1",
    name: "شركة النور للتجارة",
    phone: "0912345678",
    type: "business",
    address: "الخرطوم، شارع الستين",
    totalOrders: 3,
    totalSpent: 1500000,
    balance: 500000,
    createdAt: "2026-01-01",
  };

  const mockStatement: CustomerStatement = {
    customerId: "cust-test-1",
    customerName: "شركة النور للتجارة",
    currency: "SDG",
    openingBalance: 0,
    totalInvoiced: 1500000,
    totalCollected: 1000000,
    outstanding: 500000,
    lines: [
      {
        id: "line-1",
        date: "2026-02-01",
        kind: "invoice",
        label: "فاتورة مبيعات #INV-001",
        reference: "INV-001",
        debit: 1500000,
        credit: 0,
        runningBalance: 1500000,
      },
      {
        id: "line-2",
        date: "2026-02-10",
        kind: "payment",
        label: "سند قبض نقدي #REC-001",
        reference: "REC-001",
        debit: 0,
        credit: 1000000,
        runningBalance: 500000,
      },
    ],
  };

  it("builds an authentic A4 statement DOM element matching brand identity", () => {
    const el = buildStatementDomElement(mockStatement, mockCustomer, "SDG");
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains("statement-print-root")).toBe(true);
    expect(el.classList.contains("standard-invoice-sheet")).toBe(true);
    expect(el.innerHTML).toContain("كشف حساب مالي");
    expect(el.innerHTML).toContain("شركة النور للتجارة");
    expect(el.innerHTML).toContain("cust-test-1");
    expect(el.innerHTML).toContain("0912345678");
    expect(el.innerHTML).toContain("INV-001");
    expect(el.innerHTML).toContain("REC-001");
    expect(el.innerHTML).toContain("بنك الخرطوم 3283046");
    expect(el.innerHTML).toContain("طارق عثمان علي");
  });
});
