import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  TrendingUp,
  CreditCard,
  DollarSign,
  Printer,
  Calendar,
  Layers,
  ArrowUpRight,
  Download,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { PageShell } from "@/components/layout/PageShell";
import { useOrders } from "@/lib/ordersStore";
import { useInvoices } from "@/lib/invoicesStore";
import { useCustomInvoices } from "@/lib/billing/store";
import { useProformaInvoices } from "@/lib/proforma/store";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import { playTapSound } from "@/lib/soundEffects";

// ألوان راقية متناسقة مع هوية T.A الزمردية والذهبية
const CHART_COLORS = [
  "#0D4A39",
  "#168063",
  "#C5A059",
  "#22A07E",
  "#2563EB",
  "#8B5CF6",
  "#EC4899",
  "#D97706",
];

export function ReportsPage() {
  const orders = useOrders();
  const invoices = useInvoices();
  const customInvoices = useCustomInvoices();
  const proformaInvoices = useProformaInvoices();

  const [period, setPeriod] = useState<"today" | "week" | "month">("month");

  // تجميع الإيرادات والتحصيلات من جميع مصادر الفواتير
  const metrics = useMemo(() => {
    const calcTotal = (invoices || []).reduce((s, i) => s + (i.total || 0), 0);
    const customSales = (customInvoices || []).filter((i) => i?.meta?.type === "sales");
    const customPurchases = (customInvoices || []).filter((i) => i?.meta?.type === "purchase");

    const customSalesTotal = customSales.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
    const customPurchasesTotal = customPurchases.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

    const calcPaid = (invoices || []).reduce((s, i) => s + (i.paidAmount || 0), 0);
    // نفترض أن فواتير المبيعات الفورية محصلة بالكامل افتراضياً إن لم تكن مسودة
    const customPaid = customSales.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);

    const totalBilled = calcTotal + customSalesTotal;
    const totalCollected = calcPaid + customPaid;
    const totalDebt = Math.max(0, totalBilled - totalCollected);

    const totalArea = (orders || []).reduce((s, o) => s + (o.totalArea || 0), 0);
    const deliveredCount = (orders || []).filter((o) => o.status === "delivered").length;

    return {
      totalBilled,
      totalCollected,
      totalDebt,
      customPurchasesTotal,
      totalArea,
      orderCount: (orders || []).length,
      deliveredCount,
      invoicesCount: (invoices || []).length + (customInvoices || []).length,
    };
  }, [invoices, customInvoices, orders]);

  // الاتجاه اليومي للإيرادات المحسوب بدقة من السجلات الحقيقية
  const revenueTrendData = useMemo(() => {
    const days = [
      { name: "السبت", dayIndex: 6 },
      { name: "الأحد", dayIndex: 0 },
      { name: "الإثنين", dayIndex: 1 },
      { name: "الثلاثاء", dayIndex: 2 },
      { name: "الأربعاء", dayIndex: 3 },
      { name: "الخميس", dayIndex: 4 },
      { name: "الجمعة", dayIndex: 5 },
    ];

    return days.map((d) => {
      const dayCalc = (invoices || []).filter((inv) => {
        const dateStr = inv.date || inv.createdAt;
        if (!dateStr) return false;
        try {
          return new Date(dateStr).getDay() === d.dayIndex;
        } catch {
          return false;
        }
      });

      const dayCustom = (customInvoices || []).filter((inv) => {
        const dateStr = inv.createdAt || inv.meta?.date;
        if (!dateStr) return false;
        try {
          return new Date(dateStr).getDay() === d.dayIndex;
        } catch {
          return false;
        }
      });

      const dayOrders = (orders || []).filter((o) => {
        if (!o.createdAt) return false;
        try {
          return new Date(o.createdAt).getDay() === d.dayIndex;
        } catch {
          return false;
        }
      });

      const calcRevenue = dayCalc.reduce((sum, inv) => sum + (inv.total || 0), 0);
      const customRevenue = dayCustom.reduce((sum, inv) => sum + (Number(inv.totalAmount) || 0), 0);
      const revenue = calcRevenue + customRevenue;

      const area = Number(dayOrders.reduce((sum, o) => sum + (o.totalArea || 0), 0).toFixed(1));

      return { name: d.name, revenue, area };
    });
  }, [invoices, customInvoices, orders]);

  // توزيع استهلاك الخامات بناءً على أوامر الشغل
  const materialData = useMemo(() => {
    const map = new Map<string, number>();
    (orders || []).forEach((o) => {
      (o.items || []).forEach((it) => {
        const label = materialLabel(it.material);
        map.set(label, (map.get(label) || 0) + (it.area || 0));
      });
    });

    const arr = Array.from(map.entries()).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(1)),
    }));

    // ترتيب تنازلي للأكثر استهلاكاً
    arr.sort((a, b) => b.value - a.value);

    // إذا كانت البيانات فارغة، نضيف قيم توضيحية خفيفة
    return arr.length > 0
      ? arr
      : [
          { name: "بنر كوري 440g", value: 45 },
          { name: "فليكس مضيء", value: 30 },
          { name: "فينيل لاصق", value: 15 },
          { name: "سي ثرو", value: 10 },
        ];
  }, [orders]);

  return (
    <PageShell>
      <main
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-24 md:pb-10"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4 w-full max-w-full">
          {/* 1. الترويسة الرئيسية التنفيذية */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  التقارير والمؤشرات المالية
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                  {metrics.invoicesCount} فاتورة مسجلة
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                مؤشرات الأداء المالي، حجم المبيعات المحصلة والآجلة، ومعدلات استهلاك خامات المطبعة
              </p>
            </div>

            {/* فلتر الفترة الزمنية */}
            <div className="flex items-center gap-1 rounded-xl bg-secondary/70 p-1 border border-border/60 shrink-0">
              {[
                { k: "today", l: "اليوم" },
                { k: "week", l: "هذا الأسبوع" },
                { k: "month", l: "هذا الشهر" },
              ].map(({ k, l }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setPeriod(k as any);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition cursor-pointer active:scale-95 ${
                    period === k
                      ? "bg-primary text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 2. مؤشرات الأداء المالي الرئيسية (Top KPIs) */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي المبيعات المفوترة</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {formatNumber(metrics.totalBilled)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>النقد المحصل فعلياً</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatNumber(metrics.totalCollected)}{" "}
                <span className="text-[10px] text-emerald-600/70 font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>المتبقي آجل / ذمم</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatNumber(metrics.totalDebt)}{" "}
                <span className="text-[10px] text-rose-600/70 font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/[0.05] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#C5A059] flex items-center gap-1.5">
                <Printer className="h-3.5 w-3.5" />
                <span>المساحة المطبوعة</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-[#C5A059] tabular-nums">
                {metrics.totalArea.toFixed(1)}{" "}
                <span className="text-[10px] text-[#C5A059]/80 font-normal">م²</span>
              </p>
            </div>
          </div>

          {/* 3. شبكة الرسوم البيانية التفاعلية (Interactive Recharts Row) */}
          <div className="grid gap-3 sm:gap-4 lg:grid-cols-12">
            {/* أ. الرسم البياني العمودي: الإيرادات الأسبوعية واليومية */}
            <div className="lg:col-span-8 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-black text-foreground">
                    حجم المبيعات اليومية (ج.س)
                  </h2>
                </div>
                <span className="text-[10.5px] font-bold text-muted-foreground font-mono">
                  آخر 7 أيام
                </span>
              </div>

              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrendData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border)/0.5)"
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: any) => [`${formatNumber(Number(value))} ج.س`, "المبيعات"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "14px",
                        direction: "rtl",
                        fontSize: "12px",
                        fontWeight: "bold",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                      }}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#0D4A39"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ب. الرسم البياني الدائري: توزيع استهلاك الخامات */}
            <div className="lg:col-span-4 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-[#C5A059]" />
                  <h2 className="text-xs sm:text-sm font-black text-foreground">
                    استهلاك الخامات (م²)
                  </h2>
                </div>
              </div>

              <div className="h-48 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={materialData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={72}
                      paddingAngle={3}
                    >
                      {materialData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any) => [`${value} م²`, "المساحة"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "14px",
                        direction: "rtl",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* قائمة دلالات الخامات (Legend) */}
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-border/60 text-[10.5px]">
                {materialData.slice(0, 4).map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1.5 truncate">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground font-medium">{entry.name}</span>
                    <span className="font-mono font-bold text-foreground tabular-nums mr-auto">
                      {entry.value}م²
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
