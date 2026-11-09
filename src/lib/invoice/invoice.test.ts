import { describe, it, expect } from "vitest";
import { formatSerial } from "./serial";
import { invoiceTotal } from "./types";
import { toInvoiceLines, type OrderItem } from "./fromCalc";

describe("invoice", () => {
  it("pads serial to 4 digits", () => {
    expect(formatSerial(7)).toBe("0007");
  });
  it("sums line totals", () => {
    const l = { width: 1, height: 1, qty: 1, material: "", description: "", unitPrice: 0 };
    expect(invoiceTotal([{ ...l, total: 2800 }, { ...l, total: 1200 }])).toBe(4000);
  });
  it("keeps each size's own description with its dimensions and calculated price", () => {
    const base: OrderItem = { width: 100, height: 200, qty: 2, material: "flex", unitPrice: 12000, area: 4, cost: 48000, displayRoll: "100 سم", type: "رولة", description: "ديباجات عطور" };
    const rows = toInvoiceLines([base, { ...base, width: 150, height: 300, qty: 1, area: 4.5, cost: 54000, description: "لافتة واجهة" }]);
    expect(rows).toEqual([
      { width: 100, height: 200, qty: 2, material: "فلكس", unitPrice: 12000, total: 48000, description: "ديباجات عطور" },
      { width: 150, height: 300, qty: 1, material: "فلكس", unitPrice: 12000, total: 54000, description: "لافتة واجهة" },
    ]);
    expect(invoiceTotal(rows)).toBe(102000);
  });
});
