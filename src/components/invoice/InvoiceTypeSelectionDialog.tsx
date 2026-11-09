import React, { useEffect } from "react";
import { X, FileText, TrendingUp, ChevronLeft, Receipt } from "lucide-react";
import { registerBackHandler } from "@/lib/backButtonHandler";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectSalesInvoice: () => void;
  onSelectProforma: () => void;
}

/**
 * نافذة اختيار نوع الفاتورة الرسمية الصادرة من الحاسبة:
 * تتيح للمستخدم تحويل المقاسات مباشرة إلى:
 * 1. فاتورة مبيعات معتمدة (A4 / A5) بكامل بيانات العميل وخانة Attn
 * 2. فاتورة مبدئية وعرض أسعار رسمي (A4) بشروط الدفع 70/30
 * بدون أي خيارات لإيصالات أوامر التشغيل الداخلية.
 */
export function InvoiceTypeSelectionDialog({
  open,
  onClose,
  onSelectSalesInvoice,
  onSelectProforma,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="إصدار فاتورة من الحاسبة"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      dir="rtl"
    >
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Receipt className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base font-black text-foreground">
                إصدار الفاتورة المعتمدة
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                اختر نموذج الفاتورة المطلوب استخراجه
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-8 w-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="space-y-2.5">
          {/* الخيار 1: فاتورة مبيعات معتمدة */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectSalesInvoice();
            }}
            className="group flex w-full items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.04] p-3.5 text-right transition-all hover:border-primary hover:bg-primary/10 active:scale-[0.98] cursor-pointer"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-black text-foreground group-hover:text-primary transition-colors">
                فاتورة مبيعات معتمدة
              </span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                فاتورة بيع نهائية بالمقاسات والأسعار (A4 / A5)
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>

          {/* الخيار 2: فاتورة مبدئية وعرض أسعار A4 */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectProforma();
            }}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/[0.04] p-3.5 text-right transition-all hover:border-[#C5A059] hover:bg-[#C5A059]/10 active:scale-[0.98] cursor-pointer"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/25 shrink-0 group-hover:bg-[#C5A059] group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-sm font-black text-foreground group-hover:text-[#C5A059] transition-colors">
                فاتورة مبدئية Pro. Invoice
              </span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                عرض أسعار رسمي بالنموذج الورقي المعتمد A4
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-[#C5A059] transition-colors shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceTypeSelectionDialog;
