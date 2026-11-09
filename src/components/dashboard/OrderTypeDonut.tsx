import { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Layers } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";

interface MaterialTypeData {
  key: string;
  name: string;
  count: number;
  pct: number;
  color: string;
}

const BASE_MATERIAL_DATA = [
  { key: "flex", name: "فلكس", color: "#3b82f6" },
  { key: "banner", name: "بنر", color: "#10b981" },
  { key: "reflective", name: "بنر عاكس", color: "#f59e0b" },
  { key: "sticker", name: "استيكر", color: "#8b5cf6" },
  { key: "indoor_sticker", name: "استيكر ان دور", color: "#06b6d4" },
  { key: "mesh", name: "مش", color: "#14b8a6" },
  { key: "coated", name: "كوتيد", color: "#ec4899" },
];

export function OrderTypeDonut() {
  const [mounted, setMounted] = useState(false);
  const [activeItem, setActiveItem] = useState<MaterialTypeData | null>(null);
  const orders = useOrders();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = useMemo<MaterialTypeData[]>(() => {
    const counts: Record<string, number> = {
      flex: 0,
      banner: 0,
      reflective: 0,
      sticker: 0,
      indoor_sticker: 0,
      mesh: 0,
      coated: 0,
    };

    orders.forEach((o) => {
      o.items.forEach((it) => {
        const mat = (it.material || "").toLowerCase();
        if (mat.includes("flex")) counts.flex += it.qty || 1;
        else if (mat.includes("banner") && !mat.includes("reflect")) counts.banner += it.qty || 1;
        else if (mat.includes("reflect")) counts.reflective += it.qty || 1;
        else if (mat.includes("indoor")) counts.indoor_sticker += it.qty || 1;
        else if (mat.includes("stick")) counts.sticker += it.qty || 1;
        else if (mat.includes("mesh")) counts.mesh += it.qty || 1;
        else if (mat.includes("coat")) counts.coated += it.qty || 1;
      });
    });

    const total = Object.values(counts).reduce((s, c) => s + c, 0);

    return BASE_MATERIAL_DATA.map((item) => {
      const count = counts[item.key] || 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return {
        key: item.key,
        name: item.name,
        count,
        pct,
        color: item.color,
      };
    });
  }, [orders]);

  const totalOrders = chartData.reduce((sum, item) => sum + item.count, 0);

  const displayPieData = totalOrders > 0
    ? chartData
    : [{ key: "empty", name: "فارغ", count: 1, pct: 100, color: "hsl(var(--muted)/0.4)" }];

  return (
    <div
      className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs min-h-[300px] md:h-[310px]"
      dir="rtl"
    >
      <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-black text-foreground">
            توزيع الطلبات حسب الخامة
          </h2>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-secondary/60 rounded-full px-2 py-0.5 font-mono">
          {totalOrders} رول
        </span>
      </div>

      {/* 1. Mobile layout (< sm): centered donut + 2-3 column badges */}
      <div className="flex flex-col sm:hidden items-center pt-2 gap-2.5">
        <div className="relative h-[135px] w-full flex items-center justify-center">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={36}
                  outerRadius={52}
                  paddingAngle={totalOrders > 0 ? 3 : 0}
                  dataKey="count"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  onMouseEnter={(_, index) => totalOrders > 0 && setActiveItem(chartData[index] ?? null)}
                  onMouseLeave={() => setActiveItem(null)}
                >
                  {displayPieData.map((entry) => (
                    <Cell
                      key={`cell-mob-${entry.key}`}
                      fill={entry.color}
                      opacity={activeItem && activeItem.key !== entry.key ? 0.4 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-muted-foreground">تحميل...</div>
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all">
            <span className="font-mono text-base font-black text-foreground leading-none">
              {activeItem ? activeItem.count : totalOrders}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
              {activeItem ? activeItem.name : totalOrders === 0 ? "لا توجد خامات" : "إجمالي الأوامر"}
            </span>
          </div>
        </div>

        {/* Legend grid for mobile */}
        <div className="grid grid-cols-2 xs:grid-cols-3 gap-1.5 w-full">
          {chartData.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => totalOrders > 0 && setActiveItem(activeItem?.key === item.key ? null : item)}
              className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-xs border transition-all ${
                activeItem?.key === item.key
                  ? "bg-secondary border-primary/50 ring-1 ring-primary/40 shadow-xs"
                  : "bg-secondary/35 border-border/40 hover:bg-secondary/60"
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-foreground font-bold text-[11px]">
                  {item.name}
                </span>
              </div>
              <span className="font-mono text-[10.5px] font-bold text-muted-foreground shrink-0 mr-1">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Desktop layout (sm: and up): side by side with interactive highlight */}
      <div className="hidden sm:grid grid-cols-12 items-center gap-2 h-[225px]">
        {/* Donut chart */}
        <div className="col-span-5 relative h-full flex items-center justify-center min-w-0">
          {mounted ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                <Pie
                  data={displayPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={58}
                  paddingAngle={totalOrders > 0 ? 3 : 0}
                  dataKey="count"
                  stroke="hsl(var(--card))"
                  strokeWidth={2}
                  onMouseEnter={(_, index) => totalOrders > 0 && setActiveItem(chartData[index] ?? null)}
                  onMouseLeave={() => setActiveItem(null)}
                >
                  {displayPieData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={entry.color}
                      opacity={activeItem && activeItem.key !== entry.key ? 0.4 : 1}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs text-muted-foreground">تحميل...</div>
          )}

          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all">
            <span className="font-mono text-lg font-black text-foreground leading-none">
              {activeItem ? activeItem.count : totalOrders}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground mt-0.5">
              {activeItem ? activeItem.name : totalOrders === 0 ? "لا توجد خامات بعد" : "طلب تشغيل"}
            </span>
          </div>
        </div>

        {/* Legend with interactive hover trigger */}
        <div className="col-span-7 space-y-1.5 pr-1.5 overflow-hidden">
          {chartData.map((item) => (
            <div
              key={item.key}
              onMouseEnter={() => totalOrders > 0 && setActiveItem(item)}
              onMouseLeave={() => setActiveItem(null)}
              className={`flex items-center justify-between text-xs rounded-xl px-2 py-1.5 transition-all cursor-pointer ${
                activeItem?.key === item.key
                  ? "bg-secondary border border-border shadow-2xs translate-x-1"
                  : "hover:bg-secondary/40"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-foreground font-bold text-[11.5px]">
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground shrink-0">
                <span className="font-black text-foreground">{item.count}</span>
                <span>({item.pct}%)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
