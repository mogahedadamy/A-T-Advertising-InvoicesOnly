import React, { useState, useMemo, useEffect, useDeferredValue, useRef } from "react";
import {
  Building2,
  Phone,
  PhoneCall,
  MapPin,
  Calendar,
  Clock,
  Printer,
  Share2,
  Plus,
  Pencil,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Search,
  LayoutGrid,
  List,
  ArrowUp,
  Wallet,
  ArrowDownLeft,
  Filter,
  Check,
  FolderKanban,
  FileText,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  getCustomerFinancialSummary,
  getCustomerInvoicesList,
  archiveCustomer,
  unarchiveCustomer,
  deleteCustomer,
  checkCanDeleteCustomer,
  type CustomerFinancialProfile,
  type CustomerInvoiceItemRow,
} from "@/lib/customersStore";
import {
  getCustomerStatement,
  type CustomerStatement,
} from "@/lib/repositories/ReportsRepository";
import { getProjectsByCustomer } from "@/lib/repositories/ProjectRepository";
import type { Project } from "@/lib/domain/projects";
import {
  printCustomerStatement,
  shareCustomerStatementViaWhatsApp,
} from "@/lib/customerStatementExport";
import { getCustomInvoiceById } from "@/lib/repositories/CustomInvoiceRepository";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound, playSuccessSound, playDeleteSound } from "@/lib/soundEffects";
import { CustomerDialog } from "./CustomerDialog";
import { ReceiptDialog } from "@/components/finance/ReceiptDialog";
import {
  printCustomInvoiceDocument,
  shareCustomInvoiceViaWhatsApp,
} from "@/components/billing/CustomInvoicePrintButton";

interface Props {
  customer: CustomerRecord;
  onBack: () => void;
  onCustomerUpdated?: () => void;
  onCreateInvoice?: (customer: CustomerRecord) => void;
}

/**
 * CustomerDetailPage: صفحة مساحة عمل العميل المستقلة الكاملة (PRD & CEO Standard)
 * صفحة كاملة تشغل 100% من مساحة الشاشة الرأسية والأفقية وتستوعب آلاف الفواتير،
 * اقتداءً بالمعمارية المعتمدة لصفحة الفواتير (/billing).
 */
export function CustomerDetailPage({
  customer,
  onBack,
  onCustomerUpdated,
  onCreateInvoice,
}: Props) {
  const [activeTab, setActiveTab] = useState<"invoices" | "statement" | "projects" | "info">("invoices");
  const [financialProfile, setFinancialProfile] = useState<CustomerFinancialProfile | null>(null);
  const [invoices, setInvoices] = useState<CustomerInvoiceItemRow[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statement, setStatement] = useState<CustomerStatement | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("SDG");
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible KPI Summary
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);

  // Invoice tab sub-filters & search & sorting & pagination
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "unpaid" | "partial" | "overdue" | "paid">("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch);
  const [invoiceSort, setInvoiceSort] = useState<"date-desc" | "date-asc" | "debt-desc" | "amount-desc" | "amount-asc">("date-desc");
  const [invoicePage, setInvoicePage] = useState(1);
  const [invoicePageSize, setInvoicePageSize] = useState(25);
  const [invoiceViewMode, setInvoiceViewMode] = useState<"table" | "cards">("table");

  // Statement tab search, filter, and pagination
  const [statementSearch, setStatementSearch] = useState("");
  const deferredStatementSearch = useDeferredValue(statementSearch);
  const [statementTypeFilter, setStatementTypeFilter] = useState<"all" | "invoice" | "receipt" | "opening_balance">("all");
  const [statementPage, setStatementPage] = useState(1);
  const [statementPageSize, setStatementPageSize] = useState(30);

  // Scroll to top floating button
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Modals inside customer profile
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [targetReceiptInvoiceId, setTargetReceiptInvoiceId] = useState<string | null>(null);
  const [isExportingStatement, setIsExportingStatement] = useState(false);

  const loadAllCustomerData = async () => {
    if (!customer?.id) return;
    setIsLoading(true);
    try {
      const [profile, invs, prjs] = await Promise.all([
        getCustomerFinancialSummary(customer.id),
        getCustomerInvoicesList(customer.id),
        getProjectsByCustomer(customer.id).catch(() => []),
      ]);
      setFinancialProfile(profile);
      setInvoices(invs);
      setProjects(prjs);

      const defaultCur = profile.primaryCurrency || "SDG";
      setSelectedCurrency(defaultCur);

      const stmt = await getCustomerStatement(customer.id, {}, defaultCur);
      setStatement(stmt);
    } catch (err) {
      console.error("[CustomerDetailPage] Failed to load customer data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (customer?.id) {
      void loadAllCustomerData();
    }
  }, [customer?.id]);

  const handleCurrencyChange = async (cur: string) => {
    playTapSound();
    setSelectedCurrency(cur);
    setInvoicePage(1);
    if (customer?.id) {
      const stmt = await getCustomerStatement(customer.id, {}, cur);
      setStatement(stmt);
    }
  };

  // 1. الفواتير الخاصة بالعملة المختارة
  const currentInvoicesForCurrency = useMemo(() => {
    return selectedCurrency
      ? invoices.filter((inv) => !inv.currency || inv.currency === selectedCurrency)
      : invoices;
  }, [invoices, selectedCurrency]);

  // 2. إحصائيات وتعداد الفواتير التراكمي
  const invoiceStatusCounts = useMemo(() => {
    return {
      all: currentInvoicesForCurrency.length,
      unpaid: currentInvoicesForCurrency.filter((i) => i.status === "unpaid").length,
      partial: currentInvoicesForCurrency.filter((i) => i.status === "partial").length,
      overdue: currentInvoicesForCurrency.filter((i) => i.status === "overdue").length,
      paid: currentInvoicesForCurrency.filter((i) => i.status === "paid").length,
    };
  }, [currentInvoicesForCurrency]);

  // 3. الفواتير بعد التصفية والبحث والفرز المحاسبي
  const processedInvoices = useMemo(() => {
    let list = currentInvoicesForCurrency;

    // تصفية الحالة
    if (invoiceStatusFilter !== "all") {
      list = list.filter((i) => i.status === invoiceStatusFilter);
    }

    // تصفية البحث الفوري
    const q = (deferredInvoiceSearch || "").trim().toLowerCase();
    if (q) {
      list = list.filter((inv) => {
        const refMatch = (inv.reference || "").toLowerCase().includes(q);
        const serialMatch = String(inv.serial || "").includes(q);
        const dateMatch = (inv.date || "").includes(q);
        const dueDateMatch = (inv.dueDate || "").includes(q);
        const projMatch = (inv.projectReference || "").toLowerCase().includes(q);
        const amountMatch = String(inv.totalAmount || "").includes(q);
        const remainingMatch = String(inv.remainingAmount || "").includes(q);
        return refMatch || serialMatch || dateMatch || dueDateMatch || projMatch || amountMatch || remainingMatch;
      });
    }

    // الفرز
    const sorted = [...list];
    if (invoiceSort === "date-desc") {
      sorted.sort((a, b) => b.date.localeCompare(a.date));
    } else if (invoiceSort === "date-asc") {
      sorted.sort((a, b) => a.date.localeCompare(b.date));
    } else if (invoiceSort === "debt-desc") {
      sorted.sort((a, b) => b.remainingAmount - a.remainingAmount);
    } else if (invoiceSort === "amount-desc") {
      sorted.sort((a, b) => b.totalAmount - a.totalAmount);
    } else if (invoiceSort === "amount-asc") {
      sorted.sort((a, b) => a.totalAmount - b.totalAmount);
    }

    return sorted;
  }, [currentInvoicesForCurrency, invoiceStatusFilter, deferredInvoiceSearch, invoiceSort]);

  // 4. ترقيم وتجزئة الفواتير
  const totalInvoicePages = Math.max(1, Math.ceil(processedInvoices.length / invoicePageSize));
  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * invoicePageSize;
    return processedInvoices.slice(start, start + invoicePageSize);
  }, [processedInvoices, invoicePage, invoicePageSize]);

  // مجاميع الصفحة الحالية
  const pageFinancials = useMemo(() => {
    let pageTotal = 0;
    let pageRemaining = 0;
    for (const inv of paginatedInvoices) {
      pageTotal += inv.totalAmount || 0;
      pageRemaining += inv.remainingAmount || 0;
    }
    return { pageTotal, pageRemaining };
  }, [paginatedInvoices]);

  // إعادة ضبط رقم الصفحة عند تغيير الفلتر أو البحث
  useEffect(() => {
    setInvoicePage(1);
  }, [deferredInvoiceSearch, invoiceStatusFilter, selectedCurrency, invoiceSort, invoicePageSize]);

  // 5. حركات كشف الحساب المصفاة
  const processedStatementLines = useMemo(() => {
    if (!statement?.lines) return [];
    let lines = statement.lines;

    // نوع الحركة
    if (statementTypeFilter !== "all") {
      lines = lines.filter((l) => l.kind === statementTypeFilter);
    }

    // البحث
    const q = (deferredStatementSearch || "").trim().toLowerCase();
    if (q) {
      lines = lines.filter((l) => {
        const labelMatch = (l.label || "").toLowerCase().includes(q);
        const refMatch = (l.reference || "").toLowerCase().includes(q);
        const notesMatch = (l.notes || "").toLowerCase().includes(q);
        const dateMatch = (l.date || "").includes(q);
        const debitMatch = String(l.debit || "").includes(q);
        const creditMatch = String(l.credit || "").includes(q);
        return labelMatch || refMatch || notesMatch || dateMatch || debitMatch || creditMatch;
      });
    }

    return lines;
  }, [statement?.lines, statementTypeFilter, deferredStatementSearch]);

  const totalStatementPages = Math.max(1, Math.ceil(processedStatementLines.length / statementPageSize));
  const paginatedStatementLines = useMemo(() => {
    const start = (statementPage - 1) * statementPageSize;
    return processedStatementLines.slice(start, start + statementPageSize);
  }, [processedStatementLines, statementPage, statementPageSize]);

  useEffect(() => {
    setStatementPage(1);
  }, [deferredStatementSearch, statementTypeFilter, statementPageSize]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop > 240) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrintStatement = async () => {
    if (!statement || isExportingStatement) return;
    setIsExportingStatement(true);
    try {
      await printCustomerStatement(statement, customer, selectedCurrency);
      toast.success("تم إرسال كشف الحساب للطباعة");
    } catch (err: any) {
      toast.error(err?.message || "تعذر طباعة كشف الحساب");
    } finally {
      setIsExportingStatement(false);
    }
  };

  const handleShareStatement = async () => {
    if (!statement || isExportingStatement) return;
    setIsExportingStatement(true);
    try {
      await shareCustomerStatementViaWhatsApp(statement, customer, selectedCurrency);
      toast.success("تم فتح واتساب لمشاركة كشف الحساب");
    } catch (err: any) {
      toast.error(err?.message || "تعذر مشاركة كشف الحساب");
    } finally {
      setIsExportingStatement(false);
    }
  };

  const handleInvoicePrint = async (invoiceId: string) => {
    playTapSound();
    try {
      const fullInv = await getCustomInvoiceById(invoiceId);
      if (!fullInv) {
        toast.error("تعذر العثور على الفاتورة الأصلية");
        return;
      }
      await printCustomInvoiceDocument(fullInv);
    } catch (err: any) {
      toast.error("تعذرت طباعة الفاتورة");
    }
  };

  const handleInvoiceShare = async (invoiceId: string) => {
    playTapSound();
    try {
      const fullInv = await getCustomInvoiceById(invoiceId);
      if (!fullInv) {
        toast.error("تعذر العثور على الفاتورة الأصلية");
        return;
      }
      await shareCustomInvoiceViaWhatsApp(fullInv);
    } catch (err: any) {
      toast.error("تعذرت مشاركة الفاتورة");
    }
  };

  const typeConfig = CUSTOMER_TYPE_CONFIG[customer.type] || CUSTOMER_TYPE_CONFIG.agency;
  const currentSummary = financialProfile?.summariesByCurrency[selectedCurrency] || {
    currency: selectedCurrency,
    totalInvoiced: 0,
    totalPaid: 0,
    outstanding: 0,
    advanceCredit: 0,
    totalInvoicesCount: 0,
    paidInvoicesCount: 0,
    partialInvoicesCount: 0,
    unpaidInvoicesCount: 0,
    overdueInvoicesCount: 0,
  };

  return (
    <PageShell>
      <main
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-36 md:pb-16"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3.5 sm:space-y-4 w-full">
          {/* 1. مسار التنقل والترويسة التنفيذية العريضة (Breadcrumbs & Hero Bar) */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              {/* شريط المسار الهرمي */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold mb-1.5 flex-wrap">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    playTapSound();
                    onBack();
                  }}
                  className="h-7 px-2 -mr-2 text-xs font-black text-primary hover:bg-primary/10 gap-1 rounded-lg cursor-pointer"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>دليل العملاء</span>
                </Button>
                <span>/</span>
                <span className="text-foreground font-black">{customer.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">({customer.id})</span>
              </div>

              {/* عنوان واسم العميل مع الشارة */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Building2 className="h-4.5 w-4.5" />
                </span>
                <h1 className="text-base sm:text-lg md:text-xl font-black text-foreground tracking-tight">
                  {customer.name}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${typeConfig.bg} ${typeConfig.color} border-current/20`}
                >
                  {typeConfig.label}
                </span>
                {customer.isArchived && (
                  <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[9.5px] font-black">
                    مؤرشف
                  </span>
                )}
              </div>
            </div>

            {/* أزرار الإجراءات السريعة الكاملة */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Button
                type="button"
                onClick={() => {
                  playTapSound();
                  onCreateInvoice?.(customer);
                }}
                className="h-9 px-3.5 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.97] transition-all touch-manipulation cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>إصدار فاتورة</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  playTapSound();
                  setTargetReceiptInvoiceId(null);
                  setReceiptDialogOpen(true);
                }}
                className="h-9 px-3 rounded-xl font-bold text-xs gap-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/15 active:scale-[0.97] transition-all cursor-pointer"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>تحصيل سند قبض</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isExportingStatement || !statement}
                onClick={handlePrintStatement}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 text-foreground hover:bg-secondary active:scale-[0.97] cursor-pointer"
                title="طباعة كشف الحساب المالي"
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">طباعة الكشف</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={isExportingStatement || !statement}
                onClick={handleShareStatement}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 active:scale-[0.97] cursor-pointer"
                title="مشاركة كشف الحساب عبر واتساب"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">مشاركة واتساب</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  playTapSound();
                  setEditDialogOpen(true);
                }}
                className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
                title="تعديل بيانات العميل"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 2. مركز القيادة المالية للعميل والعملات المتعددة (Financial Command Center) */}
          <div className="rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span>المركز المالي للعميل بالعملة المحددة:</span>
                </span>

                {/* أزرار العملات */}
                <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-xl border border-border/60">
                  {Object.keys(financialProfile?.summariesByCurrency || { SDG: {} }).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => handleCurrencyChange(cur)}
                      className={`px-2.5 py-1 text-xs rounded-lg font-mono font-bold transition-all cursor-pointer ${
                        selectedCurrency === cur
                          ? "bg-primary text-white shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {/* زر طي / توسيع المؤشرات */}
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  setIsSummaryCollapsed(!isSummaryCollapsed);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg bg-secondary/40 hover:bg-secondary cursor-pointer self-end sm:self-auto"
              >
                <span>{isSummaryCollapsed ? "عرض تفاصيل المؤشرات" : "طي المؤشرات"}</span>
                {isSummaryCollapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* الشريط المدمج عند الطي */}
            {isSummaryCollapsed ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs px-2 py-1 bg-secondary/30 rounded-xl font-mono">
                <div>
                  <span className="text-muted-foreground font-sans text-[11px]">المفوتر: </span>
                  <strong className="text-foreground font-black">{formatNumber(currentSummary.totalInvoiced)} {selectedCurrency}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground font-sans text-[11px]">المسدد: </span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-black">{formatNumber(currentSummary.totalPaid)} {selectedCurrency}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground font-sans text-[11px]">المتبقي القائم: </span>
                  <strong className={currentSummary.outstanding > 0.009 ? "text-rose-600 font-black" : "text-emerald-600 font-bold"}>
                    {formatNumber(currentSummary.outstanding)} {selectedCurrency}
                  </strong>
                </div>
                <div className="text-[11px] font-sans text-muted-foreground">
                  إجمالي الفواتير: <span className="font-bold text-foreground">{currentSummary.totalInvoicesCount}</span>
                </div>
              </div>
            ) : (
              /* شبكة بطاقات الأداء المالي الموسعة */
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-border/60 bg-secondary/35 p-3 space-y-1">
                  <span className="text-[10.5px] font-bold text-muted-foreground block">إجمالي الفواتير الصادرة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                    {formatNumber(currentSummary.totalInvoiced)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    {currentSummary.totalInvoicesCount} فاتورة محررة
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1">
                  <span className="text-[10.5px] font-bold text-emerald-700 dark:text-emerald-400 block">إجمالي المبالغ المدفوعة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatNumber(currentSummary.totalPaid)}{" "}
                    <span className="text-[10px] font-normal">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-emerald-600/80 block">
                    {currentSummary.paidInvoicesCount} مسددة بالكامل
                  </span>
                </div>

                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-1">
                  <span className="text-[10.5px] font-bold text-rose-700 dark:text-rose-400 block">المبالغ المستحقة (مديونية)</span>
                  <p className="font-mono text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatNumber(currentSummary.outstanding)}{" "}
                    <span className="text-[10px] font-normal">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-rose-600/80 block">
                    {currentSummary.overdueInvoicesCount > 0
                      ? `${currentSummary.overdueInvoicesCount} متأخرة عن السداد`
                      : "لا توجد متأخرات حرجة"}
                  </span>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/35 p-3 space-y-1">
                  <span className="text-[10.5px] font-bold text-muted-foreground block">أرصدة مقدمة / دفعات دائنة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                    {formatNumber(currentSummary.advanceCredit)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block">
                    {currentSummary.partialInvoicesCount} فاتورة بسداد جزئي
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. تبويبات مساحة العمل الكاملة (Workspace Navigation Tabs) */}
          <div className="rounded-2xl border border-border/70 bg-card p-1 shadow-2xs flex items-center gap-1.5 text-xs font-black overflow-x-auto scrollbar-none">
            {[
              { key: "invoices", label: `سجل الفواتير (${invoices.length})` },
              { key: "statement", label: `كشف الحساب المالي (${statement?.lines.length || 0})` },
              { key: "projects", label: `المشاريع المرتبطة (${projects.length})` },
              { key: "info", label: "بيانات العميل والافتتاحي" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab(tab.key as any);
                }}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0 ${
                  activeTab === tab.key
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 4. محتوى مساحة العمل الكامل (Workspace Content Area) */}
          <div className="space-y-3">
            {/* ── TAB 1: INVOICES (الفواتير) ── */}
            {activeTab === "invoices" && (
              <div className="space-y-3">
                {/* شريط الأدوات: البحث، الفرز، الترقيم، ونمط العرض */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 rounded-2xl border border-border/70 shadow-2xs">
                  {/* حقل البحث الفوري */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="بحث سريع برقم الفاتورة، التاريخ، الاستحقاق، المشروع، أو القيمة..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="h-9.5 pr-8 pl-8 text-xs bg-secondary/40 rounded-xl border-border/70 placeholder:text-muted-foreground/70"
                    />
                    {invoiceSearch && (
                      <button
                        type="button"
                        onClick={() => setInvoiceSearch("")}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* مجموعة خيارات الفرز والكثافة ونمط العرض */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-between sm:justify-end flex-wrap">
                    {/* الترتيب المالي */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1.5 rounded-xl border border-border/60">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      <select
                        aria-label="ترتيب الفواتير"
                        value={invoiceSort}
                        onChange={(e) => setInvoiceSort(e.target.value as any)}
                        className="bg-transparent text-xs font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value="date-desc">الأحدث تاريخاً</option>
                        <option value="date-asc">الأقدم تاريخاً</option>
                        <option value="debt-desc">الأعلى متبقي (مديونية)</option>
                        <option value="amount-desc">الأعلى قيمة</option>
                        <option value="amount-asc">الأقل قيمة</option>
                      </select>
                    </div>

                    {/* عدد السجلات بالصفحة */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1.5 rounded-xl border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold">عرض:</span>
                      <select
                        aria-label="عدد الفواتير لكل صفحة"
                        value={invoicePageSize}
                        onChange={(e) => setInvoicePageSize(Number(e.target.value))}
                        className="bg-transparent text-xs font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    {/* التبديل بين الجدول والبطاقات */}
                    <div className="flex items-center bg-secondary/70 p-0.5 rounded-xl border border-border/60">
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setInvoiceViewMode("table");
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          invoiceViewMode === "table"
                            ? "bg-card text-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="عرض الجدول المالي عالي الكثافة (موصى به للأعداد الكبيرة)"
                      >
                        <List className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playTapSound();
                          setInvoiceViewMode("cards");
                        }}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          invoiceViewMode === "cards"
                            ? "bg-card text-foreground shadow-2xs font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="عرض البطاقات التنفيذية"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* تبويبات الفلترة حسب الحالة مع أعداد حية */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
                  {[
                    { key: "all", label: `كل الفواتير (${invoiceStatusCounts.all})` },
                    { key: "unpaid", label: `غير مسددة (${invoiceStatusCounts.unpaid})` },
                    { key: "partial", label: `مسددة جزئياً (${invoiceStatusCounts.partial})` },
                    { key: "overdue", label: `متأخرة (${invoiceStatusCounts.overdue})` },
                    { key: "paid", label: `مسددة بالكامل (${invoiceStatusCounts.paid})` },
                  ].map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => {
                        playTapSound();
                        setInvoiceStatusFilter(sub.key as any);
                      }}
                      className={`px-3.5 py-1.5 rounded-full font-bold shrink-0 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        invoiceStatusFilter === sub.key
                          ? "bg-primary text-white shadow-2xs"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* ملخص نتائج الفلترة ومجاميع الصفحة الحالية */}
                {processedInvoices.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between text-xs px-2 text-muted-foreground gap-2">
                    <div>
                      عرض{" "}
                      <span className="font-bold text-foreground">
                        {Math.min((invoicePage - 1) * invoicePageSize + 1, processedInvoices.length)} -{" "}
                        {Math.min(invoicePage * invoicePageSize, processedInvoices.length)}
                      </span>{" "}
                      من إجمالي{" "}
                      <span className="font-bold text-foreground">{processedInvoices.length}</span> فاتورة
                      {deferredInvoiceSearch && (
                        <span className="text-primary font-bold mr-1.5">
                          (تمت التصفية حسب: "{deferredInvoiceSearch}")
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span>
                        إجمالي الصفحة:{" "}
                        <strong className="text-foreground font-black">{formatNumber(pageFinancials.pageTotal)}</strong>
                      </span>
                      <span>
                        المتبقي في الصفحة:{" "}
                        <strong className={pageFinancials.pageRemaining > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                          {formatNumber(pageFinancials.pageRemaining)}
                        </strong>{" "}
                        {selectedCurrency}
                      </span>
                    </div>
                  </div>
                )}

                {/* محتوى قائمة الفواتير: جدول أو بطاقات */}
                {processedInvoices.length === 0 ? (
                  <div className="py-16 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl bg-card">
                    لا توجد فواتير مطابقة لهذا التصنيف أو نتيجة البحث
                  </div>
                ) : invoiceViewMode === "table" ? (
                  /* عرض الجدول المالي عالي الكثافة مع ترويسة مثبتة */
                  <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-2xs">
                    <div className="overflow-x-auto max-h-[640px] overscroll-contain">
                      <table className="w-full text-right text-xs">
                        <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground text-[11px] border-b border-border/70 z-10 shadow-xs">
                          <tr>
                            <th className="py-3 px-3.5 font-black">رقم الفاتورة</th>
                            <th className="py-3 px-3.5 font-black">التاريخ</th>
                            <th className="py-3 px-3.5 font-black">المشروع</th>
                            <th className="py-3 px-3.5 font-black text-left" dir="ltr">الإجمالي</th>
                            <th className="py-3 px-3.5 font-black text-left" dir="ltr">المتبقي</th>
                            <th className="py-3 px-3.5 font-black text-center">الحالة</th>
                            <th className="py-3 px-3.5 font-black text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                          {paginatedInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                              <td className="py-3 px-3.5 font-black text-primary text-xs" dir="ltr">
                                {inv.reference || `#${inv.serial}`}
                              </td>
                              <td className="py-3 px-3.5 text-muted-foreground font-sans">
                                {inv.date}
                                {inv.dueDate && (
                                  <span
                                    className={`block text-[9.5px] ${
                                      inv.status === "overdue" ? "text-rose-600 font-bold" : "text-muted-foreground/70"
                                    }`}
                                  >
                                    الاستحقاق: {inv.dueDate}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-muted-foreground font-sans">
                                {inv.projectReference || "—"}
                              </td>
                              <td className="py-3 px-3.5 text-left font-black tabular-nums text-foreground text-xs" dir="ltr">
                                {formatNumber(inv.totalAmount)} {inv.currency}
                              </td>
                              <td className="py-3 px-3.5 text-left font-black tabular-nums text-xs" dir="ltr">
                                {inv.remainingAmount > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400">
                                    {formatNumber(inv.remainingAmount)} {inv.currency}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-sans font-bold">مسددة</span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-center">
                                <span
                                  className={`inline-block rounded-full px-2.5 py-0.5 text-[9.5px] font-sans font-black border ${inv.statusBadgeColor}`}
                                >
                                  {inv.statusLabel}
                                </span>
                              </td>
                              <td className="py-3 px-3.5 text-center font-sans">
                                <div className="flex items-center justify-center gap-1.5">
                                  {inv.remainingAmount > 0 && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        playTapSound();
                                        setTargetReceiptInvoiceId(inv.id);
                                        setReceiptDialogOpen(true);
                                      }}
                                      className="h-7 px-2.5 rounded-lg text-xs font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 cursor-pointer"
                                      title="تحصيل دفعة لهذه الفاتورة"
                                    >
                                      تحصيل
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleInvoicePrint(inv.id)}
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                                    title="طباعة الفاتورة"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleInvoiceShare(inv.id)}
                                    className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                    title="مشاركة الفاتورة عبر واتساب"
                                  >
                                    <Share2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  /* عرض البطاقات التنفيذية */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paginatedInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="rounded-2xl border border-border/70 bg-card hover:bg-secondary/30 transition-all p-4 space-y-3 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-sm text-primary" dir="ltr">
                                {inv.reference || `#${inv.serial}`}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black border ${inv.statusBadgeColor}`}
                              >
                                {inv.statusLabel}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span>التاريخ: {inv.date}</span>
                              {inv.dueDate && (
                                <span className={`mr-2 ${inv.status === "overdue" ? "text-rose-600 font-bold" : ""}`}>
                                  الاستحقاق: {inv.dueDate}
                                </span>
                              )}
                            </div>
                          </div>

                          {inv.projectReference && (
                            <span className="text-[10px] font-mono bg-secondary px-2.5 py-1 rounded-md text-muted-foreground border border-border/60">
                              {inv.projectReference}
                            </span>
                          )}
                        </div>

                        {/* المبالغ */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                            <span className="text-[10px] text-muted-foreground font-bold block">إجمالي الفاتورة</span>
                            <p className="font-mono text-sm font-black text-foreground tabular-nums mt-0.5">
                              {formatNumber(inv.totalAmount)} {inv.currency}
                            </p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-secondary/30 p-2.5">
                            <span className="text-[10px] text-muted-foreground font-bold block">المتبقي المطلوب</span>
                            <p className="font-mono text-sm font-black tabular-nums mt-0.5">
                              {inv.remainingAmount > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {formatNumber(inv.remainingAmount)} {inv.currency}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-sans font-bold">مسددة بالكامل</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* الإجراءات */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40">
                          {inv.remainingAmount > 0 ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                playTapSound();
                                setTargetReceiptInvoiceId(inv.id);
                                setReceiptDialogOpen(true);
                              }}
                              className="h-8 px-3 rounded-xl text-xs font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 cursor-pointer active:scale-95"
                            >
                              تحصيل دفعة
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-medium">لا توجد مستحقات</span>
                          )}

                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleInvoicePrint(inv.id)}
                              className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
                              title="طباعة الفاتورة"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleInvoiceShare(inv.id)}
                              className="h-8 w-8 p-0 rounded-xl text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                              title="مشاركة الفاتورة عبر واتساب"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* شريط الترقيم السفلي المتقدم */}
                {totalInvoicePages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs bg-card p-3 rounded-2xl border shadow-2xs">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={invoicePage <= 1}
                        onClick={() => {
                          playTapSound();
                          setInvoicePage(1);
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة الأولى"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={invoicePage <= 1}
                        onClick={() => {
                          playTapSound();
                          setInvoicePage((p) => Math.max(1, p - 1));
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <div className="px-3.5 py-1.5 bg-secondary/60 rounded-xl font-mono font-bold text-foreground text-xs border border-border/50">
                        صفحة {invoicePage} من {totalInvoicePages}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={invoicePage >= totalInvoicePages}
                        onClick={() => {
                          playTapSound();
                          setInvoicePage((p) => Math.min(totalInvoicePages, p + 1));
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة التالية"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={invoicePage >= totalInvoicePages}
                        onClick={() => {
                          playTapSound();
                          setInvoicePage(totalInvoicePages);
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة الأخيرة"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      <span>انتقال سريع:</span>
                      <Input
                        type="number"
                        min={1}
                        max={totalInvoicePages}
                        value={invoicePage}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val >= 1 && val <= totalInvoicePages) {
                            setInvoicePage(val);
                          }
                        }}
                        className="h-8.5 w-18 text-center text-xs font-mono font-bold bg-secondary/50 rounded-xl border-border/70 p-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: STATEMENT (كشف الحساب المالي الكامل) ── */}
            {activeTab === "statement" && (
              <div className="space-y-3">
                {/* شريط البحث وتصفية كشف الحساب */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card p-3 rounded-2xl border border-border/70 shadow-2xs">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="بحث في الحركات: البيان، المرجع، المبلغ..."
                      value={statementSearch}
                      onChange={(e) => setStatementSearch(e.target.value)}
                      className="h-9.5 pr-8 pl-8 text-xs bg-secondary/40 rounded-xl border-border/70 placeholder:text-muted-foreground/70"
                    />
                    {statementSearch && (
                      <button
                        type="button"
                        onClick={() => setStatementSearch("")}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 justify-between sm:justify-end flex-wrap">
                    {/* نوع الحركة */}
                    <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-xl border border-border/60">
                      {[
                        { key: "all", label: "الكل" },
                        { key: "invoice", label: "فواتير" },
                        { key: "receipt", label: "سندات" },
                        { key: "opening_balance", label: "افتتاحي" },
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            playTapSound();
                            setStatementTypeFilter(item.key as any);
                          }}
                          className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                            statementTypeFilter === item.key
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* عدد السجلات */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1.5 rounded-xl border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold">عرض:</span>
                      <select
                        aria-label="عدد أسطر كشف الحساب لكل صفحة"
                        value={statementPageSize}
                        onChange={(e) => setStatementPageSize(Number(e.target.value))}
                        className="bg-transparent text-xs font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* جدول كشف الحساب المحاسبي مع ترويسة مثبتة */}
                <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-2xs">
                  <div className="overflow-x-auto max-h-[640px] overscroll-contain">
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground text-[11px] border-b border-border/70 z-10 shadow-xs">
                        <tr>
                          <th className="py-3 px-3.5 font-black">التاريخ</th>
                          <th className="py-3 px-3.5 font-black">البيان والحركة</th>
                          <th className="py-3 px-3.5 font-black text-center">المرجع</th>
                          <th className="py-3 px-3.5 font-black text-left" dir="ltr">مدين (+)</th>
                          <th className="py-3 px-3.5 font-black text-left" dir="ltr">دائن (-)</th>
                          <th className="py-3 px-3.5 font-black text-left" dir="ltr">الرصيد الجاري</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                        {paginatedStatementLines.length > 0 ? (
                          paginatedStatementLines.map((line, idx) => (
                            <tr key={line.id || idx} className="hover:bg-muted/20 transition-colors">
                              <td className="py-3 px-3.5 text-muted-foreground font-sans">{line.date}</td>
                              <td className="py-3 px-3.5 font-sans font-bold text-foreground">
                                {line.label}
                                {line.notes && (
                                  <span className="block text-[10px] text-muted-foreground font-normal">
                                    {line.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3.5 text-center text-primary font-bold" dir="ltr">
                                {line.reference || "—"}
                              </td>
                              <td className="py-3 px-3.5 text-left text-rose-600 font-bold tabular-nums text-xs" dir="ltr">
                                {line.debit > 0 ? formatNumber(line.debit) : "—"}
                              </td>
                              <td className="py-3 px-3.5 text-left text-emerald-600 font-bold tabular-nums text-xs" dir="ltr">
                                {line.credit > 0 ? formatNumber(line.credit) : "—"}
                              </td>
                              <td
                                className={`py-3 px-3.5 text-left font-black tabular-nums text-xs ${
                                  line.runningBalance > 0
                                    ? "text-rose-600"
                                    : line.runningBalance < 0
                                    ? "text-emerald-600"
                                    : "text-foreground"
                                }`}
                                dir="ltr"
                              >
                                {formatNumber(line.runningBalance)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-16 text-center text-muted-foreground font-sans font-bold">
                              لا توجد حركات مالية مسجلة في كشف الحساب
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ترقيم كشف الحساب */}
                {totalStatementPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs bg-card p-3 rounded-2xl border shadow-2xs">
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={statementPage <= 1}
                        onClick={() => {
                          playTapSound();
                          setStatementPage(1);
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة الأولى"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={statementPage <= 1}
                        onClick={() => {
                          playTapSound();
                          setStatementPage((p) => Math.max(1, p - 1));
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <div className="px-3.5 py-1.5 bg-secondary/60 rounded-xl font-mono font-bold text-foreground text-xs border border-border/50">
                        صفحة {statementPage} من {totalStatementPages}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={statementPage >= totalStatementPages}
                        onClick={() => {
                          playTapSound();
                          setStatementPage((p) => Math.min(totalStatementPages, p + 1));
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة التالية"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={statementPage >= totalStatementPages}
                        onClick={() => {
                          playTapSound();
                          setStatementPage(totalStatementPages);
                        }}
                        className="h-8.5 w-8.5 p-0 rounded-xl cursor-pointer"
                        title="الصفحة الأخيرة"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-muted-foreground text-xs">
                      إجمالي الحركات: <span className="font-bold text-foreground">{processedStatementLines.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: PROJECTS (المشاريع المرتبطة) ── */}
            {activeTab === "projects" && (
              <div className="space-y-3">
                {projects.length === 0 ? (
                  <div className="py-16 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl bg-card">
                    لا توجد مشاريع مرتبطة بهذا العميل حالياً
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {projects.map((prj) => (
                      <div
                        key={prj.id}
                        className="rounded-2xl border border-border/70 bg-card p-4 flex items-center justify-between gap-3 shadow-2xs hover:bg-secondary/30 transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-primary" dir="ltr">
                              {prj.reference}
                            </span>
                            <span className="font-black text-sm text-foreground">{prj.title}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {prj.deliveryDate ? `موعد التسليم: ${prj.deliveryDate}` : `الإنشاء: ${prj.createdAt.slice(0, 10)}`}
                          </div>
                        </div>

                        <div className="text-left font-mono text-xs shrink-0">
                          <span className="rounded-full px-3 py-1 text-[10.5px] font-bold bg-secondary border border-border/80 text-foreground">
                            {prj.executionStatus}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: CUSTOMER INFO (بيانات العميل والافتتاحي) ── */}
            {activeTab === "info" && (
              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-4 text-xs shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <span className="text-[10.5px] text-muted-foreground font-bold">معرف العميل في النظام (ID)</span>
                    <p className="font-mono font-bold text-foreground mt-0.5 text-xs">{customer.id}</p>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-muted-foreground font-bold">تاريخ التسجيل</span>
                    <p className="font-mono font-bold text-foreground mt-0.5 text-xs">
                      {customer.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-muted-foreground font-bold">رقم الهاتف</span>
                    <p className="font-mono font-bold text-primary mt-0.5 text-xs" dir="ltr">
                      {customer.phone || "—"}
                    </p>
                  </div>
                </div>

                {customer.openingBalance ? (
                  <div className="border-t border-border/50 pt-3">
                    <span className="text-[10.5px] text-muted-foreground font-bold">حركة الرصيد الافتتاحي</span>
                    <p className="font-bold text-foreground mt-0.5 text-xs">
                      {formatNumber(customer.openingBalance)} {customer.openingBalanceCurrency || "SDG"}{" "}
                      ({customer.openingBalanceType === "credit" ? "رصيد دائن / دفعة مقدمة" : "مديونية سابقة مستحقة"})
                    </p>
                    {customer.openingBalanceNotes && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{customer.openingBalanceNotes}</p>
                    )}
                  </div>
                ) : null}

                {customer.notes && (
                  <div className="border-t border-border/50 pt-3">
                    <span className="text-[10.5px] text-muted-foreground font-bold">ملاحظات وشروط خاصة</span>
                    <p className="text-foreground mt-0.5 text-xs">{customer.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* زر الصعود السلس للأعلى */}
        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="fixed bottom-20 md:bottom-8 left-6 z-40 p-2.5 rounded-full bg-primary text-white shadow-xl hover:bg-primary/90 transition-all cursor-pointer touch-manipulation active:scale-95 animate-in fade-in flex items-center justify-center border border-white/20"
            title="العودة لأعلى الصفحة"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </main>

      {/* نافذة تعديل بيانات العميل */}
      <CustomerDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        initialData={customer}
        onSave={async (updatedData) => {
          const { updateCustomer } = await import("@/lib/customersStore");
          await updateCustomer(customer.id, updatedData);
          setEditDialogOpen(false);
          onCustomerUpdated?.();
          void loadAllCustomerData();
        }}
      />

      {/* نافذة تحصيل سند قبض مالي */}
      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        initialCustomerId={customer.id}
        initialInvoiceId={targetReceiptInvoiceId}
        onRecorded={() => {
          void loadAllCustomerData();
          onCustomerUpdated?.();
        }}
      />
    </PageShell>
  );
}
