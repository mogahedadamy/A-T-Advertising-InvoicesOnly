import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Clock, CheckCircle2, AlertTriangle, ArrowRight, Printer, Cpu, Scissors } from "lucide-react";
import { useOrders, STATUS_CONFIG, type OrderStatus } from "@/lib/ordersStore";

const STAGES: { key: OrderStatus; label: string; dotColor: string }[] = [
  { key: "new", label: "جديد", dotColor: "bg-blue-500" },
  { key: "design", label: "تصميم", dotColor: "bg-purple-500" },
  { key: "ready_to_print", label: "جاهز", dotColor: "bg-amber-500" },
  { key: "printing", label: "طباعة", dotColor: "bg-primary" },
  { key: "finishing", label: "تشطيب", dotColor: "bg-indigo-500" },
  { key: "delivered", label: "تم التسليم", dotColor: "bg-emerald-500" },
];

export function ProductionPipeline() {
  const orders = useOrders();

  const stageCounts = useMemo(() => {
    const counts: Record<OrderStatus, number> = {
      new: 0,
      design: 0,
      ready_to_print: 0,
      printing: 0,
      finishing: 0,
      delivered: 0,
      cancelled: 0,
    };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    });
    return counts;
  }, [orders]);

  const activeCount =
    stageCounts.new +
    stageCounts.design +
    stageCounts.ready_to_print +
    stageCounts.printing +
    stageCounts.finishing;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm" dir="rtl">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <div>
          <h3 className="text-sm font-black text-foreground md:text-base">
            خط الإنتاج والورشة
          </h3>
          <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
            {activeCount} أمر شغل قيد التنفيذ والمتابعة في الورشة
          </p>
        </div>
        <Link
          to="/production"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/20 transition"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
          <span>متابعة تفصيلية</span>
        </Link>
      </div>

      {/* Pipeline Stages Grid with Visual Stepper Effect */}
      <div className="mt-3.5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map((s, idx) => {
          const count = stageCounts[s.key] ?? 0;
          const isPrinting = s.key === "printing";

          return (
            <div
              key={s.key}
              className={`relative flex flex-col items-center rounded-xl border p-2.5 text-center transition-all ${
                isPrinting && count > 0
                  ? "border-primary/50 bg-primary/10 shadow-xs ring-1 ring-primary/30"
                  : count > 0
                  ? "border-border bg-secondary/50 shadow-xs"
                  : "border-border/50 bg-secondary/20 opacity-70"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${s.dotColor}`} />
                <span className="text-[10.5px] font-black text-foreground">
                  {s.label}
                </span>
              </div>

              <span
                className={`mt-1 font-mono text-lg font-black leading-tight ${
                  count > 0 ? "text-foreground" : "text-muted-foreground/40"
                }`}
              >
                {count}
              </span>
            </div>
          );
        })}
      </div>

      {/* Hardware / Machines Realtime Status */}
      <div className="mt-3.5 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-2.5 border border-border/50">
          <div className="flex items-center gap-2">
            <Printer className="h-3.5 w-3.5 text-primary" />
            <span className="font-bold text-[11px] text-foreground">ماكينة فلكس 3.2م</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            نشطة
          </span>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-secondary/40 p-2.5 border border-border/50">
          <div className="flex items-center gap-2">
            <Scissors className="h-3.5 w-3.5 text-indigo-500" />
            <span className="font-bold text-[11px] text-foreground">كتر بلوتر وتشطيب</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            جاهز
          </span>
        </div>
      </div>
    </div>
  );
}
