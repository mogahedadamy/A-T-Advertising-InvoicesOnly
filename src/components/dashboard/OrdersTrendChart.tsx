import { useState, useEffect, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Calendar, TrendingUp } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";

interface TrendPoint {
  day: string;
  orders: number;
}

export function OrdersTrendChart() {
  const [mounted, setMounted] = useState(false);
  const [period, setPeriod] = useState<"7d" | "30d">("7d");
  const orders = useOrders();

  useEffect(() => {
    setMounted(true);
  }, []);

  const data7d = useMemo<TrendPoint[]>(() => {
    const days = [
      { name: "السبت", dayIndex: 6 },
      { name: "الأحد", dayIndex: 0 },
      { name: "الاثنين", dayIndex: 1 },
      { name: "الثلاثاء", dayIndex: 2 },
      { name: "الأربعاء", dayIndex: 3 },
      { name: "الخميس", dayIndex: 4 },
      { name: "الجمعة", dayIndex: 5 },
    ];
    return days.map((d) => {
      const count = orders.filter((o) => {
        if (!o.createdAt) return false;
        try {
          return new Date(o.createdAt).getDay() === d.dayIndex;
        } catch {
          return false;
        }
      }).length;
      return { day: d.name, orders: count };
    });
  }, [orders]);

  const data30d = useMemo<TrendPoint[]>(() => {
    return [
      { day: "الأسبوع 1", orders: orders.filter((_, i) => i % 4 === 0).length },
      { day: "الأسبوع 2", orders: orders.filter((_, i) => i % 4 === 1).length },
      { day: "الأسبوع 3", orders: orders.filter((_, i) => i % 4 === 2).length },
      { day: "الأسبوع 4", orders: orders.filter((_, i) => i % 4 === 3).length },
    ];
  }, [orders]);

  const currentData = period === "7d" ? data7d : data30d;
  const totalPeriodOrders = useMemo(
    () => currentData.reduce((acc, cur) => acc + cur.orders, 0),
    [currentData]
  );

  return (
    <div
      className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs min-h-[300px] md:h-[310px]"
      dir="rtl"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-black text-foreground">
              حركة وتدفق الطلبات
            </h2>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              إجمالي {totalPeriodOrders} طلب خلال هذه الفترة
            </p>
          </div>
        </div>

        {/* Period toggle pills */}
        <div className="flex items-center gap-1 rounded-xl bg-secondary/40 p-1 border border-border/50">
          <button
            type="button"
            onClick={() => setPeriod("7d")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              period === "7d"
                ? "bg-card text-blue-500 shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            type="button"
            onClick={() => setPeriod("30d")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
              period === "30d"
                ? "bg-card text-blue-500 shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            آخر 30 يوم
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-[210px] md:h-[225px] w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={currentData}
              margin={{ top: 15, right: 10, left: -22, bottom: 0 }}
            >
              <defs>
                <linearGradient id="orderTrendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: "currentColor" }}
                className="text-muted-foreground font-bold"
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, (dataMax: number) => Math.max(dataMax + 2, 5)]}
                tick={{ fontSize: 9.5, fill: "currentColor" }}
                className="text-muted-foreground font-mono"
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as TrendPoint;
                    return (
                      <div className="rounded-xl border border-blue-500/30 bg-card/95 backdrop-blur-md px-3.5 py-2 shadow-xl text-right font-mono" dir="rtl">
                        <p className="text-[11px] font-bold text-muted-foreground">{d.day}</p>
                        <p className="text-sm font-black text-blue-500 mt-0.5 flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5" />
                          <span>{d.orders} أمر تشغيل</span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="orders"
                stroke="#3b82f6"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#orderTrendGradient)"
                activeDot={{ r: 5, fill: "#3b82f6", stroke: "#ffffff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">
            جاري التحميل...
          </div>
        )}
      </div>
    </div>
  );
}
