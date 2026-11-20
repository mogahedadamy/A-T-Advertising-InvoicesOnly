import { describe, it, expect } from "vitest";
import {
  tafqeetArabic,
  tafqeetEnglish,
  getInvoiceAmountInWords,
} from "./amountToWords";
import { formatCurrencyAmount, getCurrencyDisplayName } from "./currencyFormat";
import { AppCurrency, SUPPORTED_CURRENCIES } from "./types";
import { calculateCustomInvoiceTotals } from "@/lib/billing/store";
import { calculateProformaTotals } from "@/lib/proforma/store";
import { normalizeLegacyBackup } from "@/lib/backup/legacyImport";

describe("Multi-Currency System — Unit & Integration Test Suite", () => {
  describe("1. Currency Configurations & Display Names", () => {
    it("supports exactly the 4 required currencies", () => {
      const currencies: AppCurrency[] = ["SDG", "USD", "SAR", "EGP"];
      currencies.forEach((code) => {
        expect(SUPPORTED_CURRENCIES[code]).toBeDefined();
        expect(SUPPORTED_CURRENCIES[code].code).toBe(code);
      });
    });

    it("returns correct localized display names in Arabic and English", () => {
      expect(getCurrencyDisplayName("SDG", "ar")).toBe("الجنيه السوداني");
      expect(getCurrencyDisplayName("SDG", "en")).toBe("Sudanese Pound");
      expect(getCurrencyDisplayName("USD", "ar")).toBe("الدولار الأمريكي");
      expect(getCurrencyDisplayName("USD", "en")).toBe("US Dollar");
      expect(getCurrencyDisplayName("SAR", "ar")).toBe("الريال السعودي");
      expect(getCurrencyDisplayName("SAR", "en")).toBe("Saudi Riyal");
      expect(getCurrencyDisplayName("EGP", "ar")).toBe("الجنيه المصري");
      expect(getCurrencyDisplayName("EGP", "en")).toBe("Egyptian Pound");
    });
  });

  describe("2. Numeric Grand Total with Mandatory Currency Identification", () => {
    it("formats amounts with ISO currency codes matching illustrative specifications", () => {
      expect(formatCurrencyAmount(65000, "SDG")).toBe("65,000.00 SDG");
      expect(formatCurrencyAmount(150, "USD")).toBe("150.00 USD");
      expect(formatCurrencyAmount(2500, "SAR")).toBe("2,500.00 SAR");
      expect(formatCurrencyAmount(8000, "EGP")).toBe("8,000.00 EGP");
    });

    it("handles decimals and zeros cleanly", () => {
      expect(formatCurrencyAmount(0, "USD")).toBe("0.00 USD");
      expect(formatCurrencyAmount(1234.5, "SAR")).toBe("1,234.50 SAR");
    });
  });

  describe("3. Arabic Amount in Words (Tafqeet Engine)", () => {
    it("reproduces exact illustrative examples from the specification", () => {
      expect(tafqeetArabic(65000, "SDG")).toBe("خمسة وستون ألف جنيه سوداني لا غير");
      expect(tafqeetArabic(150, "USD")).toBe("مائة وخمسون دولاراً أمريكياً لا غير");
      expect(tafqeetArabic(2500, "SAR")).toBe("ألفان وخمسمائة ريال سعودي لا غير");
      expect(tafqeetArabic(8000, "EGP")).toBe("ثمانية آلاف جنيه مصري لا غير");
    });

    it("correctly handles Arabic singular, dual, and plural grammar for each currency", () => {
      // 1 (Singular)
      expect(tafqeetArabic(1, "SDG")).toBe("جنيه سوداني لا غير");
      expect(tafqeetArabic(1, "USD")).toBe("دولار أمريكي لا غير");
      expect(tafqeetArabic(1, "SAR")).toBe("ريال سعودي لا غير");
      expect(tafqeetArabic(1, "EGP")).toBe("جنيه مصري لا غير");

      // 2 (Dual)
      expect(tafqeetArabic(2, "SDG")).toBe("جنيهان سودانيان لا غير");
      expect(tafqeetArabic(2, "USD")).toBe("دولاران أمريكيان لا غير");
      expect(tafqeetArabic(2, "SAR")).toBe("ريالان سعوديان لا غير");
      expect(tafqeetArabic(2, "EGP")).toBe("جنيهان مصريان لا غير");

      // 3-10 (Plural)
      expect(tafqeetArabic(5, "SDG")).toBe("خمسة جنيهات سودانية لا غير");
      expect(tafqeetArabic(7, "USD")).toBe("سبعة دولارات أمريكية لا غير");
      expect(tafqeetArabic(10, "SAR")).toBe("عشرة ريالات سعودية لا غير");
      expect(tafqeetArabic(4, "EGP")).toBe("أربعة جنيهات مصرية لا غير");

      // 11-99 (Accusative)
      expect(tafqeetArabic(15, "SDG")).toBe("خمسة عشر جنيهاً سودانياً لا غير");
      expect(tafqeetArabic(50, "USD")).toBe("خمسون دولاراً أمريكياً لا غير");
      expect(tafqeetArabic(99, "SAR")).toBe("تسعة وتسعون ريالاً سعودياً لا غير");
      expect(tafqeetArabic(25, "EGP")).toBe("خمسة وعشرون جنيهاً مصرياً لا غير");
    });

    it("correctly converts fractional amounts (subunits) in Arabic", () => {
      expect(tafqeetArabic(65000.5, "SDG")).toBe("خمسة وستون ألف جنيه سوداني وخمسون قرشاً لا غير");
      expect(tafqeetArabic(150.75, "USD")).toBe("مائة وخمسون دولاراً أمريكياً وخمسة وسبعون سنتاً لا غير");
      expect(tafqeetArabic(2500.25, "SAR")).toBe("ألفان وخمسمائة ريال سعودي وخمس وعشرون هللةً لا غير");
      expect(tafqeetArabic(8000.1, "EGP")).toBe("ثمانية آلاف جنيه مصري وعشرة قروش لا غير");
    });
  });

  describe("4. English Amount in Words", () => {
    it("reproduces exact illustrative examples from the specification", () => {
      expect(tafqeetEnglish(65000, "SDG")).toBe("Sixty-Five Thousand Sudanese Pounds Only.");
      expect(tafqeetEnglish(150, "USD")).toBe("One Hundred and Fifty US Dollars Only.");
      expect(tafqeetEnglish(2500, "SAR")).toBe("Two Thousand Five Hundred Saudi Riyals Only.");
      expect(tafqeetEnglish(8000, "EGP")).toBe("Eight Thousand Egyptian Pounds Only.");
    });

    it("handles rounding edge cases (99.996), unknown currencies, trillions, and non-finite inputs", () => {
      // Regression (FIN-07): 99.996 must roll over to 100 units, never "100 piastres/cents".
      expect(tafqeetArabic(99.996, "SDG")).toBe("مائة جنيه سوداني لا غير");
      expect(tafqeetEnglish(99.996, "USD")).toBe("One Hundred US Dollars Only.");

      // Unknown currency falls back safely to SDG without throwing TypeError.
      expect(tafqeetArabic(100, "XYZ" as unknown as AppCurrency)).toBe("مائة جنيه سوداني لا غير");
      expect(tafqeetEnglish(100, "XYZ" as unknown as AppCurrency)).toBe("One Hundred Sudanese Pounds Only.");
      expect(formatCurrencyAmount(100, "XYZ" as unknown as AppCurrency)).toBe("100.00 SDG");

      // Non-finite and negative values never produce "∞.00" or "undefined".
      expect(formatCurrencyAmount(Infinity, "USD")).toBe("0.00 USD");
      expect(formatCurrencyAmount(-Infinity, "SDG")).toBe("0.00 SDG");
      expect(formatCurrencyAmount(NaN, "SAR")).toBe("0.00 SAR");
      expect(tafqeetArabic(Infinity, "SDG")).toBe("صفر جنيه سوداني لا غير");
      expect(tafqeetEnglish(-50, "USD")).toBe("Zero US Dollars Only.");

      // Trillion-scale amounts never contain "undefined".
      const arTrillion = tafqeetArabic(1_500_000_000_000, "SDG");
      const enTrillion = tafqeetEnglish(1_500_000_000_000, "USD");
      expect(arTrillion).not.toContain("undefined");
      expect(arTrillion).toContain("تريليون");
      expect(enTrillion).not.toContain("undefined");
      expect(enTrillion).toContain("Trillion");
    });

    it("correctly handles English singular, plural, and fractional cents/piastres/halalas", () => {
      expect(tafqeetEnglish(1, "USD")).toBe("One US Dollar Only.");
      expect(tafqeetEnglish(2, "USD")).toBe("Two US Dollars Only.");
      expect(tafqeetEnglish(150.75, "USD")).toBe("One Hundred and Fifty US Dollars and Seventy-Five Cents Only.");
      expect(tafqeetEnglish(2500.25, "SAR")).toBe("Two Thousand Five Hundred Saudi Riyals and Twenty-Five Halalas Only.");
      expect(tafqeetEnglish(65000.5, "SDG")).toBe("Sixty-Five Thousand Sudanese Pounds and Fifty Piastres Only.");
    });
  });

  describe("5. Complete 8-Combination Matrix (Language × Currency Independence)", () => {
    const currencies: AppCurrency[] = ["SDG", "USD", "SAR", "EGP"];

    it("renders all 4 currencies correctly in Arabic (RTL)", () => {
      currencies.forEach((cur) => {
        const text = getInvoiceAmountInWords(1000, cur, true);
        expect(text).toContain("ألف");
        expect(text).toContain(SUPPORTED_CURRENCIES[cur].arabicGrammar.singular);
        expect(text).toContain("لا غير");
      });
    });

    it("renders all 4 currencies correctly in English (LTR)", () => {
      currencies.forEach((cur) => {
        const text = getInvoiceAmountInWords(1000, cur, false);
        expect(text).toContain("One Thousand");
        expect(text).toContain(SUPPORTED_CURRENCIES[cur].englishGrammar.plural);
        expect(text).toContain("Only.");
      });
    });
  });

  describe("6. Store & Calculation Pipelines Integration", () => {
    it("calculates custom invoice totals and words with the selected currency", () => {
      const items = [
        { id: "1", description: "Design", qty: 2, unitPrice: 75, total: 150 },
      ];
      const usdCalc = calculateCustomInvoiceTotals(items, "USD", true);
      expect(usdCalc.totalAmount).toBe(150);
      expect(usdCalc.totalInWords).toBe("مائة وخمسون دولاراً أمريكياً لا غير");

      const sarCalcEn = calculateCustomInvoiceTotals(items, "SAR", false);
      expect(sarCalcEn.totalAmount).toBe(150);
      expect(sarCalcEn.totalInWords).toBe("One Hundred and Fifty Saudi Riyals Only.");
    });

    it("calculates proforma invoice totals and words with the selected currency", () => {
      const lines = [
        {
          id: "1",
          description: "Flex Banner",
          material: "flex",
          width: 200,
          height: 100,
          qty: 1,
          unitPrice: 8000,
          area: 2,
          total: 8000,
        },
      ];
      const egpCalc = calculateProformaTotals(lines, "EGP", true);
      expect(egpCalc.totalAmount).toBe(8000);
      expect(egpCalc.totalInWords).toBe("ثمانية آلاف جنيه مصري لا غير");
    });
  });

  describe("7. Backup and Restore Compatibility", () => {
    it("normalizes legacy backup and preserves/defaults currency to SDG safely", () => {
      const legacyDoc = {
        appId: "com.taadvertising.invoicing",
        version: "1.0",
        data: {
          customInvoices: [
            {
              id: "inv-legacy-1",
              totalAmount: 5000,
              meta: { serial: "001", type: "sales" },
            },
            {
              id: "inv-legacy-usd",
              totalAmount: 150,
              currency: "USD",
              meta: { serial: "002", type: "sales", currency: "USD" },
            },
          ],
        },
      };

      const normalized = normalizeLegacyBackup(legacyDoc, new Date().toISOString());
      expect(normalized.customInvoices.length).toBe(2);
      expect(normalized.customInvoices[0].currency).toBe("SDG");
      expect(normalized.customInvoices[1].currency).toBe("USD");
    });
  });

  describe("8. Mandatory 32-Combination Matrix (4 Invoice Types × 2 Languages × 4 Currencies)", () => {
    const invoiceTypes = ["preliminary", "sales", "subsidiary", "purchase"] as const;
    const languages = [
      { code: "ar" as const, isRtl: true },
      { code: "en" as const, isRtl: false },
    ];
    const currencies: AppCurrency[] = ["SDG", "USD", "SAR", "EGP"];

    invoiceTypes.forEach((invType) => {
      languages.forEach(({ code: lang, isRtl }) => {
        currencies.forEach((cur) => {
          it(`validates [${invType}] × [${lang}] × [${cur}]`, () => {
            const amount = 25000;
            // 1. Amount in words
            const inWords = getInvoiceAmountInWords(amount, cur, isRtl);
            expect(inWords).toBeTruthy();
            if (isRtl) {
              expect(inWords).toContain(SUPPORTED_CURRENCIES[cur].arabicGrammar.singular);
              expect(inWords).toContain("لا غير");
            } else {
              expect(inWords).toContain(SUPPORTED_CURRENCIES[cur].englishGrammar.plural);
              expect(inWords).toContain("Only.");
            }

            // 2. Numeric representation with ISO code
            const numeric = formatCurrencyAmount(amount, cur);
            expect(numeric).toBe(`25,000.00 ${cur}`);

            // 3. Calculation integration
            const items = [{ id: "1", description: `${invType} item`, qty: 1, unitPrice: amount, total: amount }];
            const calc = calculateCustomInvoiceTotals(items, cur, isRtl);
            expect(calc.totalAmount).toBe(amount);
            expect(calc.totalInWords).toBe(inWords);
          });
        });
      });
    });
  });
});
