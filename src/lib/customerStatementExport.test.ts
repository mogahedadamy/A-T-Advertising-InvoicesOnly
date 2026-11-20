import { describe, it, expect } from "vitest";
import { buildStatementDomElement } from "./customerStatementExport";
import type { CustomerStatement } from "./repositories/ReportsRepository";
import type { CustomerRecord } from "./customersStore";

describe("customerStatementExport - Executive Corporate A4 Statement", () => {
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

  it("builds an executive Corporate A4 statement without raw JS IDs, faux italic, or metric clutter", () => {
    const el = buildStatementDomElement(mockStatement, mockCustomer, "SDG");
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.classList.contains("statement-print-root")).toBe(true);
    expect(el.classList.contains("standard-invoice-sheet")).toBe(true);
    // Explicit check: Must not have "invoice-paper" which triggers A5 landscape in pdfExport.ts
    expect(el.classList.contains("invoice-paper")).toBe(false);

    // Full A4 dimensions for single-page statements
    expect(el.style.width).toBe("210mm");
    expect(el.style.height).toBe("297mm");
    expect(el.style.minHeight).toBe("297mm");

    // Company & Report Title
    expect(el.innerHTML).toContain("كشف حساب مالي");
    expect(el.innerHTML).toContain("STATEMENT OF ACCOUNT");
    expect(el.innerHTML).toContain("+249 12371 1444");
    expect(el.innerHTML).toContain("t.a.advertising@gmail.com");

    // Client details: shows real info, NEVER exposes raw internal JS IDs
    expect(el.innerHTML).toContain("شركة النور للتجارة والمقاولات");
    expect(el.innerHTML).toContain("شركة");
    expect(el.innerHTML).not.toContain("cust-test-1");
    expect(el.innerHTML).toContain('<bdi dir="ltr"');
    expect(el.innerHTML).toContain("0912345678");
    expect(el.innerHTML).toContain("الخرطوم، شارع الستين");

    // Executive Summary + Arabic Tafqeet without repetitive 3-card KPI noise
    expect(el.innerHTML).toContain("صافي الرصيد المستحق");
    expect(el.innerHTML).toContain("صافي المستحق بالحروف:");
    expect(el.innerHTML).not.toContain("إجمالي القيود المسجلة");
    expect(el.innerHTML).not.toContain("font-style: italic");

    // Clean RTL Ledger Headers (no reversed BiDi (+) / (-) markers)
    expect(el.innerHTML).toContain("INV-001");
    expect(el.innerHTML).toContain("REC-001");
    expect(el.innerHTML).toContain("الرصيد التراكمي");
    expect(el.innerHTML).not.toContain("مدين (+)");
    expect(el.innerHTML).not.toContain("دائن (-)");

    // Bank Details & Equal-Height Signatures
    expect(el.innerHTML).toContain("بنك الخرطوم");
    expect(el.innerHTML).toContain("3283046");
    expect(el.innerHTML).toContain("طارق عثمان علي");
    expect(el.innerHTML).toContain("اعتماد واستلام العميل");

    // Verification QR code must NOT have "توثيق إلكتروني معتمد" or "توقيع الكتروني معتمد"
    expect(el.innerHTML).not.toContain("توثيق إلكتروني معتمد");
    expect(el.innerHTML).not.toContain("توقيع الكتروني معتمد");
  });

  it("handles multi-currency, zero balance, and omits fabricated address when customer has no address", () => {
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
      address: "",
    };

    const el = buildStatementDomElement(zeroStatement, instCustomer, "USD");
    expect(el.innerHTML).toContain("دولار أمريكي (USD)");
    expect(el.innerHTML).toContain("مؤسسة");
    expect(el.innerHTML).toContain("الحساب متزن بالكامل ومسدد");
    expect(el.innerHTML).not.toContain("العنوان:");
  });

  it("switches to multi-page auto height when ledger exceeds 12 rows", () => {
    const manyLines = Array.from({ length: 15 }, (_, i) => ({
      id: `line-${i}`,
      date: "2026-04-01",
      kind: "invoice" as const,
      label: `فاتورة #${i + 1}`,
      reference: `26-00${i + 1}`,
      debit: 1000,
      credit: 0,
      runningBalance: (i + 1) * 1000,
    }));

    const longStatement: CustomerStatement = {
      ...mockStatement,
      lines: manyLines,
      totalInvoiced: 15000,
      totalCollected: 0,
      outstanding: 15000,
    };

    const el = buildStatementDomElement(longStatement, mockCustomer, "SDG");
    expect(el.style.minHeight).toBe("297mm");
    expect(el.style.height).toBe("auto");
  });

  it("escapes XSS payloads across all dynamic customer and ledger fields (SEC-03)", () => {
    const xssPayload = "<img src=x onerror=alert(1)>";
    const scriptPayload = "<script>window.__xss=1</script>";

    const xssCustomer: CustomerRecord = {
      ...mockCustomer,
      id: `cust-${xssPayload}`,
      name: `عميل ${xssPayload}`,
      phone: `0912${xssPayload}`,
      address: `الخرطوم ${scriptPayload}`,
    };

    const xssStatement: CustomerStatement = {
      ...mockStatement,
      customerId: xssCustomer.id,
      customerName: xssCustomer.name,
      lines: [
        {
          id: "line-xss",
          date: `2026-03-01${xssPayload}`,
          kind: "invoice",
          label: `فاتورة ${xssPayload}`,
          notes: `ملاحظة ${scriptPayload}`,
          reference: `INV-${xssPayload}`,
          debit: 1000,
          credit: 0,
          runningBalance: 1000,
        },
      ],
    };

    const el = buildStatementDomElement(xssStatement, xssCustomer, "SDG");

    // Must not inject any live <script> or malicious <img src="x"> DOM elements
    expect(el.querySelectorAll("script").length).toBe(0);
    expect(el.querySelectorAll('img[src="x"]').length).toBe(0);

    // Raw payload must be HTML-escaped in innerHTML
    expect(el.innerHTML).not.toContain(xssPayload);
    expect(el.innerHTML).not.toContain(scriptPayload);
    expect(el.innerHTML).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(el.innerHTML).toContain("&lt;script&gt;window.__xss=1&lt;/script&gt;");

    // Literal text remains readable to the user
    expect(el.textContent).toContain("عميل <img src=x onerror=alert(1)>");
  });
});
