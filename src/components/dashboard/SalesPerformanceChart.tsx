import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, Calendar, ChevronDown } from "lucide-react";
import { formatNumber } from "@/lib/printCalculator";
import { useOrders } from "@/lib/ordersStore";

interface SalesPoint {
  day: string;
  sales: number;
  ordersCount: number;
  isToday?: boolean;
}

export function SalesPerformanceChart() {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState("7days");
  const orders = useOrders();

  useEffect(() => {
    setMounted(true);
  }, []);

  // حساب إجمالي مبيعات اليوم من الأوامر الحقيقية
  const todaySales = orders.reduce((sum, o) => sum + o.totalCost, 0) || 1232100;

  const chartData: SalesPoint[] = [
    { day: "السبت", sales: 180000, ordersCount: 2 },
    { day: "الأحد", sales: 420000, ordersCount: 4 },
    { day: "الاثنين", sales: 650000, ordersCount: 5 },
    { day: "الثلاثاء", sales: 510000, ordersCount: 3 },
    { day: "الأربعاء", sales: todaySales, ordersCount: orders.length || 7, isToday: true },
    { day: "الخميس", sales: 890000, ordersCount: 6 },
    { day: "الجمعة", sales: 290000, ordersCount: 2 },
  ];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 shadow-sm" dir="rtl">
      {/* Chart Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <TrendingUp className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-foreground md:text-base">
              أداء المبيعات وحركة الطلبات
            </h3>
            <p className="text-[10.5px] font-medium text-muted-foreground">
              متابعة حركة الإيرادات اليومية وتدفق أوامر الطباعة
            </p>
          </div>
        </div>

        {/* Time range selector */}
        <div className="relative">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-secondary/60 px-2.5 py-1 text-[11px] font-bold text-foreground hover:bg-secondary transition"
          >
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span>آخر 7 أيام</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="mt-4 h-56 w-full min-h-[220px]">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground font-bold"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground font-mono"
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload as SalesPoint | undefined;
                    if (!data) return null;
                    return (
                      <div className="rounded-xl border border-border bg-card p-2.5 shadow-xl text-right font-mono" dir="rtl">
                        <p className="text-xs font-black text-foreground">{data.day}</p>
                        <p className="text-sm font-black text-primary mt-1">
                          {formatNumber(data.sales)} <span className="text-[10px] text-muted-foreground">ج.س</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {data.ordersCount} أمر شغل
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#salesGradient)"
                activeDot={{ r: 6, fill: "#22c55e", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            جاري تجهيز الرسم البياني...
          </div>
        )}
      </div>

      {/* Chart Footer Indicator */}
      <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
        <div className="flex items-center gap-1.5 font-bold">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-foreground">ذروة المبيعات اليوم:</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono">
            {formatNumber(todaySales)} ج.س
          </span>
        </div>
        <span className="text-muted-foreground text-[10.5px]">
          معدل النمو الأسبوعي: <strong className="text-primary font-mono">+15%</strong>
        </span>
      </div>
    </div>
  );
}
