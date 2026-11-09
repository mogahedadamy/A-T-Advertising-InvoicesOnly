import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Layers, ChevronLeft } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";
import { useOrderSession } from "@/lib/orderSession";
import { MATERIALS, MaterialKey, materialLabel } from "@/lib/printCalculator";

const MATERIAL_COLORS: Record<MaterialKey, string> = {
  flex: "bg-red-500",
  banner: "bg-amber-500",
  sticker: "bg-blue-500",
  indoor_sticker: "bg-cyan-500",
  reflective: "bg-purple-500",
  mesh: "bg-emerald-500",
  coated: "bg-indigo-500",
};

export function MaterialStats() {
  const orders = useOrders();
  const [sessionOrder] = useOrderSession();

  const materialBreakdown = useMemo(() => {
    const totals: Record<MaterialKey, { area: number; count: number }> = {
      flex: { area: 0, count: 0 },
      banner: { area: 0, count: 0 },
      sticker: { area: 0, count: 0 },
      indoor_sticker: { area: 0, count: 0 },
      reflective: { area: 0, count: 0 },
      mesh: { area: 0, count: 0 },
      coated: { area: 0, count: 0 },
    };

    // جمع من الطلبات المسجلة
    orders.forEach((o) => {
      o.items.forEach((it) => {
        if (totals[it.material]) {
          totals[it.material].area += it.area;
          totals[it.material].count += it.qty;
        }
      });
    });

    // جمع من الجلسة الحالية
    sessionOrder.forEach((it) => {
      if (totals[it.material]) {
        totals[it.material].area += it.area;
        totals[it.material].count += it.qty;
      }
    });

    const sumArea = Object.values(totals).reduce((a, b) => a + b.area, 0);

    return {
      totals,
      sumArea: sumArea || 1, // لمنع القسمة على صفر
    };
  }, [orders, sessionOrder]);

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div>
          <h3 className="text-sm font-black text-foreground md:text-base">
            استهلاك الخامات اليوم
          </h3>
          <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
            توزيع الأمتار المطبوعة ونسب استهلاك الرولات
          </p>
        </div>
        <Link
          to="/materials"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-primary transition"
        >
          <span>المخزون والأسعار</span>
          <ChevronLeft className="h-3 w-3" />
        </Link>
      </div>

      {/* Progress Bar Stacked */}
      <div className="mt-3.5 flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
        {MATERIALS.map((m) => {
          const item = materialBreakdown.totals[m.key];
          const pct = Math.round((item.area / materialBreakdown.sumArea) * 100);
          if (pct === 0) return null;

          return (
            <div
              key={m.key}
              style={{ width: `${pct}%` }}
              className={`${MATERIAL_COLORS[m.key]} transition-all duration-500`}
              title={`${m.label}: ${item.area.toFixed(1)} م² (${pct}%)`}
            />
          );
        })}
      </div>

      {/* Legend & Details */}
      <div className="mt-3.5 space-y-2">
        {MATERIALS.map((m) => {
          const item = materialBreakdown.totals[m.key];
          const pct = Math.round((item.area / materialBreakdown.sumArea) * 100);

          return (
            <div key={m.key} className="flex items-center justify-between text-xs rounded-lg px-1.5 py-1 hover:bg-secondary/30 transition">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${MATERIAL_COLORS[m.key]}`} />
                <span className="font-bold text-foreground">{m.label}</span>
              </div>
              <div className="flex items-center gap-3 font-mono">
                <span className="font-bold text-foreground">{item.area.toFixed(1)} م²</span>
                <span className="w-9 text-left text-[11px] font-black text-muted-foreground">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
