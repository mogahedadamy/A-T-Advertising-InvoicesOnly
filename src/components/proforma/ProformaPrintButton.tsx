import { useState } from "react";
import { Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commitProformaSerial } from "@/lib/proforma/serial";
import { triggerPrintWithElement, exportElementToPdf } from "@/lib/pdfExport";
import { toast } from "sonner";

interface Props {
  serial: string;
  onBeforePrint?: () => void;
  className?: string;
}

export function ProformaPrintButton({
  serial,
  onBeforePrint,
  className,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const prepareProformaElement = async () => {
    onBeforePrint?.();
    try {
      if (document.fonts) {
        await document.fonts.ready;
      }
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".proforma-print-root img, .proforma-sheet img")
      );
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    } catch {}

    commitProformaSerial(serial);

    const el =
      document.querySelector<HTMLElement>(".proforma-sheet") ||
      document.querySelector<HTMLElement>("#proforma-document") ||
      document.querySelector<HTMLElement>(".proforma-print-root .proforma-sheet") ||
      document.querySelector<HTMLElement>(".proforma-print-root");

    const sheet =
      el && el.classList.contains("proforma-sheet")
        ? el
        : el?.querySelector<HTMLElement>(".proforma-sheet") || el;

    return sheet;
  };

  const handlePrint = async () => {
    const el = await prepareProformaElement();

    let styleEl = document.getElementById("proforma-dynamic-a4-page");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "proforma-dynamic-a4-page";
      styleEl.innerHTML = `
        @page {
          size: 210mm 297mm !important;
          margin: 0mm !important;
        }
        @page :left { margin: 0mm !important; }
        @page :right { margin: 0mm !important; }
      `;
      document.head.appendChild(styleEl);
    }

    document.body.classList.add("printing-proforma");
    triggerPrintWithElement(el, `فاتورة-مبدئية-TA-${serial}`, "a4", () => {
      document.body.classList.remove("printing-proforma");
      const dynamicStyle = document.getElementById("proforma-dynamic-a4-page");
      if (dynamicStyle) dynamicStyle.remove();
    });
  };

  const handleExportPdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const el = await prepareProformaElement();
      if (!el) {
        toast.error("تعذر العثور على مستند الفاتورة لحفظ ملف PDF");
        return;
      }
      await exportElementToPdf(el, {
        filename: `فاتورة-مبدئية-TA-${serial}`,
        format: "a4",
        orientation: "portrait",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <Button
        type="button"
        variant="outline"
        onClick={handleExportPdf}
        disabled={isExporting}
        className="h-9 rounded-xl gap-1.5 font-bold shadow-xs text-xs border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
        title="تصدير وحفظ ملف PDF أصلي في جهازك"
      >
        <FileDown className="h-4 w-4" />
        <span>حفظ PDF أصلي</span>
      </Button>

      <Button
        type="button"
        onClick={handlePrint}
        className={className || "h-9 rounded-xl gap-1.5 font-black shadow-sm text-xs bg-blue-600 hover:bg-blue-700 text-white"}
        title="طباعة عبر الطابعة أو خدمة النظام"
      >
        <Printer className="h-4 w-4" />
        <span>طباعة</span>
      </Button>
    </div>
  );
}
