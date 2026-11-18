import React from "react";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, TrendingUp, ShoppingBag, Eye, Edit3, Info } from "lucide-react";
import { INVOICE_TYPE_LABELS, type CustomInvoiceType, type CustomInvoice } from "@/lib/billing/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  type: CustomInvoiceType;
  invoiceToEdit?: CustomInvoice | null;
  savedReference?: string;
  serial?: string;
  activeTab: "edit" | "preview";
  onTabChange: (tab: "edit" | "preview") => void;
  itemsCount: number;
}

/**
 * ترويسة نافذة الفاتورة المطورة مع شريط التبديل البارز والواضح للمعاينة:
 * - تبرز زر المعاينة في صدارة النافذة ليراه المستخدم فوراً
 * - تعرض المرجع الرسمي ونوع الفاتورة وشارة تفاعلية
 */
export function CustomInvoiceDialogHeader({
  type,
  invoiceToEdit,
  savedReference,
  serial,
  activeTab,
  onTabChange,
  itemsCount,
}: Props) {
  return (
    <DialogHeader className="px-3 pl-14 py-2.5 pt-[max(0.75rem,env(safe-area-inset-top,0px))] sm:px-5 sm:pl-16 sm:py-3 border-b border-border/60 bg-card space-y-2 shrink-0">
      {/* 1. السطر العلوي: العنوان والنوع والمرجع */}
      <div className="flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`grid h-8 w-8 place-items-center rounded-xl border text-xs shrink-0 ${
              type === "sales"
                ? "bg-primary/10 text-primary border-primary/20"
                : type === "proforma"
                ? "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/20"
                : "bg-slate-500/10 text-slate-400 border-slate-500/20"
            }`}
          >
            {type === "sales" && <TrendingUp className="h-4 w-4" />}
            {type === "proforma" && <FileText className="h-4 w-4" />}
            {type === "purchase" && <ShoppingBag className="h-4 w-4" />}
          </span>
          <div>
            <DialogTitle className="text-sm sm:text-base font-black text-foreground">
              {invoiceToEdit
                ? `تعديل ${INVOICE_TYPE_LABELS[type]}`
                : `إصدار ${INVOICE_TYPE_LABELS[type]}`}
            </DialogTitle>
            <p className="text-[10px] sm:text-[10.5px] text-muted-foreground">
              نموذج الفاتورة التجاري المعتمد والمطابق للمواصفات الرسمية A4
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            dir="ltr"
            className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 tabular-nums"
          >
            {savedReference || `${String(new Date().getFullYear()).slice(-2)}-...`}
          </span>
        </div>
      </div>

      {/* 2. شريط التبديل البارز والاحترافي بين تحرير البيانات ومعاينة الفاتورة */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
        <div className="inline-flex rounded-xl bg-muted/80 p-1 border border-border/70 shadow-2xs w-full sm:w-auto">
          {/* زر تحرير البيانات */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onTabChange("edit");
            }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "edit"
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="h-3.5 w-3.5 text-primary" />
            <span>1. إدخال وتعديل البيانات</span>
          </button>

          {/* زر معاينة الفاتورة الرسمية البارز جداً */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onTabChange("preview");
            }}
            className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-primary text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>2. معاينة الفاتورة الرسمية (A4)</span>
            {itemsCount > 0 && (
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  activeTab === "preview"
                    ? "bg-white/20 text-white"
                    : "bg-primary/10 text-primary font-bold"
                }`}
              >
                {itemsCount}
              </span>
            )}
          </button>
        </div>

        {/* دليل إرشادي سريع (UI/UX Guide) */}
        <div className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
          <Info className="h-3 w-3 text-[#C5A059]" />
          <span>
            {activeTab === "edit"
              ? "اضغط «معاينة الفاتورة الرسمية» لمشاهدة القالب المطبوع فوراً"
              : "المعاينة مطابقة تماماً للمستند المطبوع وملف الـ PDF"}
          </span>
        </div>
      </div>
    </DialogHeader>
  );
}

export default CustomInvoiceDialogHeader;
