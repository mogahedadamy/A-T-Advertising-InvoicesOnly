import React, { useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Printer, FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoice } from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import { StandardInvoiceDocument } from "./StandardInvoiceDocument";
import { triggerPrintWithElement, exportElementToPdf } from "@/lib/pdfExport";
import { toast } from "sonner";

// مخزن تفاعلي بسيط لحفظ الفاتورة النشطة الجاهزة للطباعة
let currentPrintInvoice: CustomInvoice | null = null;
const listeners = new Set<() => void>();

export function setCustomInvoiceToPrint(invoice: CustomInvoice | null) {
  currentPrintInvoice = invoice;
  listeners.forEach((fn) => fn());
}

export function useCustomInvoiceToPrint(): CustomInvoice | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => currentPrintInvoice,
    () => null
  );
}

/**
 * بورتال الطباعة المعزول: يقوم بتركيب ورقة الفاتورة كابن لـ <body>
 */
export function CustomInvoicePrintPortal() {
  const invoice = useCustomInvoiceToPrint();
  if (!invoice || typeof document === "undefined") return null;

  return createPortal(
    <div
      id="custom-invoice-print-portal"
      className="custom-invoice-print-root"
      dir="rtl"
    >
      <StandardInvoiceDocument
        invoice={invoice}
        id="active-custom-invoice-print"
        isPrintMode={true}
      />
    </div>,
    document.body
  );
}

interface Props {
  invoice: CustomInvoice;
  onBeforePrint?: () => void;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export interface PreparedPrintResult {
  element: HTMLElement;
  cleanup: () => void;
}

/**
 * محضر المستند الكنسي الموحد للفاتورة:
 * يضمن 100% الحصول على عنصر الفاتورة الحقيقي جاهزاً للطباعة أو التصدير
 * حتى لو كانت النافذة في وضع التعديل (Edit Tab) أو غير معروضة في الصفحة
 */
export async function prepareCustomInvoiceElement(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<PreparedPrintResult | null> {
  onBeforePrint?.();

  // 1. محاولة التحديث المتزامن عبر بورتال الطباعة
  try {
    flushSync(() => {
      setCustomInvoiceToPrint(invoice);
    });
  } catch {
    setCustomInvoiceToPrint(invoice);
  }

  // إعطاء مهلة إطار شاشة للتأكد من اكتمال تركيب العناصر في الـ DOM
  await new Promise((r) => setTimeout(r, 60));

  let el =
    document.getElementById("active-custom-invoice-print") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal .standard-invoice-sheet") ||
    document.querySelector<HTMLElement>(".standard-invoice-sheet");

  let cleanup = () => {};

  // 2. إذا لم يتوفر العنصر في الـ DOM (مثلاً في تبويب التعديل أو صفحة أخرى)، نبنيه مستقلاً وفورياً
  if (!el && typeof document !== "undefined") {
    const staging = document.createElement("div");
    staging.id = "canonical-invoice-staging-temp";
    staging.setAttribute("dir", "rtl");
    staging.style.position = "fixed";
    staging.style.top = "0";
    staging.style.left = "-99999px";
    staging.style.width = "794px";
    staging.style.height = "1123px";
    staging.style.zIndex = "-9999";
    staging.style.backgroundColor = "#ffffff";
    document.body.appendChild(staging);

    const root = createRoot(staging);
    flushSync(() => {
      root.render(
        <StandardInvoiceDocument
          invoice={invoice}
          id="active-custom-invoice-print"
          isPrintMode={true}
        />
      );
    });

    await new Promise((r) => setTimeout(r, 80));

    el =
      staging.querySelector<HTMLElement>(".standard-invoice-sheet") ||
      (staging.firstElementChild as HTMLElement) ||
      staging;

    cleanup = () => {
      try {
        root.unmount();
        if (staging.parentNode) {
          staging.parentNode.removeChild(staging);
        }
      } catch {}
    };
  }

  if (!el) {
    return null;
  }

  // 3. انتظار اكتمال تحميل الخطوط والصور
  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    const images = Array.from(el.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return img.decode().catch(() => undefined);
      })
    );
  } catch (e) {
    console.warn("Print assets preparation note:", e);
  }

  return { element: el, cleanup };
}

export async function printCustomInvoiceDocument(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<boolean> {
  const prep = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  if (!prep || !prep.element) {
    toast.error("تعذر تجهيز مستند الفاتورة للطباعة. يرجى إعادة المحاولة.");
    return false;
  }

  const { element, cleanup } = prep;
  const label = INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة";
  const serial = invoice.meta.serial || "001";
  const party = invoice.meta.partyName || "عميل";
  const docTitle = `${label}-${serial}-${party}`;

  document.body.classList.add("printing-custom-invoice");

  triggerPrintWithElement(element, docTitle, "a4", () => {
    document.body.classList.remove("printing-custom-invoice");
    cleanup();
  });

  return true;
}

export async function saveCustomInvoiceAsPdf(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<boolean> {
  const prep = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  if (!prep || !prep.element) {
    toast.error("تعذر تجهيز مستند الفاتورة لحفظ ملف PDF. يرجى المحاولة ثانية.");
    return false;
  }

  const { element, cleanup } = prep;
  const label = INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة";
  const serial = invoice.meta.serial || "001";
  const party = invoice.meta.partyName || "عميل";

  try {
    const success = await exportElementToPdf(element, {
      filename: `${label}-${serial}-${party}`,
      format: "a4",
      orientation: "portrait",
    });
    return success;
  } finally {
    cleanup();
  }
}

export function CustomInvoicePrintButton({
  invoice,
  onBeforePrint,
  className,
  size = "default",
}: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  const handleExport = async () => {
    if (isExporting || isPrinting) return;
    setIsExporting(true);
    try {
      await saveCustomInvoiceAsPdf(invoice, onBeforePrint);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = async () => {
    if (isExporting || isPrinting) return;
    setIsPrinting(true);
    try {
      await printCustomInvoiceDocument(invoice, onBeforePrint);
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleExport}
        disabled={isExporting || isPrinting}
        className="font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
        title="تصدير وحفظ ملف PDF أصلي في جهازك"
      >
        {isExporting ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        <span>{isExporting ? "جاري الحفظ..." : "حفظ PDF أصلي"}</span>
      </Button>

      <Button
        type="button"
        size={size}
        onClick={handlePrint}
        disabled={isExporting || isPrinting}
        className={className || "font-bold shadow-sm gap-1.5"}
        title="طباعة عبر خدمة النظام أو الطابعة"
      >
        {isPrinting ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        <span>{isPrinting ? "جاري التجهيز..." : "طباعة"}</span>
      </Button>
    </div>
  );
}
