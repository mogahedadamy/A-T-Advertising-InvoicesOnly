import React, { useState, useEffect } from "react";
import { Trash2, Copy, Plus, Minus } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceItem } from "@/lib/billing/types";
import type { AppCurrency } from "@/lib/currency/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  item: CustomInvoiceItem;
  index: number;
  canDelete: boolean;
  onFieldChange: (
    field: "description" | "qty" | "unitPrice" | "total",
    val: string
  ) => void;
  onRemove: () => void;
  onDuplicate?: () => void;
  currency?: AppCurrency;
}

/**
 * بطاقة البند المطورة والذكية للفاتورة:
 * - تحتوي على: البيان، الكمية مع أزرار التحكم السريع (+ / -)، سعر الوحدة، والإجمالي
 * - تحديد تلقائي للنص عند النقر (Select-on-focus) لكتابة سريعة بدون مسح يدوي
 * - زر تكرار البند الفوري (Duplicate)
 * - استجابة تامة للهواتف وتصميم معتمد على Design Tokens
 */
export function CustomInvoiceItemCard({
  item,
  index,
  canDelete,
  onFieldChange,
  onRemove,
  onDuplicate,
  currency = "SDG",
}: Props) {
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

  useEffect(() => {
    const num = parseInt(qtyStr, 10);
    if (isNaN(num) || num !== item.qty) {
      setQtyStr(item.qty ? String(item.qty) : "");
    }
  }, [item.qty]);

  useEffect(() => {
    const num = parseFloat(priceStr);
    if (isNaN(num) || Math.abs(num - (item.unitPrice || 0)) > 0.001) {
      setPriceStr(item.unitPrice ? String(item.unitPrice) : "");
    }
  }, [item.unitPrice]);

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

  const handleStepQty = (delta: number) => {
    playTapSound();
    const current = parseInt(qtyStr, 10) || 1;
    const next = Math.max(1, current + delta);
    handleQtyChange(String(next));
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
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-3.5 space-y-2.5 shadow-xs hover:border-primary/40 transition-colors"
      dir="rtl"
    >
      {/* 1. ترويسة البند: الرقم، وزر التكرار وزر الحذف */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary font-mono font-black text-xs border border-primary/25">
            #{index + 1}
          </span>
          <span className="text-xs font-black text-foreground">
            بند الفاتورة
          </span>
        </div>

        <div className="flex items-center gap-1">
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              aria-label={`تكرار البند رقم ${index + 1}`}
              className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
              title="تكرار هذا البند بسطر جديد"
            >
              <Copy className="h-3 w-3" />
              <span className="hidden sm:inline">تكرار</span>
            </button>
          )}

          <button
            type="button"
            onClick={onRemove}
            disabled={!canDelete}
            aria-label={`حذف البند رقم ${index + 1}`}
            className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            title="حذف هذا البند"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span className="text-[11px]">حذف</span>
          </button>
        </div>
      </div>

      {/* 2. حقل البيان / تفاصيل الصنف أو الخدمة */}
      <div className="space-y-1">
        <label className="text-[11px] font-black text-muted-foreground block text-right">
          البيان / تفاصيل الصنف أو الخدمة *
        </label>
        <Input
          dir="auto"
          value={item.description}
          onChange={(e) => onFieldChange("description", e.target.value)}
          placeholder="اكتب اسم الصنف، السلعة، أو تفاصيل الخدمة (مثال: طباعة لافتات 300 x 100)..."
          className="h-10 text-xs sm:text-sm font-semibold rounded-xl bg-background border-border/80 focus:border-primary text-right"
          style={{ unicodeBidi: "plaintext", textAlign: "right" }}
        />
      </div>

      {/* 3. شبكة الحسابات المدمجة مع أزرار التحكم السريعة (+ / -) */}
      <div className="grid grid-cols-12 gap-2 pt-0.5">
        {/* العدد / الكمية مع أزرار الزيادة والنقصان */}
        <div className="col-span-4 space-y-1">
          <label className="text-[10.5px] font-black text-muted-foreground block text-center truncate">
            الكمية
          </label>
          <div className="flex items-center rounded-xl border border-border/80 bg-background overflow-hidden focus-within:border-primary">
            <button
              type="button"
              onClick={() => handleStepQty(-1)}
              disabled={(item.qty || 1) <= 1}
              className="h-10 w-7 grid place-items-center bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 transition cursor-pointer active:scale-95"
              title="إنقاص الكمية"
            >
              <Minus className="h-3 w-3" />
            </button>
            <input
              type="text"
              inputMode="numeric"
              value={qtyStr}
              onChange={(e) => handleQtyChange(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="1"
              className="h-10 flex-1 min-w-0 text-center font-mono font-bold text-xs sm:text-sm bg-transparent tabular-nums outline-none"
            />
            <button
              type="button"
              onClick={() => handleStepQty(1)}
              className="h-10 w-7 grid place-items-center bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer active:scale-95"
              title="زيادة الكمية"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* سعر الوحدة مع تحديد سريع للنص */}
        <div className="col-span-4 space-y-1">
          <label className="text-[10.5px] font-black text-muted-foreground block text-center truncate">
            سعر الوحدة
          </label>
          <Input
            type="text"
            inputMode="decimal"
            value={priceStr}
            onChange={(e) => handlePriceChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            className="h-10 text-center font-mono font-bold text-xs sm:text-sm rounded-xl bg-background border-border/80 tabular-nums focus:border-primary"
          />
        </div>

        {/* الإجمالي التلقائي */}
        <div className="col-span-4 space-y-1">
          <label className="text-[10.5px] font-black text-primary block text-center truncate">
            الإجمالي ({currency})
          </label>
          <Input
            type="text"
            inputMode="decimal"
            value={totalStr}
            onChange={(e) => handleTotalChange(e.target.value)}
            onFocus={(e) => e.target.select()}
            placeholder="0"
            className="h-10 text-center font-mono font-black text-xs sm:text-sm rounded-xl bg-primary/10 border-primary/30 text-primary tabular-nums focus:border-primary"
          />
        </div>
      </div>
    </div>
  );
}

export default CustomInvoiceItemCard;
