import React, { useState, useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoice } from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import { StandardInvoiceDocument } from "./StandardInvoiceDocument";
import { triggerPrintWithElement, exportElementToPdf } from "@/lib/pdfExport";

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

async function prepareCustomInvoiceElement(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<HTMLElement | null> {
  onBeforePrint?.();

  flushSync(() => {
    setCustomInvoiceToPrint(invoice);
  });

  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        "#custom-invoice-print-portal img, .custom-invoice-print-root img, .standard-invoice-sheet img"
      )
    );
    await Promise.all(images.map((img) => img.decode().catch(() => undefined)));
  } catch (e) {
    console.warn("Print assets preparation note:", e);
  }

  const el =
    document.getElementById("active-custom-invoice-print") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal .standard-invoice-sheet") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal") ||
    document.querySelector<HTMLElement>(".standard-invoice-sheet");

  return el;
}

export async function printCustomInvoiceDocument(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
) {
  const el = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  const label = INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة";
  const serial = invoice.meta.serial || "001";
  const party = invoice.meta.partyName || "عميل";
  const docTitle = `${label}-${serial}-${party}`;

  document.body.classList.add("printing-custom-invoice");

  triggerPrintWithElement(el, docTitle, "a4", () => {
    document.body.classList.remove("printing-custom-invoice");
  });
}

export async function saveCustomInvoiceAsPdf(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<boolean> {
  const el = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  if (!el) return false;

  const label = INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة";
  const serial = invoice.meta.serial || "001";
  const party = invoice.meta.partyName || "عميل";

  return exportElementToPdf(el, {
    filename: `${label}-${serial}-${party}`,
    format: "a4",
    orientation: "portrait",
  });
}

export function CustomInvoicePrintButton({
  invoice,
  onBeforePrint,
  className,
  size = "default",
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await saveCustomInvoiceAsPdf(invoice, onBeforePrint);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={handleExport}
        disabled={isExporting}
        className="font-bold border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
        title="تصدير وحفظ ملف PDF أصلي في جهازك"
      >
        <FileDown className="h-4 w-4" />
        <span>حفظ PDF أصلي</span>
      </Button>

      <Button
        type="button"
        size={size}
        onClick={() => printCustomInvoiceDocument(invoice, onBeforePrint)}
        className={className || "font-bold shadow-sm gap-1.5"}
        title="طباعة عبر خدمة النظام أو الطابعة"
      >
        <Printer className="h-4 w-4" />
        <span>طباعة</span>
      </Button>
    </div>
  );
}
