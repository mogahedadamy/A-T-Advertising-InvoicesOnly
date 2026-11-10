import React from "react";
import { Plus, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceItem } from "@/lib/billing/types";
import { formatAccountingNumber } from "../StandardInvoiceDocument";
import { playAddSound, playDeleteSound } from "@/lib/soundEffects";
import { CustomInvoiceItemCard } from "./CustomInvoiceItemCard";

interface Props {
  items: CustomInvoiceItem[];
  onItemsChange: (items: CustomInvoiceItem[]) => void;
  totalAmount: number;
  totalInWords?: string;
}

/**
 * مكون بنود الفاتورة المعتمدة الكلاسيكي النقي (Invoice Items):
 * - يحتوي فقط على بنود العمل العادية: البيان، العدد، السعر، والإجمالي
 * - يعتمد بطاقات إدخال رأسية مريحة وواسعة تناسب شاشات الهواتف بنسبة 100%
 * - حساب فوري تلقائي للإجمالي والتفقيط
 */
export function CustomInvoiceItemsTable({
  items,
  onItemsChange,
  totalAmount,
  totalInWords,
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
      {/* 1. ترويسة قسم البنود */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-foreground font-black text-sm">
            <ReceiptText className="h-4 w-4 text-primary" />
            <span>بنود الفاتورة والخدمات</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-muted-foreground px-2.5 py-0.5 rounded-full bg-secondary border border-border/60">
            {items.length} {items.length === 1 ? "بند" : "بنود"}
          </span>
        </div>
      </div>

      {/* 2. قائمة بطاقات البنود الرأسية المريحة (بدون أي تمرير أفقي) */}
      <div className="space-y-3">
        {items.map((item, idx) => (
          <CustomInvoiceItemCard
            key={item.id || `item-row-${idx}`}
            item={item}
            index={idx}
            canDelete={items.length > 1}
            onFieldChange={(field, val) => handleFieldChange(idx, field, val)}
            onRemove={() => handleRemoveItem(idx)}
          />
        ))}
      </div>

      {/* 3. زر كبير ومريح لإضافة بند جديد أسفل القائمة */}
      <Button
        type="button"
        variant="outline"
        onClick={handleAddItem}
        className="w-full h-11 rounded-2xl border-dashed border-2 border-primary/40 hover:border-primary bg-primary/[0.03] hover:bg-primary/[0.08] text-primary font-black text-xs sm:text-sm gap-2 transition-all cursor-pointer shadow-2xs"
      >
        <Plus className="h-4 w-4" />
        <span>+ إضافة بند جديد للفاتورة</span>
      </Button>

      {/* 4. كرت ملخص الإجمالي المحاسبي والتفقيط */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-3.5 sm:p-4 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* تفقيط المبلغ بالحروف */}
          <div className="text-xs text-muted-foreground font-medium leading-relaxed">
            {totalInWords ? (
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-muted-foreground block">
                  المبلغ كتابة بالحروف:
                </span>
                <span className="font-bold text-foreground text-xs sm:text-sm">
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
          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
            <span className="text-xs font-black text-foreground">
              الإجمالي النهائي:
            </span>
            <div className="inline-flex items-baseline gap-1.5 px-3.5 py-1.5 rounded-xl bg-background border border-primary/30 shadow-2xs">
              <span className="font-mono text-base sm:text-lg font-black text-primary tabular-nums">
                {formatAccountingNumber(totalAmount)}
              </span>
              <span className="text-xs font-black text-foreground">ج.س</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomInvoiceItemsTable;
