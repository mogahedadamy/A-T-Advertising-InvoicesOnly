import { useState, useMemo, useEffect, useDeferredValue } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Search,
  UserPlus,
  Users,
  Phone,
  MapPin,
  PlusCircle,
  Pencil,
  Trash2,
  X,
  CreditCard,
  Building,
  PhoneCall,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Archive,
  ArchiveRestore,
  Wallet,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import {
  useCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  archiveCustomer,
  unarchiveCustomer,
  checkCanDeleteCustomer,
  getAllCustomerFinancialSummaries,
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { CustomerDialog } from "./CustomerDialog";
import { CustomerProfileModal } from "./CustomerProfileModal";
import { CustomInvoiceDialog } from "@/components/billing/CustomInvoiceDialog";
import { playTapSound, playDeleteSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "كل العملاء" },
  { key: "agency", label: "وكالات دعاية (أ)" },
  { key: "company", label: "شركات تجارية (ب)" },
  { key: "individual", label: "زبون عابر / نقدي" },
  { key: "internal", label: "تشغيل داخلي" },
  { key: "debtors", label: "العملاء المدينون" },
  { key: "archived", label: "المؤرشفين" },
];

export function CustomersPage() {
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);

  // Live customer balances map from SQLite transactions
  const [liveBalances, setLiveBalances] = useState<
    Record<string, { outstanding: number; invoiced: number; collected: number; overdueCount: number }>
  >({});

  // Profile modal state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<CustomerRecord | null>(null);

  // Invoice creation modal from customer row
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceTargetCustomer, setInvoiceTargetCustomer] = useState<CustomerRecord | null>(null);

  const loadLiveBalances = async () => {
    try {
      const map = await getAllCustomerFinancialSummaries();
      setLiveBalances(map);
    } catch (err) {
      console.warn("[CustomersPage] failed to load live balances:", err);
    }
  };

  useEffect(() => {
    void loadLiveBalances();
    const handleFinanceChange = () => void loadLiveBalances();
    if (typeof window !== "undefined") {
      window.addEventListener("finance-changed", handleFinanceChange);
      window.addEventListener("native-storage-ready", handleFinanceChange);
      return () => {
        window.removeEventListener("finance-changed", handleFinanceChange);
        window.removeEventListener("native-storage-ready", handleFinanceChange);
      };
    }
  }, []);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = (deferredSearch || "").trim().toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      // Handling filter tabs
      if (typeFilter === "archived") {
        return matchSearch && Boolean(c.isArchived);
      }
      if (c.isArchived) {
        return false; // hide archived from active tabs
      }
      if (typeFilter === "all") {
        return matchSearch;
      }
      if (typeFilter === "debtors") {
        const liveBal = liveBalances[c.id]?.outstanding ?? c.balance;
        return matchSearch && liveBal > 0.009;
      }
      return matchSearch && c.type === typeFilter;
    });
  }, [customers, deferredSearch, typeFilter, liveBalances]);

  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [deferredSearch, typeFilter]);

  const visibleCustomers = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  // Accurate company-wide stats derived from live financial records
  const stats = useMemo(() => {
    const activeCustomers = customers.filter((c) => !c.isArchived);

    let totalSpent = 0;
    let totalDebt = 0;

    for (const c of activeCustomers) {
      const live = liveBalances[c.id];
      if (live) {
        totalSpent += live.invoiced;
        totalDebt += live.outstanding;
      } else {
        totalSpent += c.totalSpent || 0;
        totalDebt += c.balance > 0 ? c.balance : 0;
      }
    }

    const agencyCount = activeCustomers.filter((c) => c.type === "agency").length;
    const companyCount = activeCustomers.filter((c) => c.type === "company").length;

    return {
      total: activeCustomers.length,
      agencyCount,
      companyCount,
      totalSpent,
      totalDebt,
    };
  }, [customers, liveBalances]);

  const handleSave = async (data: Omit<CustomerRecord, "id" | "createdAt" | "totalOrders" | "totalSpent">) => {
    try {
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, data);
        playSuccessSound();
        toast.success("تم تحديث بيانات العميل بنجاح");
      } else {
        await addCustomer(data);
        playSuccessSound();
        toast.success("تمت إضافة العميل الجديد بنجاح");
      }
      setEditingCustomer(null);
      void loadLiveBalances();
    } catch (err) {
      toast.error("تعذّر حفظ بيانات العميل", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  const handleDelete = async (c: CustomerRecord) => {
    playTapSound();
    const check = await checkCanDeleteCustomer(c.id);
    if (!check.allowed) {
      playDeleteSound();
      toast.error("لا يمكن حذف هذا العميل", {
        description: check.reason,
        action: {
          label: "أرشفة العميل",
          onClick: async () => {
            await archiveCustomer(c.id);
            toast.info(`تم نقل العميل "${c.name}" إلى الأرشيف`);
            void loadLiveBalances();
          },
        },
        duration: 8000,
      });
      return;
    }

    if (confirm(`هل أنت متأكد من الحذف النهائي للعميل "${c.name}"؟ (لا توجد عليه أي معاملات سابقة)`)) {
      try {
        await deleteCustomer(c.id);
        playDeleteSound();
        toast.info(`تم حذف العميل "${c.name}" نهائياً`);
        void loadLiveBalances();
      } catch (err: any) {
        toast.error(err?.message || "تعذّر حذف العميل");
      }
    }
  };

  const handleOpenProfile = (c: CustomerRecord) => {
    playTapSound();
    setSelectedProfileCustomer(c);
    setProfileModalOpen(true);
  };

  const handleOpenInvoiceCreation = (c: CustomerRecord) => {
    playTapSound();
    setInvoiceTargetCustomer(c);
    setInvoiceDialogOpen(true);
  };

  return (
    <PageShell>
      <main
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-24 md:pb-10"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4 w-full max-w-full">
          {/* 1. ترويسة الصفحة التنفيذية المدمجة */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Users className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  دليل العملاء والحسابات المالية
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                  {stats.total} عميل نشط
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                إدارة ملفات العملاء التجارية، الفواتير، التحصيلات، والمتابعة المالية اللحظية
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setEditingCustomer(null);
                  setDialogOpen(true);
                }}
                className="h-9 px-4 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.98] transition-all w-full sm:w-auto inline-flex items-center justify-center cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>إضافة عميل جديد</span>
              </button>
            </div>
          </div>

          {/* 2. مؤشرات الأداء المالي للعملاء (KPI Grid) - محسوبة لحظياً من قاعدة البيانات */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي العملاء النشطين</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {stats.total}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                <span>وكالات الدعاية (أ)</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-purple-600 dark:text-purple-400 tabular-nums">
                {stats.agencyCount}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-[#C5A059]" />
                <span>إجمالي الفواتير والمطالبات</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {formatNumber(stats.totalSpent)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>المديونيات المستحقة الفعلية</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatNumber(stats.totalDebt)}{" "}
                <span className="text-[10px] text-rose-600/70 font-normal">ج.س</span>
              </p>
            </div>
          </div>

          {/* 3. شريط البحث والتصنيف والفلترة السريعة */}
          <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* حقل البحث بالاسم أو الهاتف */}
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="بحث باسم العميل، الهاتف، أو العنوان..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border/80 bg-secondary/40 pr-9 pl-8 text-xs font-bold text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setSearch("");
                    }}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* تبويبات الفلترة حسب تصنيف العميل والمديونيات والمؤرشفين */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                {TABS.map((tab) => {
                  const active = typeFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setTypeFilter(tab.key);
                      }}
                      className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        active
                          ? "bg-primary text-white shadow-xs shadow-primary/30"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/60"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* عرض الجدول للشاشات المتوسطة والكبيرة */}
            <div className="hidden md:block overflow-x-auto pt-1">
              {filtered.length === 0 ? (
                <div className="py-14 text-center text-xs font-bold text-muted-foreground/70 border border-dashed border-border/60 rounded-xl">
                  لا يوجد عملاء يطابقون معايير البحث
                </div>
              ) : (
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-border/70 text-muted-foreground text-[11px]">
                      <th className="py-2.5 pr-3 font-black">العميل</th>
                      <th className="py-2.5 px-3 font-bold">الهاتف</th>
                      <th className="py-2.5 px-3 font-bold">التصنيف</th>
                      <th className="py-2.5 px-3 font-bold">العنوان</th>
                      <th className="py-2.5 px-3 font-mono font-black">إجمالي الفواتير</th>
                      <th className="py-2.5 px-3 font-mono font-black">الرصيد / المستحق</th>
                      <th className="py-2.5 pl-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {visibleCustomers.map((c) => {
                      const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;
                      const live = liveBalances[c.id];
                      const totalInvoiced = live ? live.invoiced : c.totalSpent || 0;
                      const outstanding = live ? live.outstanding : (c.balance > 0 ? c.balance : 0);
                      const hasOverdue = live && live.overdueCount > 0;

                      return (
                        <tr
                          key={c.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer group"
                          onClick={() => handleOpenProfile(c)}
                        >
                          <td className="py-3 pr-3 font-bold text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-xs text-foreground group-hover:text-primary transition-colors">
                                {c.name}
                              </span>
                              {hasOverdue && (
                                <span className="rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 px-1.5 py-0.2 text-[9px] font-black">
                                  متأخرات
                                </span>
                              )}
                              {c.isArchived && (
                                <span className="rounded-full bg-muted text-muted-foreground border border-border px-1.5 py-0.2 text-[9px] font-bold">
                                  مؤرشف
                                </span>
                              )}
                            </div>
                            {c.notes && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-xs font-normal">
                                {c.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                            {c.phone ? (
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-primary hover:underline"
                                dir="ltr"
                              >
                                <PhoneCall className="h-3 w-3 text-primary/70" />
                                <span>{c.phone}</span>
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${cfg.bg} ${cfg.color} border-current/20`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-muted-foreground text-[11px]">
                            {c.address || "—"}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-foreground tabular-nums">
                            {formatNumber(totalInvoiced)}{" "}
                            <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-black tabular-nums">
                            {outstanding > 0.009 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-black">
                                {formatNumber(outstanding)} ج.س عليه
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-bold text-[11px]">
                                متزن (0)
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <button
                                type="button"
                                onClick={() => handleOpenProfile(c)}
                                title="عرض الملف المالي والتجاري للعميل"
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-black text-primary hover:bg-primary hover:text-white transition active:scale-95 cursor-pointer"
                              >
                                <FolderOpen className="h-3 w-3" />
                                <span>الملف المالي</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenInvoiceCreation(c)}
                                title="إصدار فاتورة جديدة لهذا العميل"
                                className="inline-flex items-center gap-1 rounded-lg border border-border bg-secondary/80 px-2 py-1 text-[11px] font-bold text-foreground hover:bg-primary hover:text-white transition active:scale-95 cursor-pointer"
                              >
                                <PlusCircle className="h-3 w-3" />
                                <span>فاتورة</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  playTapSound();
                                  setEditingCustomer(c);
                                  setDialogOpen(true);
                                }}
                                title="تعديل البيانات"
                                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(c)}
                                title="حذف"
                                className="rounded-lg p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* عرض البطاقات للهواتف الذكية (Mobile Cards) */}
            <div className="space-y-2.5 md:hidden pt-1">
              {filtered.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-muted-foreground/70 border border-dashed border-border/60 rounded-xl">
                  لا يوجد عملاء يطابقون معايير البحث
                </div>
              ) : (
                visibleCustomers.map((c) => {
                  const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;
                  const live = liveBalances[c.id];
                  const totalInvoiced = live ? live.invoiced : c.totalSpent || 0;
                  const outstanding = live ? live.outstanding : (c.balance > 0 ? c.balance : 0);

                  return (
                    <div
                      key={c.id}
                      onClick={() => handleOpenProfile(c)}
                      className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-2.5 shadow-2xs cursor-pointer active:scale-[0.99] transition"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                        <div>
                          <p className="font-black text-foreground text-sm">{c.name}</p>
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[11px] text-primary font-mono font-bold mt-0.5"
                              dir="ltr"
                            >
                              <PhoneCall className="h-3 w-3" />
                              <span>{c.phone}</span>
                            </a>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-black border ${cfg.bg} ${cfg.color} border-current/20 shrink-0`}
                        >
                          {cfg.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold">إجمالي الفواتير</span>
                          <p className="font-mono font-bold text-foreground tabular-nums">
                            {formatNumber(totalInvoiced)} ج.س
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold">الرصيد / المستحق</span>
                          <p className="font-mono font-black tabular-nums">
                            {outstanding > 0.009 ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                {formatNumber(outstanding)} ج.س عليه
                              </span>
                            ) : (
                              <span className="text-emerald-600">متزن (0)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div
                        className="pt-2 border-t border-border/50 flex items-center justify-between gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenProfile(c)}
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-black text-white shadow-xs active:scale-95 transition cursor-pointer"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                          <span>فتح الملف المالي</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenInvoiceCreation(c)}
                          className="rounded-xl border border-border/70 bg-card p-2 text-foreground hover:bg-secondary cursor-pointer transition active:scale-90"
                          title="إصدار فاتورة"
                        >
                          <PlusCircle className="h-3.5 w-3.5 text-primary" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playTapSound();
                            setEditingCustomer(c);
                            setDialogOpen(true);
                          }}
                          className="rounded-xl border border-border/70 bg-card p-2 text-foreground hover:bg-secondary cursor-pointer transition active:scale-90"
                          title="تعديل البيانات"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="rounded-xl border border-border/70 bg-card p-2 text-rose-500 hover:bg-rose-500/10 cursor-pointer transition active:scale-90"
                          title="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {filtered.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setVisibleCount((prev) => prev + 30);
                  }}
                  className="rounded-xl px-5 py-2 text-xs font-bold gap-2 border border-border/80 text-foreground hover:bg-muted inline-flex items-center cursor-pointer transition active:scale-95"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    عرض المزيد من العملاء (المتبقي: {filtered.length - visibleCount})
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Customer Dialog for Add/Edit */}
      <CustomerDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSave}
        initialData={editingCustomer}
      />

      {/* Customer Profile Modal for full financial/commercial view */}
      {selectedProfileCustomer && (
        <CustomerProfileModal
          open={profileModalOpen}
          onOpenChange={(open) => {
            setProfileModalOpen(open);
            if (!open) void loadLiveBalances();
          }}
          customer={selectedProfileCustomer}
          onCustomerUpdated={() => void loadLiveBalances()}
          onCreateInvoice={(c) => handleOpenInvoiceCreation(c)}
        />
      )}

      {/* Custom Invoice Dialog opened directly with selected customer */}
      <CustomInvoiceDialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open);
          if (!open) {
            setInvoiceTargetCustomer(null);
            void loadLiveBalances();
          }
        }}
        initialType="sales"
        onSaved={() => {
          void loadLiveBalances();
        }}
      />
    </PageShell>
  );
}
