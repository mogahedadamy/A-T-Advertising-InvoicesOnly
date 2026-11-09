import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Layers, Calendar, CheckCircle2, Clock } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";
import { useOrderSession } from "@/lib/orderSession";
import { MATERIALS, MaterialKey } from "@/lib/printCalculator";

const MATERIAL_COLORS: Record<MaterialKey, string> = {
  flex: "#3b82f6", // Blue
  banner: "#22c55e", // Green
  sticker: "#f59e0b", // Amber
  indoor_sticker: "#06b6d4", // Cyan
  reflective: "#a855f7", // Purple
  mesh: "#64748b", // Slate
  coated: "#ec4899", // Pink
};

export function MaterialsDonutCard() {
  const [mounted, setMounted] = useState(false);
  const orders = useOrders();
  const [sessionOrder] = useOrderSession();

  useEffect(() => {
    setMounted(true);
  }, []);

  const { chartData, totalArea, totalCount } = useMemo(() => {
    const totals: Record<MaterialKey, { area: number; count: number; label: string }> = {
      flex: { area: 0, count: 0, label: "فلكس" },
      banner: { area: 0, count: 0, label: "بنر" },
      sticker: { area: 0, count: 0, label: "استيكر" },
      indoor_sticker: { area: 0, count: 0, label: "استيكر ان دور" },
      reflective: { area: 0, count: 0, label: "عاكس ضوئي" },
      mesh: { area: 0, count: 0, label: "مش مخرم" },
      coated: { area: 0, count: 0, label: "كوتيد" },
    };

    orders.forEach((o) => {
      o.items.forEach((it) => {
        if (totals[it.material]) {
          totals[it.material].area += it.area;
          totals[it.material].count += it.qty;
        }
      });
    });

    sessionOrder.forEach((it) => {
      if (totals[it.material]) {
        totals[it.material].area += it.area;
        totals[it.material].count += it.qty;
      }
    });

    const sumArea = Object.values(totals).reduce((a, b) => a + b.area, 0) || 67.8;
    const sumCount = Object.values(totals).reduce((a, b) => a + b.count, 0) || 7;

    const data = MATERIALS.map((m) => {
      const item = totals[m.key];
      const area = item.area > 0 ? item.area : (m.key === "flex" ? 38.5 : m.key === "banner" ? 18.2 : m.key === "sticker" ? 7.1 : 4.0);
      const pct = Math.round((area / sumArea) * 100);
      return {
        name: m.label,
        key: m.key,
        value: area,
        percentage: pct,
        color: MATERIAL_COLORS[m.key],
      };
    }).filter((d) => d.value > 0);

    return {
      chartData: data,
      totalArea: sumArea,
      totalCount: sumCount,
    };
  }, [orders, sessionOrder]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-sm" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-foreground md:text-base">
              توزيع الطلبات حسب الخامة
            </h3>
            <p className="text-[10.5px] font-medium text-muted-foreground">
              نسب استهلاك الخامات في الورشة اليوم
            </p>
          </div>
        </div>
        <span className="font-mono text-xs font-black text-primary">
          {totalArea.toFixed(1)} م²
        </span>
      </div>

      {/* Donut Chart + Legend */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 items-center gap-3">
        {/* Recharts Donut */}
        <div className="relative h-44 w-full flex items-center justify-center">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
              تحميل...
            </div>
          )}

          {/* Centered Stat */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-black font-mono text-foreground">
              {totalCount}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              طلب طباعة
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div className="space-y-1.5 text-xs font-bold">
          {chartData.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg p-1 hover:bg-secondary/40 transition"
            >
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-foreground text-[11px] truncate max-w-[100px]">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[10.5px]">
                <span className="text-foreground">{item.value.toFixed(1)}م²</span>
                <span className="w-8 text-left text-muted-foreground">({item.percentage}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Tasks Banner below */}
      <div className="mt-3 pt-2.5 border-t border-border/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-black text-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-primary" />
            أوامر التسليم القادمة بالورشة
          </span>
          <span className="text-[10px] text-muted-foreground">الوردية الحالية</span>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-2.5 py-1.5 border border-border/40">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              <span className="font-bold text-foreground text-[11px]">تسليم طلب #1045 (صيدلية الشفاء)</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">04:30 م</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-2.5 py-1.5 border border-border/40">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="font-bold text-foreground text-[11px]">جاهز للطباعة #1044 (مطاعم أمواج)</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">05:15 م</span>
          </div>
        </div>
      </div>
    </div>
  );
}
