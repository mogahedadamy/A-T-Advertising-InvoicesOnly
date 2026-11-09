import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  PlusCircle,
  FileSpreadsheet,
  Printer,
  Pencil,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  FileText,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import {
  useProformaInvoices,
  deleteProformaInvoice,
  convertProformaToOperatingInvoice,
} from "@/lib/proforma/store";
import { formatNumber } from "@/lib/printCalculator";
import { ProformaDialog } from "./ProformaDialog";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG = {
  draft: {
    label: "مسودة",
    color: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
  },
  sent: {
    label: "مرسلة للعميل",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
  },
  approved: {
    label: "معتمدة",
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
  },
  converted: {
    label: "محولة لأمر تشغيل",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
  },
};

export function ProformaInvoicesPage() {
  const invoices = useProformaInvoices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeInvoice, setActiveInvoice] = useState<ProformaInvoice | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = useMemo(() => {
    return invoices.filter((inv) => {
      const q = (search || "").trim().toLowerCase();
      const matchSearch =
        !q ||
        inv.meta.serial.includes(q) ||
        inv.meta.customerName.toLowerCase().includes(q) ||
        (inv.meta.phone && inv.meta.phone.includes(q)) ||
        inv.lines.some((l) => l.description.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [invoices, search, statusFilter]);

  const stats = useMemo(() => {
    const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0);
    const convertedCount = invoices.filter((i) => i.status === "converted").length;
    const activeCount = invoices.length - convertedCount;

    return {
      count: invoices.length,
      totalAmount,
      convertedCount,
      activeCount,
    };
  }, [invoices]);

  const openNew = () => {
    setActiveInvoice(null);
    setDialogOpen(true);
  };

  const openEdit = (inv: ProformaInvoice) => {
    setActiveInvoice(inv);
    setDialogOpen(true);
  };

  const handleDelete = (id: string, serial: string) => {
    if (window.confirm(`هل أنت متأكد من حذف الفاتورة المبدئية #${serial}؟`)) {
      deleteProformaInvoice(id);
      toast.success(`تم حذف الفاتورة #${serial}`);
    }
  };

  const handleConvert = (id: string, serial: string) => {
    const res = convertProformaToOperatingInvoice(id);
    if (res) {
      toast.success(`تم تحويل الفاتورة المبدئية #${serial} إلى طلب تشغيل بنجاح!`);
    }
  };

  return (
    <PageShell>
      <main className="mx-auto w-full flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-5 min-w-0" dir="rtl">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Header */}
          <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card to-primary/5 p-4 shadow-sm md:flex-row md:items-center md:justify-between border-r-4 border-r-[#C5A059]">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-foreground md:text-xl">
                  قسم الفواتير المبدئية (عروض الأسعار)
                </h1>
                <span className="rounded-full bg-[#C5A059]/15 border border-[#C5A059]/30 px-2.5 py-0.5 text-[11px] font-black text-[#C5A059]">
                  نموذج Pro. Invoice الرسمي
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                إصدار وتعديل عروض الأسعار للعملاء بشروط 70/30 والتحويل المباشر لخط الإنتاج
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/orders"
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-border/80 bg-secondary/80 px-3 text-xs font-bold text-foreground hover:bg-card transition"
              >
                <FileText className="h-4 w-4 text-primary" />
                <span>أرشيف أوامر التشغيل</span>
              </Link>

              <Button
                onClick={openNew}
                className="h-9.5 gap-1.5 rounded-xl btn-primary-seal text-xs font-black shadow-md shadow-primary/25"
              >
                <PlusCircle className="h-4 w-4" />
                <span>إصدار فاتورة مبدئية جديدة</span>
              </Button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-muted-foreground">إجمالي عروض الأسعار</span>
              <p className="font-mono text-xl font-black text-foreground mt-1">{stats.count}</p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-primary">قيمة العروض الصادرة</span>
              <p className="font-mono text-xl font-black text-primary mt-1">
                {formatNumber(stats.totalAmount)} <span className="text-xs text-muted-foreground font-sans font-bold">ج.س</span>
              </p>
            </div>
            <div className="rounded-2xl border border-[#C5A059]/20 bg-[#C5A059]/5 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-[#C5A059]">عروض قيد المتابعة</span>
              <p className="font-mono text-xl font-black text-[#C5A059] mt-1">
                {stats.activeCount}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-2xs">
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">تم تحويلها لإنتاج</span>
              <p className="font-mono text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.convertedCount}
              </p>
            </div>
          </div>

          {/* Search & Tabs Filter */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="بحث برقم الفاتورة، اسم العميل، أو البند..."
                  className="h-9 w-full rounded-xl border border-border bg-background pr-9 pl-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {[
                  { key: "all", label: "الكل" },
                  { key: "draft", label: "مسودات" },
                  { key: "approved", label: "معتمدة" },
                  { key: "converted", label: "محولة لإنتاج" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setStatusFilter(t.key)}
                    className={`rounded-xl px-3 py-1 text-xs font-bold transition-all ${
                      statusFilter === t.key
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Invoices List / Table */}
            {filtered.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <FileSpreadsheet className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-bold text-muted-foreground">لا توجد فواتير مبدئية مطابقة للبحث</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  يمكنك إنشاء فاتورة مبدئية جديدة بالضغط على الزر أعلاه أو عبر الحاسبة
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-muted-foreground">
                      <th className="py-2.5 px-3 font-bold">الرقم</th>
                      <th className="py-2.5 px-3 font-bold">التاريخ</th>
                      <th className="py-2.5 px-3 font-bold">العميل / الجهة</th>
                      <th className="py-2.5 px-3 font-bold text-center">عدد البنود</th>
                      <th className="py-2.5 px-3 font-bold text-center">إجمالي الأمتار</th>
                      <th className="py-2.5 px-3 font-bold text-center">المبلغ المستحق</th>
                      <th className="py-2.5 px-3 font-bold text-center">الحالة</th>
                      <th className="py-2.5 px-3 font-bold text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((inv) => {
                      const st = STATUS_CONFIG[inv.status] || STATUS_CONFIG.draft;
                      return (
                        <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                            #{inv.meta.serial}
                          </td>
                          <td className="py-3 px-3 font-mono text-muted-foreground">
                            {inv.meta.date}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-foreground block">
                              {inv.meta.customerName || "عميل عام"}
                            </span>
                            {inv.meta.customerEnName && (
                              <span className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                                {inv.meta.customerEnName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center font-bold">
                            {inv.lines.length} بند
                          </td>
                          <td className="py-3 px-3 text-center font-mono">
                            {inv.totalArea} م²
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-black text-foreground">
                            {formatNumber(inv.totalAmount)} ج.س
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${st.bg} ${st.color} ${st.border}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* تعديل ومراجعة الأسعار */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEdit(inv)}
                                className="h-7 px-2.5 gap-1 text-[11px] font-bold"
                                title="تعديل الأسعار والمقاسات والبنود"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>تعديل</span>
                              </Button>

                              {/* معاينة وطباعة */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openEdit(inv)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                title="معاينة وطباعة"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>

                              {/* تحويل لأمر تشغيل إذا لم تكن محولة */}
                              {inv.status !== "converted" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleConvert(inv.id, inv.meta.serial)}
                                  className="h-7 w-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                  title="تحويل الفاتورة لأمر تشغيل في الورشة"
                                >
                                  <ArrowRightLeft className="h-3.5 w-3.5" />
                                </Button>
                              )}

                              {/* حذف */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(inv.id, inv.meta.serial)}
                                className="h-7 w-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="حذف الفاتورة المبدئية"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Proforma Dialog */}
      <ProformaDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        existingInvoice={activeInvoice || undefined}
        onConverted={() => setDialogOpen(false)}
      />
    </PageShell>
  );
}
