import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import {
  Search,
  UserPlus,
  Users,
  X,
  Building2,
  Receipt,
  Wallet,
  RefreshCw,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  archiveCustomer,
  checkCanDeleteCustomer,
  getAllCustomerFinancialSummaries,
  type CustomerRecord,
} from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { CustomerDialog } from "./CustomerDialog";
import { CustomerDetailPage } from "./CustomerDetailPage";
import {
  CustomersDirectoryTable,
  CustomersMobileCards,
  type LiveBalancesMap,
} from "./CustomersDirectoryViews";
import { CustomInvoiceDialog } from "@/components/billing/CustomInvoiceDialog";
import { playTapSound, playDeleteSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "كل العملاء" },
  { key: "debtors", label: "العملاء المدينون" },
  { key: "company", label: "شركات" },
  { key: "institution", label: "مؤسسات" },
  { key: "client", label: "زبائن" },
  { key: "individual", label: "أفراد" },
  { key: "archived", label: "المؤرشفين" },
];

export function CustomersPage() {
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [typeFilter, setTypeFilter] = useState("all");
  const [customerSort, setCustomerSort] = useState<"debt-desc" | "spent-desc" | "name-asc" | "date-desc">("debt-desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);
  const [pendingDeleteCustomer, setPendingDeleteCustomer] = useState<CustomerRecord | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainScrollRef = useRef<HTMLElement>(null);

  const [liveBalances, setLiveBalances] = useState<LiveBalancesMap>({});
  const [selectedProfileCustomer, setSelectedProfileCustomer] = useState<CustomerRecord | null>(null);

  useEffect(() => {
    const syncFromUrl = () => {
      if (typeof window === "undefined") return;
      const hash = window.location.hash || "";
      const locSearch = window.location.search || "";
      const queryString = hash.includes("?") ? hash.split("?")[1] : locSearch.replace("?", "");
      const params = new URLSearchParams(queryString);
      const custId = params.get("id");
      if (custId) {
        const found = customers.find((c) => c.id === custId);
        if (found) {
          setSelectedProfileCustomer(found);
          return;
        }
      }
      setSelectedProfileCustomer(null);
    };

    window.addEventListener("popstate", syncFromUrl);
    syncFromUrl();
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, [customers]);

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceTargetCustomer, setInvoiceTargetCustomer] = useState<CustomerRecord | null>(null);

  const loadLiveBalances = async () => {
    setLoadingBalances(true);
    try {
      const map = await getAllCustomerFinancialSummaries();
      setLiveBalances(map);
    } catch (err) {
      console.warn("[CustomersPage] failed to load live balances:", err);
    } finally {
      setLoadingBalances(false);
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

      if (typeFilter === "archived") {
        return matchSearch && Boolean(c.isArchived);
      }
      if (c.isArchived) {
        return false;
      }
      if (typeFilter === "all") {
        return matchSearch;
      }
      if (typeFilter === "debtors") {
        const liveBal = liveBalances[c.id]?.outstanding ?? c.balance;
        return matchSearch && liveBal > 0.009;
      }
      if (typeFilter === "institution") {
        return matchSearch && (c.type === "institution" || c.type === "agency" || c.type === "internal");
      }
      return matchSearch && c.type === typeFilter;
    });
  }, [customers, deferredSearch, typeFilter, liveBalances]);

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    if (customerSort === "debt-desc") {
      list.sort((a, b) => {
        const debtA = liveBalances[a.id]?.outstanding ?? (a.balance > 0 ? a.balance : 0);
        const debtB = liveBalances[b.id]?.outstanding ?? (b.balance > 0 ? b.balance : 0);
        return debtB - debtA;
      });
    } else if (customerSort === "spent-desc") {
      list.sort((a, b) => {
        const spentA = liveBalances[a.id]?.invoiced ?? a.totalSpent ?? 0;
        const spentB = liveBalances[b.id]?.invoiced ?? b.totalSpent ?? 0;
        return spentB - spentA;
      });
    } else if (customerSort === "name-asc") {
      list.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    } else if (customerSort === "date-desc") {
      list.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }
    return list;
  }, [filtered, customerSort, liveBalances]);

  const [visibleCount, setVisibleCount] = useState(30);

  useEffect(() => {
    setVisibleCount(30);
  }, [deferredSearch, typeFilter, customerSort]);

  const visibleCustomers = useMemo(() => {
    return sortedAndFiltered.slice(0, visibleCount);
  }, [sortedAndFiltered, visibleCount]);

  const stats = useMemo(() => {
    const activeCustomers = customers.filter((c) => !c.isArchived);

    let totalSpent = 0;
    let totalDebt = 0;
    let debtorsCount = 0;

    for (const c of activeCustomers) {
      const live = liveBalances[c.id];
      if (live) {
        totalSpent += live.invoiced;
        totalDebt += live.outstanding;
        if (live.outstanding > 0.009) debtorsCount++;
      } else {
        totalSpent += c.totalSpent || 0;
        const curDebt = c.balance > 0 ? c.balance : 0;
        totalDebt += curDebt;
        if (curDebt > 0.009) debtorsCount++;
      }
    }

    const agencyCount = activeCustomers.filter((c) => c.type === "agency").length;
    const companyCount = activeCustomers.filter((c) => c.type === "company").length;

    return {
      total: activeCustomers.length,
      agencyCount,
      companyCount,
      commercialCount: agencyCount + companyCount,
      totalSpent,
      totalDebt,
      debtorsCount,
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

  const handleDeleteRequest = async (c: CustomerRecord) => {
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

    setPendingDeleteCustomer(c);
  };

  const executeDeleteCustomer = async (c: CustomerRecord) => {
    try {
      await deleteCustomer(c.id);
      playDeleteSound();
      toast.info(`تم حذف العميل "${c.name}" نهائياً`);
      void loadLiveBalances();
    } catch (err: any) {
      toast.error(err?.message || "تعذّر حذف العميل");
    } finally {
      setPendingDeleteCustomer(null);
    }
  };

  const handleOpenProfile = (c: CustomerRecord) => {
    playTapSound();
    setSelectedProfileCustomer(c);
    if (typeof window !== "undefined") {
      window.history.pushState({ customerId: c.id }, "", "#/customers?id=" + c.id);
    }
  };

  const handleBackToDirectory = () => {
    playTapSound();
    setSelectedProfileCustomer(null);
    if (typeof window !== "undefined") {
      if (window.location.hash.includes("?id=")) {
        window.history.pushState(null, "", "#/customers");
      }
    }
    void loadLiveBalances();
  };

  const handleOpenInvoiceCreation = (c: CustomerRecord) => {
    playTapSound();
    setInvoiceTargetCustomer(c);
    setInvoiceDialogOpen(true);
  };

  if (selectedProfileCustomer) {
    return (
      <>
        <CustomerDetailPage
          customer={selectedProfileCustomer}
          onBack={handleBackToDirectory}
          onCustomerUpdated={() => void loadLiveBalances()}
          onCreateInvoice={(c) => handleOpenInvoiceCreation(c)}
        />

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
          initialCustomer={invoiceTargetCustomer || selectedProfileCustomer}
          initialCustomerId={invoiceTargetCustomer?.id || selectedProfileCustomer?.id}
          onSaved={() => {
            void loadLiveBalances();
          }}
        />
      </>
    );
  }

  return (
    <PageShell>
      <main
        ref={mainScrollRef}
        onScroll={(e) => {
          setShowScrollTop(e.currentTarget.scrollTop > 300);
        }}
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-28 md:pb-12"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3.5 sm:space-y-4 w-full">
          {/* 1. ترويسة الصفحة التنفيذية المعتمدة لشركة T.A */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Users className="h-4.5 w-4.5" />
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  void loadLiveBalances();
                }}
                disabled={loadingBalances}
                aria-label="تحديث الأرصدة"
                className="h-9 w-9 rounded-xl p-0 text-muted-foreground border-border/80 hover:bg-secondary cursor-pointer"
              >
                <RefreshCw className={cn("h-4 w-4", loadingBalances && "animate-spin")} />
              </Button>

              <Button
                type="button"
                onClick={() => {
                  playTapSound();
                  setEditingCustomer(null);
                  setDialogOpen(true);
                }}
                className="h-9 px-4 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.97] transition-all touch-manipulation cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>إضافة عميل جديد</span>
              </Button>
            </div>
          </div>

          {/* 2. مؤشرات الأداء المالي (KPI Cards Grid) */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي العملاء النشطين</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {stats.total}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-[#C5A059] flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                <span>الوكالات والشركات</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-[#C5A059] tabular-nums">
                {stats.commercialCount}
              </p>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي الفواتير والمطالبات</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {formatNumber(stats.totalSpent)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5" />
                <span>المديونيات القائمة المستحقة</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
                {formatNumber(stats.totalDebt)}{" "}
                <span className="text-[10px] text-rose-600/70 font-normal">ج.س</span>
              </p>
            </div>
          </div>

          {/* 3. شريط البحث والتصنيف والفلترة السريعة */}
          <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-1 max-w-lg">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="بحث باسم العميل، الهاتف، أو العنوان..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 w-full rounded-xl border border-border/80 bg-secondary/35 pr-9 pl-8 text-xs font-bold text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
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

                <div className="flex items-center gap-1.5 bg-secondary/50 px-2.5 h-10 rounded-xl border border-border/80 shrink-0">
                  <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <select
                    aria-label="ترتيب قائمة العملاء"
                    value={customerSort}
                    onChange={(e) => setCustomerSort(e.target.value as any)}
                    className="bg-transparent text-xs font-bold text-foreground border-none outline-hidden cursor-pointer"
                  >
                    <option value="debt-desc">الأعلى مديونية</option>
                    <option value="spent-desc">الأعلى تعاملاً</option>
                    <option value="name-asc">أبجدياً (أ - ي)</option>
                    <option value="date-desc">الأحدث تسجيلاً</option>
                  </select>
                </div>
              </div>

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
                      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        active
                          ? "bg-primary text-white shadow-2xs"
                          : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <CustomersDirectoryTable
              totalMatchedCount={sortedAndFiltered.length}
              visibleCustomers={visibleCustomers}
              liveBalances={liveBalances}
              onOpenProfile={handleOpenProfile}
              onCreateInvoice={handleOpenInvoiceCreation}
              onEditCustomer={(c) => {
                setEditingCustomer(c);
                setDialogOpen(true);
              }}
              onDeleteCustomer={(c) => void handleDeleteRequest(c)}
            />

            <CustomersMobileCards
              totalMatchedCount={sortedAndFiltered.length}
              visibleCustomers={visibleCustomers}
              liveBalances={liveBalances}
              onOpenProfile={handleOpenProfile}
              onCreateInvoice={handleOpenInvoiceCreation}
              onEditCustomer={(c) => {
                setEditingCustomer(c);
                setDialogOpen(true);
              }}
              onDeleteCustomer={(c) => void handleDeleteRequest(c)}
            />

            {sortedAndFiltered.length > visibleCount && (
              <div className="flex justify-center pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    playTapSound();
                    setVisibleCount((prev) => prev + 30);
                  }}
                  className="rounded-xl px-5 py-2 text-xs font-bold gap-2 border-border/80 text-foreground hover:bg-secondary cursor-pointer transition active:scale-95"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span>
                    عرض المزيد من العملاء (المتبقي: {sortedAndFiltered.length - visibleCount})
                  </span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {showScrollTop && (
          <button
            type="button"
            onClick={() => {
              playTapSound();
              mainScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="fixed bottom-20 md:bottom-8 left-5 z-40 p-2.5 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 transition-all cursor-pointer touch-manipulation active:scale-95 animate-in fade-in flex items-center justify-center border border-white/20"
            title="العودة لأعلى الصفحة"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </main>

      <CustomerDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingCustomer(null);
        }}
        onSave={handleSave}
        initialData={editingCustomer}
      />

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
        initialCustomer={invoiceTargetCustomer}
        initialCustomerId={invoiceTargetCustomer?.id}
        onSaved={() => {
          void loadLiveBalances();
        }}
      />

      <AlertDialog
        open={Boolean(pendingDeleteCustomer)}
        onOpenChange={(open) => !open && setPendingDeleteCustomer(null)}
      >
        <AlertDialogContent dir="rtl" className="rounded-3xl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle className="font-black text-base">
              تأكيد حذف العميل نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs leading-relaxed">
              {pendingDeleteCustomer
                ? `هل أنت متأكد من الحذف النهائي للعميل "${pendingDeleteCustomer.name}"؟ (لا توجد عليه أي معاملات سابقة)`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel className="rounded-xl text-xs font-bold">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingDeleteCustomer && void executeDeleteCustomer(pendingDeleteCustomer)}
              className="rounded-xl text-xs font-black bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
