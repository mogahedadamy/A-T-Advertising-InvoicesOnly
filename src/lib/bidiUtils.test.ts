import { describe, it, expect } from "vitest";
import { formatBiDiDimensions, LRI, PDI } from "./bidiUtils";

describe("BiDi Description & Dimension Formatting", () => {
  it("isolates dimensions like '300 x 100' inside Arabic text", () => {
    const input = "طباعة لافتات 300 x 100";
    const result = formatBiDiDimensions(input);
    expect(result).toBe(`طباعة لافتات ${LRI}300 × 100${PDI}`);
  });

  it("handles uppercase '300 X 100'", () => {
    const input = "لوحة فليكس 120 X 80 سم";
    const result = formatBiDiDimensions(input);
    expect(result).toContain(`${LRI}`);
    expect(result).toContain("120 × 80");
    expect(result).toContain(`${PDI}`);
  });

  it("handles asterisk '*' as dimension separator", () => {
    const input = "بنر قماشي 500*200";
    const result = formatBiDiDimensions(input);
    expect(result).toBe(`بنر قماشي ${LRI}500 × 200${PDI}`);
  });

  it("handles decimal dimensions like '2.5 x 1.2'", () => {
    const input = "واجهة كلادينج 2.5 x 1.2 متر";
    const result = formatBiDiDimensions(input);
    expect(result).toContain(`${LRI}2.5 × 1.2`);
  });

  it("leaves standard text without dimensions unchanged", () => {
    const plain = "تصميم هوية بصرية كاملة";
    expect(formatBiDiDimensions(plain)).toBe("تصميم هوية بصرية كاملة");
  });

  it("handles empty or null inputs gracefully", () => {
    expect(formatBiDiDimensions("")).toBe("");
    expect(formatBiDiDimensions(null)).toBe("");
    expect(formatBiDiDimensions(undefined)).toBe("");
  });
});
