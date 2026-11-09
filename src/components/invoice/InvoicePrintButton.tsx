import { Printer, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commitSerial } from "@/lib/invoice/serial";
import { triggerPrintWithElement, exportElementToPdf } from "@/lib/pdfExport";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  serial: string;
  onBeforePrint?: () => void;
  className?: string;
}

export function InvoicePrintButton({
  serial,
  onBeforePrint,
  className,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const preparePrintElement = async () => {
    onBeforePrint?.();
    try {
      await document.fonts.ready;
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(".invoice-print-root img, .invoice-paper img")
      );
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    } catch {}

    commitSerial(serial);

    const el =
      document.querySelector<HTMLElement>(".invoice-print-root") ||
      document.querySelector<HTMLElement>(".invoice-paper");
    return el;
  };

  const handlePrint = async () => {
    const el = await preparePrintElement();
    document.body.classList.add("printing-a5-invoice");
    triggerPrintWithElement(el, `فاتورة-TA-${serial}`, "a5", () => {
      document.body.classList.remove("printing-a5-invoice");
    });
  };

  const handleSavePdf = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const el = await preparePrintElement();
      if (!el) {
        toast.error("تعذر العثور على مستند الفاتورة لحفظ ملف PDF");
        return;
      }
      await exportElementToPdf(el, {
        filename: `فاتورة-TA-${serial}`,
        format: "a5",
        orientation: "landscape",
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
        onClick={handleSavePdf}
        disabled={isExporting}
        className="h-9 rounded-xl gap-1.5 font-bold shadow-xs text-xs border-primary/40 text-primary hover:bg-primary/10"
        title="تصدير وحفظ ملف PDF أصلي في جهازك"
      >
        <FileDown className="h-4 w-4" />
        <span>حفظ PDF أصلي</span>
      </Button>

      <Button
        type="button"
        onClick={handlePrint}
        className={className || "h-9 rounded-xl gap-1.5 font-black shadow-sm text-xs bg-primary hover:bg-primary/90 text-white"}
        title="طباعة عبر الطابعة أو خدمة طباعة النظام"
      >
        <Printer className="h-4 w-4" />
        <span>طباعة</span>
      </Button>
    </div>
  );
}