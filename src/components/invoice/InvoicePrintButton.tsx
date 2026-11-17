import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commitSerial } from "@/lib/invoice/serial";
import { triggerPrintWithElement } from "@/lib/pdfExport";


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
      document.querySelector<HTMLElement>(".invoice-paper") ||
      document.querySelector<HTMLElement>(".invoice-print-root .invoice-paper") ||
      document.querySelector<HTMLElement>(".invoice-print-root");

    const paper =
      el && el.classList.contains("invoice-paper")
        ? el
        : el?.querySelector<HTMLElement>(".invoice-paper") || el;

    return paper;
  };

  const handlePrint = async () => {
    const el = await preparePrintElement();
    document.body.classList.add("printing-a5-invoice");
    triggerPrintWithElement(el, `فاتورة-TA-${serial}`, "a5", () => {
      document.body.classList.remove("printing-a5-invoice");
    });
  };



  return (
    <div className="flex items-center gap-1.5">
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