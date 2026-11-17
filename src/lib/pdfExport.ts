import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "sonner";
import { convertOklchToRgb, isCanvasBlank } from "./pdfColorUtils";
import { INVOICE_STANDALONE_CSS } from "./pdfExportStyles";
import { TA_QR_CODE_BASE64 } from "@/assets/invoiceImagesBase64";

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

const ARABIC_FONT_SAMPLE = "فاتورة مبيعات شركة التقانة عناية السيد مدير المبيعات ١٢٣٤٥";

/**
 * Load the bundled Tajawal font files from the app package.
 * This deliberately has no network fallback: PDF output must be deterministic
 * and offline-capable. A missing/corrupt local font stops export with a clear
 * error instead of silently changing Arabic glyph metrics.
 */
async function waitForInvoiceFonts(doc: Document): Promise<void> {
  if (!doc.fonts) throw new Error("المتصفح لا يدعم التحقق من تحميل الخطوط");

  const weights = [200, 300, 400, 500, 600, 700, 800, 900];
  try {
    const loadedFaces = await Promise.all(
      weights.map((weight) => doc.fonts.load(`${weight} 16px "Tajawal"`, ARABIC_FONT_SAMPLE))
    );
    await doc.fonts.ready;

    const requiredFacesLoaded = loadedFaces.every(
      (faces) => faces.length > 0 && faces.every((face) => face.status === "loaded")
    );
    if (!requiredFacesLoaded || !doc.fonts.check('400 16px "Tajawal"', ARABIC_FONT_SAMPLE)) {
      throw new Error("لم يتم تحميل جميع ملفات Tajawal المحلية");
    }
  } catch (error) {
    console.error("[PDF Export] Local Tajawal font loading failed:", error);
    throw new Error("تعذر تحميل خطوط Tajawal المضمنة داخل التطبيق؛ لم يتم إنشاء فاتورة بخطوط بديلة");
  }
}

/**
 * Correct overly tight line boxes only on elements that contain Arabic text.
 * This prevents diacritics and tall Arabic glyphs from being clipped without
 * changing the geometry of unrelated layout containers.
 */
function stabilizeArabicTextMetrics(doc: Document): void {
  const arabicPattern = /[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF]/;
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue && arabicPattern.test(node.nodeValue)) textNodes.push(node);
  }

  for (const node of textNodes) {
    const element = node.parentElement;
    if (!element) continue;
    const computed = doc.defaultView?.getComputedStyle(element);
    if (!computed) continue;

    const fontSize = Number.parseFloat(computed.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) {
      const lineHeight = computed.lineHeight === "normal"
        ? Number.NaN
        : Number.parseFloat(computed.lineHeight);
      const minimumLineHeight = fontSize * 1.35;
      if (!Number.isFinite(lineHeight) || lineHeight < minimumLineHeight) {
        element.style.setProperty("line-height", `${minimumLineHeight.toFixed(2)}px`, "important");
      }
    }

    element.style.setProperty("font-kerning", "normal");
    element.style.setProperty("font-synthesis", "none");
    element.style.setProperty("font-variant-ligatures", "normal");
    element.style.setProperty("letter-spacing", "normal", "important");
    element.style.setProperty("word-spacing", "normal", "important");
    element.style.setProperty("text-rendering", "auto");
  }
}

/**
 * Returns the image content rectangle produced by object-fit: contain.
 * Coordinates are CSS pixels relative to the image element's border box.
 */
function getContainedImageRect(
  boxWidth: number,
  boxHeight: number,
  naturalWidth: number,
  naturalHeight: number
): { x: number; y: number; width: number; height: number } {
  const ratio = naturalWidth / naturalHeight;
  const boxRatio = boxWidth / boxHeight;
  if (ratio > boxRatio) {
    const width = boxWidth;
    const height = width / ratio;
    return { x: 0, y: (boxHeight - height) / 2, width, height };
  }
  const height = boxHeight;
  const width = height * ratio;
  return { x: (boxWidth - width) / 2, y: 0, width, height };
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
      '<div style="display:flex;flex-direction:column;align-items:center;gap:12px;font-family:system-ui,sans-serif;"><div style="width:38px;height:38px;border:4px solid rgba(255,255,255,0.25);border-top-color:#ffffff;border-radius:50%;animation:spin 0.9s linear infinite;"></div><div style="font-size:14px;font-weight:bold;">جاري تجهيز الفاتورة بدقة 300 DPI مع الحفاظ على QR الأصلي...</div></div><style>@keyframes spin{to{transform:rotate(360deg)}}</style>';
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

      // Arabic font loading is mandatory: never export with fallback metrics.
      await waitForInvoiceFonts(iframeDoc);

      const imgs = Array.from(iframeDoc.querySelectorAll<HTMLImageElement>("img"));
      await Promise.all(
        imgs.map(async (img) => {
          if (img.complete && img.naturalWidth > 0) return;
          try { await img.decode(); } catch {}
        })
      );

      // Stabilize only Arabic text line boxes after the real font faces and images load.
      stabilizeArabicTextMetrics(iframeDoc);

      // Let two layout frames settle after font metric normalization.
      await new Promise<void>((resolve) => requestAnimationFrame(() =>
        requestAnimationFrame(() => resolve())
      ));

      const sheetEl = iframeDoc.querySelector<HTMLElement>(
        ".standard-invoice-sheet, .proforma-sheet, .invoice-paper, .invoice-standalone-root"
      ) || iframeDoc.body;

      // Render the invoice body at a measured 300 DPI. The QR asset is
      // temporarily hidden from this raster pass and embedded separately below.
      const sheetRect = sheetEl.getBoundingClientRect();
      if (sheetRect.width <= 0 || sheetRect.height <= 0) {
        throw new Error("أبعاد صفحة الفاتورة غير صالحة أثناء التصدير");
      }

      const targetPixelWidth = Math.round((targetWmm / 25.4) * 300);
      const targetScale = targetPixelWidth / sheetRect.width;
      const qrImages = Array.from(
        sheetEl.querySelectorAll<HTMLImageElement>('img[alt="QR Code"]')
      );

      const qrPlacements = await Promise.all(qrImages.map(async (img) => {
        try {
          if (!img.complete || img.naturalWidth === 0) await img.decode();
        } catch {
          throw new Error("تعذر تحميل صورة QR الأصلية؛ تم إيقاف التصدير لحماية جودتها");
        }

        const source = img.getAttribute("src");
        if (source !== TA_QR_CODE_BASE64 || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
          throw new Error("مصدر QR في الفاتورة لا يطابق الملف الأصلي المعتمد");
        }

        const imageRect = img.getBoundingClientRect();
        const contained = getContainedImageRect(
          imageRect.width,
          imageRect.height,
          img.naturalWidth,
          img.naturalHeight
        );
        const xCss = imageRect.left - sheetRect.left + contained.x;
        const yCss = imageRect.top - sheetRect.top + contained.y;

        return {
          data: TA_QR_CODE_BASE64,
          x: (xCss / sheetRect.width) * targetWmm,
          y: (yCss / sheetRect.height) * targetHmm,
          width: (contained.width / sheetRect.width) * targetWmm,
          height: (contained.height / sheetRect.height) * targetHmm,
        };
      }));

      let canvas: HTMLCanvasElement | null = null;
      const previousQrVisibility = qrImages.map((img) => img.style.visibility);
      try {
        // visibility preserves the QR element's layout box, so the rest of the
        // invoice keeps exactly the same geometry during rasterization.
        qrImages.forEach((img) => { img.style.visibility = "hidden"; });
        canvas = await html2canvas(sheetEl, {
          scale: targetScale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          x: 0,
          y: 0,
          width: sheetRect.width,
          height: sheetRect.height,
          windowWidth: stageWidthPx,
          windowHeight: stageHeightPx,
          scrollX: 0,
          scrollY: 0,
        });
      } catch (errCapture) {
        console.warn("[PDF Export] 300 DPI capture failed:", errCapture);
        // Never fall back to capturing the QR into a flattened page image.
        if (qrImages.length > 0) {
          throw new Error("فشل تصيير الفاتورة مع حماية QR Code؛ لم يتم إنشاء ملف بجودة QR منخفضة");
        }
      } finally {
        qrImages.forEach((img, index) => {
          img.style.visibility = previousQrVisibility[index];
        });
      }

      if (!canvas || canvas.width === 0 || canvas.height === 0 || isCanvasBlank(canvas)) {
        if (qrImages.length > 0) {
          throw new Error("تعذر إنشاء صورة الفاتورة مع الحفاظ على QR Code الأصلي");
        }
        console.warn("[PDF Export] Retrying invoice capture at measured 300 DPI.");
        canvas = await html2canvas(targetEl, {
          scale: 3.125,
          useCORS: true,
          allowTaint: false,
          backgroundColor: "#ffffff",
          logging: false,
          scrollX: 0,
          scrollY: 0,
        });
      }

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error("فشل إنشاء كانفاس الفاتورة بدقة صحيحة");
      }

      const actualDpiX = (canvas.width / targetWmm) * 25.4;
      const actualDpiY = (canvas.height / targetHmm) * 25.4;
      if (actualDpiX < 295 || actualDpiY < 295) {
        throw new Error(
          `دقة تصدير الفاتورة أقل من المطلوب ( ${Math.round(actualDpiX)} × ${Math.round(actualDpiY)} DPI )`
        );
      }

      const imgData = canvas.toDataURL("image/png");
      // PNG is lossless. FAST controls PDF stream compression, not image quality.
      pdf.addImage(imgData, "PNG", 0, 0, targetWmm, targetHmm, undefined, "FAST");

      // Re-embed the exact approved QR data URI as a separate lossless PNG.
      // It never passes through html2canvas, page downsampling, or JPEG encoding.
      for (const qr of qrPlacements) {
        pdf.addImage(qr.data, "PNG", qr.x, qr.y, qr.width, qr.height, undefined, "NONE");
      }
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
