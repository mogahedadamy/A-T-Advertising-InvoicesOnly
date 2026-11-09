import React from "react";
import { CalcResult, formatNumber } from "@/lib/printCalculator";
import { CheckCircle2 } from "lucide-react";

interface CalculatorResultPreviewProps {
  result: CalcResult | null;
  error?: string;
}

/**
 * مكون عرض ملخص نتيجة الحساب والأمتار والتكلفة والرول المختار
 * تصميم احترافي مطفأ matte ومحمي من أي تمدد أو سحب أفقي
 */
export const CalculatorResultPreview: React.FC<CalculatorResultPreviewProps> = ({
  result,
  error,
}) => {
  if (error) {
    return (
      <div className="mt-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-center text-xs font-bold text-destructive animate-fade-in w-full max-w-full min-w-0">
        {error}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="mt-3 rounded-2xl border border-border bg-card p-3 shadow-xs animate-fade-in w-full max-w-full min-w-0 overflow-hidden">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
        <div className="flex items-center gap-1.5 text-xs font-black text-foreground">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>تم الحساب</span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/60">
          توزيع الرول
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-center divide-x divide-x-reverse divide-border/50 w-full min-w-0">
        {/* المساحة الإجمالية */}
        <div className="flex flex-col items-center justify-center min-w-0 px-1">
          <span className="text-[10px] font-bold text-muted-foreground mb-0.5 truncate w-full">المساحة</span>
          <span className="text-xs sm:text-sm font-black text-foreground font-mono tabular-nums truncate w-full">
            {result.area.toFixed(2)} م²
          </span>
        </div>

        {/* مقاس الرول ونوع التوزيع */}
        <div className="flex flex-col items-center justify-center min-w-0 px-1">
          <span className="text-[10px] font-bold text-muted-foreground mb-0.5 truncate w-full">{result.type || "الرول المقترح"}</span>
          <span className="text-[11px] sm:text-xs font-black text-foreground bg-secondary border border-border/70 px-1.5 py-0.5 rounded-lg font-mono truncate max-w-full">
            {result.displayRoll}
          </span>
        </div>

        {/* التكلفة الإجمالية للبند */}
        <div className="flex flex-col items-center justify-center min-w-0 px-1">
          <span className="text-[10px] font-bold text-muted-foreground mb-0.5 truncate w-full">القيمة</span>
          <div className="flex items-baseline gap-0.5 truncate max-w-full">
            <span className="text-sm sm:text-base font-black text-foreground font-mono tabular-nums tracking-tight truncate">
              {formatNumber(result.cost)}
            </span>
            <span className="text-[9px] font-bold text-muted-foreground shrink-0">ج.س</span>
          </div>
        </div>
      </div>
    </div>
  );
};
