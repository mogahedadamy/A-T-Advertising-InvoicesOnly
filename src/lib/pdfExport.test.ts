import { describe, it, expect } from "vitest";
import { convertOklchToRgb, buildStandaloneInvoiceHtml, INVOICE_STANDALONE_CSS } from "./pdfExport";

describe("PDF Export & OKLCH Color Forensics (Problem B)", () => {
  it("converts standard OKLCH to sRGB format", () => {
    const input = "color: oklch(0.6 0.2 25);";
    const result = convertOklchToRgb(input);
    expect(result).not.toContain("oklch");
    expect(result).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
  });

  it("handles angle units in OKLCH (deg, rad, grad, turn)", () => {
    const withDeg = "border-color: oklch(0.637 0.237 25.331deg);";
    const withRad = "background-color: oklch(0.5 0.1 0.5rad);";
    const withTurn = "color: oklch(0.7 0.15 0.25turn);";

    expect(convertOklchToRgb(withDeg)).toMatch(/border-color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
    expect(convertOklchToRgb(withRad)).toMatch(/background-color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
    expect(convertOklchToRgb(withTurn)).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
  });

  it("handles percentages and alpha channels correctly", () => {
    const withAlpha = "background: oklch(60% 0.15 45 / 50%);";
    const result = convertOklchToRgb(withAlpha);
    expect(result).not.toContain("oklch");
    expect(result).toMatch(/background:\s*rgba\(\d+,\s*\d+,\s*\d+,\s*0?\.5\);/);
  });

  it("handles 'none' in chroma or hue", () => {
    const withNoneHue = "color: oklch(0.8 0 none);";
    const withNoneChroma = "color: oklch(0.5 none 180);";
    expect(convertOklchToRgb(withNoneHue)).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
    expect(convertOklchToRgb(withNoneChroma)).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
  });

  it("handles negative hue angles gracefully", () => {
    const input = "color: oklch(0.7 0.12 -45deg);";
    const result = convertOklchToRgb(input);
    expect(result).not.toContain("oklch");
    expect(result).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
  });

  it("leaves standard colors untouched", () => {
    const hex = "background: #f8fafc;";
    const rgb = "color: rgb(15, 23, 42);";
    const rgba = "border: 1px solid rgba(0, 0, 0, 0.1);";
    expect(convertOklchToRgb(hex)).toBe(hex);
    expect(convertOklchToRgb(rgb)).toBe(rgb);
    expect(convertOklchToRgb(rgba)).toBe(rgba);
  });

  it("safely falls back for irregular oklch expressions to prevent html2canvas crashes", () => {
    const irregular = "color: oklch(unsupported complex expression);";
    const result = convertOklchToRgb(irregular);
    expect(result).not.toContain("oklch");
    expect(result).toMatch(/color:\s*rgb\(\d+,\s*\d+,\s*\d+\);/);
  });
});

describe("Invoice Footer & Standalone Print HTML Engineering (Problem C)", () => {
  it("includes all deterministic proforma footer classes in INVOICE_STANDALONE_CSS", () => {
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-wrap");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-bottom-line");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-shape");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-bar");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-contacts");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-row");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-icon");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-text");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-phone");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-footer-stamp");
  });

  it("enforces explicit icon dimensions in standalone CSS to prevent collapsing or clipping", () => {
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-icon");
    expect(INVOICE_STANDALONE_CSS).toContain("15px !important");
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-contact-icon svg");
    expect(INVOICE_STANDALONE_CSS).toContain("9px !important");
  });

  it("builds completely isolated standalone HTML without any oklch color references", () => {
    const dummyEl = {
      outerHTML: `<div class="proforma-sheet">
        <div class="proforma-footer-contacts">
          <div class="proforma-contact-row">
            <span class="proforma-contact-phone">+249 11593 1769</span>
          </div>
        </div>
      </div>`,
      classList: {
        contains: (cls: string) => cls === "proforma-sheet",
      },
      querySelector: () => null,
    } as unknown as HTMLElement;

    const html = buildStandaloneInvoiceHtml(dummyEl, "فاتورة تجريبية", "a4");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("width=794");
    expect(html).not.toContain("oklch(");
    expect(html).toContain(".proforma-footer-wrap");
    expect(html).toContain("+249 11593 1769");
  });

  it("sets A5 landscape viewport correctly for A5 work orders", () => {
    const dummyEl = {
      outerHTML: `<div class="invoice-paper"><p>أمر تشغيل</p></div>`,
      classList: {
        contains: (cls: string) => cls === "invoice-paper",
      },
      querySelector: () => null,
    } as unknown as HTMLElement;

    const html = buildStandaloneInvoiceHtml(dummyEl, "طلب تشغيل 101", "a5");
    expect(html).toContain("width=760");
    expect(html).toContain("size: 210mm 148mm");
  });
});
