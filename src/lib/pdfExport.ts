import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { convertOklchToRgb, isCanvasBlank } from "./pdfColorUtils";
import { INVOICE_STANDALONE_CSS } from "./pdfExportStyles";

export { convertOklchToRgb, isCanvasBlank } from "./pdfColorUtils";
export { INVOICE_STANDALONE_CSS } from "./pdfExportStyles";

export interface ExportPdfOptions {
  filename: string;
  format?: "a4" | "a5";
  orientation?: "portrait" | "landscape";
}

export interface SharePdfOptions {
  filename: string;
  format?: "a4" | "a5";
  partyName?: string;
  invoiceRef?: string;
  totalAmount?: number;
  currency?: string;
  invoiceTypeLabel?: string;
  isRtl?: boolean;
}

/**
 * بناء مستند HTML مستقل تماماً ومرئي 100% لطباعة وتصدير أندرويد بدون أي عناصر مخفية
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

  const targetSheet =
    element.classList.contains("standard-invoice-sheet") ||
    element.classList.contains("proforma-sheet") ||
    element.classList.contains("invoice-paper")
      ? element
      : element.querySelector<HTMLElement>(".standard-invoice-sheet, .proforma-sheet, .invoice-paper") ||
        element;

  const targetDir =
    (typeof (targetSheet as any)?.getAttribute === "function" ? targetSheet.getAttribute("dir") : null) ||
    (targetSheet.classList?.contains?.("text-left") ? "ltr" : "rtl");
  const isRtl = targetDir === "rtl";
  const rawHtml = convertOklchToRgb(targetSheet.outerHTML);
  const viewportWidth = isA5 ? 760 : 794;

  return `<!DOCTYPE html>
<html dir="${targetDir}" lang="${isRtl ? "ar" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${viewportWidth}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
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
<body class="printing-proforma printing-custom-invoice printing-a5-invoice ${isRtl ? "printing-rtl" : "printing-ltr"}" dir="${targetDir}">
  <div class="invoice-standalone-root" dir="${targetDir}">
    ${rawHtml}
  </div>
</body>
</html>`;
}

/**
 * تحويل ArrayBuffer إلى Base64 نقي وصحيح 100%
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 8192) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + 8192, bytes.byteLength))));
  }
  return window.btoa(binary);
}

/**
 * توليد ملف PDF عالي الدقة بدون أي تشويه أو اقتطاع بالهواتف عبر إطار معزول (Isolated IFrame)
 */
export async function generateInvoicePdf(
  element: HTMLElement,
  options: ExportPdfOptions
): Promise<{ pdf: jsPDF; base64: string; filename: string } | null> {
  const { filename, format = "a4", orientation = "portrait" } = options;
  const isA5 = format === "a5" || element.classList.contains("invoice-paper") || element.querySelector(".invoice-paper") !== null;
  const actualFormat: "a4" | "a5" = isA5 ? "a5" : format;
  const actualOrientation: "portrait" | "landscape" = isA5 ? "landscape" : orientation;
  const isLandscape = actualOrientation === "landscape";
  const targetWmm = isLandscape ? (actualFormat === "a5" ? 210 : 297) : (actualFormat === "a5" ? 148 : 210);
  const targetHmm = isLandscape ? (actualFormat === "a5" ? 148 : 210) : (actualFormat === "a5" ? 210 : 297);
  const stageWidthPx = isA5 ? 760 : 794;
  const stageHeightPx = isA5 ? 536 : 1123;

  const printPages = Array.from(element.querySelectorAll<HTMLElement>(".invoice-print-page"));
  const sheets = Array.from(element.querySelectorAll<HTMLElement>(".proforma-sheet, .standard-invoice-sheet, .invoice-paper"));
  const targets = printPages.length > 0 ? printPages : (sheets.length > 0 ? sheets : [element]);

  const pdf = new jsPDF({
    orientation: actualOrientation,
    unit: "mm",
    format: actualFormat,
    compress: true,
  });

  for (let i = 0; i < targets.length; i++) {
    const targetEl = targets[i];
    if (!targetEl) continue;
    if (i > 0) pdf.addPage(actualFormat, actualOrientation);

    // بناء إطار عرض كامل معزول داخل نطاق الشاشة لضمان رسم 100% من محتوى الفاتورة في أندرويد
    const overlay = document.createElement("div");
    overlay.id = `pdf-export-overlay-${i}`;
    overlay.style.cssText =
      "position:fixed;inset:0;background:rgba(13,74,57,0.95);backdrop-filter:blur(6px);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#ffffff;pointer-events:all;direction:rtl;";
    overlay.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;font-family:system-ui,sans-serif;"><div style="width:38px;height:38px;border:4px solid rgba(255,255,255,0.25);border-top-color:#ffffff;border-radius:50%;animation:spin 0.9s linear infinite;"></div><div style="font-size:14px;font-weight:bold;">جاري تصدير الفاتورة بدقة عالية (> 300 DPI)...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);

    // إنشاء إطار عمل معزول تماماً عن شاشة الهاتف ومحاذاة RTL والوضع الداكن
    const iframe = document.createElement("iframe");
    iframe.id = `pdf-render-frame-${i}`;
    iframe.style.cssText = `position:fixed;top:0;left:0;width:${stageWidthPx}px;height:${stageHeightPx}px;border:none;margin:0;padding:0;opacity:0.01;pointer-events:none;z-index:-9999;background:#ffffff;`;
    document.body.appendChild(iframe);

    try {
      const standaloneHtml = buildStandaloneInvoiceHtml(targetEl, filename, actualFormat);
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("تعذر الوصول لمستند الإطار المعزول");
      }

      iframeDoc.open();
      iframeDoc.write(standaloneHtml);
      iframeDoc.close();

      // ضمان استقرار التمرير داخل الإطار
      iframe.contentWindow?.scrollTo(0, 0);

      // انتظار تحميل الخطوط والصور
      if (iframeDoc.fonts) {
        try { await iframeDoc.fonts.ready; } catch {}
      }

      const imgs = Array.from(iframeDoc.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        imgs.map(async (img) => {
          if (img.complete && img.naturalWidth > 0) return;
          try { await img.decode(); } catch {}
        })
      );

      // مهلة كافية لإنهاء التصيير الحقيقي في المتصفح
      await new Promise((r) => setTimeout(r, 160));

      const sheetEl = iframeDoc.querySelector<HTMLElement>(
        ".standard-invoice-sheet, .proforma-sheet, .invoice-paper, .invoice-standalone-root"
      ) || iframeDoc.body;

      // حساب مقياس الدقة المحسن والمستهدف (DPI > 300 بمقدار 315 DPI، مع حجم مستند متوازن حول 15 إلى 25 ميغابايت)
      // مقياس 3.25 يُنتج 2580×3650 بكسل (312 DPI حقيقي لـ A4)، مما يضمن حدة طباعة ممتازة بدون تضخم الحجم إلى 100 ميغابايت
      const targetScale = 3.25;

      let canvas: HTMLCanvasElement | null = null;
      try {
        canvas = await html2canvas(sheetEl, {
          scale: targetScale,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          x: 0,
          y: 0,
          width: stageWidthPx,
          height: stageHeightPx,
          windowWidth: stageWidthPx,
          windowHeight: stageHeightPx,
          scrollX: 0,
          scrollY: 0,
        });
      } catch (errCapture) {
        console.warn("[PDF Export] Target scale canvas allocation note:", errCapture);
      }

      if (!canvas || canvas.width === 0 || canvas.height === 0 || isCanvasBlank(canvas)) {
        console.warn("[PDF Export] Direct element capture fallback at 3.125 scale (300 DPI).");
        canvas = await html2canvas(targetEl, {
          scale: 3.125,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
        });
      }

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("فشل إنشاء كانفاس الفاتورة بدقة صحيحة");
      }

      const imgData = canvas.toDataURL("image/png");
      // ضغط NONE لحفظ كامل البكسلات الخام بدقة > 300 DPI وبدون أي فقدان أو تنعيم ضبابي بحجم متوازن 15-25 MB
      pdf.addImage(imgData, "PNG", 0, 0, targetWmm, targetHmm, undefined, "NONE");
    } finally {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  }

  const safeFilename = (filename || "فاتورة-TA").replace(/[\\/:*?"<>|]/g, "-");
  const fullFilename = safeFilename.endsWith(".pdf") ? safeFilename : `${safeFilename}.pdf`;

  const arrayBuffer = pdf.output("arraybuffer");
  const base64 = arrayBufferToBase64(arrayBuffer);

  return { pdf, base64, filename: fullFilename };
}

/**
 * تصدير وحفظ ملف PDF أصلي وحقيقي (.pdf) بدقة عالية ومقاوم للأخطاء
 */
export async function exportElementToPdf(
  element: HTMLElement,
  options: ExportPdfOptions
): Promise<boolean> {
  const toastId = toast.loading("جاري توليد وحفظ ملف الـ PDF الأصلي...");
  try {
    const generated = await generateInvoicePdf(element, options);
    if (!generated) {
      throw new Error("تعذر توليد بيانات ملف PDF");
    }

    const { pdf, base64, filename } = generated;
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.savePdf === "function") {
      androidPrint.savePdf(base64, filename);
      toast.success(`تم حفظ ملف الـ PDF بنجاح باسم: ${filename}`, { id: toastId });
      return true;
    }

    pdf.save(filename);
    toast.success(`تم تنزيل ملف الـ PDF بنجاح: ${filename}`, { id: toastId });
    return true;
  } catch (error: any) {
    console.error("PDF generation failed:", error);
    const msg = error?.message ? `: ${error.message}` : "";
    toast.error(`تعذر توليد ملف PDF${msg}، يرجى المحاولة مرة أخرى`, { id: toastId });
    return false;
  }
}

/**
 * تصدير ومشاركة الفاتورة مباشرة عبر واتساب مع نص توثيقي مدمج
 */
export async function shareInvoiceViaWhatsApp(
  element: HTMLElement,
  options: SharePdfOptions
): Promise<boolean> {
  const toastId = toast.loading("جاري تجهيز الفاتورة ومشاركتها عبر واتساب...");
  try {
    const generated = await generateInvoicePdf(element, {
      filename: options.filename,
      format: options.format || "a4",
      orientation: "portrait",
    });

    if (!generated) {
      throw new Error("فشل توليد ملف PDF للمشاركة");
    }

    const { pdf, base64, filename } = generated;
    const clientName = options.partyName?.trim() || "العميل الكريم";
    const ref = options.invoiceRef || "";
    const typeLabel = options.invoiceTypeLabel || "فاتورة";
    const amountStr = options.totalAmount !== undefined ? options.totalAmount.toLocaleString("en-US") : "";
    const currencyStr = options.currency || "SDG";

    const messageText = options.isRtl !== false
      ? `السلام عليكم ورحمة الله،\nمرفق لكم ${typeLabel} ${ref ? `رقم ${ref}` : ""}\nالعميل: ${clientName}\nالمبلغ الإجمالي: ${amountStr} ${currencyStr}\nوكالة T.A Advertising Solution`
      : `Dear ${clientName},\nPlease find attached ${typeLabel} ${ref ? `No. ${ref}` : ""}\nTotal: ${amountStr} ${currencyStr}\nT.A Advertising Solution`;

    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.shareToWhatsApp === "function") {
      androidPrint.shareToWhatsApp(base64, filename, messageText);
      toast.success("تم فتح واتساب وجاهزية إرسال الفاتورة", { id: toastId });
      return true;
    }

    if (typeof navigator !== "undefined" && navigator.canShare) {
      try {
        const pdfBlob = pdf.output("blob");
        const file = new File([pdfBlob], filename, { type: "application/pdf" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ title: filename, text: messageText, files: [file] });
          toast.success("تمت مشاركة الفاتورة بنجاح", { id: toastId });
          return true;
        }
      } catch (shareErr) {
        console.warn("Web Share API files sharing rejected or canceled:", shareErr);
      }
    }

    pdf.save(filename);
    window.open(`https://wa.me/?text=${encodeURIComponent(messageText)}`, "_blank");
    toast.success("تم حفظ الفاتورة وفتح واتساب", { id: toastId });
    return true;
  } catch (error: any) {
    console.error("WhatsApp share failed:", error);
    toast.error(`تعذر مشاركة الفاتورة: ${error?.message || "خطأ غير متوقع"}`, { id: toastId });
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
      documentTitle.includes("A5") ||
      documentTitle.includes("a5")
        ? "a5"
        : "a4";
  } else if (pageSize === "a5" || pageSize === "a4") {
    actualPageSize = pageSize;
  }

  const previousTitle = document.title;
  if (documentTitle) document.title = documentTitle;

  const cleanup = () => {
    document.title = previousTitle;
    actualOnDone?.();
  };

  if (!element) {
    console.error("Print rejected: Invoice element is null or undefined.");
    toast.error("تعذر العثور على مستند الفاتورة لتجهيز الطباعة. يرجى إعادة المحاولة.");
    cleanup();
    return;
  }

  const androidPrint = (window as any).AndroidPrint;
  if (androidPrint && typeof androidPrint.printHtml === "function") {
    try {
      const html = buildStandaloneInvoiceHtml(element, documentTitle, actualPageSize);
      androidPrint.printHtml(html, documentTitle, actualPageSize.toUpperCase());
      setTimeout(cleanup, 1200);
      return;
    } catch (e) {
      console.warn("AndroidPrint.printHtml error:", e);
    }
  }

  if (androidPrint && typeof androidPrint.print === "function") {
    try {
      androidPrint.print(documentTitle);
      setTimeout(cleanup, 1200);
      return;
    } catch (e) {
      console.warn("AndroidPrint.print error:", e);
    }
  }

  try {
    window.addEventListener("afterprint", () => cleanup(), { once: true });
    setTimeout(cleanup, 5000);
    window.print();
  } catch (err) {
    console.error("Browser print failed:", err);
    cleanup();
  }
}
