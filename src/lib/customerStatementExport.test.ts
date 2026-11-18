import { describe, it, expect } from "vitest";
import { buildStatementDomElement } from "./customerStatementExport";
import type { CustomerStatement } from "./repositories/ReportsRepository";
import type { CustomerRecord } from "./customersStore";

describe("customerStatementExport - Professional Enterprise A4 Redesign", () => {
  const mockCustomer: CustomerRecord = {
    id: "cust-test-1",
    name: "شركة النور للتجارة والمقاولات",
    phone: "0912345678",
    type: "company",
    address: "الخرطوم، شارع الستين",
    totalOrders: 3,
    totalSpent: 1500000,
    balance: 500000,
    createdAt: "2026-01-01",
  };

  const mockStatement: CustomerStatement = {
    customerId: "cust-test-1",
    customerName: "شركة النور للتجارة والمقاولات",
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

  it("builds an authentic Enterprise A4 statement DOM element filling the full page", () => {
    const el = buildStatementDomElement(mockStatement, mockCustomer, "SDG");
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains("statement-print-root")).toBe(true);
    expect(el.classList.contains("standard-invoice-sheet")).toBe(true);
    // Explicit check: Must not have "invoice-paper" which triggers A5 landscape in pdfExport.ts
    expect(el.classList.contains("invoice-paper")).toBe(false);

    // Full A4 dimensions
    expect(el.style.width).toBe("210mm");
    expect(el.style.height).toBe("297mm");
    expect(el.style.minHeight).toBe("297mm");

    // Company & Report Title
    expect(el.innerHTML).toContain("كشف حساب مالي");
    expect(el.innerHTML).toContain("STATEMENT OF ACCOUNT");
    expect(el.innerHTML).toContain("+249 12371 1444");
    expect(el.innerHTML).toContain("t.a.advertising@gmail.com");

    // Client & Meta Box
    expect(el.innerHTML).toContain("شركة النور للتجارة والمقاولات");
    expect(el.innerHTML).toContain("شركة");
    expect(el.innerHTML).toContain("cust-test-1");
    expect(el.innerHTML).toContain("0912345678");

    // KPI Summary
    expect(el.innerHTML).toContain("إجمالي المطالبات والفواتير");
    expect(el.innerHTML).toContain("إجمالي التحصيلات والمدفوعات");
    expect(el.innerHTML).toContain("صافي الرصيد المستحق على العميل");

    // Ledger Table & References
    expect(el.innerHTML).toContain("INV-001");
    expect(el.innerHTML).toContain("REC-001");
    expect(el.innerHTML).toContain("الرصيد التراكمي");

    // Bank Details & Signatures
    expect(el.innerHTML).toContain("بنك الخرطوم 3283046");
    expect(el.innerHTML).toContain("طارق عثمان علي");
    expect(el.innerHTML).toContain("اعتماد واستلام العميل");

    // Verification QR code must NOT have "توثيق إلكتروني معتمد" or "توقيع الكتروني معتمد"
    expect(el.innerHTML).not.toContain("توثيق إلكتروني معتمد");
    expect(el.innerHTML).not.toContain("توقيع الكتروني معتمد");
  });

  it("handles multi-currency and zero balance properly without numerical clutter", () => {
    const zeroStatement: CustomerStatement = {
      customerId: "cust-test-2",
      customerName: "مؤسسة الرواد للدعاية",
      currency: "USD",
      openingBalance: 0,
      totalInvoiced: 5000,
      totalCollected: 5000,
      outstanding: 0,
      lines: [
        {
          id: "line-1",
          date: "2026-03-01",
          kind: "invoice",
          label: "فاتورة مبيعات دولارية",
          reference: "INV-USD-1",
          debit: 5000,
          credit: 0,
          runningBalance: 5000,
        },
        {
          id: "line-2",
          date: "2026-03-05",
          kind: "payment",
          label: "سداد حساب بنكي",
          reference: "PAY-USD-1",
          debit: 0,
          credit: 5000,
          runningBalance: 0,
        },
      ],
    };

    const instCustomer: CustomerRecord = {
      ...mockCustomer,
      id: "cust-test-2",
      name: "مؤسسة الرواد للدعاية",
      type: "institution",
    };

    const el = buildStatementDomElement(zeroStatement, instCustomer, "USD");
    expect(el.innerHTML).toContain("دولار أمريكي (USD)");
    expect(el.innerHTML).toContain("مؤسسة");
    expect(el.innerHTML).toContain("الحساب متزن بالكامل ومسدد");
  });
});
