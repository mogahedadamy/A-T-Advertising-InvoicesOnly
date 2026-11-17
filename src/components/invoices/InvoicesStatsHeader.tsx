import React from "react";
import { formatNumber } from "@/lib/printCalculator";
import { InvoicesStats } from "./types";

interface InvoicesStatsHeaderProps {
  stats: InvoicesStats;
}

/**
 * شريط الإحصائيات السريعة لأرشيف الفواتير
 * يعرض إجمالي المبالغ، عدد فواتير المبيعات، وإيصالات الحاسبة
 */
export const InvoicesStatsHeader: React.FC<InvoicesStatsHeaderProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="rounded-xl border border-border bg-card p-2.5 shadow-2xs">
        <span className="text-[10px] font-bold text-muted-foreground">إجمالي القيمة المفوترة</span>
        <p className="font-mono text-sm font-black text-primary mt-0.5 truncate">
          {formatNumber(stats.totalAmount)} <span className="text-[10px] font-normal">ج.س</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-2.5 shadow-2xs">
        <span className="text-[10px] font-bold text-muted-foreground">فواتير المطالبات</span>
        <p className="font-mono text-sm font-black text-foreground mt-0.5">
          {stats.customCount} <span className="text-[10px] font-normal">فاتورة</span>
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-2.5 shadow-2xs">
        <span className="text-[10px] font-bold text-muted-foreground">إجمالي السجلات</span>
        <p className="font-mono text-sm font-black text-foreground mt-0.5">
          {stats.totalCount} <span className="text-[10px] font-normal">فاتورة</span>
        </p>
      </div>
    </div>
  );
};
