import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { StandardInvoiceDocument } from "./StandardInvoiceDocument";
import type { CustomInvoice } from "@/lib/billing/types";

afterEach(cleanup);

describe("Billing A4 Document & Language Polish", () => {
  it("defaults empty auto-language invoices to Arabic instead of English", () => {
    expect(detectInvoiceLanguage("auto", "", "", [{ description: "" }])).toBe("ar");
    expect(detectInvoiceLanguage("auto", "   ", undefined, [])).toBe("ar");
    expect(detectInvoiceLanguage("auto", "شركة النور", "", [])).toBe("ar");
    expect(detectInvoiceLanguage("auto", "Acme Trading LLC", "", [])).toBe("en");
    expect(detectInvoiceLanguage("en", "شركة النور", "", [])).toBe("en");
  });

  it("renders accurate English invoice title for sales and purchase invoices", () => {
    const baseInvoice: CustomInvoice = {
      id: "inv-en-1",
      reference: "26-0009",
      currency: "USD",
      totalAmount: 500,
      createdAt: "2026-11-20T10:00:00Z",
      meta: {
        type: "sales",
        language: "en",
        date: "2026-11-20",
        partyName: "Global Co",
        partyEnName: "Global Co",
        currency: "USD",
      },
      items: [{ id: "1", description: "Banner Printing", qty: 5, unitPrice: 100, total: 500 }],
    };

    const { container, rerender } = render(<StandardInvoiceDocument invoice={baseInvoice} />);
    expect(container.textContent).toContain("Sales Invoice");
    expect(container.textContent).not.toContain("Pro-invoice");

    rerender(
      <StandardInvoiceDocument
        invoice={{ ...baseInvoice, meta: { ...baseInvoice.meta, type: "purchase" } }}
      />
    );
    expect(container.textContent).toContain("Purchase Invoice");

    rerender(
      <StandardInvoiceDocument
        invoice={{ ...baseInvoice, meta: { ...baseInvoice.meta, type: "proforma" } }}
      />
    );
    expect(container.textContent).toContain("Pro-invoice");
  });

  it("hides blank initial draft placeholder row (qty=1, price=0, total=0) in A4 preview", () => {
    const emptyDraft: CustomInvoice = {
      id: "inv-draft-1",
      reference: "26-0001",
      currency: "SDG",
      totalAmount: 0,
      createdAt: "2026-11-20T10:00:00Z",
      meta: {
        type: "sales",
        language: "auto",
        date: "2026-11-20",
        partyName: "",
        currency: "SDG",
      },
      items: [{ id: "blank-1", description: "", qty: 1, unitPrice: 0, total: 0 }],
    };

    const { container } = render(<StandardInvoiceDocument invoice={emptyDraft} />);
    expect(container.textContent).toContain("فاتورة مبيعات");
    const firstBodyRow = container.querySelector("tbody tr");
    expect(firstBodyRow?.textContent?.trim()).toBe("");
  });
});
