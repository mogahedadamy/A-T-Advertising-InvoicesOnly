import { describe, expect, it } from "vitest";
import {
  compareForBackfill,
  dateKeyFromParts,
  formatReference,
  isInvoiceReference,
  isValidReference,
  localDateParts,
  localPartsFromIsoDate,
  parseReference,
  planReferenceBackfill,
  scopeForInvoiceType,
  sequenceDateKey,
} from "@/lib/domain/references";

describe("Reference format (PRD §5.3.3)", () => {
  it("builds INV-DDMMYYYY-NNN with two-digit day/month and a three-digit sequence", () => {
    expect(formatReference("sales", "11112026", 1)).toBe("INV-11112026-001");
    expect(formatReference("sales", "11112026", 2)).toBe("INV-11112026-002");
    expect(formatReference("sales", "11112026", 123)).toBe("INV-11112026-123");
    // 1 December 2026 → 01122026
    expect(formatReference("sales", "01122026", 1)).toBe("INV-01122026-001");
  });

  it("keeps purchase invoices in their own namespace (PRD §5.3.8)", () => {
    expect(formatReference("purchase", "11112026", 1)).toBe("PINV-11112026-001");
    expect(formatReference("purchase", "11112026", 1)).not.toBe(formatReference("sales", "11112026", 1));
  });

  it("refuses to build a reference from an invalid sequence or date key", () => {
    expect(() => formatReference("sales", "11112026", 0)).toThrow();
    expect(() => formatReference("sales", "11112026", -3)).toThrow();
    expect(() => formatReference("sales", "2026-11-11", 1)).toThrow();
  });

  it("parses its own output and rejects anything else", () => {
    const parsed = parseReference("INV-11112026-007");
    expect(parsed?.scope).toBe("sales");
    expect(parsed?.sequence).toBe(7);
    expect(parsed?.date).toEqual({ year: 2026, month: 11, day: 11 });

    expect(parseReference("PINV-01122026-042")?.scope).toBe("purchase");
    expect(parseReference("INV-11112026-007")).not.toBeNull();

    expect(parseReference("001")).toBeNull();
    expect(parseReference("INVOICE-11112026-001")).toBeNull();
    expect(parseReference("INV-99999999-001")).toBeNull();
    expect(parseReference("")).toBeNull();
    expect(parseReference(null)).toBeNull();
  });

  it("validates references and distinguishes invoice references", () => {
    expect(isValidReference("INV-11112026-001")).toBe(true);
    expect(isValidReference("RCV-11112026-001")).toBe(true);
    expect(isValidReference("EXP-11112026-001")).toBe(true);
    expect(parseReference("EXP-11112026-004")?.scope).toBe("expense_payment");
    expect(formatReference("expense_payment", "11112026", 4)).toBe("EXP-11112026-004");
    expect(isValidReference("001")).toBe(false);
    expect(isInvoiceReference("INV-11112026-001")).toBe(true);
    expect(isInvoiceReference("PINV-11112026-001")).toBe(true);
    // a receipt or expense payment reference is not an invoice reference
    expect(isInvoiceReference("RCV-11112026-001")).toBe(false);
    expect(isInvoiceReference("EXP-11112026-001")).toBe(false);
  });
});

describe("Local business date handling (PRD §5.3.5)", () => {
  it("uses the local calendar day, never the UTC day", () => {
    // 2026-11-10T22:30Z is already 2026-11-11 in Khartoum (UTC+2, offset -120)
    const instant = Date.parse("2026-11-10T22:30:00.000Z");
    expect(localDateParts(instant, -120)).toEqual({ year: 2026, month: 11, day: 11 });
    expect(localDateParts(instant, 0)).toEqual({ year: 2026, month: 11, day: 10 });

    expect(sequenceDateKey("receipt", instant, -120)).toBe("11112026");
    expect(sequenceDateKey("receipt", instant, 0)).toBe("10112026");
    expect(sequenceDateKey("sales", instant, -120)).toBe("2026");
  });

  it("derives keys from stored business dates without timezone drift", () => {
    // A stored YYYY-MM-DD must map to the same day for every offset.
    const parts = localPartsFromIsoDate("2026-11-11");
    expect(parts).toEqual({ year: 2026, month: 11, day: 11 });
    expect(dateKeyFromParts("sales", parts!)).toBe("2026");
    expect(dateKeyFromParts("receipt", parts!)).toBe("11112026");
    for (const offset of [-660, -120, 0, 120, 600]) {
      expect(sequenceDateKey("receipt", Date.UTC(2026, 10, 11, 12), offset)).toBe("11112026");
      expect(sequenceDateKey("sales", Date.UTC(2026, 10, 11, 12), offset)).toBe("2026");
    }
    // Verify genuine timezone rollovers across midnight (UTC+12 and Sudan UTC+2 New Year boundary).
    expect(sequenceDateKey("receipt", Date.UTC(2026, 10, 11, 12), -720)).toBe("12112026");
    const sudanNewYear = Date.parse("2026-12-31T22:30:00.000Z"); // 2027-01-01 00:30 UTC+2
    expect(sequenceDateKey("sales", sudanNewYear, -120)).toBe("2027");
    expect(sequenceDateKey("receipt", sudanNewYear, -120)).toBe("01012027");
    expect(sequenceDateKey("sales", sudanNewYear, 0)).toBe("2026");
    expect(localPartsFromIsoDate("bad-date")).toBeNull();
    expect(localPartsFromIsoDate("2026-13-01")).toBeNull();
  });
});

describe("Scope mapping", () => {
  it("maps invoice types to their namespace", () => {
    expect(scopeForInvoiceType("sales")).toBe("sales");
    expect(scopeForInvoiceType("purchase")).toBe("purchase");
    // proforma keeps its legacy serial: no mandated format exists for it
    expect(scopeForInvoiceType("proforma")).toBeNull();
    expect(scopeForInvoiceType(undefined)).toBeNull();
  });
});

describe("Deterministic retroactive backfill (PRD §5.3.3)", () => {
  const rows = [
    { id: "c", date: "2026-11-11", createdAt: "2026-11-11T18:00:00.000Z" },
    { id: "a", date: "2026-11-11", createdAt: "2026-11-11T08:00:00.000Z" },
    { id: "b", date: "2026-11-11", createdAt: "2026-11-11T12:00:00.000Z" },
    { id: "d", date: "2026-11-12", createdAt: "2026-11-12T09:00:00.000Z" },
  ];

  it("orders by business date, then creation instant, then id", () => {
    const ordered = [...rows].sort(compareForBackfill).map((r) => r.id);
    expect(ordered).toEqual(["a", "b", "c", "d"]);
  });

  it("assigns sequential numbers per year (YY-NNNN)", () => {
    const plan = planReferenceBackfill("sales", rows, 0);
    const byId = Object.fromEntries(plan.assignments.map((a) => [a.id, a.reference]));
    expect(byId.a).toBe("26-0001");
    expect(byId.b).toBe("26-0002");
    expect(byId.c).toBe("26-0003");
    expect(byId.d).toBe("26-0004");
    expect(plan.maxSequenceByDateKey["2026"]).toBe(4);
  });

  it("is independent of the input order", () => {
    const shuffled = [rows[3], rows[0], rows[2], rows[1]];
    const plan = planReferenceBackfill("sales", shuffled, 0);
    const byId = Object.fromEntries(plan.assignments.map((a) => [a.id, a.reference]));
    expect(byId.a).toBe("26-0001");
    expect(byId.c).toBe("26-0003");
  });

  it("falls back to created_at when a row has no business date", () => {
    const plan = planReferenceBackfill("purchase", [{ id: "x", date: null, createdAt: "2026-12-01T05:00:00.000Z" }], 0);
    expect(plan.assignments[0].reference).toBe("26-0001");
  });
});
