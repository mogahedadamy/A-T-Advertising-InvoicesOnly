import { useMemo } from "react";
import { Coins, FileText, Maximize2, Ruler } from "lucide-react";
import { formatNumber } from "@/lib/printCalculator";
import { useOrderSession } from "@/lib/orderSession";
import { StatCard } from "./StatCard";

/** ملخص اليوم: يقرأ طلبية الجلسة الحالية من الحاسبة (بدون تخزين دائم حتى المرحلة الثانية) */
export function TodaySummary() {
  const [order] = useOrderSession();
  const totals = useMemo(
    () => ({
      count: order.length,
      area: order.reduce((a, b) => a + b.area, 0),
      cost: order.reduce((a, b) => a + b.cost, 0),
    }),
    [order],
  );

  return (
    <section aria-label="ملخص الطلبية الحالية">
      <h2 className="mb-2 text-sm font-black">ملخص الطلبية الحالية</h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <StatCard
          label="عدد المقاسات"
          value={String(totals.count)}
          icon={<Ruler className="h-3.5 w-3.5 text-primary" />}
        />
        <StatCard
          label="إجمالي الأمتار المطبوعة"
          value={`${totals.area.toFixed(2)} م²`}
          icon={<Maximize2 className="h-3.5 w-3.5 text-primary" />}
        />
        <StatCard
          label="إجمالي المبلغ"
          value={formatNumber(totals.cost)}
          hint="ج.م"
          emphasize
          icon={<Coins className="h-3.5 w-3.5 text-primary" />}
        />
        <StatCard
          label="فواتير اليوم"
          value="0"
          hint="يُربط بسجل الفواتير لاحقًا"
          icon={<FileText className="h-3.5 w-3.5 text-primary" />}
        />
      </div>
    </section>
  );
}
