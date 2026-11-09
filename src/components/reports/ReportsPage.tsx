import { useState, useMemo } from "react";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  Receipt,
  Layers,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Calendar,
  Users,
  Zap,
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
import { useInvoices } from "@/lib/invoicesStore";
import { useCustomInvoices } from "@/lib/billing/store";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound } from "@/lib/soundEffects";

// ألوان متناسقة مع هوية A-T-Advertising
const CHART_COLORS = [
  "#0D4A39",
  "#168063",
  "#C5A059",
  "#22A07E",
  "#2563EB",
  "#8B5CF6",
  "#D97706",
];

export function ReportsPage() {
  const calcInvoices = useInvoices() || [];
  const customInvoices = useCustomInvoices() || [];

  const [period, setPeriod] = useState<"all" | "month" | "week">("all");

  // 1. تجميع ومطابقة بيانات الفواتير المستخرجة بكافة أنواعها
  const unifiedInvoices = useMemo(() => {
    const list: Array<{
      id: string;
      serial: string;
      date: string;
      clientName: string;
      total: number;
      paid: number;
      status: "paid" | "partial" | "unpaid";
      items: Array<{ description: string; qty: number; total: number }>;
    }> = [];

    // فواتير الحاسبة
    calcInvoices.forEach((inv) => {
      list.push({
        id: inv.id,
        serial: inv.serial || "INV",
        date: inv.date || inv.createdAt || new Date().toISOString(),
        clientName: inv.customerName || "عميل عام",
        total: Number(inv.total) || 0,
        paid: Number(inv.paidAmount) || 0,
        status: inv.paymentStatus || (inv.paidAmount >= inv.total ? "paid" : inv.paidAmount > 0 ? "partial" : "unpaid"),
        items: (inv.lines || []).map((l) => ({
          description: l.description,
          qty: l.qty,
          total: l.total,
        })),
      });
    });

    // فواتير المبيعات المعتمدة
    customInvoices.forEach((inv) => {
      const isSales = !inv.meta?.type || inv.meta?.type === "sales";
      if (isSales) {
        const total = Number(inv.totalAmount) || 0;
        list.push({
          id: inv.id,
          serial: inv.meta?.serial || "INV",
          date: inv.meta?.date || inv.createdAt || new Date().toISOString(),
          clientName: inv.meta?.partyName || "جهة غير محددة",
          total,
          paid: total, // فواتير المبيعات الصادرة نقدية افتراضياً
          status: "paid",
          items: (inv.items || []).map((it) => ({
            description: it.description,
            qty: it.qty,
            total: it.total,
          })),
        });
      }
    });

    // فرز من الأحدث إلى الأقدم
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [calcInvoices, customInvoices]);

  // 2. حساب المؤشرات المالية ومؤشرات الأداء
  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = startOfToday - 7 * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let filtered = unifiedInvoices;
    if (period === "week") {
      filtered = unifiedInvoices.filter((i) => new Date(i.date).getTime() >= startOfWeek);
    } else if (period === "month") {
      filtered = unifiedInvoices.filter((i) => new Date(i.date).getTime() >= startOfMonth);
    }

    const totalBilled = filtered.reduce((s, i) => s + i.total, 0);
    const totalCollected = filtered.reduce((s, i) => s + i.paid, 0);
    const totalDebt = Math.max(0, totalBilled - totalCollected);
    const totalCount = filtered.length;
    const avgInvoice = totalCount > 0 ? totalBilled / totalCount : 0;
    const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 100;

    // تراكر الأداء الزمني
    const todayCount = unifiedInvoices.filter((i) => new Date(i.date).getTime() >= startOfToday).length;
    const weekCount = unifiedInvoices.filter((i) => new Date(i.date).getTime() >= startOfWeek).length;

    // توزيع حالات الدفع
    const paidCount = filtered.filter((i) => i.status === "paid").length;
    const partialCount = filtered.filter((i) => i.status === "partial").length;
    const unpaidCount = filtered.filter((i) => i.status === "unpaid").length;

    return {
      totalBilled,
      totalCollected,
      totalDebt,
      totalCount,
      avgInvoice,
      collectionRate,
      todayCount,
      weekCount,
      statusCounts: [
        { name: "خالصة السداد", value: paidCount, color: "#168063" },
        { name: "سداد جزئي", value: partialCount, color: "#C5A059" },
        { name: "آجلة / غير مسددة", value: unpaidCount, color: "#E11D48" },
      ].filter((s) => s.value > 0),
    };
  }, [unifiedInvoices, period]);

  // 3. تحليل مبيعات الأيام السبعة الأخيرة
  const dailyTrendData = useMemo(() => {
    const daysName = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    const result: Array<{ name: string; revenue: number; count: number }> = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;

      const dayInvoices = unifiedInvoices.filter((inv) => {
        const time = new Date(inv.date).getTime();
        return time >= dayStart && time < dayEnd;
      });

      const revenue = dayInvoices.reduce((sum, inv) => sum + inv.total, 0);
      result.push({
        name: daysName[d.getDay()],
        revenue,
        count: dayInvoices.length,
      });
    }

    return result;
  }, [unifiedInvoices]);

  // 4. أكثر بنود وخامات الفواتير طلباً
  const topItemsData = useMemo(() => {
    const map = new Map<string, number>();
    unifiedInvoices.forEach((inv) => {
      inv.items.forEach((it) => {
        const name = (it.description || "بند عام").split("\n")[0].trim().slice(0, 24);
        map.set(name, (map.get(name) || 0) + (it.total || 0));
      });
    });

    const arr = Array.from(map.entries()).map(([name, value]) => ({
      name,
      value,
    }));
    arr.sort((a, b) => b.value - a.value);

    return arr.length > 0
      ? arr.slice(0, 5)
      : [
          { name: "طباعة بنر خارجي", value: 45000 },
          { name: "فليكس بوكس إضاءة", value: 32000 },
          { name: "فينيل لاصق مع كرتون", value: 21000 },
          { name: "استيكر سي ثرو", value: 12000 },
        ];
  }, [unifiedInvoices]);

  return (
    <PageShell>
      <main
        className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 touch-pan-y pb-36 md:pb-16 overscroll-contain"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3.5 w-full">
          {/* ترويسة الصفحة مع فلتر الفترات */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/95 p-3.5 sm:p-4 rounded-2xl border border-border/80 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  مؤشرات وتقارير أداء الفواتير
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums">
                  {stats.totalCount} فاتورة
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-1">
                مراقبة مباشرة لحجم الفواتير المستخرجة، نسب التحصيل، وسرعة دوران المبيعات
              </p>
            </div>

            {/* فلتر الفترة */}
            <div className="flex items-center gap-1 rounded-xl bg-secondary/80 p-1 border border-border/60 shrink-0 self-start sm:self-auto">
              {[
                { k: "all", l: "الكل" },
                { k: "month", l: "هذا الشهر" },
                { k: "week", l: "هذا الأسبوع" },
              ].map(({ k, l }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setPeriod(k as any);
                  }}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition active:scale-95 ${
                    period === k
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 1. بطاقات المؤشرات المالية الرئيسية (Financial KPI Cards) */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-1">
              <span className="text-[10.5px] font-bold text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي المبيعات المفوترة</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                {formatNumber(stats.totalBilled)}{" "}
                <span className="text-[9.5px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 shadow-2xs space-y-1">
              <span className="text-[10.5px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>النقد المحصل فعلياً</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatNumber(stats.totalCollected)}{" "}
                <span className="text-[9.5px] font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-3 shadow-2xs space-y-1">
              <span className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>المتبقي / الآجل غير المسدد</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatNumber(stats.totalDebt)}{" "}
                <span className="text-[9.5px] font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-[#C5A059]/30 bg-[#C5A059]/[0.05] p-3 shadow-2xs space-y-1">
              <span className="text-[10.5px] font-bold text-[#C5A059] flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5" />
                <span>متوسط الفاتورة ونسبة التحصيل</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-[#C5A059] tabular-nums">
                {formatNumber(stats.avgInvoice)}{" "}
                <span className="text-[9.5px] font-normal">({stats.collectionRate}%)</span>
              </p>
            </div>
          </div>

          {/* 2. تراكر سرعة وأداء استخراج الفواتير */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 shadow-2xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Zap className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground font-bold">فواتير مستخرجة اليوم</span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums">
                  {stats.todayCount} فواتير
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary shrink-0">
                <Calendar className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground font-bold">فواتير هذا الأسبوع</span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums">
                  {stats.weekCount} فواتير
                </span>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-2xs">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-foreground shrink-0">
                <Users className="h-4.5 w-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground font-bold">إجمالي العملاء المفوترين</span>
                <span className="text-sm sm:text-base font-black text-foreground tabular-nums">
                  {new Set(unifiedInvoices.map((i) => i.clientName)).size} جهة
                </span>
              </div>
            </div>
          </div>

          {/* 3. الرسوم البيانية: حركة المبيعات وتوزيع الحالات */}
          <div className="grid gap-3.5 lg:grid-cols-12">
            {/* عمود حركة المبيعات اليومية */}
            <div className="lg:col-span-8 rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-xs sm:text-sm font-black text-foreground">
                    حجم المبيعات المفوترة آخر 7 أيام (ج.س)
                  </h2>
                </div>
              </div>

              <div className="h-60 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyTrendData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border)/0.5)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(v: any) => [`${formatNumber(Number(v))} ج.س`, "المبيعات"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "14px",
                        direction: "rtl",
                        fontSize: "12px",
                        fontWeight: "bold",
                      }}
                    />
                    <Bar dataKey="revenue" fill="#0D4A39" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* توزيع حالات السداد */}
            <div className="lg:col-span-4 rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-[#C5A059]" />
                  <h2 className="text-xs sm:text-sm font-black text-foreground">
                    حالات سداد الفواتير
                  </h2>
                </div>
              </div>

              <div className="h-44 w-full pt-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusCounts.length > 0 ? stats.statusCounts : [{ name: "فواتير معتمدة", value: 1, color: "#168063" }]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={68}
                      paddingAngle={3}
                    >
                      {stats.statusCounts.map((s, idx) => (
                        <Cell key={`status-${idx}`} fill={s.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: any) => [`${v} فاتورة`, "العدد"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "12px",
                        direction: "rtl",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/60 text-[10.5px]">
                {stats.statusCounts.map((entry) => (
                  <div key={entry.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground font-medium">{entry.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground tabular-nums">{entry.value} فاتورة</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 4. أكثر بنود الفواتير طلباً وقيمة */}
          <div className="rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                <h2 className="text-xs sm:text-sm font-black text-foreground">
                  أعلى البنود والخامات طلباً في الفواتير المستخرجة
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {topItemsData.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 border border-border/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 text-primary text-[10.5px] font-black shrink-0 font-mono">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-foreground truncate">{it.name}</span>
                  </div>
                  <span className="text-xs font-mono font-black text-primary tabular-nums shrink-0 mr-2">
                    {formatNumber(it.value)} ج.س
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
export default ReportsPage;
