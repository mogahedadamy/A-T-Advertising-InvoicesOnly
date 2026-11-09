import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";

export interface ExportPdfOptions {
  filename: string;
  format?: "a4" | "a5";
  orientation?: "portrait" | "landscape";
}

/**
 * دالة رياضية دقيقة لتحويل صيغ ألوان OKLCH الحديثة في CSS إلى sRGB القياسية
 * تدعم كافة المتغيرات (deg, rad, grad, turn, none, %, fractions) وتمنع خطأ
 * Attempting to parse an unsupported color function "oklch" في html2canvas تماماً
 */
export function convertOklchToRgb(input: string): string {
  if (!input || !input.includes("oklch")) return input;

  const oklchRegex =
    /oklch\(\s*([^\s,/)]+)\s+([^\s,/)]+)\s+([^\s,/)]+)(?:\s*(?:\/|,)\s*([^\s,/)]+))?\s*\)/gi;

  const converted = input.replace(
    oklchRegex,
    (_match, lStr: string, cStr: string, hStr: string, aStr?: string) => {
      try {
        let L = lStr.endsWith("%") ? parseFloat(lStr) / 100 : parseFloat(lStr);
        if (isNaN(L)) L = 0;
        L = Math.max(0, Math.min(1, L));

        let C = cStr.toLowerCase() === "none" ? 0 : parseFloat(cStr);
        if (isNaN(C)) C = 0;
        C = Math.max(0, C);

        let H_deg = 0;
        const hLower = hStr.toLowerCase();
        if (hLower === "none") {
          H_deg = 0;
        } else if (hLower.endsWith("deg")) {
          H_deg = parseFloat(hLower.slice(0, -3));
        } else if (hLower.endsWith("rad")) {
          H_deg = (parseFloat(hLower.slice(0, -3)) * 180) / Math.PI;
        } else if (hLower.endsWith("grad")) {
          H_deg = (parseFloat(hLower.slice(0, -4)) * 360) / 400;
        } else if (hLower.endsWith("turn")) {
          H_deg = parseFloat(hLower.slice(0, -4)) * 360;
        } else {
          H_deg = parseFloat(hStr);
        }
        if (isNaN(H_deg)) H_deg = 0;

        const a = C * Math.cos((H_deg * Math.PI) / 180);
        const b = C * Math.sin((H_deg * Math.PI) / 180);

        const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
        const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
        const s_ = L - 0.0894841775 * a - 1.291485548 * b;

        const l3 = l_ * l_ * l_;
        const m3 = m_ * m_ * m_;
        const s3 = s_ * s_ * s_;

        const r_l = +4.076743477 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
        const g_l = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
        const b_l = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

        const transfer = (c: number) => {
          const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
          return Math.min(255, Math.max(0, Math.round(v * 255)));
        };

        const r = transfer(r_l);
        const g = transfer(g_l);
        const bVal = transfer(b_l);

        if (aStr !== undefined) {
          let alpha = aStr.endsWith("%") ? parseFloat(aStr) / 100 : parseFloat(aStr);
          if (isNaN(alpha)) alpha = 1;
          alpha = Math.max(0, Math.min(1, alpha));
          return alpha < 1 ? `rgba(${r}, ${g}, ${bVal}, ${alpha})` : `rgb(${r}, ${g}, ${bVal})`;
        }
        return `rgb(${r}, ${g}, ${bVal})`;
      } catch {
        return "rgb(100, 116, 139)";
      }
    }
  );

  return converted.replace(/oklch\([^)]+\)/gi, "rgb(100, 116, 139)");
}

/**
 * أنماط الطباعة والتصدير الشاملة والمستقلة بالكامل:
 * - معطلة تماماً لميزة Font Boosting في أندرويد عبر text-size-adjust: 100%
 * - تضمن ألوان HEX/RGB متوافقة وبدون أخطاء oklch
 * - تغطي كافة فئات Tailwind والأبعاد لمستندات A4 و A5 بدقة مطلقة
 * - خالية تماماً من الـ Overrides التي تشوه الجداول أو التذييل
 */
export const INVOICE_STANDALONE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap');

:root {
  --invoice-paper: #ffffff;
  --invoice-ink: #000000;
  --invoice-accent: #0D4A39;
  --invoice-border: #1e293b;
  --font-arabic: 'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

*, *::before, *::after {
  box-sizing: border-box !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  -webkit-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
}

html, body {
  background: #ffffff !important;
  background-color: #ffffff !important;
  color: #000000 !important;
  margin: 0 !important;
  padding: 0 !important;
  font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  direction: rtl !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  -webkit-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
}

/* إلغاء أي هوامش سالبة أو إخفاء من شاشات العرض */
.invoice-print-root,
.proforma-print-root,
.custom-invoice-print-root,
#custom-invoice-print-portal,
.invoice-standalone-root {
  display: block !important;
  position: static !important;
  left: auto !important;
  top: auto !important;
  opacity: 1 !important;
  visibility: visible !important;
  margin: 0 auto !important;
  padding: 0 !important;
  transform: none !important;
  z-index: 1 !important;
}

/* 1. ورقة الفاتورة المعتمدة A4 (210mm x 297mm) — مرونة Flex كاملة لتوزيع المساحات */
.proforma-sheet, .standard-invoice-sheet {
  width: 210mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  height: 297mm !important;
  background-color: #ffffff !important;
  color: #000000 !important;
  position: relative !important;
  left: auto !important;
  top: auto !important;
  margin: 0 auto !important;
  padding: 10mm 12mm 10mm 12mm !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  opacity: 1 !important;
  visibility: visible !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

/* 2. ورقة فاتورة A5 العرضية (760px x 536px / 210mm x 148mm) */
.invoice-paper {
  width: 760px !important;
  min-height: 536px !important;
  height: 536px !important;
  max-height: 536px !important;
  background: #ffffff !important;
  color: #0f172a !important;
  font-family: 'Tajawal', 'Cairo', system-ui, -apple-system, sans-serif !important;
  padding: 12px 18px 10px !important;
  font-size: 11px !important;
  line-height: 1.4 !important;
  box-sizing: border-box !important;
  position: relative !important;
  border-top: 5px solid #0D4A39 !important;
  border-bottom: 3.5px solid #0D4A39 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  margin: 0 auto !important;
  opacity: 1 !important;
  visibility: visible !important;
  overflow: hidden !important;
}

.invoice-print-page {
  page-break-after: always !important;
  break-after: page !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  display: block !important;
  margin: 0 !important;
  padding: 0 !important;
}
.invoice-print-page:last-child {
  page-break-after: avoid !important;
  break-after: avoid !important;
}

@media print {
  @page {
    margin: 0 !important;
  }
  body {
    margin: 0 !important;
    padding: 0 !important;
  }
  .standard-invoice-sheet {
    width: 210mm !important;
    height: 297mm !important;
    max-height: 297mm !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .invoice-paper {
    width: 210mm !important;
    height: 148mm !important;
    max-height: 148mm !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}

/* ══════════ عناصر ورقة A5 العرضية ══════════ */
.inv-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 8px !important;
  padding-bottom: 6px !important;
  border-bottom: 1.5px solid #cbd5e1 !important;
}
.inv-header-right {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.inv-logo {
  height: 48px !important;
  width: auto !important;
  object-fit: contain !important;
  flex-shrink: 0 !important;
}
.inv-brand-text {
  display: flex !important;
  flex-direction: column !important;
  gap: 3px !important;
  justify-content: center !important;
}
.inv-brand-ar {
  font-size: 16px !important;
  font-weight: 900 !important;
  color: #0f172a !important;
  line-height: 1.3 !important;
}
.inv-brand-en {
  font-size: 9px !important;
  font-weight: 900 !important;
  letter-spacing: 1.8px !important;
  color: #0D4A39 !important;
  direction: ltr !important;
  line-height: 1.2 !important;
}
.inv-badge-box {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  gap: 2px !important;
}
.inv-badge {
  border: 1.5px solid #0D4A39 !important;
  background: #f0fdf4 !important;
  color: #0D4A39 !important;
  border-radius: 6px !important;
  padding: 3px 18px !important;
  font-weight: 900 !important;
  font-size: 13.5px !important;
}
.inv-branch-tag {
  font-size: 10px !important;
  font-weight: 700 !important;
  color: #475569 !important;
}
.inv-serial-card {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: center !important;
}
.inv-serial {
  border: 1.5px solid #0f172a !important;
  border-radius: 8px !important;
  padding: 3px 12px !important;
  background: #f8fafc !important;
  display: inline-flex !important;
  align-items: center !important;
  gap: 6px !important;
  font-size: 11.5px !important;
  font-weight: 800 !important;
}
.inv-serial-no {
  color: #0D4A39 !important;
  font-weight: 900 !important;
  font-size: 15px !important;
  direction: ltr !important;
  font-family: monospace !important;
}
.inv-meta-grid {
  margin: 5px 0 !important;
  display: grid !important;
  grid-template-columns: repeat(4, 1fr) !important;
  gap: 4px 10px !important;
  background: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  border-radius: 6px !important;
  padding: 5px 10px !important;
  font-size: 10.5px !important;
}
.inv-meta-cell {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  min-width: 0 !important;
}
.inv-meta-cell b {
  color: #475569 !important;
  flex-shrink: 0 !important;
  font-size: 10px !important;
}
.inv-meta-cell span {
  font-weight: 700 !important;
  color: #0f172a !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.inv-table-wrap {
  margin-bottom: 4px !important;
}
.inv-table {
  width: 100% !important;
  table-layout: fixed !important;
  border-collapse: collapse !important;
  border: 1.5px solid #0f172a !important;
  font-size: 10.5px !important;
}
.inv-table th {
  background: #C1D0CD !important;
  background-color: #C1D0CD !important;
  color: #000000 !important;
  font-weight: 900 !important;
  padding: 4px 3px !important;
  border: 1px solid #0f172a !important;
  font-size: 10.5px !important;
  height: 22px !important;
}
.inv-table td {
  border: 1px solid #cbd5e1 !important;
  padding: 2.5px 4px !important;
  text-align: center !important;
  height: 21px !important;
  max-height: 21px !important;
  color: #0f172a !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  white-space: nowrap !important;
}
.inv-table tbody tr:nth-child(even) td {
  background: #f8fafc !important;
}

/* ══════════ نظام CSS Grid ══════════ */
.grid { display: grid !important; }
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
.col-span-1 { grid-column: span 1 / span 1 !important; }
.col-span-2 { grid-column: span 2 / span 2 !important; }
.col-span-3 { grid-column: span 3 / span 3 !important; }
.col-span-4 { grid-column: span 4 / span 4 !important; }
.col-span-5 { grid-column: span 5 / span 5 !important; }
.col-span-6 { grid-column: span 6 / span 6 !important; }
.col-span-7 { grid-column: span 7 / span 7 !important; }
.col-span-8 { grid-column: span 8 / span 8 !important; }
.col-span-9 { grid-column: span 9 / span 9 !important; }
.col-span-10 { grid-column: span 10 / span 10 !important; }
.col-span-11 { grid-column: span 11 / span 11 !important; }
.col-span-12 { grid-column: span 12 / span 12 !important; }

/* ══════════ نظام Flexbox ══════════ */
.flex { display: flex !important; }
.flex-col { flex-direction: column !important; }
.flex-row { flex-direction: row !important; }
.flex-1 { flex: 1 1 0% !important; min-width: 0 !important; }
.shrink-0 { flex-shrink: 0 !important; }
.grow { flex-grow: 1 !important; }
.items-center { align-items: center !important; }
.items-baseline { align-items: baseline !important; }
.items-start { align-items: flex-start !important; }
.items-end { align-items: flex-end !important; }
.justify-between { justify-content: space-between !important; }
.justify-center { justify-content: center !important; }
.justify-start { justify-content: flex-start !important; }
.justify-end { justify-content: flex-end !important; }

/* ══════════ محاذاة ونصوص وأوزان الخطوط ══════════ */
.font-mono { font-family: monospace, Courier, monospace !important; }
.font-sans { font-family: 'Tajawal', 'Cairo', system-ui, sans-serif !important; }
.font-black { font-weight: 900 !important; }
.font-extrabold { font-weight: 800 !important; }
.font-bold { font-weight: 700 !important; }
.font-semibold { font-weight: 600 !important; }
.font-medium { font-weight: 500 !important; }
.font-normal { font-weight: 400 !important; }
.italic { font-style: italic !important; }
.not-italic { font-style: normal !important; }
.text-center { text-align: center !important; }
.text-right { text-align: right !important; }
.text-left { text-align: left !important; }
.leading-none { line-height: 1 !important; }
.leading-tight { line-height: 1.25 !important; }
.tracking-tight { letter-spacing: -0.025em !important; }
.tracking-wide { letter-spacing: 0.025em !important; }
.tracking-wider { letter-spacing: 0.05em !important; }
.truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
.whitespace-nowrap { white-space: nowrap !important; }
.tabular-nums { font-variant-numeric: tabular-nums !important; }
.lowercase { text-transform: lowercase !important; }

/* ══════════ أحجام الخطوط الدقيقة ══════════ */
.text-\\[9\\.5px\\] { font-size: 9.5px !important; }
.text-\\[10px\\] { font-size: 10px !important; }
.text-\\[11px\\] { font-size: 11px !important; }
.text-\\[11\\.5px\\] { font-size: 11.5px !important; }
.text-\\[12px\\] { font-size: 12px !important; }
.text-\\[12\\.5px\\] { font-size: 12.5px !important; }
.text-\\[13px\\] { font-size: 13px !important; }
.text-\\[13\\.5px\\] { font-size: 13.5px !important; }
.text-\\[14px\\] { font-size: 14px !important; }
.text-\\[14\\.5px\\] { font-size: 14.5px !important; }
.text-\\[15px\\] { font-size: 15px !important; }
.text-\\[15\\.5px\\] { font-size: 15.5px !important; }
.text-\\[16px\\] { font-size: 16px !important; }
.text-\\[18px\\] { font-size: 18px !important; }
.text-\\[22px\\] { font-size: 22px !important; }
.text-\\[26px\\] { font-size: 26px !important; }
.text-xs { font-size: 12px !important; }
.text-transparent { color: transparent !important; }

/* ══════════ الألوان المعتمدة للفواتير ══════════ */
.text-black { color: #000000 !important; }
.text-white { color: #ffffff !important; }
.text-slate-400 { color: #94a3b8 !important; }
.text-slate-500 { color: #64748b !important; }
.text-slate-600 { color: #475569 !important; }
.text-slate-700 { color: #334155 !important; }
.text-slate-800 { color: #1e293b !important; }
.text-slate-900 { color: #0f172a !important; }
.bg-white { background-color: #ffffff !important; }
.bg-black { background-color: #000000 !important; }
.bg-transparent { background-color: transparent !important; }

/* ══════════ الحدود والزوايا ══════════ */
.border { border-width: 1px !important; border-style: solid !important; }
.border-b { border-bottom-width: 1px !important; border-bottom-style: solid !important; }
.border-t { border-top-width: 1px !important; border-top-style: solid !important; }
.border-l { border-left-width: 1px !important; border-left-style: solid !important; }
.border-r { border-right-width: 1px !important; border-right-style: solid !important; }
.border-black { border-color: #000000 !important; }
.border-collapse { border-collapse: collapse !important; }
.rounded-lg { border-radius: 0.5rem !important; }
.rounded-xl { border-radius: 0.75rem !important; }
.rounded-2xl { border-radius: 1rem !important; }
.rounded-3xl { border-radius: 1.5rem !important; }
.rounded-full { border-radius: 9999px !important; }
.rounded-\\[8px\\] { border-radius: 8px !important; }
.rounded-\\[10px\\] { border-radius: 10px !important; }
.rounded-\\[12px\\] { border-radius: 12px !important; }
.rounded-\\[20px\\] { border-radius: 20px !important; }

/* ══════════ المسافات والهوامش ══════════ */
.gap-1 { gap: 0.25rem !important; }
.gap-1\\.5 { gap: 0.375rem !important; }
.gap-2 { gap: 0.5rem !important; }
.gap-3 { gap: 0.75rem !important; }
.gap-3\\.5 { gap: 0.875rem !important; }
.gap-4 { gap: 1rem !important; }
.p-0 { padding: 0 !important; }
.p-1 { padding: 0.25rem !important; }
.p-2 { padding: 0.5rem !important; }
.p-2\\.5 { padding: 0.625rem !important; }
.p-3 { padding: 0.75rem !important; }
.px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
.px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
.px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
.px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
.px-5 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
.py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
.py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
.py-1\\.5 { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; }
.py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
.pt-0\\.5 { padding-top: 0.125rem !important; }
.pt-1 { padding-top: 0.25rem !important; }
.pb-0\\.5 { padding-bottom: 0.125rem !important; }
.pb-1 { padding-bottom: 0.25rem !important; }
.pl-3 { padding-left: 0.75rem !important; }
.pr-3 { padding-right: 0.75rem !important; }
.my-1 { margin-top: 0.25rem !important; margin-bottom: 0.25rem !important; }
.my-1\\.5 { margin-top: 0.375rem !important; margin-bottom: 0.375rem !important; }
.my-2 { margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
.mt-0\\.5 { margin-top: 0.125rem !important; }
.mt-1 { margin-top: 0.25rem !important; }
.mt-1\\.5 { margin-top: 0.375rem !important; }
.mb-1 { margin-bottom: 0.25rem !important; }
.mb-2 { margin-bottom: 0.5rem !important; }
.mb-2\\.5 { margin-bottom: 0.625rem !important; }
.mr-1 { margin-right: 0.25rem !important; }
.mx-auto { margin-left: auto !important; margin-right: auto !important; }

/* ══════════ الأبعاد الثابتة والمخصصة ══════════ */
.w-full { width: 100% !important; }
.w-auto { width: auto !important; }
.h-full { height: 100% !important; }
.h-auto { height: auto !important; }
.min-h-0 { min-height: 0px !important; }
.min-h-\\[80px\\] { min-height: 80px !important; }
.min-h-\\[560px\\] { min-height: 560px !important; }
.h-\\[38px\\] { height: 38px !important; }
.h-\\[56px\\] { height: 56px !important; }
.h-\\[66px\\] { height: 66px !important; }
.w-\\[66px\\] { width: 66px !important; }
.h-\\[68px\\] { height: 68px !important; }
.h-\\[74px\\] { height: 74px !important; }
.h-\\[76px\\] { height: 76px !important; }
.h-\\[78px\\] { height: 78px !important; }
.w-\\[40px\\] { width: 40px !important; }
.w-\\[48px\\] { width: 48px !important; }
.w-\\[58px\\] { width: 58px !important; }
.w-\\[62px\\] { width: 62px !important; }
.w-\\[100px\\] { width: 100px !important; }
.w-\\[190px\\] { width: 190px !important; }
.w-\\[460px\\] { width: 460px !important; }

/* ══════════ التموضع والطبقات ══════════ */
.relative { position: relative !important; }
.absolute { position: absolute !important; }
.inset-0 { inset: 0px !important; top: 0px !important; right: 0px !important; bottom: 0px !important; left: 0px !important; }
.z-0 { z-index: 0 !important; }
.z-10 { z-index: 10 !important; }
.z-20 { z-index: 20 !important; }
.pointer-events-none { pointer-events: none !important; }
.pointer-events-auto { pointer-events: auto !important; }
.select-none { user-select: none !important; }
.select-text { user-select: text !important; }
.overflow-hidden { overflow: hidden !important; }
.object-contain { object-fit: contain !important; }
`;

/**
 * بناء مستند HTML مستقل تماماً ومرئي 100% لطباعة أندرويد بدون أي عناصر مخفية
 * مع ضبط Viewport دقيق يطابق عرض الورقة لمنع تكبير وتشويه الخطوط على شاشات الهواتف
 */
export function buildStandaloneInvoiceHtml(
  element: HTMLElement,
  title: string,
  pageSize: "a4" | "a5" = "a4"
): string {
  const isA5 =
    pageSize === "a5" ||
    element.classList.contains("invoice-paper") ||
    element.querySelector(".invoice-paper") !== null ||
    title.includes("A5") ||
    title.includes("a5");

  const rawHtml = convertOklchToRgb(element.outerHTML);
  const viewportWidth = isA5 ? 760 : 794;

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${viewportWidth}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    ${INVOICE_STANDALONE_CSS}

    @page {
      size: ${isA5 ? "210mm 148mm" : "210mm 297mm"} !important;
      margin: 0mm !important;
    }
    @page :left { margin: 0mm !important; }
    @page :right { margin: 0mm !important; }
  </style>
</head>
<body class="printing-proforma printing-custom-invoice printing-a5-invoice">
  <div class="invoice-standalone-root">
    ${rawHtml}
  </div>
</body>
</html>`;
}

/**
 * تحويل ArrayBuffer إلى Base64 نقي وصحيح 100%
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + chunkSize, len)))
    );
  }
  return window.btoa(binary);
}

/**
 * توليد وحفظ ملف PDF أصلي وحقيقي (.pdf) بدقة عالية ومقاوم للأخطاء
 * مع دعم الصفحات المتعددة وتطابق هندسي بنسبة 100% مع المعاينة
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportPdfOptions
): Promise<boolean> {
  const toastId = toast.loading("جاري توليد وحفظ ملف الـ PDF الأصلي...");
  try {
    const { filename, format = "a4", orientation = "portrait" } = options;

    const isA5 =
      format === "a5" ||
      element.classList.contains("invoice-paper") ||
      element.querySelector(".invoice-paper") !== null;

    const actualFormat: "a4" | "a5" = isA5 ? "a5" : format;
    const actualOrientation: "portrait" | "landscape" = isA5 ? "landscape" : orientation;
    const isActuallyLandscape = actualOrientation === "landscape";

    const targetWmm = isActuallyLandscape ? (actualFormat === "a5" ? 210 : 297) : (actualFormat === "a5" ? 148 : 210);
    const targetHmm = isActuallyLandscape ? (actualFormat === "a5" ? 148 : 210) : (actualFormat === "a5" ? 210 : 297);

    // استخراج الصفحات المستهدفة
    let targets: HTMLElement[] = [];
    const printPages = Array.from(element.querySelectorAll<HTMLElement>(".invoice-print-page"));
    if (printPages.length > 0) {
      targets = printPages;
    } else {
      const sheets = Array.from(
        element.querySelectorAll<HTMLElement>(".proforma-sheet, .standard-invoice-sheet, .invoice-paper")
      );
      if (sheets.length > 0) {
        targets = sheets;
      } else {
        targets = [element];
      }
    }

    const pdf = new jsPDF({
      orientation: actualOrientation,
      unit: "mm",
      format: actualFormat,
      compress: true,
    });

    const stageWidthPx = isA5 ? 760 : 794;
    const stageHeightPx = isA5 ? 536 : 1123;

    for (let i = 0; i < targets.length; i++) {
      const targetEl = targets[i];
      if (!targetEl) continue;
      if (i > 0) {
        pdf.addPage(actualFormat, actualOrientation);
      }

      // بناء صندوق عزل مؤقت في الـ DOM بعرض وارتفاع قياسي ومثالي للكانفاس
      const staging = document.createElement("div");
      staging.setAttribute("dir", "rtl");
      staging.style.position = "fixed";
      staging.style.top = "0";
      staging.style.left = "-99999px";
      staging.style.width = `${stageWidthPx}px`;
      staging.style.height = `${stageHeightPx}px`;
      staging.style.minHeight = `${stageHeightPx}px`;
      staging.style.maxHeight = `${stageHeightPx}px`;
      staging.style.backgroundColor = "#ffffff";
      staging.style.zIndex = "-9999";
      staging.style.margin = "0";
      staging.style.padding = "0";
      staging.style.boxSizing = "border-box";
      staging.style.webkitTextSizeAdjust = "100%";

      const clone = targetEl.cloneNode(true) as HTMLElement;
      clone.classList.remove("invoice-print-root", "proforma-print-root", "custom-invoice-print-root");
      clone.style.setProperty("position", "relative", "important");
      clone.style.setProperty("left", "0", "important");
      clone.style.setProperty("top", "0", "important");
      clone.style.setProperty("opacity", "1", "important");
      clone.style.setProperty("visibility", "visible", "important");
      clone.style.setProperty("display", isA5 ? "flex" : "flex", "important");
      clone.style.setProperty("flex-direction", "column", "important");
      clone.style.setProperty("justify-content", "space-between", "important");
      clone.style.setProperty("margin", "0 auto", "important");
      clone.style.setProperty("box-sizing", "border-box", "important");
      clone.style.setProperty("background-color", "#ffffff", "important");
      clone.style.setProperty("-webkit-text-size-adjust", "100%", "important");

      staging.appendChild(clone);
      document.body.appendChild(staging);

      try {
        if (document.fonts) {
          try {
            await document.fonts.ready;
          } catch {}
        }
        const imgs = Array.from(staging.querySelectorAll<HTMLImageElement>("img"));
        await Promise.all(
          imgs.map(async (img) => {
            if (img.complete && img.naturalWidth > 0) return;
            try {
              await img.decode();
            } catch {}
          })
        );

        // التقاط الكانفاس بدقة عالية 2.0x مع ألوان sRGB متوافقة
        const canvas = await html2canvas(clone, {
          scale: 2.0,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: stageWidthPx,
          windowHeight: stageHeightPx,
          onclone: (clonedDoc) => {
            clonedDoc.querySelectorAll("link[rel='stylesheet']").forEach((link) => {
              link.remove();
            });

            clonedDoc.querySelectorAll("style").forEach((styleEl) => {
              try {
                if (styleEl.id === "standalone-pdf-styles") return;
                if (styleEl.textContent && styleEl.textContent.includes("oklch")) {
                  styleEl.textContent = convertOklchToRgb(styleEl.textContent);
                }
              } catch (e) {
                console.warn("Style oklch conversion note:", e);
              }
            });

            clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
              const s = el.getAttribute("style");
              if (s && s.includes("oklch")) {
                el.setAttribute("style", convertOklchToRgb(s));
              }
            });

            const styleTag = clonedDoc.createElement("style");
            styleTag.id = "standalone-pdf-styles";
            styleTag.textContent = INVOICE_STANDALONE_CSS;
            clonedDoc.head.appendChild(styleTag);
          },
        });

        // استخدام PNG لضمان نصوص حادة وخطوط نقية بدون أي تشويش JPEG
        const imgData = canvas.toDataURL("image/png");
        pdf.addImage(imgData, "PNG", 0, 0, targetWmm, targetHmm, undefined, "FAST");
      } finally {
        if (staging.parentNode) {
          staging.parentNode.removeChild(staging);
        }
      }
    }

    const safeFilename = (filename || "فاتورة-TA").replace(/[\\/:*?"<>|]/g, "-");
    const fullFilename = safeFilename.endsWith(".pdf") ? safeFilename : `${safeFilename}.pdf`;

    // جسر أندرويد لحفظ الـ PDF في مجلد التنزيلات بالجهاز
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.savePdf === "function") {
      const arrayBuffer = pdf.output("arraybuffer");
      const base64 = arrayBufferToBase64(arrayBuffer);
      androidPrint.savePdf(base64, fullFilename);
      toast.success(`تم حفظ ملف الـ PDF بنجاح باسم: ${fullFilename}`, { id: toastId });
      return true;
    }

    // متصفح الويب القياسي
    pdf.save(fullFilename);
    toast.success(`تم تنزيل ملف الـ PDF بنجاح: ${fullFilename}`, { id: toastId });
    return true;
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    const msg = error?.message ? `: ${error.message}` : "";
    toast.error(`تعذر توليد ملف PDF${msg}، يرجى المحاولة مرة أخرى`, { id: toastId });
    return false;
  }
}

/**
 * معالج أمر الطباعة الذكي: يرسل HTML المخصص لأندرويد مع تحديد مقاس الورق بدقة
 * يمنع تماماً أي طباعة لواجهة التطبيق أو النوافذ المحيطة
 */
export function triggerPrintWithElement(
  element: HTMLElement | null,
  documentTitle: string,
  pageSize: "a4" | "a5" | (() => void) = "a4",
  onDone?: () => void
) {
  let actualPageSize: "a4" | "a5" = "a4";
  let actualOnDone: (() => void) | undefined = onDone;

  if (typeof pageSize === "function") {
    actualOnDone = pageSize;
    actualPageSize =
      element?.classList.contains("invoice-paper") ||
      element?.querySelector(".invoice-paper") !== null ||
      documentTitle.includes("A5") ||
      documentTitle.includes("a5")
        ? "a5"
        : "a4";
  } else if (pageSize === "a5" || pageSize === "a4") {
    actualPageSize = pageSize;
  }

  const previousTitle = document.title;
  if (documentTitle) {
    document.title = documentTitle;
  }

  const cleanup = () => {
    document.title = previousTitle;
    actualOnDone?.();
  };

  // حماية صارمة: منع طباعة نافذة التطبيق العامة إذا لم يتوفر عنصر الفاتورة
  if (!element) {
    console.error("Print rejected: Invoice element is null or undefined.");
    toast.error("تعذر العثور على مستند الفاتورة لتجهيز الطباعة. يرجى إعادة المحاولة.");
    cleanup();
    return;
  }

  const androidPrint = (window as any).AndroidPrint;

  // 1. في أندرويد نرسل HTML مستقل بالكامل محدد الحجم بدقة عبر جسر الطباعة الأصلي
  if (androidPrint && typeof androidPrint.printHtml === "function") {
    try {
      const html = buildStandaloneInvoiceHtml(element, documentTitle, actualPageSize);
      androidPrint.printHtml(html, documentTitle, actualPageSize.toUpperCase());
      setTimeout(cleanup, 1500);
      return;
    } catch (e) {
      console.warn("AndroidPrint.printHtml error:", e);
    }
  }

  // 2. متصفح الويب القياسي (عبر نافذة طباعة مخصصة تركز على الفاتورة فقط)
  try {
    window.addEventListener("afterprint", () => cleanup(), { once: true });
    setTimeout(cleanup, 5000);
    window.print();
  } catch (err) {
    console.error("Browser print failed:", err);
    cleanup();
  }
}
