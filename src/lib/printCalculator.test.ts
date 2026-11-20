import { describe, it, expect } from "vitest";
import {
  calculate,
  MATERIALS,
  ROLLS_STICKER,
  ROLLS_NORMAL,
} from "./printCalculator";

describe("printCalculator algorithms and materials", () => {
  it("should have correct default prices for materials", () => {
    const flex = MATERIALS.find((m) => m.key === "flex");
    const mesh = MATERIALS.find((m) => m.key === "mesh");
    const coated = MATERIALS.find((m) => m.key === "coated");
    const sticker = MATERIALS.find((m) => m.key === "sticker");
    const indoor = MATERIALS.find((m) => m.key === "indoor_sticker");

    expect(flex?.defaultPrice).toBe(28000);
    expect(mesh?.defaultPrice).toBe(28000);
    expect(coated?.defaultPrice).toBe(28000);
    expect(sticker?.defaultPrice).toBe(28000);
    expect(indoor?.defaultPrice).toBe(28000);

    expect(coated?.label).toBe("كوتيد");
    expect(sticker?.label).toBe("استيكر");
    expect(indoor?.label).toBe("استيكر ان دور");
  });

  it("calculates outdoor sticker using commercial rolls (100, 120, 127, 137, 150)", () => {
    const res = calculate({
      width: 80,
      height: 120,
      qty: 1,
      unitPrice: 28000,
      material: "sticker",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.displayRoll).toBe("120 سم");
      expect(res.result.area).toBeCloseTo(0.96, 2);
      expect(res.result.cost).toBeCloseTo(0.96 * 28000, 1);
    }
  });

  it("calculates 125x200 cm sticker on 127 cm roll", () => {
    const res = calculate({
      width: 125,
      height: 200,
      qty: 1,
      unitPrice: 28000,
      material: "sticker",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.displayRoll).toBe("127 سم");
      expect(res.result.area).toBeCloseTo((127 / 100) * 2, 2);
    }
  });

  it("calculates 135x200 cm sticker on 137 cm roll", () => {
    const res = calculate({
      width: 135,
      height: 200,
      qty: 1,
      unitPrice: 28000,
      material: "sticker",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.displayRoll).toBe("137 سم");
      expect(res.result.area).toBeCloseTo((137 / 100) * 2, 2);
    }
  });

  it("calculates 145x250 cm sticker on 150 cm roll", () => {
    const res = calculate({
      width: 145,
      height: 250,
      qty: 1,
      unitPrice: 28000,
      material: "sticker",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.displayRoll).toBe("150 سم");
      expect(res.result.area).toBeCloseTo(1.5 * 2.5, 2);
    }
  });

  it("fails outdoor sticker if both dimensions exceed 150 cm", () => {
    const res = calculate({
      width: 160,
      height: 180,
      qty: 1,
      unitPrice: 28000,
      material: "sticker",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("150 سم");
    }
  });

  it("calculates indoor sticker by exact net area without roll waste", () => {
    const res = calculate({
      width: 140,
      height: 200,
      qty: 2,
      unitPrice: 28000,
      material: "indoor_sticker",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.displayRoll).toBe("صافي طباعة");
      expect(res.result.area).toBeCloseTo(1.4 * 2.0 * 2, 2);
      expect(res.result.cost).toBeCloseTo(1.4 * 2.0 * 2 * 28000, 1);
    }
  });

  it("calculates coated material directly as net area because it can be welded (e.g. 1200x400 cm = 48 m²)", () => {
    const res = calculate({
      width: 1200,
      height: 400,
      qty: 1,
      unitPrice: 28000,
      material: "coated",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.area).toBe(48);
      expect(res.result.cost).toBe(48 * 28000);
      expect(res.result.displayRoll).toBe("لحام مباشر");
      expect(res.result.type).toBe("كوتيد (لحام)");
    }
  });

  it("calculates standard coated sizes directly as net area without roll limitation", () => {
    const res = calculate({
      width: 180,
      height: 300,
      qty: 1,
      unitPrice: 28000,
      material: "coated",
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.result.area).toBeCloseTo(1.8 * 3.0, 2);
      expect(res.result.cost).toBeCloseTo(1.8 * 3.0 * 28000, 1);
      expect(res.result.displayRoll).toBe("أمتار صافية");
      expect(res.result.type).toBe("كوتيد");
    }
  });

  it("fails other materials like flex if size exceeds all rolls (e.g. 1200x400 cm)", () => {
    const res = calculate({
      width: 1200,
      height: 400,
      qty: 1,
      unitPrice: 28000,
      material: "flex",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("المقاس يتجاوز عرض أكبر رولة متاحة");
    }
  });

  it("rejects negative or non-finite inputs and rounds monetary cost to 2 decimals", () => {
    expect(calculate({ width: -10, height: 100, qty: 1, unitPrice: 100, material: "flex" }).ok).toBe(false);
    expect(calculate({ width: Infinity, height: 100, qty: 1, unitPrice: 100, material: "flex" }).ok).toBe(false);
    expect(calculate({ width: 100, height: 100, qty: NaN, unitPrice: 100, material: "flex" }).ok).toBe(false);
    expect(calculate({ width: 100, height: 100, qty: 1, unitPrice: -5, material: "flex" }).ok).toBe(false);
    expect(calculate({ width: 100, height: 100, qty: 1, unitPrice: Infinity, material: "flex" }).ok).toBe(false);

    // Floating-point multiplication 0.33 * 0.33 * 100.33 = 10.925937 -> rounded to 10.93
    const rounded = calculate({
      width: 33,
      height: 33,
      qty: 1,
      unitPrice: 100.33,
      material: "indoor_sticker",
    });
    expect(rounded.ok).toBe(true);
    if (rounded.ok) {
      expect(rounded.result.cost).toBe(10.93);
    }
  });
});
