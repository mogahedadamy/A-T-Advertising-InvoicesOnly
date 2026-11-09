import React from "react";
import { TrendingUp, FileText, ShoppingBag } from "lucide-react";
import type { CustomInvoiceType } from "@/lib/billing/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  type: CustomInvoiceType;
  onChange: (type: CustomInvoiceType) => void;
}

/**
 * شريط اختيار نوع الفاتورة المدمج (Segmented Control):
 * مبيعات / مبدئية / مشتريات
 */
export function CustomInvoiceTypeSelector({ type, onChange }: Props) {
  const OPTIONS: Array<{
    val: CustomInvoiceType;
    label: string;
    icon: typeof TrendingUp;
    activeClass: string;
  }> = [
    {
      val: "sales",
      label: "فاتورة مبيعات",
      icon: TrendingUp,
      activeClass: "text-primary border-primary/30 bg-card shadow-xs",
    },
    {
      val: "proforma",
      label: "مبدئية Proforma",
      icon: FileText,
      activeClass: "text-[#C5A059] border-[#C5A059]/30 bg-card shadow-xs",
    },
    {
      val: "purchase",
      label: "فاتورة مشتريات",
      icon: ShoppingBag,
      activeClass: "text-slate-400 border-slate-500/30 bg-card shadow-xs",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted/50 border border-border/60">
      {OPTIONS.map((t) => {
        const isSelected = type === t.val;
        const Icon = t.icon;
        return (
          <button
            key={t.val}
            type="button"
            onClick={() => {
              playTapSound();
              onChange(t.val);
            }}
            className={`flex items-center justify-center gap-1.5 h-8.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              isSelected
                ? `${t.activeClass} font-black`
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

