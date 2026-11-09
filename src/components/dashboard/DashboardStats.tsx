import { useMemo, useEffect, useRef, useState } from "react";
import {
  Clock,
  Wallet,
  CheckCircle2,
  FileText,
  TrendingUp,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { formatNumber } from "@/lib/printCalculator";
import { useOrders } from "@/lib/ordersStore";

/* ─── Animated number hook ────────────────────────────────────── */
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef   = useRef<number>(0);

  useEffect(() => {
    startRef.current = null;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      /* Ease-out cubic */
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

/* ─── Stat Card ───────────────────────────────────────────────── */
interface StatCardProps {
  label:       string;
  value:       number;
  suffix?:     string;
  formatFn?:   (v: number) => string;
  trendPct?:   number;
  trendLabel?: string;
  icon:        React.ElementType;
  colorClass:  string;       /* e.g. "text-amber-500" */
  borderClass: string;       /* e.g. "border-amber-500/25" */
  bgClass:     string;       /* e.g. "bg-amber-500/12" */
  iconBgClass: string;       /* e.g. "bg-amber-500/15 text-amber-500" */
  delay?:      number;       /* animation-delay in ms */
  children?:   React.ReactNode;
}

function StatCard({
  label, value, suffix, formatFn, trendPct, trendLabel,
  icon: Icon, colorClass, borderClass, bgClass, iconBgClass,
  delay = 0, children,
}: StatCardProps) {
  const animated = useCountUp(value, 800);
  const display  = formatFn ? formatFn(animated) : String(animated);
  const isUp     = (trendPct ?? 0) >= 0;

  return (
    <div
      className={[
        "stat-card group relative flex flex-col justify-between",
        "min-h-[108px] sm:min-h-[118px]",
        "rounded-2xl border p-3.5 sm:p-4",
        "shadow-card hover:shadow-float",
        "transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-opacity-50",
        borderClass,
        "bg-gradient-to-br from-card via-card",
        bgClass,
      ].join(" ")}
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <div className="text-right min-w-0 flex-1">
          <span className="block text-[10.5px] sm:text-xs font-bold text-muted-foreground leading-tight">
            {label}
          </span>
          <div className="mt-1.5 flex items-baseline gap-1 flex-wrap">
            <span
              className={[
                "num-display font-black leading-none",
                "text-xl sm:text-2xl md:text-[28px]",
                colorClass,
              ].join(" ")}
            >
              {display}
            </span>
            {suffix && (
              <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                {suffix}
              </span>
            )}
          </div>
        </div>

        <span
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            "transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3",
            iconBgClass,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>

      {/* Bottom: trend or custom children */}
      <div className="mt-2 pt-2 border-t border-border/40">
        {children ?? (
          trendPct !== undefined ? (
            <div className="flex items-center justify-between text-[10px] sm:text-[10.5px] font-bold">
              <span
                className={[
                  "inline-flex items-center gap-0.5",
                  isUp ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500",
                ].join(" ")}
              >
                {isUp
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />
                }
                <span>{Math.abs(trendPct)}%</span>
              </span>
              <span className="text-muted-foreground font-medium">
                {trendLabel}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
              <ArrowRight className="h-3 w-3 text-primary" />
              <span>على خطوط الإنتاج</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}

/* ─── DashboardStats ──────────────────────────────────────────── */
export function DashboardStats() {
  const orders = useOrders();

  const stats = useMemo(() => {
    const total     = orders.length;
    const completed = orders.filter((o) => o.status === "delivered").length;
    const active    = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
    const paid      = orders.reduce((s, o) => s + (o.paidAmount || 0), 0);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, active, paid, pct };
  }, [orders]);

  return (
    <section
      aria-label="مؤشرات الأداء الرئيسية"
      className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4"
      dir="rtl"
    >
      {/* 1. Active orders */}
      <StatCard
        label="قيد التنفيذ بالمطبعة"
        value={stats.active}
        suffix="أمر جاري"
        icon={Clock}
        colorClass="text-amber-500"
        borderClass="border-amber-500/25"
        bgClass="to-amber-500/5"
        iconBgClass="bg-amber-500/15 text-amber-500"
        delay={0}
      />

      {/* 2. Revenue collected */}
      <StatCard
        label="إجمالي المحصل نقداً"
        value={stats.paid}
        suffix="ج.س"
        formatFn={formatNumber}
        trendPct={stats.paid > 0 ? 100 : undefined}
        trendLabel={stats.paid > 0 ? "مبيعات محصلة" : "جاهز للتشغيل"}
        icon={Wallet}
        colorClass="text-emerald-600 dark:text-emerald-400"
        borderClass="border-emerald-500/25"
        bgClass="to-emerald-500/5"
        iconBgClass="bg-emerald-500/15 text-emerald-500"
        delay={80}
      />

      {/* 3. Completion rate */}
      <StatCard
        label="نسبة الإنجاز والتسليم"
        value={stats.completed}
        suffix={`من ${stats.total}`}
        icon={CheckCircle2}
        colorClass="text-blue-500"
        borderClass="border-blue-500/25"
        bgClass="to-blue-500/5"
        iconBgClass="bg-blue-500/15 text-blue-500"
        delay={160}
      >
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-[9.5px] font-mono text-muted-foreground">
            <span>نسبة الإتمام</span>
            <span className="font-black text-foreground">{stats.pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/70">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000 ease-out"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>
      </StatCard>

      {/* 4. Total orders */}
      <StatCard
        label="إجمالي أوامر الشهر"
        value={stats.total}
        suffix="أمر تشغيل"
        trendPct={stats.total > 0 ? 100 : undefined}
        trendLabel={stats.total > 0 ? "إجمالي الأوامر" : "جاهز للتشغيل"}
        icon={FileText}
        colorClass="text-purple-500"
        borderClass="border-purple-500/25"
        bgClass="to-purple-500/5"
        iconBgClass="bg-purple-500/15 text-purple-500"
        delay={240}
      />
    </section>
  );
}
