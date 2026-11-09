import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
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
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import {
  useCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { CustomerDialog } from "./CustomerDialog";
import { playTapSound, playDeleteSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "كل العملاء" },
  { key: "agency", label: "وكالات دعاية (أ)" },
  { key: "company", label: "شركات تجارية (ب)" },
  { key: "individual", label: "زبون عابر / نقدي" },
  { key: "internal", label: "تشغيل داخلي" },
];

export function CustomersPage() {
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRecord | null>(null);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      const q = (search || "").trim().toLowerCase();
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));

      const matchType = typeFilter === "all" || c.type === typeFilter;

      return matchSearch && matchType;
    });
  }, [customers, search, typeFilter]);

  const stats = useMemo(() => {
    const totalSpent = customers.reduce((s, c) => s + (c.totalSpent || 0), 0);
    const totalDebt = customers.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0);
    const agencyCount = customers.filter((c) => c.type === "agency").length;
    const companyCount = customers.filter((c) => c.type === "company").length;

    return {
      total: customers.length,
      agencyCount,
      companyCount,
      totalSpent,
      totalDebt,
    };
  }, [customers]);

  const handleSave = (data: Omit<CustomerRecord, "id" | "createdAt" | "totalOrders" | "totalSpent">) => {
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, data);
      playSuccessSound();
      toast.success("تم تحديث بيانات العميل بنجاح");
    } else {
      addCustomer(data);
      playSuccessSound();
      toast.success("تمت إضافة العميل الجديد بنجاح");
    }
    setEditingCustomer(null);
  };

  const handleDelete = (c: CustomerRecord) => {
    if (confirm(`هل أنت متأكد من حذف العميل "${c.name}"؟`)) {
      playDeleteSound();
      deleteCustomer(c.id);
      toast.info(`تم حذف العميل "${c.name}"`);
    }
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
                  دليل العملاء والحسابات
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                  {stats.total} عميل مسجل
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                إدارة سجل وكالات الدعاية والشركات ومتابعة الأرصدة والمديونيات والسحوبات المالية
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

          {/* 2. مؤشرات الأداء المالي للعملاء (KPI Grid) */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" />
                <span>إجمالي العملاء</span>
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
                <span>إجمالي المسحوبات</span>
              </span>
              <p className="font-mono text-lg sm:text-xl font-black text-foreground tabular-nums">
                {formatNumber(stats.totalSpent)}{" "}
                <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
              </p>
            </div>

            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.04] p-3 sm:p-3.5 shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>المديونيات المستحقة</span>
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

              {/* تبويبات الفلترة حسب تصنيف العميل */}
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
                      <th className="py-2.5 px-3 font-mono font-bold text-center">الطلبات</th>
                      <th className="py-2.5 px-3 font-mono font-black">إجمالي المسحوبات</th>
                      <th className="py-2.5 px-3 font-mono font-bold">الرصيد / الذمة</th>
                      <th className="py-2.5 pl-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filtered.map((c) => {
                      const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;

                      return (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 pr-3 font-bold text-foreground">
                            <div className="font-black text-xs text-foreground">{c.name}</div>
                            {c.notes && (
                              <div className="text-[10px] text-muted-foreground truncate max-w-xs font-normal">
                                {c.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
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
                          <td className="py-3 px-3 font-mono font-bold text-foreground text-center tabular-nums">
                            {c.totalOrders || 0}
                          </td>
                          <td className="py-3 px-3 font-mono font-black text-foreground tabular-nums">
                            {formatNumber(c.totalSpent || 0)}{" "}
                            <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-black tabular-nums">
                            {c.balance > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">
                                {formatNumber(c.balance)} ج.س عليه
                              </span>
                            ) : c.balance < 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {formatNumber(Math.abs(c.balance))} ج.س له
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-normal text-[11px]">
                                متزن (0)
                              </span>
                            )}
                          </td>
                          <td className="py-3 pl-3 text-center">
                            <div className="inline-flex items-center gap-1.5 justify-center">
                              <Link
                                to="/calculator"
                                title="إنشاء طلب جديد لهذا العميل"
                                className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-black text-primary hover:bg-primary hover:text-white transition active:scale-95"
                              >
                                <PlusCircle className="h-3 w-3" />
                                <span>طلب</span>
                              </Link>
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
                filtered.map((c) => {
                  const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;

                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-border/70 bg-secondary/30 p-3.5 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2">
                        <div>
                          <p className="font-black text-foreground text-sm">{c.name}</p>
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
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
                          <span className="text-[10px] text-muted-foreground font-bold">عدد الطلبات</span>
                          <p className="font-mono font-bold text-foreground tabular-nums">{c.totalOrders || 0} طلب</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-bold">الرصيد / الذمة</span>
                          <p className="font-mono font-black tabular-nums">
                            {c.balance > 0 ? (
                              <span className="text-rose-600 dark:text-rose-400">{formatNumber(c.balance)} ج.س عليه</span>
                            ) : c.balance < 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">{formatNumber(Math.abs(c.balance))} ج.س له</span>
                            ) : (
                              <span className="text-muted-foreground">متزن (0)</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                        <Link
                          to="/calculator"
                          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-xs font-black text-white shadow-xs active:scale-95 transition"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          <span>طلب جديد</span>
                        </Link>
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
          </div>
        </div>
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
    </PageShell>
  );
}
