import React from "react";
import { Calculator, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CalculatorActionButtonsProps {
  onCalc: () => void;
  onAddToOrder: () => void;
}

/**
 * أزرار تنفيذ العمليات في الحاسبة (احسب الآن + إضافة للطلب)
 * مصممة بهيكل مطفأ matte وبدون أي ظلال مضيئة نيون
 */
export const CalculatorActionButtons: React.FC<CalculatorActionButtonsProps> = ({
  onCalc,
  onAddToOrder,
}) => {
  return (
    <div className="mt-3.5 grid grid-cols-5 gap-2.5 w-full max-w-full min-w-0">
      <Button
        type="button"
        size="lg"
        onClick={onCalc}
        className="col-span-3 min-h-[46px] min-w-0 rounded-xl bg-primary text-primary-foreground text-xs sm:text-sm font-black shadow-xs hover:bg-primary/90 active:scale-[0.98] touch-manipulation border border-primary/20"
      >
        <span className="relative inline-flex items-center justify-center gap-1.5 truncate">
          <Calculator className="h-4 w-4 shrink-0" />
          <span className="truncate">احسب المقاس</span>
        </span>
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        onClick={onAddToOrder}
        className="col-span-2 min-h-[46px] min-w-0 flex items-center justify-center gap-1 rounded-xl border border-border/80 bg-secondary/80 text-xs sm:text-sm font-black text-foreground hover:bg-card hover:border-primary/40 active:scale-[0.98] touch-manipulation shadow-xs"
      >
        <Plus className="h-4 w-4 text-primary shrink-0" />
        <span className="truncate">إدراج</span>
      </Button>
    </div>
  );
};
