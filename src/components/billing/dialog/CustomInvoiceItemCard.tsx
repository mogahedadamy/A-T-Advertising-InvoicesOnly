import React, { useState, useEffect } from "react";
import { Trash2, Ruler, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceItem } from "@/lib/billing/types";

interface Props {
  item: CustomInvoiceItem;
  index: number;
  canDelete: boolean;
  showDimensions: boolean;
  onFieldChange: (
    field: "description" | "material" | "dimensions" | "qty" | "unitPrice" | "total",
    val: string
  ) => void;
  onRemove: () => void;
}

/**
 * بطاقة البند التفاعلية المريحة للفاتورة (Mobile-First Card):
 * تلغي تماماً مشكلة التمرير الأفقي وضيق المساحة في شاشات الهواتف
 * وتوفر إدخالاً سلساً للبيان والكمية والسعر مع الحساب التلقائي اللحظي
 */
export function CustomInvoiceItemCard({
  item,
  index,
  canDelete,
  showDimensions,
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
      {/* 1. ترويسة البند: الرقم + شارة المقاسات + زر الحذف */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary font-mono font-black text-xs border border-primary/25">
            #{index + 1}
          </span>
          <span className="text-xs font-black text-foreground">
            بند الفاتورة
          </span>
          {showDimensions && (item.dimensions || item.material) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10.5px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Ruler className="h-3 w-3" />
              مقاسات وخامة
            </span>
          )}
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

      {/* 2. حقل البيان / التفاصيل عريض ومريح بكامل العرض */}
      <div className="space-y-1">
        <label className="text-[11px] font-black text-muted-foreground block text-right">
          البيان / تفاصيل العمل أو الخدمة *
        </label>
        <Input
          value={item.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          placeholder="اكتب اسم الصنف، المطبوعة، أو الخدمة المقدمة..."
          className="h-10 text-xs sm:text-sm font-semibold rounded-xl bg-background border-border/80 focus:border-primary text-right"
        />
      </div>

      {/* 3. شبكة الحسابات المريحة (العدد × سعر الوحدة = الإجمالي) */}
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

      {/* 4. قسم المقاسات والخامات (يظهر فقط إذا كان مفعّلاً) */}
      {showDimensions && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50 mt-1 animate-in fade-in duration-150">
          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-muted-foreground" />
              <span>الخامة</span>
            </label>
            <Input
              value={item.material || ""}
              onChange={(e) => onFieldChange("material", e.target.value)}
              placeholder="مثال: بنر كوري، فليكس..."
              className="h-9 text-xs rounded-xl bg-background border-border/70 text-right font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10.5px] font-bold text-muted-foreground flex items-center gap-1">
              <Ruler className="h-3 w-3 text-muted-foreground" />
              <span>المقاس والأبعاد</span>
            </label>
            <Input
              value={item.dimensions || ""}
              onChange={(e) => onFieldChange("dimensions", e.target.value)}
              placeholder="مثال: 3.00 × 1.50 م"
              className="h-9 text-xs rounded-xl bg-background border-border/70 text-center font-mono tabular-nums font-medium"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomInvoiceItemCard;
