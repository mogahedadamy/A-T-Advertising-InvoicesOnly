import React from "react";
import { DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Save, ArrowLeftRight, Share2 } from "lucide-react";
import type { CustomInvoiceType } from "@/lib/billing/types";

interface Props {
  type: CustomInvoiceType;
  isProcessing: boolean;
  onSave: () => void;
  onSaveAndPrint: () => void;
  onSaveAndShareWhatsApp?: () => void;
  onConvertToSales?: () => void;
  onClose: () => void;
}

export function CustomInvoiceDialogFooter({
  type,
  isProcessing,
  onSave,
  onSaveAndPrint,
  onSaveAndShareWhatsApp,
  onConvertToSales,
  onClose,
}: Props) {
  return (
    <DialogFooter className="px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-3 border-t border-border/60 flex flex-row items-center justify-between shrink-0 bg-card">
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* زر مشاركة وحفظ عبر واتساب مباشرة */}
        {onSaveAndShareWhatsApp && (
          <Button
            type="button"
            onClick={onSaveAndShareWhatsApp}
            disabled={isProcessing}
            className="h-9 px-3 sm:px-3.5 rounded-xl font-black text-xs gap-1.5 bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xs shadow-[#25D366]/30 cursor-pointer active:scale-95 transition-transform"
            title="حفظ الفاتورة في النظام تلقائياً ومشاركتها مباشرة عبر واتساب"
          >
            <Share2 className="h-4 w-4" />
            <span className="hidden sm:inline">مشاركة واتساب</span>
            <span className="sm:hidden">واتساب</span>
          </Button>
        )}



        {/* زر الحفظ والطباعة المباشرة */}
        <Button
          type="button"
          variant="outline"
          onClick={onSaveAndPrint}
          disabled={isProcessing}
          className="h-9 px-3 sm:px-3.5 rounded-xl font-black text-xs gap-1.5 border-primary/30 hover:bg-primary/5 text-primary cursor-pointer active:scale-95 transition-transform"
          title="حفظ الفاتورة وتشغيل الطابعة أو خدمة طباعة النظام فوراً"
        >
          <Printer className="h-4 w-4" />
          <span className="hidden sm:inline">
            {isProcessing ? "جاري التجهيز..." : "طباعة فورية"}
          </span>
          <span className="sm:hidden">
            {isProcessing ? "..." : "طباعة"}
          </span>
        </Button>

        {type === "proforma" && onConvertToSales && (
          <Button
            type="button"
            variant="outline"
            onClick={onConvertToSales}
            disabled={isProcessing}
            className="h-9 px-2.5 sm:px-3.5 rounded-xl font-black text-xs gap-1.5 border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 cursor-pointer active:scale-95 transition-transform"
            title="حفظ العرض المبدئي وإصدار فاتورة مبيعات معتمدة منه مباشرة"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>تحويل لمبيعات</span>
          </Button>
        )}

        {/* زر حفظ بالسجل فقط */}
        <Button
          type="button"
          variant="ghost"
          onClick={onSave}
          disabled={isProcessing}
          className="h-9 px-2 sm:px-3 rounded-xl font-bold text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
          title="حفظ بيانات الفاتورة في السجل فقط دون تصدير ملف"
        >
          <Save className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">حفظ بالسجل</span>
        </Button>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        className="h-9 px-3.5 sm:px-4 rounded-xl font-bold text-xs cursor-pointer"
      >
        إلغاء
      </Button>
    </DialogFooter>
  );
}

export default CustomInvoiceDialogFooter;
