import React, { useState, useEffect } from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceItem } from "@/lib/billing/types";

interface Props {
  item: CustomInvoiceItem;
  index: number;
  canDelete: boolean;
  onFieldChange: (
    field: "description" | "qty" | "unitPrice" | "total",
    val: string
  ) => void;
  onRemove: () => void;
}

/**
 * بطاقة البند الكلاسيكية النقية للفاتورة (Classic Invoice Item Card):
 * تحتوي فقط على (البيان / الوصف، العدد، سعر الوحدة، والإجمالي)
 * مع الحساب التلقائي اللحظي وملاءمة تامة للهواتف الذكية بدون أي تعقيد أو مقاسات
 */
export function CustomInvoiceItemCard({
  item,
  index,
  canDelete,
  onFieldChange,
  onRemove,
}: Props) {
  // حالات محلية للنصوص العددية لضمان عدم ابتلاع الفاصلة العشرية أثناء الكتابة
  const [qtyStr, setQtyStr] = useState(item.qty ? String(item.qty) : "1");
  const [priceStr, setPriceStr] = useState(
    item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice > 0
      ? String(item.unitPrice)
      : ""
  );
  const [totalStr, setTotalStr] = useState(
    item.total !== undefined && item.total !== null && item.total > 0
      ? String(item.total)
      : ""
  );

  // مزامنة حالة العدد عند التغير من الخارج
  useEffect(() => {
    const num = parseInt(qtyStr, 10);
    if (isNaN(num) || num !== item.qty) {
      setQtyStr(item.qty ? String(item.qty) : "");
    }
  }, [item.qty]);

  // مزامنة حالة السعر عند التغير من الخارج (الحساب العكسي أو التحميل)
  useEffect(() => {
    const num = parseFloat(priceStr);
    if (isNaN(num) || Math.abs(num - (item.unitPrice || 0)) > 0.001) {
      setPriceStr(item.unitPrice ? String(item.unitPrice) : "");
    }
  }, [item.unitPrice]);

  // مزامنة حالة الإجمالي عند الحساب التلقائي
  useEffect(() => {
    const num = parseFloat(totalStr);
    if (isNaN(num) || Math.abs(num - (item.total || 0)) > 0.001) {
      setTotalStr(item.total ? String(item.total) : "");
    }
  }, [item.total]);

  const handleQtyChange = (val: string) => {
    setQtyStr(val);
    onFieldChange("qty", val);
  };

  const handlePriceChange = (val: string) => {
    setPriceStr(val);
    onFieldChange("unitPrice", val);
  };

  const handleTotalChange = (val: string) => {
    setTotalStr(val);
    onFieldChange("total", val);
  };

  return (
    <div
      className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 space-y-3 shadow-xs hover:border-primary/40 transition-colors"
      dir="rtl"
    >
      {/* 1. ترويسة البند: الرقم وزر الحذف */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary font-mono font-black text-xs border border-primary/25">
            #{index + 1}
          </span>
          <span className="text-xs font-black text-foreground">
            بند الفاتورة
          </span>
        </div>

        <button
          type="button"
          onClick={onRemove}
          disabled={!canDelete}
          aria-label={`حذف البند رقم ${index + 1}`}
          className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          title="حذف هذا البند"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="text-[11px]">حذف البند</span>
        </button>
      </div>

      {/* 2. حقل البيان / تفاصيل العمل بكامل العرض */}
      <div className="space-y-1">
        <label className="text-[11px] font-black text-muted-foreground block text-right">
          البيان / تفاصيل الصنف أو الخدمة *
        </label>
        <Input
          value={item.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          placeholder="اكتب اسم الصنف أو البيان أو تفاصيل الخدمة المقدمة..."
          className="h-10 text-xs sm:text-sm font-semibold rounded-xl bg-background border-border/80 focus:border-primary text-right"
        />
      </div>

      {/* 3. شبكة الحسابات الكلاسيكية (العدد × سعر الوحدة = الإجمالي) */}
      <div className="grid grid-cols-12 gap-2 pt-0.5">
        {/* العدد / الكمية */}
        <div className="col-span-3 space-y-1">
          <label className="text-[10.5px] font-black text-muted-foreground block text-center truncate">
            العدد
          </label>
          <Input
            type="text"
            inputMode="numeric"
            value={qtyStr}
            onChange={(e) => handleQtyChange(e.target.value)}
            placeholder="1"
            className="h-10 text-center font-mono font-bold text-xs sm:text-sm rounded-xl bg-background border-border/80 tabular-nums focus:border-primary"
          />
        </div>

        {/* سعر الوحدة */}
        <div className="col-span-4 space-y-1">
          <label className="text-[10.5px] font-black text-muted-foreground block text-center truncate">
            سعر الوحدة
          </label>
          <Input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => handlePriceChange(e.target.value)}
            placeholder="0"
            className="h-10 text-center font-mono font-bold text-xs sm:text-sm rounded-xl bg-background border-border/80 tabular-nums focus:border-primary"
          />
        </div>

        {/* الإجمالي التلقائي */}
        <div className="col-span-5 space-y-1">
          <label className="text-[10.5px] font-black text-primary block text-center truncate">
            الإجمالي (ج.س)
          </label>
          <Input
            type="text"
            inputMode="decimal"
            value={totalStr}
            onChange={(e) => handleTotalChange(e.target.value)}
            placeholder="0"
            className="h-10 text-center font-mono font-black text-xs sm:text-sm rounded-xl bg-primary/10 border-primary/30 text-primary tabular-nums focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}

export default CustomInvoiceItemCard;
