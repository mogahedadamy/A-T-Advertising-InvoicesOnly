import { useState } from "react";
import { Package, Maximize2, Trash2, X, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderItem } from "@/lib/invoice/fromCalc";
import { OrderItemRow } from "./OrderItemRow";

interface Props {
  items: OrderItem[];
  onRemove: (index: number) => void;
  onClear: () => void;
  onDescriptionChange: (index: number, value: string) => void;
  totalArea?: number;
}

export function OrderList({
  items,
  onRemove,
  onClear,
  onDescriptionChange,
  totalArea,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const calculatedArea =
    totalArea !== undefined
      ? totalArea
      : items.reduce((acc, curr) => acc + (curr.area || 0), 0);

  const content = (full: boolean) => (
    <div className="flex flex-col h-full min-h-0 w-full max-w-full overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border/70 pb-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-secondary text-foreground border border-border/60 shrink-0">
            <Layers className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-foreground truncate">
              سجل المقاسات المضافة ({items.length})
            </h2>
            <span className="text-[10px] font-bold text-muted-foreground tabular-nums block truncate">
              المساحة: {calculatedArea.toFixed(2)} م²
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {items.length > 0 && (
            <Button
              variant="destructive"
              size="xs"
              onClick={onClear}
              className="h-8 px-2.5 text-xs rounded-xl"
            >
              <Trash2 className="h-3.5 w-3.5 ml-1" />
              مسح
            </Button>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setExpanded(!full)}
            className="h-8 w-8 rounded-xl"
            aria-label={full ? "إغلاق التوسيع" : "توسيع الطلبية"}
          >
            {full ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center my-auto">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary/80 text-muted-foreground mb-3 border border-border/60">
            <Package className="h-6 w-6 opacity-60" />
          </div>
          <h3 className="text-xs font-bold text-foreground">لا توجد مقاسات مضافة حتى الآن</h3>
          <p className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">
            حدد الخامة والأبعاد بالأعلى واضغط &quot;إضافة&quot; لتسجيل البند في الطلب
          </p>
        </div>
      ) : (
        <ul
          aria-label="مقاسات الطلبية"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5 w-full max-w-full overflow-x-hidden"
        >
          {items.map((item, index) => (
            <OrderItemRow
              key={index}
              item={item}
              index={index}
              onRemove={() => onRemove(index)}
              onDescriptionChange={(value) => onDescriptionChange(index, value)}
            />
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <section aria-label="الطلبية" className="flex min-h-0 flex-1 flex-col h-full w-full max-w-full overflow-hidden">
        {content(false)}
      </section>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="الطلبية الموسعة"
          dir="rtl"
          className="fixed inset-0 z-50 flex flex-col bg-background/98 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-150"
        >
          <div className="mx-auto w-full max-w-4xl flex-1 flex flex-col bg-card rounded-3xl border border-border/80 p-5 shadow-2xl overflow-hidden">
            {content(true)}
          </div>
        </div>
      )}
    </>
  );
}
