/**
 * معالج الطباعة وحفظ الفواتير الأصلي على أندرويد والويب
 * يتيح الطباعة والحفظ المباشر في ملفات الهاتف بصيغة PDF حقيقية وأصلية
 */

import { buildStandaloneInvoiceHtml, exportElementToPdf, triggerPrintWithElement } from "./pdfExport";

export { exportElementToPdf, buildStandaloneInvoiceHtml };

/**
 * دالة طباعة المستند دون ظهور صفحة بيضاء على أندرويد مع ضبط مقاس الورقة بدقة
 */
export function triggerPrintOrSave(
  documentTitle: string,
  onDone?: () => void,
  explicitElement?: HTMLElement | null
) {
  const previousTitle = document.title;
  if (documentTitle) {
    document.title = documentTitle;
  }

  const cleanup = () => {
    document.title = previousTitle;
    onDone?.();
  };

  // محاولة العثور على عنصر الفاتورة المراد طباعته
  const targetElement =
    explicitElement ||
    document.querySelector<HTMLElement>(".invoice-print-root") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal") ||
    document.querySelector<HTMLElement>(".custom-invoice-print-root") ||
    document.querySelector<HTMLElement>(".proforma-print-root") ||
    document.querySelector<HTMLElement>(".invoice-paper") ||
    document.querySelector<HTMLElement>(".standard-invoice-sheet") ||
    document.querySelector<HTMLElement>(".proforma-sheet");

  const isA5 =
    targetElement?.classList.contains("invoice-paper") ||
    targetElement?.querySelector(".invoice-paper") !== null ||
    documentTitle.includes("طلب") ||
    documentTitle.includes("تشغيل");

  triggerPrintWithElement(targetElement, documentTitle, isA5 ? "a5" : "a4", cleanup);
}

/**
 * حفظ الفاتورة مباشرة كملف PDF أصلي وحقيقي (.pdf) على الهاتف أو الكمبيوتر
 */
export async function downloadInvoiceAsFile(filename: string, elementId?: string): Promise<boolean> {
  const el =
    (elementId
      ? document.getElementById(elementId) || document.querySelector<HTMLElement>(`#${elementId}`)
      : null) ||
    document.querySelector<HTMLElement>(".invoice-print-root") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal") ||
    document.querySelector<HTMLElement>(".custom-invoice-print-root") ||
    document.querySelector<HTMLElement>(".proforma-print-root") ||
    document.querySelector<HTMLElement>(".invoice-paper") ||
    document.querySelector<HTMLElement>(".standard-invoice-sheet") ||
    document.querySelector<HTMLElement>(".proforma-sheet");

  if (!el) return false;

  const isA5 =
    el.classList.contains("invoice-paper") ||
    el.querySelector(".invoice-paper") !== null ||
    filename.includes("طلب") ||
    filename.includes("تشغيل");

  return exportElementToPdf(el, {
    filename,
    format: isA5 ? "a5" : "a4",
    orientation: isA5 ? "landscape" : "portrait",
  });
}
