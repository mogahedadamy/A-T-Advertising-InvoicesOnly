import React, { useEffect } from "react";
import { X, FileText, TrendingUp, ShoppingBag, ChevronLeft, Receipt } from "lucide-react";
import { registerBackHandler } from "@/lib/backButtonHandler";
import type { CustomInvoiceType } from "@/lib/billing/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectType: (type: CustomInvoiceType) => void;
}

/**
 * نافذة اختيار نموذج الفاتورة المستخرجة من الحاسبة:
 * تتيح للمستخدم تحديد أحد الخيارات الثلاثة بلمسة واحدة:
 * 1. اصدار فاتورة مبدئية
 * 2. اصدار فاتورة مبيعات
 * 3. اصدار فاتورة مشتريات
 */
export function InvoiceTypeSelectionDialog({ open, onClose, onSelectType }: Props) {
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  if (!open) return null;

  const handleChoose = (type: CustomInvoiceType) => {
    playTapSound();
    onClose();
    onSelectType(type);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تحديد نوع الفاتورة"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] px-[max(1rem,env(safe-area-inset-left,0px))] animate-in fade-in duration-150 backdrop-blur-xs select-none"
      dir="rtl"
    >
      <div className="w-full max-w-sm max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-2xl space-y-3.5 animate-in zoom-in-95 duration-150">
        {/* الترويسة الصريحة الأنيقة */}
        <div className="flex items-center justify-between pb-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Receipt className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-black text-foreground">
                تحديد نوع الفاتورة المطلوب استخراجها
              </h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                ترحيل مباشر للمقاسات والبيان لنموذج الفاتورة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="grid h-7 w-7 place-items-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* الخيارات الثلاثة الصريحة */}
        <div className="space-y-2">
          {/* 1. إصدار فاتورة مبدئية */}
          <button
            type="button"
            onClick={() => handleChoose("proforma")}
            className="group flex w-full items-center gap-3 rounded-2xl border border-[#C5A059]/40 bg-[#C5A059]/[0.05] p-3 text-right transition-all hover:border-[#C5A059] hover:bg-[#C5A059]/10 active:scale-[0.98] cursor-pointer"
          >
            <div className="grid h-9.5 w-9.5 place-items-center rounded-xl bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/30 shrink-0 group-hover:bg-[#C5A059] group-hover:text-white transition-colors">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black text-foreground group-hover:text-[#C5A059] transition-colors">
                اصدار فاتورة مبدئية
              </span>
              <span className="block text-[10.5px] text-muted-foreground mt-0.5">
                عرض أسعار رسمي Pro. Invoice موجه للعميل
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-[#C5A059] transition-colors shrink-0" />
          </button>

          {/* 2. إصدار فاتورة مبيعات */}
          <button
            type="button"
            onClick={() => handleChoose("sales")}
            className="group flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/[0.05] p-3 text-right transition-all hover:border-primary hover:bg-primary/10 active:scale-[0.98] cursor-pointer"
          >
            <div className="grid h-9.5 w-9.5 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/30 shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black text-foreground group-hover:text-primary transition-colors">
                اصدار فاتورة مبيعات
              </span>
              <span className="block text-[10.5px] text-muted-foreground mt-0.5">
                فاتورة مبيعات معتمدة بالمقاسات والخامات والأسعار
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </button>

          {/* 3. إصدار فاتورة مشتريات */}
          <button
            type="button"
            onClick={() => handleChoose("purchase")}
            className="group flex w-full items-center gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/[0.05] p-3 text-right transition-all hover:border-blue-500 hover:bg-blue-500/10 active:scale-[0.98] cursor-pointer"
          >
            <div className="grid h-9.5 w-9.5 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-black text-foreground group-hover:text-blue-600 transition-colors">
                اصدار فاتورة مشتريات
              </span>
              <span className="block text-[10.5px] text-muted-foreground mt-0.5">
                فاتورة شراء وتوريد خامات ومستلزمات الإنتاج
              </span>
            </div>
            <ChevronLeft className="h-4 w-4 text-muted-foreground group-hover:text-blue-600 transition-colors shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default InvoiceTypeSelectionDialog;
