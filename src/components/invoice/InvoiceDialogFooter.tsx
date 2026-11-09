import React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoicePrintButton } from "./InvoicePrintButton";

interface InvoiceDialogFooterProps {
  tab: "edit" | "preview";
  setTab: (tab: "edit" | "preview") => void;
  saved: boolean;
  serial: string;
  onRecord: () => void;
  onClose: () => void;
}

/**
 * شريط تذييل نافذة الفاتورة
 * يقع في نطاق إبهام اليد (Thumb-Zone) ويحتوي على أزرار الحفظ والطباعة ومعاينة الهاتف
 */
export const InvoiceDialogFooter: React.FC<InvoiceDialogFooterProps> = ({
  tab,
  setTab,
  saved,
  serial,
  onRecord,
  onClose,
}) => {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/80 p-2.5 bg-card" dir="rtl">
      {/* أزرار الحفظ والطباعة الأساسية - في البداية (اليمين) */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          onClick={onRecord}
          disabled={saved}
          className="h-9 rounded-xl px-3 text-xs font-bold touch-manipulation cursor-pointer"
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          <span>{saved ? "تم الحفظ" : "حفظ في السجل"}</span>
        </Button>

        <InvoicePrintButton serial={serial} onBeforePrint={onRecord} />
      </div>

      {/* إجراءات العرض والتبديل والإغلاق - في النهاية (اليسار) */}
      <div className="flex items-center gap-1.5">
        {/* زر التبديل السريع لشاشات الهواتف فقط */}
        <Button
          variant="secondary"
          onClick={() => setTab(tab === "edit" ? "preview" : "edit")}
          className="h-9 px-3 rounded-xl text-xs font-bold md:hidden touch-manipulation cursor-pointer"
        >
          {tab === "edit" ? "عرض المعاينة" : "تعديل البيانات"}
        </Button>

        {/* زر الإغلاق */}
        <Button
          variant="ghost"
          onClick={onClose}
          className="h-9 px-3 text-xs font-bold text-muted-foreground hover:text-foreground cursor-pointer"
        >
          إغلاق
        </Button>
      </div>
    </footer>
  );
};
