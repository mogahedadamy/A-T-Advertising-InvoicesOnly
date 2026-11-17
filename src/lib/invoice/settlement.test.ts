import { describe, expect, it } from "vitest";
import { saveInvoice } from "@/lib/invoicesStore";
import { invoiceTotal, type Invoice } from "@/lib/invoice/types";

/**
 * PRD §5.1/§12.1: إنشاء فاتورة لا يعني استلام المال.
 * كان المتجر يفترض `paid = total` صامتاً، فيظهر المبلغ محصّلاً بلا أي دفعة.
 */
const invoice: Invoice = {
  meta: {
    serial: "0001",
    date: "2026-11-11",
    customerName: "عميل نقدي",
    phone: "",
    branch: "امدرمان",
    shipTo: "",
    clientTypes: ["takeaway"],
  },
  lines: [
    { description: "لافتة", material: "flex", width: 100, height: 200, qty: 2, unitPrice: 5000, total: 10000 },
  ],
};

describe("Invoice creation never claims money was received", () => {
  it("records zero paid when no explicit payment is provided", () => {
    const record = saveInvoice(invoice);
    expect(invoiceTotal(invoice.lines)).toBe(10000);
    expect(record.paidAmount).toBe(0);
    expect(record.paymentStatus).toBe("unpaid");
    expect(record.total).toBe(10000);
  });

  it("honours an explicit paid amount passed by the caller who knows the money arrived", () => {
    const partial = saveInvoice({ ...invoice, meta: { ...invoice.meta, serial: "0002" } }, 4000);
    expect(partial.paidAmount).toBe(4000);
    expect(partial.paymentStatus).toBe("partial");

    const full = saveInvoice({ ...invoice, meta: { ...invoice.meta, serial: "0003" } }, 10000);
    expect(full.paidAmount).toBe(10000);
    expect(full.paymentStatus).toBe("paid");
  });

  it("treats a negative or invalid paid amount as zero", () => {
    const record = saveInvoice({ ...invoice, meta: { ...invoice.meta, serial: "0004" } }, -500);
    expect(record.paidAmount).toBe(0);
    expect(record.paymentStatus).toBe("unpaid");
  });
});
