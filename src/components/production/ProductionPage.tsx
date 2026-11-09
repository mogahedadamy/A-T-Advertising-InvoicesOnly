import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  Printer,
  ChevronLeft,
  ChevronRight,
  Flame,
  CheckCircle2,
  Layers,
  PlusCircle,
  FileText,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Scissors,
  Paintbrush,
  Sparkles,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import {
  useOrders,
  updateOrderStatus,
  STATUS_CONFIG,
  type OrderStatus,
  type PrintOrder,
} from "@/lib/ordersStore";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import { playTapSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";

interface StageDef {
  key: OrderStatus;
  title: string;
  badgeBg: string;
  badgeColor: string;
  desc: string;
  icon: typeof Printer;
}

const STAGES: StageDef[] = [
  {
    key: "new",
    title: "أوامر جديدة",
    badgeBg: "bg-blue-500/10 border-blue-500/20",
    badgeColor: "text-blue-600 dark:text-blue-400",
    desc: "بانتظار تجهيز الملفات",
    icon: FileText,
  },
  {
    key: "design",
    title: "تحت التصميم",
    badgeBg: "bg-purple-500/10 border-purple-500/20",
    badgeColor: "text-purple-600 dark:text-purple-400",
    desc: "تدقيق القياس والـ RIP",
    icon: Paintbrush,
  },
  {
    key: "ready_to_print",
    title: "جاهز للطباعة",
    badgeBg: "bg-amber-500/10 border-amber-500/20",
    badgeColor: "text-amber-600 dark:text-amber-400",
    desc: "في طابور الماكينات",
    icon: Clock,
  },
  {
    key: "printing",
    title: "قيد الطباعة",
    badgeBg: "bg-primary/10 border-primary/20",
    badgeColor: "text-primary font-black",
    desc: "الماكينات تعمل الآن",
    icon: Printer,
  },
  {
    key: "finishing",
    title: "تشطيب وقص",
    badgeBg: "bg-indigo-500/10 border-indigo-500/20",
    badgeColor: "text-indigo-600 dark:text-indigo-400",
    desc: "قص وخياطة وحلقات",
    icon: Scissors,
  },
  {
    key: "delivered",
    title: "تم التسليم",
    badgeBg: "bg-emerald-500/10 border-emerald-500/20",
    badgeColor: "text-emerald-600 dark:text-emerald-400",
    desc: "مكتمل ومسلّم للعميل",
    icon: CheckCircle2,
  },
];

const STAGE_KEYS: OrderStatus[] = [
  "new",
  "design",
  "ready_to_print",
  "printing",
  "finishing",
  "delivered",
];

export function ProductionPage() {
  const orders = useOrders();
  const [activeMobileTab, setActiveMobileTab] = useState<OrderStatus>("printing");

  const moveOrder = (orderId: string, currentStatus: OrderStatus, direction: "next" | "prev") => {
    playTapSound();
    const idx = STAGE_KEYS.indexOf(currentStatus);
    if (direction === "next" && idx < STAGE_KEYS.length - 1) {
      const nextStatus = STAGE_KEYS[idx + 1];
      if (nextStatus) {
        updateOrderStatus(orderId, nextStatus);
        const stageObj = STAGES.find((s) => s.key === nextStatus);
        toast.success(`تم نقل الأمر إلى مرحلة: ${stageObj?.title || nextStatus}`);
      }
    } else if (direction === "prev" && idx > 0) {
      const prevStatus = STAGE_KEYS[idx - 1];
      if (prevStatus) {
        updateOrderStatus(orderId, prevStatus);
        const stageObj = STAGES.find((s) => s.key === prevStatus);
        toast.info(`تم إرجاع الأمر إلى مرحلة: ${stageObj?.title || prevStatus}`);
      }
    }
  };

  const stageBuckets = useMemo(() => {
    const map: Record<OrderStatus, PrintOrder[]> = {
      new: [],
      design: [],
      ready_to_print: [],
      printing: [],
      finishing: [],
      delivered: [],
      cancelled: [],
    };
    (orders || []).forEach((o) => {
      if (map[o.status]) {
        map[o.status].push(o);
      }
    });
    return map;
  }, [orders]);

  const activeCount =
    stageBuckets.new.length +
    stageBuckets.design.length +
    stageBuckets.ready_to_print.length +
    stageBuckets.printing.length +
    stageBuckets.finishing.length;

  return (
    <PageShell>
      <main
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-24 md:pb-10"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4 w-full max-w-full">
          {/* 1. الترويسة الرئيسية التنفيذية لخط الإنتاج */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Printer className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  طابور الإنتاج وورشة الطباعة (Kanban)
                </h1>
                <span className="text-[11px] font-mono font-black text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 tabular-nums shrink-0">
                  {activeCount} أمر نشط بالورشة
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                توزيع ومتابعة تدفق أوامر العمل لحظياً عبر الماكينات ومراحل التشطيب والتسليم
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/orders"
                className="h-9 px-3.5 rounded-xl border border-border/70 bg-secondary/60 hover:bg-secondary text-foreground text-xs font-black inline-flex items-center gap-1.5 transition active:scale-95"
              >
                <FileText className="h-4 w-4" />
                <span>سجل الأوامر</span>
              </Link>
              <Link
                to="/calculator"
                className="h-9 px-4 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.98] transition-all inline-flex items-center"
              >
                <PlusCircle className="h-4 w-4" />
                <span>أمر شغل جديد</span>
              </Link>
            </div>
          </div>

          {/* 2. شريط التبويب السريع للهاتف (Mobile Stage Switcher) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none md:hidden border-b border-border/60">
            {STAGES.map((s) => {
              const count = stageBuckets[s.key].length;
              const active = activeMobileTab === s.key;
              const Icon = s.icon;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setActiveMobileTab(s.key);
                  }}
                  className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer touch-manipulation active:scale-95 ${
                    active
                      ? "bg-primary text-white shadow-xs shadow-primary/30"
                      : "bg-card border border-border/70 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{s.title}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-black tabular-nums ${
                      active ? "bg-white/20 text-white" : "bg-secondary text-foreground"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 3. عرض الأعمدة للكانبان الكامل (Desktop & Tablet Multi-Column View) */}
          <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-6 gap-3 items-start">
            {STAGES.map((stage) => {
              const list = stageBuckets[stage.key];
              const isPrinting = stage.key === "printing";
              const Icon = stage.icon;

              return (
                <div
                  key={stage.key}
                  className={`rounded-2xl border bg-card/90 backdrop-blur-md p-3 shadow-2xs min-h-[500px] flex flex-col transition-colors ${
                    isPrinting
                      ? "border-primary/40 bg-primary/[0.02]"
                      : "border-border/70"
                  }`}
                >
                  {/* ترويسة العمود */}
                  <div className="pb-2.5 mb-2.5 border-b border-border/60 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-black text-foreground">
                          {stage.title}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.2 text-[10px] font-mono font-black border tabular-nums ${stage.badgeBg} ${stage.badgeColor}`}
                        >
                          {list.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">{stage.desc}</p>
                    </div>
                  </div>

                  {/* بطاقات العمود */}
                  <div className="space-y-2.5 flex-1 overflow-y-auto pr-0.5">
                    {list.length === 0 ? (
                      <div className="py-10 text-center text-[11px] font-bold text-muted-foreground/50 border border-dashed border-border/60 rounded-xl">
                        لا توجد أوامر هنا
                      </div>
                    ) : (
                      list.map((order) => {
                        const isUrgent = order.priority === "urgent";
                        const primaryMaterial = order.items?.[0]?.material
                          ? materialLabel(order.items[0].material)
                          : "بنر عادي";

                        return (
                          <div
                            key={order.id}
                            className={`rounded-xl border p-2.5 shadow-2xs transition-all hover:shadow-md ${
                              isUrgent
                                ? "border-rose-500/40 bg-rose-500/[0.04]"
                                : "border-border/70 bg-secondary/30 hover:bg-secondary/60"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-xs text-foreground">
                                #{order.orderNumber}
                              </span>
                              {isUrgent && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-1.5 text-[9px] font-black text-rose-600 dark:text-rose-400">
                                  <Flame className="h-2.5 w-2.5" />
                                  مستعجل
                                </span>
                              )}
                            </div>

                            <p className="font-black text-xs text-foreground mt-1 truncate">
                              {order.customerName || "عميل بدون اسم"}
                            </p>

                            <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="truncate max-w-[90px]">{primaryMaterial}</span>
                              <span className="font-mono font-bold text-foreground tabular-nums">
                                {order.totalArea?.toFixed(1) || 0} م²
                              </span>
                            </div>

                            {/* أزرار التحريك بين المراحل */}
                            <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-1">
                              {stage.key !== "new" ? (
                                <button
                                  type="button"
                                  onClick={() => moveOrder(order.id, order.status, "prev")}
                                  className="h-6 px-1.5 rounded-lg border border-border/60 bg-card hover:bg-secondary text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5 cursor-pointer transition active:scale-90"
                                  title="إرجاع للمرحلة السابقة"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                  <span>رجوع</span>
                                </button>
                              ) : <span />}

                              {stage.key !== "delivered" ? (
                                <button
                                  type="button"
                                  onClick={() => moveOrder(order.id, order.status, "next")}
                                  className="h-6 px-2 rounded-lg bg-primary hover:bg-primary/90 text-white text-[10px] font-black inline-flex items-center gap-0.5 cursor-pointer shadow-2xs transition active:scale-90"
                                  title="تقديم للمرحلة التالية"
                                >
                                  <span>تقديم</span>
                                  <ArrowLeft className="h-3 w-3" />
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>مكتمل</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. عرض التبويب المحدد على الهواتف الذكية (Mobile Active Tab View) */}
          <div className="md:hidden space-y-2.5">
            {(() => {
              const currentStage = STAGES.find((s) => s.key === activeMobileTab) || STAGES[0];
              const list = stageBuckets[activeMobileTab];

              return (
                <div className="rounded-2xl border border-border/70 bg-card/90 p-3.5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div>
                      <h2 className="text-sm font-black text-foreground">{currentStage.title}</h2>
                      <p className="text-[11px] text-muted-foreground">{currentStage.desc}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-black border tabular-nums ${currentStage.badgeBg} ${currentStage.badgeColor}`}
                    >
                      {list.length} أمر
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {list.length === 0 ? (
                      <div className="py-12 text-center text-xs font-bold text-muted-foreground/60 border border-dashed border-border/60 rounded-xl">
                        لا توجد أوامر في مرحلة «{currentStage.title}» حالياً
                      </div>
                    ) : (
                      list.map((order) => {
                        const isUrgent = order.priority === "urgent";
                        const primaryMaterial = order.items?.[0]?.material
                          ? materialLabel(order.items[0].material)
                          : "بنر عادي";

                        return (
                          <div
                            key={order.id}
                            className={`rounded-xl border p-3 shadow-2xs space-y-2 ${
                              isUrgent
                                ? "border-rose-500/40 bg-rose-500/[0.04]"
                                : "border-border/70 bg-secondary/30"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-black text-xs text-foreground">
                                أمر #{order.orderNumber}
                              </span>
                              {isUrgent && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400">
                                  <Flame className="h-3 w-3" />
                                  مستعجل
                                </span>
                              )}
                            </div>

                            <p className="font-black text-sm text-foreground">
                              {order.customerName || "عميل بدون اسم"}
                            </p>

                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1">
                              <div>
                                <span className="text-[10px] block">الخامة</span>
                                <span className="font-bold text-foreground">{primaryMaterial}</span>
                              </div>
                              <div>
                                <span className="text-[10px] block">المساحة</span>
                                <span className="font-mono font-bold text-foreground tabular-nums">
                                  {order.totalArea?.toFixed(1) || 0} م²
                                </span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                              {currentStage.key !== "new" && (
                                <button
                                  type="button"
                                  onClick={() => moveOrder(order.id, order.status, "prev")}
                                  className="h-8 px-3 rounded-lg border border-border/70 bg-card text-xs font-bold text-muted-foreground inline-flex items-center gap-1 active:scale-95"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                  <span>المرحلة السابقة</span>
                                </button>
                              )}

                              {currentStage.key !== "delivered" ? (
                                <button
                                  type="button"
                                  onClick={() => moveOrder(order.id, order.status, "next")}
                                  className="h-8 px-4 rounded-lg bg-primary text-white text-xs font-black inline-flex items-center gap-1 mr-auto shadow-xs active:scale-95"
                                >
                                  <span>تقديم المرحلة</span>
                                  <ArrowLeft className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 dark:text-emerald-400 mr-auto">
                                  <CheckCircle2 className="h-4 w-4" />
                                  <span>تم التسليم بنجاح</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </PageShell>
  );
}
