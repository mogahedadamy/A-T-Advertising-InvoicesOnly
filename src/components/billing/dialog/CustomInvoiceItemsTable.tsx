import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceItem } from "@/lib/billing/types";
import { formatAccountingNumber } from "../StandardInvoiceDocument";
import { playAddSound, playDeleteSound } from "@/lib/soundEffects";

interface Props {
  items: CustomInvoiceItem[];
  onItemsChange: (items: CustomInvoiceItem[]) => void;
  totalAmount: number;
  totalInWords?: string;
}

/**
 * جدول بنود الفاتورة المعتمدة التفاعلي:
 * إدخال التفاصيل، الكمية، سعر الوحدة، واحتساب الإجمالي تلقائياً
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
      target.total = unitPrice > 0 ? (qty || 1) * unitPrice : target.total;
    } else if (field === "unitPrice") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const unitPrice = cleaned === "" ? 0 : parseFloat(cleaned);
      const qty = target.qty || 1;
      target.unitPrice = unitPrice;
      target.total = Number((qty * unitPrice).toFixed(2));
    } else if (field === "total") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const total = cleaned === "" ? 0 : parseFloat(cleaned);
      const qty = target.qty || 1;
      target.total = total;
      target.unitPrice = qty > 0 ? Number((total / qty).toFixed(2)) : total;
    }

    next[idx] = target as CustomInvoiceItem;
    onItemsChange(next);
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">جدول البنود والخدمات</span>
          <span className="text-[10px] font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-full bg-secondary">
            {items.length} بنود
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={handleAddItem}
          className="h-7.5 px-3 rounded-lg text-xs font-bold gap-1 bg-primary hover:bg-primary/90 text-white shadow-2xs cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>إضافة سطر</span>
        </Button>
      </div>

      {/* جدول إدخال البنود */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-border/60 text-[11px] font-black text-muted-foreground">
              <th className="py-2 pr-2 w-8 text-center">#</th>
              <th className="py-2 px-2 min-w-[200px]">البيان / التفاصيل *</th>
              <th className="py-2 px-2 w-20 text-center">العدد</th>
              <th className="py-2 px-2 w-28 text-center">سعر الوحدة</th>
              <th className="py-2 px-2 w-28 text-center">الإجمالي</th>
              <th className="py-2 pl-2 w-10 text-center">حذف</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((it, idx) => (
              <tr key={it.id || idx} className="hover:bg-muted/30 transition-colors">
                <td className="py-2 pr-2 text-center font-mono font-bold text-muted-foreground text-[11px]">
                  {idx + 1}
                </td>
                <td className="py-2 px-2">
                  <Input
                    value={it.description}
                    onChange={(e) => handleFieldChange(idx, "description", e.target.value)}
                    placeholder="مثال: طباعة بنر 3×1 متر، تصميم هوية، تركيب..."
                    className="h-8.5 text-xs rounded-lg font-medium"
                  />
                </td>
                <td className="py-2 px-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={it.qty || ""}
                    onChange={(e) => handleFieldChange(idx, "qty", e.target.value)}
                    className="h-8.5 text-xs rounded-lg text-center font-mono font-bold"
                  />
                </td>
                <td className="py-2 px-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={it.unitPrice || ""}
                    onChange={(e) => handleFieldChange(idx, "unitPrice", e.target.value)}
                    placeholder="0"
                    className="h-8.5 text-xs rounded-lg text-center font-mono font-bold"
                  />
                </td>
                <td className="py-2 px-2">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={it.total || ""}
                    onChange={(e) => handleFieldChange(idx, "total", e.target.value)}
                    placeholder="0"
                    className="h-8.5 text-xs rounded-lg text-center font-mono font-black text-primary bg-primary/[0.03]"
                  />
                </td>
                <td className="py-2 pl-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 transition-colors disabled:opacity-30 cursor-pointer"
                    title="حذف هذا السطر"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* شريط الإجمالي المحاسبي والتفقيط */}
      <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground font-medium">
          {totalInWords ? (
            <span className="font-bold text-foreground">فقط: {totalInWords}</span>
          ) : (
            <span>أدخل تفاصيل البنود والأسعار لاحتساب الإجمالي</span>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <span className="text-xs font-black text-foreground">الإجمالي الكلي:</span>
          <span className="font-mono text-base font-black text-primary px-3 py-1 rounded-xl bg-primary/10 border border-primary/20 tabular-nums">
            {formatAccountingNumber(totalAmount)}{" "}
            <span className="text-[10px] font-sans font-bold">ج.س</span>
          </span>
        </div>
      </div>
    </div>
  );
}

