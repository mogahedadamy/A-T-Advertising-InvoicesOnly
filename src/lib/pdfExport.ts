import type jsPDF from "jspdf";
import { toast } from "sonner";
import { convertOklchToRgb, isCanvasBlank } from "./pdfColorUtils";
import { INVOICE_STANDALONE_CSS } from "./pdfExportStyles";
import { escapeHtml, isSafeUrl, sanitizeDir } from "./security/htmlEscape";

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
    element.classList.contains("official-letter-sheet") ||
    element.classList.contains("standard-invoice-sheet") ||
    element.classList.contains("proforma-sheet") ||
    element.classList.contains("invoice-paper") ||
    element.classList.contains("statement-print-root") ||
    element.classList.contains("statement-print-document")
      ? element
      : element.querySelector<HTMLElement>(
          ".official-letter-sheet, .standard-invoice-sheet, .proforma-sheet, .invoice-paper, .statement-print-root, .statement-print-document"
        ) || element;

  const rawDir =
    (typeof targetSheet?.getAttribute === "function" ? targetSheet.getAttribute("dir") : null) ||
    (targetSheet.classList?.contains?.("text-left") ? "ltr" : "rtl");
  const targetDir = sanitizeDir(rawDir);
  const isRtl = targetDir === "rtl";
  const rawHtml = convertOklchToRgb(targetSheet.outerHTML);
  const viewportWidth = isA5 ? 760 : 794;
  const safeTitle = escapeHtml(title);

  return `<!DOCTYPE html>
<html dir="${targetDir}" lang="${isRtl ? "ar" : "en"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=${viewportWidth}, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeTitle}</title>
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
  const sheets = Array.from(element.querySelectorAll<HTMLElement>(".official-letter-sheet, .proforma-sheet, .standard-invoice-sheet, .invoice-paper"));
  const targets = printPages.length > 0 ? printPages : (sheets.length > 0 ? sheets : [element]);

  const [{ default: html2canvas }, { default: JsPdfCtor }, { TA_QR_CODE_BASE64 }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
    import("@/assets/invoiceImagesBase64"),
  ]);

  const pdf = new JsPdfCtor({
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

    // إنشاء إطار عمل معزول تماماً عن شاشة الهاتف ومحاذاة RTL والوضع الداكن (بدون تشغيل سكربتات)
    const iframe = document.createElement("iframe");
    iframe.id = `pdf-render-frame-${i}`;
    iframe.setAttribute("sandbox", "allow-same-origin");
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
        ".official-letter-sheet, .standard-invoice-sheet, .proforma-sheet, .invoice-paper, .invoice-standalone-root"
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
    const androidPrint = window.AndroidPrint;
    if (androidPrint && typeof androidPrint.saveHtmlAsPdf === "function") {
      const actualFormat: "a4" | "a5" =
        options.format === "a5" ||
        element.classList.contains("invoice-paper") ||
        element.querySelector(".invoice-paper") !== null
          ? "a5"
          : "a4";
      const safeName = (options.filename || "فاتورة-TA").replace(/[\\/:*?"<>|]/g, "-");
      const fullFilename = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;
      const standaloneHtml = buildStandaloneInvoiceHtml(element, fullFilename, actualFormat);
      androidPrint.saveHtmlAsPdf(standaloneHtml, fullFilename, actualFormat.toUpperCase());
      toast.success(`تم حفظ ملف الـ PDF الأصلي بنجاح: ${fullFilename}`, { id: toastId });
      return true;
    }

    const generated = await generateInvoicePdf(element, options);
    if (!generated) {
      throw new Error("تعذر توليد بيانات ملف PDF");
    }

    const { pdf, base64, filename } = generated;
    if (androidPrint && typeof androidPrint.savePdf === "function") {
      androidPrint.savePdf(base64, filename);
      toast.success(`تم حفظ ملف الـ PDF بنجاح باسم: ${filename}`, { id: toastId });
      return true;
    }

    pdf.save(filename);
    toast.success(`تم تنزيل ملف الـ PDF بنجاح: ${filename}`, { id: toastId });
    return true;
  } catch (error: unknown) {
    console.error("PDF generation failed:", error);
    const errMsg = error instanceof Error ? error.message : "";
    const msg = errMsg ? `: ${errMsg}` : "";
    toast.error(`تعذر توليد ملف PDF${msg}، يرجى المحاولة مرة أخرى`, { id: toastId });
    return false;
  }
}

/**
 * نافذة تفاعلية (HUD) متقدمة لعرض حالة ومراحل تصدير ومشاركة الفاتورة للمستخدم
 */
function showShareProgressHud(options: { ref?: string; partyName?: string }) {
  const existing = document.getElementById("share-invoice-hud-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "share-invoice-hud-overlay";
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(10, 25, 20, 0.78);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    direction: rtl;
    font-family: system-ui, -apple-system, sans-serif;
    animation: hud-fade-in 0.2s ease-out;
  `;

  const partyDisplay = escapeHtml(options.partyName || "العميل الكريم");
  const refDisplay = escapeHtml(options.ref || "معياري");

  overlay.innerHTML = `
    <div style="
      background: #ffffff;
      color: #0f172a;
      width: 100%;
      max-width: 400px;
      border-radius: 24px;
      padding: 24px 20px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(37, 211, 102, 0.3);
      text-align: right;
    ">
      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 20px;">
        <div style="
          width: 48px;
          height: 48px;
          border-radius: 16px;
          background: #25D366;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);
        ">
          <svg style="width: 28px; height: 28px; fill: white;" viewBox="0 0 24 24">
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 16.5px; font-weight: 800; color: #0f172a;">مشاركة الفاتورة عبر واتساب</h3>
          <p style="margin: 3px 0 0; font-size: 12px; color: #64748b;">
            العميل: <strong style="color: #0f172a;">${partyDisplay}</strong> • رقم: <strong style="color: #0f172a;">${refDisplay}</strong>
          </p>
        </div>
      </div>

      <!-- Step items -->
      <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
        <div id="hud-step-1" style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #16a34a;">
          <span style="width: 22px; height: 22px; border-radius: 50%; background: #dcfce7; color: #16a34a; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold;">✓</span>
          <span>تدقيق واكتمال بيانات الفاتورة</span>
        </div>

        <div id="hud-step-2" style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #0284c7;">
          <span id="hud-icon-2" style="width: 22px; height: 22px; border-radius: 50%; background: #e0f2fe; color: #0284c7; display: flex; align-items: center; justify-content: center;">
            <div style="width: 12px; height: 12px; border: 2px solid #0284c7; border-top-color: transparent; border-radius: 50%; animation: hud-spin 0.7s linear infinite;"></div>
          </span>
          <span id="hud-label-2">إنشاء وتصيير مستند PDF عالي الدقة (300 DPI)...</span>
        </div>

        <div id="hud-step-3" style="display: flex; align-items: center; gap: 10px; font-size: 13px; font-weight: 600; color: #94a3b8;">
          <span id="hud-icon-3" style="width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; color: #94a3b8; display: flex; align-items: center; justify-content: center; font-size: 11px;">3</span>
          <span id="hud-label-3">إطلاق ملف الفاتورة وفتح تطبيق واتساب</span>
        </div>
      </div>

      <!-- Progress bar -->
      <div style="height: 6px; width: 100%; background: #f1f5f9; border-radius: 999px; overflow: hidden; margin-bottom: 12px;">
        <div id="hud-progress-bar" style="height: 100%; width: 40%; background: linear-gradient(90deg, #25D366, #10b981); border-radius: 999px; transition: width 0.3s ease;"></div>
      </div>

      <!-- Footer with Timer & Status Text -->
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: #64748b;">
        <span id="hud-status-msg">جاري المعالجة، لحظات من فضلك...</span>
        <span id="hud-timer" style="font-family: monospace; font-weight: bold; background: #f8fafc; padding: 2px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">01s</span>
      </div>
    </div>
    <style>
      @keyframes hud-spin { to { transform: rotate(360deg); } }
      @keyframes hud-fade-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    </style>
  `;

  document.body.appendChild(overlay);

  let seconds = 1;
  const timerInterval = setInterval(() => {
    seconds++;
    const timerEl = document.getElementById("hud-timer");
    if (timerEl) {
      timerEl.textContent = `${seconds < 10 ? "0" + seconds : seconds}s`;
    }
  }, 1000);

  return {
    setStagePdfDone: () => {
      const step2Icon = document.getElementById("hud-icon-2");
      const step2Label = document.getElementById("hud-label-2");
      const step3 = document.getElementById("hud-step-3");
      const step3Icon = document.getElementById("hud-icon-3");
      const step3Label = document.getElementById("hud-label-3");
      const pBar = document.getElementById("hud-progress-bar");
      const msg = document.getElementById("hud-status-msg");

      if (step2Icon) {
        step2Icon.style.background = "#dcfce7";
        step2Icon.style.color = "#16a34a";
        step2Icon.innerHTML = "✓";
      }
      if (step2Label) step2Label.textContent = "تم تصيير الفاتورة بجودة 300 DPI مع QR أصلي";
      if (step3) step3.style.color = "#0284c7";
      if (step3Icon) {
        step3Icon.style.background = "#e0f2fe";
        step3Icon.innerHTML = '<div style="width: 12px; height: 12px; border: 2px solid #0284c7; border-top-color: transparent; border-radius: 50%; animation: hud-spin 0.7s linear infinite;"></div>';
      }
      if (step3Label) step3Label.textContent = "جاري فتح تطبيق واتساب الآن...";
      if (pBar) pBar.style.width = "85%";
      if (msg) msg.textContent = "تم تجهيز المستند، جاري تشغيل واتساب...";
    },
    setSuccess: (customMsg?: string) => {
      clearInterval(timerInterval);
      const step3 = document.getElementById("hud-step-3");
      const step3Icon = document.getElementById("hud-icon-3");
      const step3Label = document.getElementById("hud-label-3");
      const pBar = document.getElementById("hud-progress-bar");
      const msg = document.getElementById("hud-status-msg");

      if (step3) step3.style.color = "#16a34a";
      if (step3Icon) {
        step3Icon.style.background = "#dcfce7";
        step3Icon.style.color = "#16a34a";
        step3Icon.innerHTML = "✓";
      }
      if (step3Label) step3Label.textContent = "تم إطلاق الفاتورة بنجاح!";
      if (pBar) pBar.style.width = "100%";
      if (msg) msg.textContent = customMsg || "تم فتح تطبيق واتساب بنجاح. جاهز للإرسال!";

      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 1500);
    },
    setError: (errorMsg: string, fallbackUrl?: string) => {
      clearInterval(timerInterval);
      const msg = document.getElementById("hud-status-msg");
      if (msg) {
        const safeErrorMsg = escapeHtml(errorMsg);
        const safeFallbackLink =
          fallbackUrl && isSafeUrl(fallbackUrl)
            ? `<a href="${escapeHtml(fallbackUrl)}" target="_blank" rel="noopener noreferrer" style="background: #25D366; color: white; padding: 6px 12px; border-radius: 8px; text-decoration: none; font-weight: bold;">فتح واتساب ويب</a>`
            : "";
        msg.innerHTML = `
          <div style="color: #ef4444; font-weight: bold; margin-top: 8px;">
            ⚠️ ${safeErrorMsg}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 12px;">
            ${safeFallbackLink}
            <button id="hud-close-btn" type="button" style="background: #e2e8f0; color: #334155; padding: 6px 12px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer;">إغلاق</button>
          </div>
        `;
        const closeBtn = msg.querySelector<HTMLButtonElement>("#hud-close-btn");
        closeBtn?.addEventListener("click", () => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        });
      }
    },
    close: () => {
      clearInterval(timerInterval);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  };
}

/**
 * تصدير ومشاركة الفاتورة مباشرة عبر واتساب مع نص توثيقي مدمج وواجهة تقدم متقدمة
 */
export async function shareInvoiceViaWhatsApp(
  element: HTMLElement,
  options: SharePdfOptions
): Promise<boolean> {
  const clientName = options.partyName?.trim() || "العميل الكريم";
  const ref = options.invoiceRef || "";
  const typeLabel = options.invoiceTypeLabel || "فاتورة";
  const amountStr = options.totalAmount !== undefined ? options.totalAmount.toLocaleString("en-US") : "";
  const currencyStr = options.currency || "SDG";
  const amountLineAr = options.totalAmount !== undefined ? `\nالمبلغ الإجمالي: ${amountStr} ${currencyStr}` : "";
  const amountLineEn = options.totalAmount !== undefined ? `\nTotal: ${amountStr} ${currencyStr}` : "";
  const messageText = options.isRtl !== false
    ? `السلام عليكم ورحمة الله،\nمرفق لكم ${typeLabel} ${ref ? `رقم ${ref}` : ""}\nالجهة: ${clientName}${amountLineAr}\nوكالة T.A Advertising Solution`
    : `Dear ${clientName},\nPlease find attached ${typeLabel} ${ref ? `No. ${ref}` : ""}${amountLineEn}\nT.A Advertising Solution`;

  const actualFormat = options.format || "a4";
  const filename = options.filename || `فاتورة-TA-${ref || Date.now()}`;

  const hud = showShareProgressHud({ ref, partyName: clientName });

  try {
    if (!element) throw new Error("تعذر العثور على مستند الفاتورة لتجهيزه للمشاركة");

    // المسار الأصلي المباشر على أندرويد: تصدير Vector PDF مباشر من Chromium WebView بدون أي إزاحة للخطوط أو ضغط للباركود
    const androidPrint = window.AndroidPrint;
    if (androidPrint && typeof androidPrint.shareHtmlToWhatsApp === "function") {
      const safeFilename = filename.replace(/[\\/:*?"<>|]/g, "-");
      const fullFilename = safeFilename.endsWith(".pdf") ? safeFilename : `${safeFilename}.pdf`;
      const standaloneHtml = buildStandaloneInvoiceHtml(element, fullFilename, actualFormat);

      return await new Promise<boolean>((resolve) => {
        let settled = false;
        const previousHandler = window.__onInvoiceShared;
        const finish = (success: boolean, msg?: string) => {
          if (settled) return;
          settled = true;
          window.__onInvoiceShared = previousHandler;
          if (success) {
            hud.setStagePdfDone();
            hud.setSuccess(msg || "تم تجهيز الملف الأصلي وفتح واتساب بنجاح!");
            resolve(true);
          } else {
            hud.setError(msg || "تعذر تجهيز المستند للمشاركة");
            resolve(false);
          }
        };

        window.__onInvoiceShared = (success: boolean, msg: string) => finish(success, msg);
        androidPrint.shareHtmlToWhatsApp!(
          standaloneHtml,
          fullFilename,
          actualFormat.toUpperCase(),
          messageText
        );

        setTimeout(() => {
          finish(true, "تم إرسال الملف إلى واتساب");
        }, 3500);
      });
    }

    // 1. توليد ملف PDF عالي الدقة (300 DPI) لمتصفحات الويب مع الحفاظ على رمز QR الأصلي بدون ضغط
    const generated = await generateInvoicePdf(element, {
      filename,
      format: actualFormat,
      orientation: "portrait",
    });

    if (!generated) {
      throw new Error("فشل إنشاء ملف PDF عالي الدقة للفاتورة");
    }

    hud.setStagePdfDone();

    // 2. إطلاق الفاتورة إلى واتساب مباشرة عبر AndroidPrint (مسار احتياطي للإصدارات الأقدم)
    if (androidPrint && typeof androidPrint.shareToWhatsApp === "function") {
      let responded = false;
      const previousHandler = window.__onInvoiceShared;
      window.__onInvoiceShared = (success: boolean, msg: string) => {
        responded = true;
        window.__onInvoiceShared = previousHandler;
        if (success) {
          hud.setSuccess(msg);
        } else {
          hud.setError(msg || "تعذر فتح تطبيق واتساب");
        }
      };

      androidPrint.shareToWhatsApp(generated.base64, generated.filename, messageText);

      // في حال فتح تطبيق واتساب مباشرة دون انتظار
      setTimeout(() => {
        if (!responded) {
          window.__onInvoiceShared = previousHandler;
          hud.setSuccess();
        }
      }, 1500);

      return true;
    }

    // 3. متصفح الويب (Web Share API)
    if (typeof navigator !== "undefined" && navigator.canShare) {
      const file = new File([generated.pdf.output("blob")], generated.filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ title: generated.filename, text: messageText, files: [file] });
        hud.setSuccess();
        return true;
      }
    }

    // 4. فتح رابط واتساب ويب كخيار بديل
    const waWebUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    window.open(waWebUrl, "_blank", "noopener,noreferrer");
    hud.setSuccess("تم فتح واتساب لمشاركة نص الفاتورة");
    return true;
  } catch (error: unknown) {
    console.error("WhatsApp share failed:", error);
    const errMsg = error instanceof Error ? error.message : "";
    const waWebUrl = `https://wa.me/?text=${encodeURIComponent(messageText)}`;
    hud.setError(errMsg || "تعذر إكمال عملية المشاركة", waWebUrl);
    toast.error(`تعذر مشاركة الفاتورة: ${errMsg || "خطأ غير متوقع"}`);
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
): void {
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

  const androidPrint = window.AndroidPrint;
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
