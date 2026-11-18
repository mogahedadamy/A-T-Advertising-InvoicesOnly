import React from "react";
import { Plus, ReceiptText, Eye, FileCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceItem } from "@/lib/billing/types";
import { formatAccountingNumber } from "../StandardInvoiceDocument";
import { playAddSound, playDeleteSound, playTapSound } from "@/lib/soundEffects";
import { CustomInvoiceItemCard } from "./CustomInvoiceItemCard";
import type { AppCurrency } from "@/lib/currency/types";

interface Props {
  items: CustomInvoiceItem[];
  onItemsChange: (items: CustomInvoiceItem[]) => void;
  totalAmount: number;
  totalInWords?: string;
  currency?: AppCurrency;
  onPreviewClick?: () => void;
}

/**
 * مكون بنود الفاتورة والخدمات (الخطوة 2):
 * - إدخال سلس وواضح لأي أصناف أو خدمات تجارية عامة
 * - تحكم سلس بالكميات والأسعار والتكرار السريع
 * - ملخص مالي فوري مع زر معاينة الفاتورة البارز
 */
export function CustomInvoiceItemsTable({
  items,
  onItemsChange,
  totalAmount,
  totalInWords,
  currency = "SDG",
  onPreviewClick,
}: Props) {
  const handleAddItem = () => {
    playAddSound();
    const newItem: CustomInvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: "",
      qty: 1,
      unitPrice: 0,
      total: 0,
    };
    onItemsChange([...items, newItem]);
  };

  const handleDuplicateItem = (idx: number) => {
    playAddSound();
    const source = items[idx];
    if (!source) return;
    const duplicated: CustomInvoiceItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: source.description,
      qty: source.qty,
      unitPrice: source.unitPrice,
      total: source.total,
    };
    const next = [...items];
    next.splice(idx + 1, 0, duplicated);
    onItemsChange(next);
  };

  const handleRemoveItem = (idx: number) => {
    playDeleteSound();
    onItemsChange(items.filter((_, i) => i !== idx));
  };

  const handleFieldChange = (
    idx: number,
    field: "description" | "qty" | "unitPrice" | "total",
    val: string
  ) => {
    const next = [...items];
    const target = { ...next[idx] };
    if (!target) return;

    if (field === "description") {
      target.description = val;
    } else if (field === "qty") {
      const cleaned = val.replace(/[^0-9]/g, "");
      const qty = cleaned === "" ? 0 : parseInt(cleaned, 10);
      const unitPrice = target.unitPrice ?? 0;
      target.qty = qty;
      const effectiveQty = qty > 0 ? qty : 1;
      target.total = unitPrice > 0 ? Number((effectiveQty * unitPrice).toFixed(2)) : target.total;
    } else if (field === "unitPrice") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const unitPrice = cleaned === "" || cleaned === "." ? 0 : parseFloat(cleaned);
      const effectiveQty = target.qty > 0 ? target.qty : 1;
      target.unitPrice = unitPrice;
      target.total = Number((effectiveQty * unitPrice).toFixed(2));
    } else if (field === "total") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const total = cleaned === "" || cleaned === "." ? 0 : parseFloat(cleaned);
      const effectiveQty = target.qty > 0 ? target.qty : 1;
      target.total = total;
      target.unitPrice = effectiveQty > 0 ? Number((total / effectiveQty).toFixed(2)) : total;
    }

    next[idx] = target as CustomInvoiceItem;
    onItemsChange(next);
  };

  return (
    <div className="space-y-3.5 select-text" dir="rtl">
      {/* 1. ترويسة قسم البنود مع الدليل الإرشادي */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-black">
            2
          </span>
          <div className="flex items-center gap-1.5 text-foreground font-black text-xs sm:text-sm">
            <ReceiptText className="h-4 w-4 text-primary" />
            <span>بنود وخدمات الفاتورة</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-full bg-secondary border border-border/60">
            {items.length} {items.length === 1 ? "بند" : "بنود"}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground hidden sm:block">
          أدخل تفاصيل البند والكمية والسعر (الحساب فوري)
        </p>
      </div>

      {/* 2. قائمة بطاقات البنود الرأسية */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <CustomInvoiceItemCard
            key={item.id || `item-row-${idx}`}
            item={item}
            index={idx}
            canDelete={items.length > 1}
            onFieldChange={(field, val) => handleFieldChange(idx, field, val)}
            onRemove={() => handleRemoveItem(idx)}
            onDuplicate={() => handleDuplicateItem(idx)}
            currency={currency}
          />
        ))}
      </div>

      {/* 4. زر كبير ومريح لإضافة بند جديد */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddItem}
        className="w-full h-11 rounded-2xl border-dashed border-2 border-primary/40 hover:border-primary bg-primary/[0.03] hover:bg-primary/[0.08] text-primary font-black text-xs sm:text-sm gap-2 transition-all cursor-pointer shadow-2xs active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        <span>+ إضافة بند جديد للفاتورة</span>
      </Button>

      {/* 5. كرت ملخص الإجمالي المحاسبي والتفقيط مع زر المعاينة المباشر والبارز */}
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* تفقيط المبلغ بالحروف */}
          <div className="text-xs text-muted-foreground font-medium leading-relaxed flex-1">
            {totalInWords ? (
              <div className="space-y-0.5">
                <span className="text-[10.5px] font-bold text-muted-foreground block">
                  المبلغ كتابة بالحروف:
                </span>
                <span className="font-bold text-foreground text-xs sm:text-sm leading-snug">
                  {totalInWords}
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground">
                أدخل تفاصيل البنود والأسعار لاحتساب الإجمالي والتفقيط تلقائياً
              </span>
            )}
          </div>

          {/* الإجمالي النهائي بالأرقام */}
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40 shrink-0">
            <span className="text-xs font-black text-foreground">
              الإجمالي النهائي:
            </span>
            <div className="inline-flex items-baseline gap-1.5 px-3.5 py-1.5 rounded-xl bg-background border border-primary/30 shadow-2xs">
              <span className="font-mono text-base sm:text-lg font-black text-primary tabular-nums">
                {formatAccountingNumber(totalAmount)}
              </span>
              <span className="text-xs font-black font-mono text-foreground uppercase">{currency}</span>
            </div>
          </div>
        </div>

        {/* زر معاينة الفاتورة الرسمي البارز جداً مع الدليل الإرشادي */}
        {onPreviewClick && (
          <div className="pt-2 border-t border-primary/15 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
              <FileCheck className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
              <span>جاهز لمشاهدة شكل الفاتورة والختم الرسمي A4؟</span>
            </div>

            <Button
              type="button"
              onClick={() => {
                playTapSound();
                onPreviewClick();
              }}
              className="h-9 px-4 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-95 transition-transform cursor-pointer w-full sm:w-auto"
            >
              <Eye className="h-4 w-4" />
              <span>معاينة الفاتورة الرسمية (A4) الآن</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomInvoiceItemsTable;
