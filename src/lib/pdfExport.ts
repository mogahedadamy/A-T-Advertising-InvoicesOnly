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

  // حماية إضافية: استبدال أي تعبير oklch شاذ متبقٍ بلون محايد متوافق
  return converted.replace(/oklch\([^)]+\)/gi, "rgb(100, 116, 139)");
}

/**
 * أنماط الطباعة والتصدير الشاملة والمستقلة بالكامل:
 * - معطلة تماماً لميزة Font Boosting في أندرويد عبر text-size-adjust: 100%
 * - تضمن ألوان HEX/RGB متوافقة وبدون أخطاء oklch
 * - تغطي كافة فئات Tailwind والأبعاد لمستندات A5 و A4 بدقة مطلقة
 */
export const INVOICE_STANDALONE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

:root {
  --invoice-paper: #ffffff;
  --invoice-ink: #0f172a;
  --invoice-accent: #1d4ed8;
  --invoice-accent-2: #ea580c;
  --invoice-soft: #f8fafc;
  --invoice-border: #cbd5e1;
  --font-arabic: 'Tajawal', system-ui, -apple-system, sans-serif;
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
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif !important;
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

/* 1. ورقة الفاتورة المبدئية A4 والفاتورة المخصصة (210mm x 297mm) */
.proforma-sheet, .standard-invoice-sheet {
  width: 210mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  height: 297mm !important;
  background-color: #ffffff !important;
  color: #0f172a !important;
  position: relative !important;
  left: auto !important;
  top: auto !important;
  margin: 0 auto !important;
  padding: 0 !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  opacity: 1 !important;
  visibility: visible !important;
  display: block !important;
  page-break-inside: avoid !important;
  break-inside: avoid !important;
}

/* 2. ورقة فاتورة طلب التشغيل A5 العرضية (760px x 536px / 210mm x 148mm) */
.invoice-paper {
  width: 760px !important;
  min-height: 536px !important;
  height: 536px !important;
  max-height: 536px !important;
  background: #ffffff !important;
  color: #0f172a !important;
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif !important;
  padding: 12px 18px 10px !important;
  font-size: 11px !important;
  line-height: 1.4 !important;
  box-sizing: border-box !important;
  position: relative !important;
  border-top: 5px solid #ea580c !important;
  border-bottom: 3.5px solid #ea580c !important;
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

/* عناصر ورقة A5 العرضية */
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
  color: #ea580c !important;
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
  border: 1.5px solid #dc2626 !important;
  background: #fef2f2 !important;
  color: #dc2626 !important;
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
  color: #ea580c !important;
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
.inv-checks-row {
  grid-column: span 4 !important;
  display: flex !important;
  align-items: center !important;
  gap: 14px !important;
  padding-top: 3px !important;
  border-top: 1px dashed #cbd5e1 !important;
}
.inv-check {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  font-weight: 700 !important;
  font-size: 10px !important;
}
.inv-box {
  width: 13px !important;
  height: 13px !important;
  border: 1.5px solid #0f172a !important;
  border-radius: 2.5px !important;
  display: inline-grid !important;
  place-items: center !important;
  font-size: 9.5px !important;
  color: #ea580c !important;
  font-weight: 900 !important;
  line-height: 1 !important;
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
  background: #ea580c !important;
  background-color: #ea580c !important;
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
.inv-num {
  font-family: monospace !important;
  font-weight: 800 !important;
}
.inv-strong {
  font-weight: 800 !important;
  color: #0f172a !important;
}
.inv-desc {
  text-align: right !important;
  font-weight: 600 !important;
}
.inv-total-row td {
  background: #fff7ed !important;
  background-color: #fff7ed !important;
  border-top: 1.5px solid #0f172a !important;
  font-weight: 900 !important;
  height: 24px !important;
}
.inv-total-label {
  text-align: left !important;
  font-size: 11px !important;
  color: #0f172a !important;
}
.inv-total-val {
  font-size: 13.5px !important;
  color: #ea580c !important;
  font-family: monospace !important;
  font-weight: 900 !important;
}
.inv-footer {
  margin-top: 4px !important;
  border-top: 1px solid #cbd5e1 !important;
  padding-top: 4px !important;
}
.inv-signs {
  display: grid !important;
  grid-template-columns: repeat(3, 1fr) !important;
  gap: 16px !important;
  font-size: 10.5px !important;
  font-weight: 700 !important;
  text-align: center !important;
}
.inv-sign-box {
  border-top: 1px dotted #0f172a !important;
  padding-top: 2px !important;
  margin-top: 14px !important;
  color: #475569 !important;
}
.inv-note {
  margin-top: 4px !important;
  font-size: 8.5px !important;
  font-weight: 600 !important;
  color: #64748b !important;
  text-align: center !important;
}

/* جداول الفواتير العامة والبروفورما */
table {
  width: 100% !important;
  border-collapse: collapse !important;
}
th, td {
  border: 1px solid #cbd5e1 !important;
}
thead tr, th, .bg-\\[\\#f58220\\] {
  background-color: #f58220 !important;
  background: #f58220 !important;
  color: #000000 !important;
  font-weight: 900 !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
tfoot tr {
  background-color: #f8fafc !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}

/* تنسيقات Tailwind الشاملة المستخدمة في الفواتير (ضمان التطابق الكامل مع المعاينة) */
.flex { display: flex !important; }
.flex-col { flex-direction: column !important; }
.items-center { align-items: center !important; }
.justify-between { justify-content: space-between !important; }
.justify-center { justify-content: center !important; }
.text-center { text-align: center !important; }
.text-right { text-align: right !important; }
.text-left { text-align: left !important; }
.w-full { width: 100% !important; }
.w-auto { width: auto !important; }
.h-full { height: 100% !important; }
.h-auto { height: auto !important; }
.relative { position: relative !important; }
.absolute { position: absolute !important; }
.overflow-hidden { overflow: hidden !important; }
.pointer-events-none { pointer-events: none !important; }
.pointer-events-auto { pointer-events: auto !important; }
.select-none { user-select: none !important; }
.select-text { user-select: text !important; }
.font-mono { font-family: monospace !important; }
.font-sans { font-family: 'Tajawal', sans-serif !important; }
.font-black { font-weight: 900 !important; }
.font-bold { font-weight: 700 !important; }
.font-semibold { font-weight: 600 !important; }
.font-medium { font-weight: 500 !important; }
.font-normal { font-weight: 400 !important; }
.leading-none { line-height: 1 !important; }
.leading-tight { line-height: 1.25 !important; }
.tracking-tight { letter-spacing: -0.025em !important; }
.tracking-wider { letter-spacing: 0.05em !important; }
.border { border-width: 1px !important; border-style: solid !important; }
.border-l { border-left-width: 1px !important; border-left-style: solid !important; }
.border-t { border-top-width: 1px !important; border-top-style: solid !important; }
.border-box { box-sizing: border-box !important; }
.divide-y > :not([hidden]) ~ :not([hidden]) { border-top-width: 1px !important; border-top-style: solid !important; border-color: #e2e8f0 !important; }
.divide-slate-200 > :not([hidden]) ~ :not([hidden]) { border-color: #e2e8f0 !important; }

/* هوامش وأبعاد فواتير A4 المعتمدة */
.px-\\[14mm\\] { padding-left: 14mm !important; padding-right: 14mm !important; }
.px-\\[21mm\\] { padding-left: 21mm !important; padding-right: 21mm !important; }
.pt-\\[5mm\\] { padding-top: 5mm !important; }
.right-\\[21mm\\] { right: 21mm !important; }
.w-\\[210mm\\] { width: 210mm !important; }

/* أحجام الخطوط الدقيقة */
.text-\\[25px\\] { font-size: 25px !important; }
.text-\\[30px\\] { font-size: 30px !important; }
.text-\\[18px\\] { font-size: 18px !important; }
.text-\\[13px\\] { font-size: 13px !important; }
.text-\\[12\\.5px\\] { font-size: 12.5px !important; }
.text-\\[12px\\] { font-size: 12px !important; }
.text-\\[10px\\] { font-size: 10px !important; }
.text-\\[9\\.5px\\] { font-size: 9.5px !important; }
.text-\\[11px\\] { font-size: 11px !important; }
.text-\\[13\\.5px\\] { font-size: 13.5px !important; }
.text-\\[14\\.5px\\] { font-size: 14.5px !important; }
.text-\\[15\\.5px\\] { font-size: 15.5px !important; }
.text-\\[15px\\] { font-size: 15px !important; }
.text-\\[16px\\] { font-size: 16px !important; }
.text-xs { font-size: 12px !important; }

/* أبعاد العناصر الثابتة */
.w-52 { width: 13rem !important; }
.h-\\[3px\\] { height: 3px !important; }
.h-\\[4\\.5px\\] { height: 4.5px !important; }
.h-\\[84px\\] { height: 84px !important; }
.h-\\[90px\\] { height: 90px !important; }
.h-\\[128px\\] { height: 128px !important; }
.h-\\[140px\\] { height: 140px !important; }
.h-\\[36px\\] { height: 36px !important; }
.h-\\[37px\\] { height: 37px !important; }
.h-\\[40px\\] { height: 40px !important; }
.h-\\[46px\\] { height: 46px !important; }
.h-\\[52px\\] { height: 52px !important; }
.w-\\[36px\\] { width: 36px !important; }
.w-\\[38px\\] { width: 38px !important; }
.w-\\[48px\\] { width: 48px !important; }
.w-\\[64px\\] { width: 64px !important; }
.w-\\[68px\\] { width: 68px !important; }
.w-\\[82px\\] { width: 82px !important; }
.w-\\[88px\\] { width: 88px !important; }
.w-\\[94px\\] { width: 94px !important; }
.w-\\[110px\\] { width: 110px !important; }
.w-\\[120px\\] { width: 120px !important; }

/* الألوان المعيارية */
.text-\\[\\#901a24\\] { color: #901a24 !important; }
.bg-\\[\\#901a24\\] { background-color: #901a24 !important; }
.border-\\[\\#901a24\\]\\/50 { border-color: rgba(144, 26, 36, 0.5) !important; }
.text-\\[\\#c2410c\\] { color: #c2410c !important; }
.bg-\\[\\#f58220\\] { background-color: #f58220 !important; }
.bg-orange-50\\/70 { background-color: rgba(255, 247, 237, 0.7) !important; }
.border-orange-200\\/80 { border-color: rgba(254, 215, 170, 0.8) !important; }
.bg-slate-50\\/30 { background-color: rgba(248, 250, 252, 0.3) !important; }
.bg-slate-100\\/80 { background-color: rgba(241, 245, 249, 0.8) !important; }
.border-slate-200 { border-color: #e2e8f0 !important; }
.border-slate-300 { border-color: #cbd5e1 !important; }
.border-black\\/15 { border-color: rgba(0, 0, 0, 0.15) !important; }
.text-slate-400 { color: #94a3b8 !important; }
.text-slate-500 { color: #64748b !important; }
.text-slate-600 { color: #475569 !important; }
.text-slate-700 { color: #334155 !important; }
.text-slate-800 { color: #1e293b !important; }
.text-slate-900 { color: #0f172a !important; }
.text-slate-950 { color: #020617 !important; }
.text-muted-foreground { color: #64748b !important; }
.text-muted-foreground\\/30 { color: rgba(100, 116, 139, 0.3) !important; }
.text-foreground { color: #0f172a !important; }
.text-black { color: #000000 !important; }
.bg-black { background-color: #000000 !important; }
.text-white { color: #ffffff !important; }
.bg-white { background-color: #ffffff !important; }

/* المسافات والفجوات */
.gap-2 { gap: 0.5rem !important; }
.gap-10 { gap: 2.5rem !important; }
.space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem !important; }
.space-y-1\\.5 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.375rem !important; }
.p-2\\.5 { padding: 0.625rem !important; }
.px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
.px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
.px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
.px-5 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
.py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
.py-1\\.5 { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; }
.py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
.py-2\\.5 { padding-top: 0.625rem !important; padding-bottom: 0.625rem !important; }
.pt-1 { padding-top: 0.25rem !important; }
.pb-1 { padding-bottom: 0.25rem !important; }
.mt-0\\.5 { margin-top: 0.125rem !important; }
.mt-1 { margin-top: 0.25rem !important; }
.mt-2 { margin-top: 0.5rem !important; }
.mt-10 { margin-top: 2.5rem !important; }
.mb-1 { margin-bottom: 0.25rem !important; }
.mb-2 { margin-bottom: 0.5rem !important; }
.mb-2\\.5 { margin-bottom: 0.625rem !important; }
.mb-3\\.5 { margin-bottom: 0.875rem !important; }
.mb-4 { margin-bottom: 1rem !important; }
.my-2 { margin-top: 0.5rem !important; margin-bottom: 0.5rem !important; }
.mx-auto { margin-left: auto !important; margin-right: auto !important; }
.bottom-0 { bottom: 0 !important; }
.left-0 { left: 0 !important; }
.right-0 { right: 0 !important; }
.left-\\[74px\\] { left: 74px !important; }
.left-\\[94px\\] { left: 94px !important; }
.bottom-\\[14px\\] { bottom: 14px !important; }
.bottom-\\[16px\\] { bottom: 16px !important; }
.bottom-\\[22px\\] { bottom: 22px !important; }
.rounded-xs { border-radius: 0.125rem !important; }
.rounded-xl { border-radius: 0.75rem !important; }
.rounded-2xl { border-radius: 1rem !important; }
.rounded-full { border-radius: 9999px !important; }
.shadow-2xs { box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important; }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1) !important; }
.object-contain { object-fit: contain !important; }
.shrink-0 { flex-shrink: 0 !important; }
.-rotate-2 { transform: rotate(-2deg) !important; }

/* الأيقونات والمقاسات الدقيقة لتذييل الفواتير */
.w-2\\.5 { width: 0.625rem !important; }
.w-10 { width: 2.5rem !important; }
.h-3\\.5 { height: 0.875rem !important; }
.w-3\\.5 { width: 0.875rem !important; }
.h-2 { height: 0.5rem !important; }
.w-2 { width: 0.5rem !important; }
.h-\\[9px\\] { height: 9px !important; }
.w-\\[9px\\] { width: 9px !important; }
.h-\\[10px\\] { height: 10px !important; }
.w-\\[10px\\] { width: 10px !important; }
.h-\\[15px\\] { height: 15px !important; }
.w-\\[15px\\] { width: 15px !important; }
.stroke-\\[2\\.2\\] { stroke-width: 2.2 !important; }

/* تنسيقات تذييل الفاتورة المبدئية والفاتورة المخصصة A4 لضمان محاذاة هندسية دقيقة وثابتة ومستقلة */
.proforma-footer-wrap {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  width: 210mm !important;
  height: 140px !important;
  overflow: hidden !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
}
.proforma-footer-bottom-line {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 4.5px !important;
  background-color: #901a24 !important;
  z-index: 10 !important;
}
.proforma-footer-shape {
  position: absolute !important;
  bottom: 0 !important;
  left: 0 !important;
  height: 128px !important;
  width: auto !important;
  object-fit: contain !important;
  z-index: 20 !important;
  pointer-events: none !important;
}
.proforma-footer-bar {
  position: absolute !important;
  bottom: 22px !important;
  left: 74px !important;
  width: 10px !important;
  height: 52px !important;
  background-color: #901a24 !important;
  border-radius: 2px !important;
  z-index: 20 !important;
}
.proforma-footer-contacts {
  position: absolute !important;
  bottom: 18px !important;
  left: 94px !important;
  z-index: 20 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 3.5px !important;
  direction: ltr !important;
  text-align: left !important;
  font-size: 9.5px !important;
  line-height: 1.35 !important;
  color: #1e293b !important;
  font-weight: 600 !important;
  pointer-events: auto !important;
}
.proforma-contact-row {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  min-height: 15px !important;
  white-space: nowrap !important;
}
.proforma-contact-icon {
  width: 15px !important;
  height: 15px !important;
  min-width: 15px !important;
  min-height: 15px !important;
  border-radius: 9999px !important;
  border: 1px solid rgba(144, 26, 36, 0.6) !important;
  background-color: #ffffff !important;
  color: #901a24 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  box-sizing: border-box !important;
  padding: 0 !important;
}
.proforma-contact-icon svg {
  width: 9px !important;
  height: 9px !important;
  display: block !important;
  stroke: #901a24 !important;
  stroke-width: 2.2 !important;
  fill: none !important;
}
.proforma-contact-text {
  font-family: 'Tajawal', system-ui, -apple-system, sans-serif !important;
  color: #1e293b !important;
  direction: ltr !important;
  unicode-bidi: isolate !important;
  vertical-align: middle !important;
}
.proforma-contact-phone {
  font-family: monospace, system-ui !important;
  color: #1e293b !important;
  direction: ltr !important;
  unicode-bidi: isolate !important;
  font-weight: 700 !important;
  letter-spacing: 0.3px !important;
}
.proforma-footer-stamp {
  position: absolute !important;
  bottom: 14px !important;
  right: 21mm !important;
  z-index: 20 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  pointer-events: auto !important;
}
.proforma-footer-stamp img {
  height: 90px !important;
  width: auto !important;
  object-fit: contain !important;
  transform: rotate(-2deg) !important;
}
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
    title.includes("طلب") ||
    title.includes("تشغيل");

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
 * مع دعم الصفحات المتعددة وحظر Font Boosting تماماً
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

    // البحث عن كافة الصفحات المستهدفة بشكل سليم (يدعم الفواتير متعددة الصفحات)
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

    // ضبط مقاس صندوق العزل بدقة مطلقة لمنع أي تمدد أو هوامش فارغة
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
      staging.style.minHeight = `${stageHeightPx}px`;
      staging.style.maxWidth = `${stageWidthPx}px`;
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
      clone.style.setProperty("display", "block", "important");
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

        // التقاط الكانفاس بدقة عالية مع معالجة ألوان oklch وحظر Font Boosting دون حذف الـ CSS الأصلي
        const canvas = await html2canvas(clone, {
          scale: 2.0,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: stageWidthPx + 50,
          onclone: (clonedDoc) => {
            // 1. إزالة كافة ملفات الـ CSS الخارجية (link[rel="stylesheet"]) لمنع html2canvas
            // من محاولة تحليل ألوان oklch الخاصة بحزم Tailwind v4 والتسبب بالخطأ
            clonedDoc.querySelectorAll("link[rel='stylesheet']").forEach((link) => {
              link.remove();
            });

            // 2. تحويل أو تنظيف أي وسوم style موجودة تحتوي على oklch
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

            // 3. تحويل أي أنماط مضمنة style="..." تحتوي على oklch في كافة العناصر
            clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
              const s = el.getAttribute("style");
              if (s && s.includes("oklch")) {
                el.setAttribute("style", convertOklchToRgb(s));
              }
            });

            // 4. حقن التنسيق الشامل المستقل كأولوية قصوى وبألوان sRGB/HEX متوافقة 100%
            const styleTag = clonedDoc.createElement("style");
            styleTag.id = "standalone-pdf-styles";
            styleTag.textContent = INVOICE_STANDALONE_CSS;
            clonedDoc.head.appendChild(styleTag);
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        pdf.addImage(imgData, "JPEG", 0, 0, targetWmm, targetHmm, undefined, "FAST");
      } finally {
        if (staging.parentNode) {
          staging.parentNode.removeChild(staging);
        }
      }
    }

    const safeFilename = (filename || "فاتورة-TA").replace(/[\\/:*?"<>|]/g, "-");
    const fullFilename = safeFilename.endsWith(".pdf") ? safeFilename : `${safeFilename}.pdf`;

    // جسر أندرويد لحفظ الـ PDF في مجلد التنزيلات بالجهاز كملف ثنائي أصلي وسليم 100%
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.savePdf === "function") {
      const arrayBuffer = pdf.output("arraybuffer");
      const base64 = arrayBufferToBase64(arrayBuffer);
      androidPrint.savePdf(base64, fullFilename);
      toast.success("تم تصدير وحفظ ملف الـ PDF الأصلي بنجاح", { id: toastId });
      return true;
    }

    // متصفح الويب العادي
    pdf.save(fullFilename);
    toast.success("تم تنزيل ملف الـ PDF بنجاح", { id: toastId });
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
      documentTitle.includes("طلب") ||
      documentTitle.includes("تشغيل")
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

  const androidPrint = (window as any).AndroidPrint;

  // 1. في أندرويد إذا توفر العنصر نرسل HTML مستقل بالكامل محدد الحجم بدقة لمنع الصفحة البيضاء وتثبيت التنسيق
  if (androidPrint && typeof androidPrint.printHtml === "function" && element) {
    try {
      const html = buildStandaloneInvoiceHtml(element, documentTitle, actualPageSize);
      androidPrint.printHtml(html, documentTitle, actualPageSize.toUpperCase());
      setTimeout(cleanup, 1500);
      return;
    } catch (e) {
      console.warn("AndroidPrint.printHtml error:", e);
    }
  }

  // 2. إذا توفر أمر print العادي في أندرويد
  if (androidPrint && typeof androidPrint.print === "function") {
    try {
      androidPrint.print(documentTitle || "فاتورة-TA");
      setTimeout(cleanup, 2000);
      return;
    } catch (e) {
      console.warn("AndroidPrint.print error:", e);
    }
  }

  // 3. متصفح الويب القياسي
  window.addEventListener("afterprint", () => cleanup(), { once: true });
  setTimeout(cleanup, 5000);

  try {
    window.print();
  } catch (err) {
    console.error("Browser print failed:", err);
    cleanup();
  }
}
