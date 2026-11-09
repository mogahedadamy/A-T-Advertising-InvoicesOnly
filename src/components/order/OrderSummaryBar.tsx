import { formatNumber } from "@/lib/printCalculator";
import { IssueInvoiceButton } from "@/components/invoice/IssueInvoiceButton";
import { Layers } from "lucide-react";

export function OrderSummaryBar({
  area,
  cost,
  empty,
  onInvoice,
}: {
  area: number;
  cost: number;
  empty: boolean;
  onInvoice: () => void;
}) {
  return (
    <div
      className={`flex w-full max-w-full items-center justify-between gap-2.5 sm:gap-3 rounded-2xl md:rounded-3xl border p-3 sm:p-4 shadow-xs transition-all duration-150 overflow-hidden min-w-0 ${
        empty
          ? "border-border/80 bg-card/90 backdrop-blur-md opacity-85"
          : "border-border bg-card/95 backdrop-blur-md"
      }`}
      dir="rtl"
    >
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground truncate">
          <span className="flex items-center gap-1 shrink-0">
            <Layers className="h-3.5 w-3.5 text-primary/80" />
            <span>المقاسات:</span>
          </span>
          <span className="inline-flex items-center rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-[11px] font-black text-foreground tabular-nums border border-border/50 shrink-0">
            {area.toFixed(2)} م²
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-0.5 text-lg sm:text-xl font-black text-foreground truncate">
          <span className="font-mono tabular-nums text-foreground text-xl sm:text-2xl font-black tracking-tight truncate">
            {formatNumber(cost)}
          </span>
          <span className="text-[10px] sm:text-xs font-black text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded-md shrink-0">
            ج.س
          </span>
        </div>
      </div>
      <div className="w-36 xs:w-44 sm:w-52 shrink-0 min-w-0">
        <IssueInvoiceButton disabled={empty} onClick={onInvoice} />
      </div>
    </div>
  );
}
