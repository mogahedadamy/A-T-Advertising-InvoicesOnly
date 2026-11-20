import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  convertOklchToRgb,
  buildStandaloneInvoiceHtml,
  INVOICE_STANDALONE_CSS,
  arrayBufferToBase64,
  shareInvoiceViaWhatsApp,
} from "./pdfExport";

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
  it("includes deterministic A4/A5 sheet and grid footer utility classes in INVOICE_STANDALONE_CSS", () => {
    expect(INVOICE_STANDALONE_CSS).toContain(".proforma-sheet, .standard-invoice-sheet");
    expect(INVOICE_STANDALONE_CSS).toContain(".invoice-paper");
    expect(INVOICE_STANDALONE_CSS).toContain(".grid-cols-12");
    expect(INVOICE_STANDALONE_CSS).toContain(".col-span-5");
    expect(INVOICE_STANDALONE_CSS).toContain(".col-span-2");
    expect(INVOICE_STANDALONE_CSS).toContain(".rounded-\\[12px\\]");
    expect(INVOICE_STANDALONE_CSS).toContain("-webkit-text-size-adjust: 100%");
    expect(INVOICE_STANDALONE_CSS).toContain("--invoice-accent: #0D4A39");
    expect(INVOICE_STANDALONE_CSS).toContain("font-family: 'Tajawal'");
    expect(INVOICE_STANDALONE_CSS).toContain("/fonts/Tajawal-Regular.ttf");
    expect(INVOICE_STANDALONE_CSS).toContain("/fonts/Tajawal-Black.ttf");
    expect(INVOICE_STANDALONE_CSS).toContain("font-synthesis: none");
    expect(INVOICE_STANDALONE_CSS).toContain("text-rendering: auto");
    expect(INVOICE_STANDALONE_CSS).not.toContain("text-rendering: geometricPrecision");
    // Account Statement safe centered paper margins must NEVER be reset to padding: 0
    expect(INVOICE_STANDALONE_CSS).toContain("#customer-statement-print-mount");
    expect(INVOICE_STANDALONE_CSS).toContain("padding: 16mm 18mm 14mm 18mm !important;");
  });

  it("enforces explicit QR box dimensions in standalone CSS to prevent collapsing or clipping", () => {
    expect(INVOICE_STANDALONE_CSS).toContain(".w-\\[66px\\]");
    expect(INVOICE_STANDALONE_CSS).toContain("width: 66px !important");
    expect(INVOICE_STANDALONE_CSS).toContain(".h-\\[66px\\]");
    expect(INVOICE_STANDALONE_CSS).toContain("height: 66px !important");
  });

  it("builds completely isolated standalone HTML without any oklch color references", () => {
    const dummyEl = {
      outerHTML: `<div class="standard-invoice-sheet">
        <div class="grid grid-cols-12 gap-3.5 items-end pt-1 shrink-0">
          <div class="col-span-5">+249 11593 1769</div>
        </div>
      </div>`,
      classList: {
        contains: (cls: string) => cls === "standard-invoice-sheet",
      },
      querySelector: () => null,
    } as unknown as HTMLElement;

    const html = buildStandaloneInvoiceHtml(dummyEl, "فاتورة تجريبية", "a4");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("width=794");
    expect(html).not.toContain("oklch(");
    expect(html).toContain(".standard-invoice-sheet");
    expect(html).toContain(".grid-cols-12");
    expect(html).toContain("+249 11593 1769");
    expect(html).toContain("/fonts/Tajawal-Regular.ttf");
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
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

  it("escapes XSS payloads in title and sanitizes dir attribute in standalone HTML (SEC-03)", () => {
    const dummyEl = {
      outerHTML: `<div class="standard-invoice-sheet"><p>فاتورة</p></div>`,
      getAttribute: (name: string) => (name === "dir" ? 'rtl" onmouseover="alert(1)' : null),
      classList: {
        contains: (cls: string) => cls === "standard-invoice-sheet",
      },
      querySelector: () => null,
    } as unknown as HTMLElement;

    const maliciousTitle = '</title><img src=x onerror=alert(1)>';
    const html = buildStandaloneInvoiceHtml(dummyEl, maliciousTitle, "a4");
    expect(html).toContain('dir="rtl"');
    expect(html).not.toContain('onmouseover="alert(1)"');
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;/title&gt;&lt;img src=x onerror=alert(1)&gt;");
  });

  it("converts ArrayBuffer to valid base64 string accurately", () => {
    const text = "T.A Advertising Solution - Official Invoice";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(text).buffer;
    const base64 = arrayBufferToBase64(buffer);
    const decoded = atob(base64);
    expect(decoded).toBe(text);
  });
});

describe("Direct WhatsApp Sharing & System Export (Problem G)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.getElementById("share-invoice-hud-overlay")?.remove();
  });

  afterEach(() => {
    delete window.AndroidPrint;
    document.getElementById("share-invoice-hud-overlay")?.remove();
  });

  it("invokes shareInvoiceViaWhatsApp, escapes XSS in HUD, sets noopener noreferrer, and avoids inline onclick", async () => {
    const dummyEl = document.createElement("div");
    dummyEl.className = "standard-invoice-sheet";
    dummyEl.innerHTML = "<p>محتوى الفاتورة</p>";

    const xssParty = 'شركة الرواد <img src=x onerror=alert(1)>';
    const xssRef = '26-0012"><script>alert(1)</script>';

    const result = await shareInvoiceViaWhatsApp(dummyEl, {
      filename: "فاتورة-26-0012",
      format: "a4",
      partyName: xssParty,
      invoiceRef: xssRef,
      totalAmount: 250000,
      currency: "SDG",
      invoiceTypeLabel: "فاتورة مبيعات",
      isRtl: true,
    });

    // In jsdom without document.fonts, PDF export fails cleanly and renders the error HUD with WhatsApp Web fallback
    expect(result).toBe(false);

    const hud = document.getElementById("share-invoice-hud-overlay");
    expect(hud).not.toBeNull();

    // No raw XSS elements injected into HUD DOM
    expect(hud!.querySelectorAll("img").length).toBe(0);
    expect(hud!.querySelectorAll("script").length).toBe(0);
    expect(hud!.textContent).toContain("شركة الرواد");

    // Fallback link carries structured Arabic summary text and rel="noopener noreferrer"
    const fallbackLink = hud!.querySelector<HTMLAnchorElement>("a[target='_blank']");
    expect(fallbackLink).not.toBeNull();
    expect(fallbackLink!.getAttribute("rel")).toBe("noopener noreferrer");
    const decodedHref = decodeURIComponent(fallbackLink!.getAttribute("href") || "");
    expect(decodedHref).toContain("https://wa.me/?text=");
    expect(decodedHref).toContain("250,000");
    expect(decodedHref).toContain("SDG");
    expect(decodedHref).toContain("T.A Advertising Solution");

    // Close button must NOT use inline onclick and must remove overlay when clicked
    const closeBtn = hud!.querySelector<HTMLButtonElement>("#hud-close-btn");
    expect(closeBtn).not.toBeNull();
    expect(closeBtn!.getAttribute("onclick")).toBeNull();
    closeBtn!.click();
    expect(document.getElementById("share-invoice-hud-overlay")).toBeNull();
  });
});
