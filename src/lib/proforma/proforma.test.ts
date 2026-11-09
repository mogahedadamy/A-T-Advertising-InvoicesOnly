import { describe, it, expect } from "vitest";
import { numberToArabicWords, tafqeetSDG } from "./tafqeet";
import { calculateProformaTotals } from "./store";
import type { ProformaLine } from "./types";

describe("Tafqeet (Number to Arabic Words)", () => {
  it("converts 0 correctly", () => {
    expect(numberToArabicWords(0)).toBe("صفر");
    expect(tafqeetSDG(0)).toBe("صفر جنيه سوداني");
  });

  it("converts simple numbers", () => {
    expect(numberToArabicWords(5)).toBe("خمسة");
    expect(numberToArabicWords(12)).toBe("اثنا عشر");
    expect(numberToArabicWords(25)).toBe("خمسة وعشرون");
    expect(numberToArabicWords(100)).toBe("مائة");
    expect(numberToArabicWords(1500)).toBe("ألف وخمسمائة");
  });

  it("converts invoice totals in SDG correctly", () => {
    const text = tafqeetSDG(365500);
    expect(text).toContain("ثلاثمائة");
    expect(text).toContain("خمسمائة");
    expect(text).toContain("جنيه سوداني لا غير");
  });
});

describe("calculateProformaTotals", () => {
  it("calculates area, qty, total amount, and tafqeet for proforma lines", () => {
    const lines: ProformaLine[] = [
      {
        id: "1",
        description: "مكتبة البيان",
        material: "فلكس",
        width: 110,
        height: 145,
        qty: 1,
        unitPrice: 25000,
        area: 1.6,
        total: 41250,
      },
      {
        id: "2",
        description: "مكتبة البيان",
        material: "فلكس",
        width: 350,
        height: 120,
        qty: 1,
        unitPrice: 25000,
        area: 4.2,
        total: 131250,
      },
    ];

    const totals = calculateProformaTotals(lines);
    expect(totals.totalQty).toBe(2);
    expect(totals.totalArea).toBe(5.8);
    expect(totals.totalAmount).toBe(172500);
    expect(totals.totalInWords).toContain("جنيه سوداني لا غير");
  });
});
