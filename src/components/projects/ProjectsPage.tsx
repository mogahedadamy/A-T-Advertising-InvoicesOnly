import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  RefreshCw,
  Search,
  Activity,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCustomers } from "@/lib/customersStore";
import { refreshProjectsFromDb, updateProject, useProjects } from "@/lib/projectsStore";
import {
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_TONES,
  FINANCIAL_STATUS_LABELS,
  FINANCIAL_STATUS_TONES,
  type Project,
  type ProjectExecutionStatus,
  type ProjectFinancialStatus,
} from "@/lib/domain/projects";
import { getAllProjectSummaries, getProjectFinancialSummary } from "@/lib/repositories/ProjectRepository";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound } from "@/lib/soundEffects";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { ProjectDetailsDialog } from "./ProjectDetailsDialog";
import { ReceiptDialog } from "@/components/finance/ReceiptDialog";

type ProjectFilterKey = "all" | "active" | "quotation_pending" | "completed" | "unpaid";

const FILTER_TABS: Array<{ key: ProjectFilterKey; label: string }> = [
  { key: "all", label: "كل المشاريع" },
  { key: "active", label: "النشطة" },
  { key: "quotation_pending", label: "بانتظار عرض" },
  { key: "completed", label: "المكتملة" },
  { key: "unpaid", label: "مستحقات قائمة" },
];

/**
 * صفحة المشاريع (PRD §7.2): واجهة عربية RTL تنفيذية كاملة متسقة مع نظام التصميم،
 * تعرض مؤشرات المشاريع، التصفية الفورية، والوصول لمساحة عمل المشروع بنقرة.
 */
export function ProjectsPage() {
  const projects = useProjects();
  const customers = useCustomers();

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [filter, setFilter] = useState<ProjectFilterKey>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [receiptTargetProject, setReceiptTargetProject] = useState<Project | null>(null);
  const [totals, setTotals] = useState<
    Record<string, { invoiced: number; collected: number; status: ProjectFinancialStatus }>
  >({});
  const [loadingTotals, setLoadingTotals] = useState(false);

  const customerName = useCallback(
    (customerId: string | null) =>
      customerId ? customers.find((c) => c.id === customerId)?.name ?? "عميل غير معروف" : "بلا عميل",
    [customers]
  );

  const handleQuickExecutionChange = async (
    e: React.MouseEvent,
    projectId: string,
    newStatus: ProjectExecutionStatus
  ) => {
    e.stopPropagation();
    playTapSound();
    try {
      await updateProject(projectId, { executionStatus: newStatus });
      toast.success(`تم تحديث مرحلة التنفيذ إلى: ${EXECUTION_STATUS_LABELS[newStatus]}`);
    } catch (err) {
      console.error("Failed to update execution status:", err);
      toast.error("تعذر تحديث مرحلة التنفيذ");
    }
  };

  // إجماليات كل مشروع تُقرأ عبر استعلام تجميعي واحد فائق السرعة (PRD §15)
  const loadTotals = useCallback(async () => {
    if (projects.length === 0) {
      setTotals({});
      return;
    }
    setLoadingTotals(true);
    try {
      const summaries = await getAllProjectSummaries();
      const map: Record<string, { invoiced: number; collected: number; status: ProjectFinancialStatus }> = {};
      for (const row of summaries) {
        map[row.id] = {
          invoiced: row.summary.invoicedAmount,
          collected: row.summary.collectedAmount,
          status: row.summary.suggestedFinancialStatus,
        };
      }
      setTotals(map);
    } catch (err) {
      console.warn("[ProjectsPage] totals failed:", err);
    } finally {
      setLoadingTotals(false);
    }
  }, [projects]);

  useEffect(() => {
    void refreshProjectsFromDb();
    const onReady = () => {
      void refreshProjectsFromDb();
      void loadTotals();
    };
    window.addEventListener("native-storage-ready", onReady);
    window.addEventListener("project-relations-changed", onReady);
    return () => {
      window.removeEventListener("native-storage-ready", onReady);
      window.removeEventListener("project-relations-changed", onReady);
    };
  }, [loadTotals]);

  useEffect(() => {
    void loadTotals();
  }, [loadTotals]);

  const stats = useMemo(() => {
    const activeCount = projects.filter(
      (p) => p.executionStatus !== "completed" && p.executionStatus !== "cancelled"
    ).length;
    const totalInvoiced = Object.values(totals).reduce((sum, e) => sum + (Number(e.invoiced) || 0), 0);
    const totalCollected = Object.values(totals).reduce((sum, e) => sum + (Number(e.collected) || 0), 0);
    const unpaidCount = projects.filter((p) => {
      const status = totals[p.id]?.status ?? p.financialStatus;
      return status === "unpaid" || status === "partially_paid";
    }).length;
    return {
      total: projects.length,
      activeCount,
      totalInvoiced,
      totalCollected,
      unpaidCount,
    };
  }, [projects, totals]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return projects.filter((project) => {
      const effectiveFinancial = totals[project.id]?.status ?? project.financialStatus;
      const matchesFilter =
        filter === "all" ||
        (filter === "active" &&
          project.executionStatus !== "completed" &&
          project.executionStatus !== "cancelled") ||
        (filter === "quotation_pending" && project.executionStatus === "quotation_pending") ||
        (filter === "completed" && project.executionStatus === "completed") ||
        (filter === "unpaid" &&
          (effectiveFinancial === "unpaid" || effectiveFinancial === "partially_paid"));

      if (!matchesFilter) return false;
      if (!q) return true;

      const name = customerName(project.customerId).toLowerCase();
      return (
        project.reference.toLowerCase().includes(q) ||
        project.title.toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [projects, deferredQuery, filter, customerName, totals]);

  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [deferredQuery, filter]);

  const visibleProjects = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  return (
    <PageShell>
      <main
        className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-36 md:pb-16"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3.5 w-full">
          {/* 1. ترويسة الصفحة التنفيذية بنظام RTL متكامل */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <FolderKanban className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  إدارة المشاريع والعمليات
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                  {stats.total} مشروع
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                المحور المركزي لربط العروض المبدئية بفواتير المبيعات والمشتريات ومتابعة التحصيل
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  void loadTotals();
                }}
                disabled={loadingTotals}
                aria-label="تحديث الإجماليات"
                className="h-9 w-9 rounded-xl p-0 text-muted-foreground"
              >
                <RefreshCw className={cn("h-4 w-4", loadingTotals && "animate-spin")} />
              </Button>
              <Button
                type="button"
                onClick={() => {
                  playTapSound();
                  setFormOpen(true);
                }}
                className="h-9 px-4 rounded-xl gap-1.5 text-xs font-black bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 flex-1 sm:flex-initial"
              >
                <Plus className="h-4 w-4" />
                <span>مشروع جديد</span>
              </Button>
            </div>
          </div>

          {/* 2. مؤشرات الأداء للمشاريع (4 بطاقات KPI) */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span>المشاريع النشطة</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {stats.activeCount}{" "}
                <span className="text-[10px] font-sans font-bold text-muted-foreground">
                  من {stats.total}
                </span>
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي المُفوتر</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                {formatNumber(stats.totalInvoiced)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                <span>المحصّل من المشاريع</span>
              </span>
              <p className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatNumber(stats.totalCollected)}{" "}
                <span className="text-[10px] font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span>بانتظار السداد</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">
                {stats.unpaidCount}{" "}
                <span className="text-[10px] font-sans font-bold">مشاريع</span>
              </p>
            </div>
          </div>

          {/* 3. شريط البحث والفلاتر والقائمة */}
          <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالمرجع (PRJ) أو اسم المشروع أو العميل..."
                  className="h-10 rounded-xl pr-9 pl-8 text-xs font-bold bg-background text-right"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="مسح البحث"
                    onClick={() => {
                      playTapSound();
                      setQuery("");
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
                {FILTER_TABS.map((tab) => {
                  const active = filter === tab.key;
                  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [query, filter]);

  const visibleProjects = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setFilter(tab.key);
                      }}
                      className={cn(
                        "shrink-0 rounded-xl px-3 py-1.5 text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95",
                        active
                          ? "bg-primary text-white shadow-xs shadow-primary/30"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60"
                      )}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
                <FolderKanban className="h-8 w-8 text-muted-foreground/70" />
                <div>
                  <p className="text-sm font-black text-foreground">
                    {projects.length === 0 ? "لا توجد مشاريع بعد" : "لا توجد نتائج مطابقة"}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground max-w-md">
                    {projects.length === 0
                      ? "المشروع يجمع لك العروض المبدئية وفواتير المبيعات والمشتريات والمصاريف في مجلد واحد متكامل."
                      : "جرّب مرجعاً أو اسماً آخر أو أعد ضبط الفلتر."}
                  </p>
                </div>
                {projects.length === 0 && (
                  <Button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setFormOpen(true);
                    }}
                    className="h-10 rounded-xl gap-1.5 text-xs font-black"
                  >
                    <Plus className="h-4 w-4" />
                    <span>إنشاء أول مشروع</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {visibleProjects.map((project) => {
                  const entry = totals[project.id];
                  const financialStatus = entry?.status ?? project.financialStatus;
                  const invoiced = Number(entry?.invoiced) || 0;
                  const collected = Number(entry?.collected) || 0;
                  const remaining = Math.max(0, invoiced - collected);
                  const percentCollected =
                    invoiced > 0 ? Math.min(100, Math.round((collected / invoiced) * 100)) : 0;

                  return (
                    <div
                      key={project.id}
                      onClick={() => {
                        playTapSound();
                        setOpenProjectId(project.id);
                      }}
                      className="group flex flex-col justify-between gap-3 rounded-2xl border border-border/70 bg-card/90 p-3.5 sm:p-4 text-right transition-all hover:border-primary/50 hover:bg-muted/20 hover:shadow-xs active:scale-[0.99] cursor-pointer"
                    >
                      {/* 1. السطر العلوي: المرجع، والحالات، وزر الفتح */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-black text-primary border border-primary/20">
                            <bdi dir="ltr">{project.reference}</bdi>
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              EXECUTION_STATUS_TONES[project.executionStatus]
                            )}
                          >
                            {EXECUTION_STATUS_LABELS[project.executionStatus]}
                          </span>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                              FINANCIAL_STATUS_TONES[financialStatus]
                            )}
                          >
                            {FINANCIAL_STATUS_LABELS[financialStatus]}
                          </span>
                        </div>

                        <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-primary shrink-0">
                          <span>فتح مساحة العمل</span>
                          <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                        </span>
                      </div>

                      {/* 2. عنوان المشروع والعميل وتاريخ التسليم */}
                      <div className="space-y-1">
                        <h3 className="text-sm sm:text-base font-black text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {project.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-muted-foreground">
                          <span className="inline-flex items-center gap-1 truncate">
                            <User className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                            <span className="truncate">{customerName(project.customerId)}</span>
                          </span>
                          {project.deliveryDate && (
                            <span className="inline-flex items-center gap-1 shrink-0">
                              <Calendar className="h-3.5 w-3.5 text-primary/70" />
                              <span>التسليم:</span>
                              <bdi dir="ltr" className="font-mono">
                                {project.deliveryDate}
                              </bdi>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 3. شريط التتبع التلقائي للتحصيل المالي (Automatic Financial Tracer) */}
                      <div className="rounded-xl border border-border/50 bg-secondary/30 p-2.5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Activity className="h-3 w-3 text-primary shrink-0" />
                            <span>مسار التحصيل التلقائي</span>
                          </span>
                          <span className="font-mono text-primary font-black tabular-nums">{percentCollected}%</span>
                        </div>

                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              percentCollected === 100
                                ? "bg-emerald-500"
                                : percentCollected > 0
                                ? "bg-primary"
                                : "bg-muted-foreground/30"
                            )}
                            style={{ width: `${percentCollected}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-border/40 text-center">
                          <div className="space-y-0.5">
                            <span className="text-[9.5px] font-bold text-muted-foreground block">المُفوتر</span>
                            <span className="font-mono text-[11px] font-black text-foreground tabular-nums block">
                              {formatNumber(invoiced)}
                            </span>
                          </div>
                          <div className="space-y-0.5 border-r border-border/40 pr-1">
                            <span className="text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400 block">المحصّل</span>
                            <span className="font-mono text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums block">
                              {formatNumber(collected)}
                            </span>
                          </div>
                          <div className="space-y-0.5 border-r border-border/40 pr-1">
                            <span className="text-[9.5px] font-bold text-amber-600 dark:text-amber-400 block">المتبقي</span>
                            <span className="font-mono text-[11px] font-black text-amber-600 dark:text-amber-400 tabular-nums block">
                              {formatNumber(remaining)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 4. الإجراءات السريعة: تبديل مرحلة التنفيذ بنقرة واحدة + تسجيل تحصيل فوري */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                          {(["new", "in_progress", "completed"] as const).map((st) => {
                            const isActive = project.executionStatus === st;
                            const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [query, filter]);

  const visibleProjects = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  return (
                              <button
                                key={st}
                                type="button"
                                onClick={(e) => handleQuickExecutionChange(e, project.id, st)}
                                className={cn(
                                  "text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-all cursor-pointer",
                                  isActive
                                    ? "bg-primary text-white border-primary shadow-2xs"
                                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50"
                                )}
                              >
                                {st === "new" ? "جديد" : st === "in_progress" ? "تنفيذ" : "مكتمل"}
                              </button>
                            );
                          })}
                        </div>

                        {project.customerId && remaining > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              playTapSound();
                              setReceiptTargetProject(project);
                            }}
                            className="h-7 px-2.5 rounded-lg gap-1 text-[10.5px] font-black border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shrink-0"
                          >
                            <Wallet className="h-3 w-3" />
                            <span>تحصيل دفعة</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filtered.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playTapSound();
                    setVisibleCount((prev) => prev + 30);
                  }}
                  className="rounded-xl px-5 text-xs font-bold gap-2 border-border/80 text-foreground hover:bg-muted"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    عرض المزيد من المشاريع (المتبقي: {filtered.length - visibleCount})
                  </span>
                </Button>
              </div>
            )}
          </div>

          <p className="pb-2 text-center text-[10.5px] leading-relaxed text-muted-foreground">
            الحالة المالية للمشروع تُشتق تلقائياً من الفواتير والتحصيلات المسجّلة ولا تُعدَّل يدوياً.
          </p>
        </div>
      </main>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={(project) => {
          void refreshProjectsFromDb();
          setOpenProjectId(project.id);
        }}
      />

      <ProjectDetailsDialog
        projectId={openProjectId}
        onOpenChange={(open) => !open && setOpenProjectId(null)}
      />

      <ReceiptDialog
        open={!!receiptTargetProject}
        onOpenChange={(open) => {
          if (!open) setReceiptTargetProject(null);
        }}
        initialCustomerId={receiptTargetProject?.customerId}
        onRecorded={() => {
          void refreshProjectsFromDb();
          void loadTotals();
        }}
      />
    </PageShell>
  );
}

export default ProjectsPage;
