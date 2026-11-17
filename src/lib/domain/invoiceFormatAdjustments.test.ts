import { describe, expect, it } from "vitest";
import {
  formatInvoiceReference,
  formatReference,
  parseReference,
  isValidReference,
  isInvoiceReference,
  dateKeyFromParts,
} from "./references";
import {
  DEFAULT_COMPANY_EMAIL,
  getCompanyEmail,
  updateCompanyProfile,
} from "@/lib/settings/companyProfileStore";

describe("A. Invoice Reference Number Format (YY-NNNN)", () => {
  it("formats reference with 2-digit year and 4-digit sequence starting from 0001", () => {
    expect(formatInvoiceReference(2026, 1)).toBe("26-0001");
    expect(formatInvoiceReference(2026, 2)).toBe("26-0002");
    expect(formatInvoiceReference(2026, 3)).toBe("26-0003");
  });

  it("resets counter to 0001 when a new calendar year begins", () => {
    // 2026 sequence
    expect(formatInvoiceReference(2026, 1)).toBe("26-0001");
    // 2027 sequence resets to 0001
    expect(formatInvoiceReference(2027, 1)).toBe("27-0001");
    expect(formatInvoiceReference(2027, 2)).toBe("27-0002");
  });

  it("formatReference produces YY-NNNN when given year keys", () => {
    expect(formatReference("sales", "2026", 1)).toBe("26-0001");
    expect(formatReference("sales", "26", 45)).toBe("26-0045");
    expect(formatReference("purchase", "2027", 1)).toBe("27-0001");
  });

  it("parses YY-NNNN references accurately", () => {
    const parsed = parseReference("26-0001");
    expect(parsed).not.toBeNull();
    expect(parsed?.sequence).toBe(1);
    expect(parsed?.date.year).toBe(2026);

    const parsed27 = parseReference("27-0042");
    expect(parsed27).not.toBeNull();
    expect(parsed27?.sequence).toBe(42);
    expect(parsed27?.date.year).toBe(2027);
  });

  it("validates and recognizes YY-NNNN as valid invoice references", () => {
    expect(isValidReference("26-0001")).toBe(true);
    expect(isValidReference("27-0001")).toBe(true);
    expect(isInvoiceReference("26-0001")).toBe(true);
    expect(isInvoiceReference("27-0001")).toBe(true);
  });

  it("preserves all existing historical invoice reference numbers", () => {
    expect(isValidReference("INV-11112026-001")).toBe(true);
    expect(isValidReference("PINV-01122026-042")).toBe(true);
    expect(isInvoiceReference("INV-11112026-001")).toBe(true);
    expect(isInvoiceReference("PINV-01122026-042")).toBe(true);

    const historical = parseReference("INV-11112026-005");
    expect(historical).not.toBeNull();
    expect(historical?.sequence).toBe(5);
    expect(historical?.date).toEqual({ year: 2026, month: 11, day: 11 });
  });

  it("rejects invalid or malformed references", () => {
    expect(parseReference("001")).toBeNull();
    expect(parseReference("random-string")).toBeNull();
    expect(parseReference("")).toBeNull();
    expect(parseReference(null)).toBeNull();
  });
});

describe("B. Client Email Information (t.a.advertising@gmail.com)", () => {
  it("defaults to confirmed client email t.a.advertising@gmail.com", () => {
    expect(DEFAULT_COMPANY_EMAIL).toBe("t.a.advertising@gmail.com");
    expect(getCompanyEmail()).toBe("t.a.advertising@gmail.com");
  });

  it("supports configurable company profile updates", async () => {
    await updateCompanyProfile({ email: "billing@ta-solution.com" });
    expect(getCompanyEmail()).toBe("billing@ta-solution.com");

    // Reset back to confirmed default
    await updateCompanyProfile({ email: "t.a.advertising@gmail.com" });
    expect(getCompanyEmail()).toBe("t.a.advertising@gmail.com");
  });
});

