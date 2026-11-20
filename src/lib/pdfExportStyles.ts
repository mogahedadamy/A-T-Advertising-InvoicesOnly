/**
 * أنماط الطباعة والتصدير الشاملة والمستقلة بالكامل لملفات PDF:
 * - معطلة تماماً لميزة Font Boosting في أندرويد عبر text-size-adjust: 100%
 * - تضمن ألوان HEX/RGB متوافقة وبدون أخطاء oklch
 * - تغطي كافة فئات Tailwind والأبعاد لمستندات A4 و A5 بدقة مطلقة
 */
export const INVOICE_STANDALONE_CSS = `
/* Locally bundled Tajawal font family (SIL Open Font License 1.1). */
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-ExtraLight.ttf') format('truetype');
  font-style: normal;
  font-weight: 200;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Light.ttf') format('truetype');
  font-style: normal;
  font-weight: 300;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Regular.ttf') format('truetype');
  font-style: normal;
  font-weight: 400;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Medium.ttf') format('truetype');
  font-style: normal;
  font-weight: 500;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Medium.ttf') format('truetype');
  font-style: normal;
  font-weight: 600;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Bold.ttf') format('truetype');
  font-style: normal;
  font-weight: 700;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-ExtraBold.ttf') format('truetype');
  font-style: normal;
  font-weight: 800;
  font-display: block;
}
@font-face {
  font-family: 'Tajawal';
  src: url('/fonts/Tajawal-Black.ttf') format('truetype');
  font-style: normal;
  font-weight: 900;
  font-display: block;
}


:root {
  --invoice-paper: #ffffff;
  --invoice-ink: #000000;
  --invoice-accent: #0D4A39;
  --invoice-border: #1e293b;
  --font-arabic: 'Tajawal', 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif;
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
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  -webkit-text-size-adjust: 100% !important;
  text-size-adjust: 100% !important;
  line-height: 1.4 !important;
}

[dir="rtl"], .printing-rtl {
  direction: rtl !important;
  text-align: right !important;
  font-family: 'Tajawal', 'Noto Naskh Arabic', 'Noto Sans Arabic', sans-serif !important;
  font-kerning: normal !important;
  font-synthesis: none !important;
  font-variant-ligatures: normal !important;
}

/* قاعدة الحماية القصوى للنصوص العربية: منع تقطيع وتداخل الأحرف والخطوط الضاربة */
[dir="rtl"],
[dir="rtl"] *:not([dir="ltr"]),
.printing-rtl,
.printing-rtl *:not([dir="ltr"]) {
  letter-spacing: normal !important;
  word-spacing: normal !important;
  font-feature-settings: normal !important;
  font-kerning: normal !important;
  font-synthesis: none !important;
  font-variant-ligatures: normal !important;
  text-rendering: auto !important;
}

[dir="rtl"] :is(p, span, strong, b, em, label, small, td, th, li),
.printing-rtl :is(p, span, strong, b, em, label, small, td, th, li) {
  line-height: 1.35 !important;
  font-synthesis: none !important;
  font-kerning: normal !important;
  text-rendering: auto !important;
}

[dir="ltr"], .printing-ltr {
  direction: ltr !important;
  text-align: left !important;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
}

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

/* 1. ورقة الفاتورة المعتمدة A4 (210mm x 297mm) */
.proforma-sheet, .standard-invoice-sheet {
  width: 210mm !important;
  min-height: 297mm !important;
  max-height: 297mm !important;
  margin: 0 auto !important;
  padding: 10mm 12mm 10mm 12mm !important;
  box-sizing: border-box !important;
  background-color: #ffffff !important;
  color: #000000 !important;
  position: relative !important;
  overflow: hidden !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
}

/* 2. كشف الحساب المالي A4 بهوامش أمان متوازنة ومسنترة داخل الورقة */
.statement-print-root,
.statement-print-document,
#customer-statement-print-mount,
#customer-statement-share-mount {
  width: 210mm !important;
  min-height: 297mm !important;
  max-height: none !important;
  margin: 0 auto !important;
  padding: 16mm 18mm 14mm 18mm !important;
  box-sizing: border-box !important;
  background-color: #ffffff !important;
  color: #0f172a !important;
  position: relative !important;
  overflow: visible !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
}

/* ورقة الفاتورة المعتمدة A5 (210mm x 148mm Landscape) */
.invoice-paper {
  width: 210mm !important;
  min-height: 148mm !important;
  max-height: 148mm !important;
  margin: 0 auto !important;
  padding: 5mm 8mm !important;
  box-sizing: border-box !important;
  background-color: #ffffff !important;
  color: #000000 !important;
  position: relative !important;
  overflow: hidden !important;
}

/* ══════════ تخطيط Flex و Grid ══════════ */
.flex { display: flex !important; }
.inline-flex { display: inline-flex !important; }
.grid { display: grid !important; }
.hidden { display: none !important; }
.flex-col { flex-direction: column !important; }
.flex-row { flex-direction: row !important; }
.items-center { align-items: center !important; }
.items-start { align-items: flex-start !important; }
.items-end { align-items: flex-end !important; }
.items-baseline { align-items: baseline !important; }
.justify-between { justify-content: space-between !important; }
.justify-center { justify-content: center !important; }
.justify-start { justify-content: flex-start !important; }
.justify-end { justify-content: flex-end !important; }
.flex-1 { flex: 1 1 0% !important; }
.shrink-0 { flex-shrink: 0 !important; }
.grow { flex-grow: 1 !important; }

/* ══════════ أعمدة الشبكة Grid Columns ══════════ */
.grid-cols-12 { grid-template-columns: repeat(12, minmax(0, 1fr)) !important; }
.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
.col-span-1 { grid-column: span 1 / span 1 !important; }
.col-span-2 { grid-column: span 2 / span 2 !important; }
.col-span-3 { grid-column: span 3 / span 3 !important; }
.col-span-4 { grid-column: span 4 / span 4 !important; }
.col-span-5 { grid-column: span 5 / span 5 !important; }
.col-span-6 { grid-column: span 6 / span 6 !important; }
.col-span-7 { grid-column: span 7 / span 7 !important; }
.col-span-8 { grid-column: span 8 / span 8 !important; }
.col-span-10 { grid-column: span 10 / span 10 !important; }
.col-span-12 { grid-column: span 12 / span 12 !important; }

/* ══════════ النصوص والخطوط ══════════ */
.text-right { text-align: right !important; }
.text-left { text-align: left !important; }
.text-center { text-align: center !important; }
.font-bold { font-weight: 700 !important; }
.font-extrabold { font-weight: 800 !important; }
.font-black { font-weight: 900 !important; }
.font-medium { font-weight: 500 !important; }
.font-normal { font-weight: 400 !important; }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important; }
.italic { font-style: italic !important; }
.not-italic { font-style: normal !important; }
/* letter-spacing مسموح فقط للنصوص اللاتينية والأرقام لمنع كراش الخط العربي */
[dir="ltr"] .tracking-tight, .font-mono.tracking-tight { letter-spacing: -0.025em !important; }
[dir="ltr"] .tracking-wide, .font-mono.tracking-wide { letter-spacing: 0.025em !important; }
[dir="ltr"] .tracking-wider, .font-mono.tracking-wider { letter-spacing: 0.05em !important; }
.leading-none { line-height: 1 !important; }
.leading-tight { line-height: 1.25 !important; }
.leading-snug { line-height: 1.375 !important; }
.leading-normal { line-height: 1.5 !important; }
.leading-relaxed { line-height: 1.625 !important; }
.tabular-nums { font-variant-numeric: tabular-nums !important; }
.truncate { overflow: hidden !important; text-overflow: ellipsis !important; white-space: nowrap !important; }
.whitespace-nowrap { white-space: nowrap !important; }

/* أحجام الخطوط */
.text-\\[9\\.5px\\] { font-size: 9.5px !important; }
.text-\\[10px\\] { font-size: 10px !important; }
.text-\\[10\\.5px\\] { font-size: 10.5px !important; }
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
.text-sm { font-size: 14px !important; }
.text-base { font-size: 16px !important; }
.text-lg { font-size: 18px !important; }
.text-xl { font-size: 20px !important; }

/* ══════════ الألوان المعتمدة للفواتير ══════════ */
.text-black { color: #000000 !important; }
.text-white { color: #ffffff !important; }
.text-slate-400 { color: #94a3b8 !important; }
.text-slate-500 { color: #64748b !important; }
.text-slate-600 { color: #475569 !important; }
.text-slate-700 { color: #334155 !important; }
.text-slate-800 { color: #1e293b !important; }
.text-slate-900 { color: #0f172a !important; }
.text-primary { color: #0D4A39 !important; }
.bg-white { background-color: #ffffff !important; }
.bg-black { background-color: #000000 !important; }
.bg-transparent { background-color: transparent !important; }
.bg-slate-50 { background-color: #f8fafc !important; }
.bg-slate-100 { background-color: #f1f5f9 !important; }

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
.gap-2\\.5 { gap: 0.625rem !important; }
.gap-3 { gap: 0.75rem !important; }
.gap-3\\.5 { gap: 0.875rem !important; }
.gap-4 { gap: 1rem !important; }
.p-0 { padding: 0 !important; }
.p-1 { padding: 0.25rem !important; }
.p-2 { padding: 0.5rem !important; }
.p-2\\.5 { padding: 0.625rem !important; }
.p-3 { padding: 0.75rem !important; }
.p-3\\.5 { padding: 0.875rem !important; }
.px-1 { padding-left: 0.25rem !important; padding-right: 0.25rem !important; }
.px-2 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
.px-2\\.5 { padding-left: 0.625rem !important; padding-right: 0.625rem !important; }
.px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
.px-3\\.5 { padding-left: 0.875rem !important; padding-right: 0.875rem !important; }
.px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
.px-5 { padding-left: 1.25rem !important; padding-right: 1.25rem !important; }
.py-0\\.5 { padding-top: 0.125rem !important; padding-bottom: 0.125rem !important; }
.py-1 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }
.py-1\\.5 { padding-top: 0.375rem !important; padding-bottom: 0.375rem !important; }
.py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
.pt-0\\.5 { padding-top: 0.125rem !important; }
.pt-1 { padding-top: 0.25rem !important; }
.pt-1\\.5 { padding-top: 0.375rem !important; }
.pt-2 { padding-top: 0.5rem !important; }
.pb-0\\.5 { padding-bottom: 0.125rem !important; }
.pb-1 { padding-bottom: 0.25rem !important; }
.pb-1\\.5 { padding-bottom: 0.375rem !important; }
.pb-2 { padding-bottom: 0.5rem !important; }
.pl-2 { padding-left: 0.5rem !important; }
.pl-3 { padding-left: 0.75rem !important; }
.pr-2 { padding-right: 0.5rem !important; }
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
.w-\\[74px\\] { width: 74px !important; }
.h-\\[76px\\] { height: 76px !important; }
.w-\\[76px\\] { width: 76px !important; }
.h-\\[78px\\] { height: 78px !important; }
.w-\\[78px\\] { width: 78px !important; }
.w-\\[40px\\] { width: 40px !important; }
.w-\\[48px\\] { width: 48px !important; }
.w-\\[58px\\] { width: 58px !important; }
.w-\\[62px\\] { width: 62px !important; }
.w-\\[100px\\] { width: 100px !important; }
.w-\\[190px\\] { width: 190px !important; }
.w-\\[230px\\] { width: 230px !important; }
.max-w-\\[260px\\] { max-width: 260px !important; }
.max-h-\\[170px\\] { max-height: 170px !important; }

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
