import { Trash2, Pencil } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import type { OrderItem } from "@/lib/invoice/fromCalc";
import { OrderDescriptionEditor } from "./OrderDescriptionEditor";

interface Props {
  item: OrderItem;
  index: number;
  onRemove: () => void;
  onDescriptionChange: (value: string) => void;
}

export function OrderItemRow({ item, index, onRemove, onDescriptionChange }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <li className="group rounded-2xl border border-border/70 bg-card/60 p-2.5 sm:p-3 mb-2 hover:bg-card hover:border-primary/40 hover:shadow-2xs transition-all duration-150 w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 sm:gap-2.5 w-full min-w-0">
        {/* Index Badge */}
        <span className="grid h-6 w-6 sm:h-7 sm:w-7 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-black text-foreground border border-border/70">
          {index + 1}
        </span>

        {/* Content Details */}
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs sm:text-[13px] font-black text-foreground truncate max-w-full">
              {materialLabel(item.material)}
            </span>
            <span className="text-[10.5px] sm:text-[11px] font-bold text-foreground/80 bg-secondary px-1.5 py-0.5 rounded-lg border border-border/60 shrink-0">
              <bdi>{item.width} × {item.height} سم</bdi>
            </span>
            {item.qty > 1 && (
              <span className="text-[10px] font-black text-foreground bg-secondary px-1.5 py-0.5 rounded-md border border-border/70 shrink-0">
                × {item.qty}
              </span>
            )}
          </div>

          {/* Description button */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label={`تعديل البيان للبند ${index + 1}`}
            className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors text-right truncate max-w-full group/btn touch-manipulation active:scale-[0.98] cursor-pointer"
          >
            <Pencil className="h-3 w-3 shrink-0 opacity-60 group-hover/btn:opacity-100" />
            <span className="truncate underline-offset-2 hover:underline">
              {item.description || "إضافة تفاصيل أو بيان..."}
            </span>
          </button>
        </div>

        {/* Cost & Delete */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="flex items-baseline gap-1 text-left">
            <span className="text-xs sm:text-sm font-black text-foreground font-mono tabular-nums" dir="ltr">
              {formatNumber(item.cost)}
            </span>
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground">ج.س</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`حذف البند ${index + 1}`}
            title="حذف البند"
            className="h-7 w-7 sm:h-8 sm:w-8 rounded-xl text-muted-foreground/70 hover:text-destructive hover:bg-destructive/15 transition-all touch-manipulation active:scale-95 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {editing && (
        <OrderDescriptionEditor
          index={index}
          value={item.description ?? ""}
          onSave={onDescriptionChange}
          onClose={() => setEditing(false)}
        />
      )}
    </li>
  );
}
