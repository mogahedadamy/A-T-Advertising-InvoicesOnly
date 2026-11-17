import React, { useState } from "react";
import { Printer, FileDown, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoice } from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { formatDisplayReference } from "@/lib/domain/references";
import { triggerPrintWithElement, exportElementToPdf, shareInvoiceViaWhatsApp } from "@/lib/pdfExport";
import { saveCustomInvoice } from "@/lib/billing/store";
import { prepareCustomInvoiceElement } from "./customInvoicePrintEngine";
import { toast } from "sonner";

export {
  CustomInvoicePrintPortal,
  setCustomInvoiceToPrint,
  useCustomInvoiceToPrint,
  prepareCustomInvoiceElement,
} from "./customInvoicePrintEngine";

interface Props {
  invoice: CustomInvoice;
  onBeforePrint?: () => void;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
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
  const isEn =
    detectInvoiceLanguage(
      invoice.meta.language,
      invoice.meta.partyName,
      invoice.meta.partyEnName,
      invoice.items
    ) === "en";
  const label = isEn ? "Pro-invoice" : (INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة");
  const serial = formatDisplayReference(invoice.reference, invoice.meta.serial, invoice.meta.date);
  const party = isEn
    ? (invoice.meta.partyEnName || invoice.meta.partyName || "Client")
    : (invoice.meta.partyName || "عميل");
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
  // الحفظ التلقائي المباشر في النظام لضمان توثيق وأمان البيانات
  try {
    await saveCustomInvoice(invoice);
  } catch (err) {
    console.warn("Auto-save before PDF save note:", err);
  }

  const prep = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  if (!prep || !prep.element) {
    toast.error("تعذر تجهيز مستند الفاتورة لحفظ ملف PDF. يرجى المحاولة ثانية.");
    return false;
  }

  const { element, cleanup } = prep;
  const isEn =
    detectInvoiceLanguage(
      invoice.meta.language,
      invoice.meta.partyName,
      invoice.meta.partyEnName,
      invoice.items
    ) === "en";
  const label = isEn ? "Pro-invoice" : (INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة");
  const serial = formatDisplayReference(invoice.reference, invoice.meta.serial, invoice.meta.date);
  const party = isEn
    ? (invoice.meta.partyEnName || invoice.meta.partyName || "Client")
    : (invoice.meta.partyName || "عميل");

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

export async function shareCustomInvoiceViaWhatsApp(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<boolean> {
  // الحفظ التلقائي المباشر في النظام قبل المشاركة لضمان سلامة وأمان البيانات
  try {
    await saveCustomInvoice(invoice);
  } catch (err) {
    console.warn("Auto-save before WhatsApp share note:", err);
  }

  const prep = await prepareCustomInvoiceElement(invoice, onBeforePrint);
  if (!prep || !prep.element) {
    toast.error("تعذر تجهيز مستند الفاتورة للمشاركة. يرجى المحاولة ثانية.");
    return false;
  }

  const { element, cleanup } = prep;
  const isEn =
    detectInvoiceLanguage(
      invoice.meta.language,
      invoice.meta.partyName,
      invoice.meta.partyEnName,
      invoice.items
    ) === "en";
  const label = isEn ? "Pro-invoice" : (INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة");
  const serial = formatDisplayReference(invoice.reference, invoice.meta.serial, invoice.meta.date);
  const party = isEn
    ? (invoice.meta.partyEnName || invoice.meta.partyName || "Client")
    : (invoice.meta.partyName || "عميل");

  try {
    const success = await shareInvoiceViaWhatsApp(element, {
      filename: `${label}-${serial}-${party}`,
      partyName: party,
      invoiceRef: serial,
      totalAmount: invoice.totalAmount,
      currency: (invoice as any).currency || invoice.meta.currency || "SDG",
      invoiceTypeLabel: label,
      isRtl: !isEn,
    });
    return success;
  } finally {
    cleanup();
  }
}

export function CustomInvoiceWhatsAppButton({
  invoice,
  onBeforePrint,
  className,
  size = "default",
}: Props) {
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      await shareCustomInvoiceViaWhatsApp(invoice, onBeforePrint);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      onClick={handleShare}
      disabled={isSharing}
      className={className || "font-bold shadow-xs bg-[#25D366] hover:bg-[#20bd5a] text-white gap-1.5 h-8 px-2.5 sm:px-3 text-xs rounded-xl cursor-pointer"}
      title="حفظ ومشاركة الفاتورة مباشرة عبر واتساب"
    >
      {isSharing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      <span>{isSharing ? "جاري المشاركة..." : "مشاركة واتساب"}</span>
    </Button>
  );
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
        size={size}
        onClick={handlePrint}
        disabled={isExporting || isPrinting}
        className={className || "font-bold shadow-sm gap-1 sm:gap-1.5 h-8 px-2.5 sm:px-3 text-xs rounded-xl cursor-pointer"}
        title="طباعة عبر خدمة النظام أو الطابعة"
      >
        {isPrinting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        <span>{isPrinting ? "جاري التجهيز..." : "طباعة"}</span>
      </Button>
    </div>
  );
}
