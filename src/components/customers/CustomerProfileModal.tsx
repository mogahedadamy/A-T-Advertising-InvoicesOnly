import React, { useState, useEffect, useMemo, useDeferredValue, useRef } from "react";
import {
  X,
  Phone,
  PhoneCall,
  MapPin,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Plus,
  Printer,
  Share2,
  FolderKanban,
  AlertCircle,
  CheckCircle2,
  Clock,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
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
  ExternalLink,
  Wallet,
  ArrowDownLeft,
  Filter,
  Check,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { getCustomerStatement, type CustomerStatement } from "@/lib/repositories/ReportsRepository";
import { getProjectsByCustomer } from "@/lib/repositories/ProjectRepository";
import type { Project } from "@/lib/domain/projects";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound, playSuccessSound, playDeleteSound } from "@/lib/soundEffects";
import { CustomerDialog } from "./CustomerDialog";
import { ReceiptDialog } from "@/components/finance/ReceiptDialog";
import {
  printCustomerStatement,
  shareCustomerStatementViaWhatsApp,
} from "@/lib/customerStatementExport";
import { getCustomInvoiceById } from "@/lib/repositories/CustomInvoiceRepository";
import {
  printCustomInvoiceDocument,
  shareCustomInvoiceViaWhatsApp,
} from "@/components/billing/CustomInvoicePrintButton";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: CustomerRecord | null;
  onCustomerUpdated?: () => void;
  onCreateInvoice?: (customer: CustomerRecord) => void;
}

export function CustomerProfileModal({
  open,
  onOpenChange,
  customer,
  onCustomerUpdated,
  onCreateInvoice,
}: Props) {
  if (!customer) return null;

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
  const [invoiceViewMode, setInvoiceViewMode] = useState<"cards" | "table">("cards");

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
      console.error("[CustomerProfile] Failed to load customer data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && customer) {
      void loadAllCustomerData();
    }
  }, [open, customer]);

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

  // 3. المعالجة الكاملة للفواتير: فلترة الحالة + البحث الفوري + الترتيب
  const processedInvoices = useMemo(() => {
    let list = currentInvoicesForCurrency;

    // تصفية حسب الحالة
    if (invoiceStatusFilter !== "all") {
      list = list.filter((inv) => inv.status === invoiceStatusFilter);
    }

    // تصفية حسب البحث الفوري
    const q = deferredInvoiceSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((inv) => {
        return (
          inv.reference?.toLowerCase().includes(q) ||
          inv.serial?.toLowerCase().includes(q) ||
          inv.date?.toLowerCase().includes(q) ||
          inv.dueDate?.toLowerCase().includes(q) ||
          inv.projectReference?.toLowerCase().includes(q) ||
          String(inv.totalAmount).includes(q) ||
          String(inv.remainingAmount).includes(q)
        );
      });
    }

    // الفرز والترتيب
    return [...list].sort((a, b) => {
      switch (invoiceSort) {
        case "date-asc":
          return a.date.localeCompare(b.date);
        case "debt-desc":
          return (b.remainingAmount || 0) - (a.remainingAmount || 0);
        case "amount-desc":
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case "amount-asc":
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case "date-desc":
        default:
          return b.date.localeCompare(a.date);
      }
    });
  }, [currentInvoicesForCurrency, invoiceStatusFilter, deferredInvoiceSearch, invoiceSort]);

  // التصفح والتقسيم إلى صفحات (Pagination) لضمان أقصى سرعة حتى مع آلاف الفواتير
  const totalInvoicePages = Math.max(1, Math.ceil(processedInvoices.length / invoicePageSize));

  const paginatedInvoices = useMemo(() => {
    const start = (invoicePage - 1) * invoicePageSize;
    return processedInvoices.slice(start, start + invoicePageSize);
  }, [processedInvoices, invoicePage, invoicePageSize]);

  const pageFinancials = useMemo(() => {
    let pageTotal = 0;
    let pageRemaining = 0;
    for (const inv of paginatedInvoices) {
      pageTotal += inv.totalAmount || 0;
      pageRemaining += inv.remainingAmount || 0;
    }
    return { pageTotal, pageRemaining };
  }, [paginatedInvoices]);

  // إعادة التصفير إلى الصفحة الأولى عند تغير أي فلتر
  useEffect(() => {
    setInvoicePage(1);
  }, [deferredInvoiceSearch, invoiceStatusFilter, selectedCurrency, invoiceSort, invoicePageSize]);

  // تصفية كشف الحساب والبحث داخله
  const processedStatementLines = useMemo(() => {
    if (!statement?.lines) return [];
    let list = statement.lines;

    if (statementTypeFilter !== "all") {
      list = list.filter((l) => l.kind === statementTypeFilter);
    }

    const q = deferredStatementSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        return (
          l.label?.toLowerCase().includes(q) ||
          l.reference?.toLowerCase().includes(q) ||
          l.notes?.toLowerCase().includes(q) ||
          l.date?.toLowerCase().includes(q) ||
          String(l.debit).includes(q) ||
          String(l.credit).includes(q) ||
          String(l.runningBalance).includes(q)
        );
      });
    }

    return list;
  }, [statement, statementTypeFilter, deferredStatementSearch]);

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

  const handleArchiveToggle = async () => {
    playTapSound();
    try {
      if (customer.isArchived) {
        await unarchiveCustomer(customer.id);
        toast.success(`تم إلغاء أرشفة العميل "${customer.name}" بنجاح`);
      } else {
        await archiveCustomer(customer.id);
        toast.info(`تم نقل العميل "${customer.name}" إلى الأرشيف`);
      }
      onCustomerUpdated?.();
      void loadAllCustomerData();
    } catch (err) {
      toast.error("تعذر تغيير حالة أرشفة العميل");
    }
  };

  const handleDeleteAttempt = async () => {
    playTapSound();
    const check = await checkCanDeleteCustomer(customer.id);
    if (!check.allowed) {
      playDeleteSound();
      toast.error("لا يمكن حذف هذا العميل", {
        description: check.reason,
        duration: 6000,
      });
      return;
    }

    if (confirm(`هل أنت متأكد من الحذف النهائي للعميل "${customer.name}"؟ (لا توجد عليه فواتير أو حركات سابقة)`)) {
      try {
        await deleteCustomer(customer.id);
        playSuccessSound();
        toast.success(`تم حذف العميل "${customer.name}" نهائياً`);
        onCustomerUpdated?.();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err?.message || "تعذر حذف العميل");
      }
    }
  };

  const handlePrintStatement = async () => {
    if (!statement || !customer) return;
    setIsExportingStatement(true);
    try {
      await printCustomerStatement(statement, customer, selectedCurrency);
    } finally {
      setIsExportingStatement(false);
    }
  };

  const handleShareStatement = async () => {
    if (!statement || !customer) return;
    setIsExportingStatement(true);
    try {
      await shareCustomerStatementViaWhatsApp(statement, customer, selectedCurrency);
    } finally {
      setIsExportingStatement(false);
    }
  };

  const handleInvoicePrint = async (invoiceId: string) => {
    playTapSound();
    const fullInv = await getCustomInvoiceById(invoiceId);
    if (!fullInv) {
      toast.error("تعذر العثور على الفاتورة الأصلية");
      return;
    }
    await printCustomInvoiceDocument(fullInv);
  };

  const handleInvoiceShare = async (invoiceId: string) => {
    playTapSound();
    const fullInv = await getCustomInvoiceById(invoiceId);
    if (!fullInv) {
      toast.error("تعذر العثور على الفاتورة الأصلية");
      return;
    }
    await shareCustomInvoiceViaWhatsApp(fullInv);
  };

  const cfg = CUSTOMER_TYPE_CONFIG[customer.type] || CUSTOMER_TYPE_CONFIG.individual;
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dir="rtl"
          className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-0 rounded-3xl bg-card border border-border/80 shadow-2xl overflow-hidden gap-0"
        >
          {/* 1. Header: Customer Identity & Toolbar */}
          <div className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Building2 className="h-5 w-5" />
                </span>
                <h2 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  {customer.name}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${cfg.bg} ${cfg.color} shrink-0`}
                >
                  {cfg.label}
                </span>

                {/* Status Badge */}
                {financialProfile && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${financialProfile.statusBg} ${financialProfile.statusColor} shrink-0`}
                  >
                    {financialProfile.statusLabel}
                  </span>
                )}

                {customer.isArchived && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black bg-muted text-muted-foreground border border-border shrink-0">
                    مؤرشف
                  </span>
                )}
              </div>

              {/* Contact info row */}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground font-medium">
                {customer.phone ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${customer.phone}`}
                      className="inline-flex items-center gap-1.5 text-primary font-mono font-bold hover:underline"
                      dir="ltr"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>{customer.phone}</span>
                    </a>
                    <a
                      href={`https://wa.me/${customer.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold hover:bg-emerald-500/20 transition"
                    >
                      واتساب
                    </a>
                  </div>
                ) : (
                  <span>لا يوجد رقم هاتف</span>
                )}
                {customer.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground/80" />
                    <span>{customer.address}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Top Toolbar Actions */}
            <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  setEditDialogOpen(true);
                }}
                className="h-8.5 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 text-foreground hover:bg-secondary active:scale-[0.97] touch-manipulation cursor-pointer"
                title="تعديل بيانات العميل"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                <span>تعديل</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleArchiveToggle}
                className="h-8.5 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 text-foreground hover:bg-secondary active:scale-[0.97] touch-manipulation cursor-pointer"
                title={customer.isArchived ? "إلغاء الأرشفة" : "أرشفة العميل"}
              >
                {customer.isArchived ? <ArchiveRestore className="h-3.5 w-3.5 text-primary" /> : <Archive className="h-3.5 w-3.5 text-muted-foreground" />}
                <span>{customer.isArchived ? "استعادة" : "أرشفة"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteAttempt}
                className="h-8.5 w-8.5 p-0 rounded-xl text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 hover:border-rose-500/30 active:scale-[0.97] touch-manipulation cursor-pointer"
                title="حذف العميل نهائياً"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 2. Multi-Currency Financial KPI Bar & Currency Switcher */}
          <div className="p-3.5 sm:p-4 border-b border-border/60 space-y-2.5 shrink-0 bg-background/50">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-foreground flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  <span>الملخص المالي والذمم:</span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsSummaryCollapsed((v) => !v)}
                  className="h-6 px-2 text-[10.5px] font-bold text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  {isSummaryCollapsed ? (
                    <span className="inline-flex items-center gap-1">
                      <ChevronDown className="h-3 w-3" />
                      <span>عرض تفاصيل الملخص</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <ChevronUp className="h-3 w-3" />
                      <span>طي</span>
                    </span>
                  )}
                </Button>
              </div>

              {/* Currency Selector Pills */}
              <div className="flex items-center gap-1">
                {Object.keys(financialProfile?.summariesByCurrency || { SDG: {} }).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => handleCurrencyChange(cur)}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-black transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      selectedCurrency === cur
                        ? "bg-primary text-white shadow-2xs"
                        : "bg-secondary/70 text-muted-foreground hover:text-foreground border border-border/50"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            {/* If Collapsed: compact 1-line strip for maximum invoice vertical space */}
            {isSummaryCollapsed ? (
              <div className="rounded-xl border border-border/70 bg-card px-3 py-2 flex items-center justify-between gap-2 text-xs font-mono flex-wrap">
                <div className="flex items-center gap-3">
                  <span>
                    <span className="text-muted-foreground font-sans text-[10px]">المفوتر: </span>
                    <strong className="text-foreground font-black">{formatNumber(currentSummary.totalInvoiced)} {selectedCurrency}</strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground font-sans text-[10px]">المحصل: </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-black">{formatNumber(currentSummary.totalPaid)} {selectedCurrency}</strong>
                  </span>
                  <span>
                    <span className="text-muted-foreground font-sans text-[10px]">المتبقي: </span>
                    <strong className={currentSummary.outstanding > 0 ? "text-rose-600 dark:text-rose-400 font-black" : "text-foreground font-black"}>
                      {formatNumber(currentSummary.outstanding)} {selectedCurrency}
                    </strong>
                  </span>
                </div>
                <span className="text-[10.5px] font-sans font-bold text-muted-foreground">
                  ({currentSummary.totalInvoicesCount} فاتورة)
                </span>
              </div>
            ) : (
              /* KPI Cards Grid */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground block">إجمالي الفواتير الصادرة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                    {formatNumber(currentSummary.totalInvoiced)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    {currentSummary.totalInvoicesCount} فاتورة
                  </span>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">إجمالي المبالغ المسددة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatNumber(currentSummary.totalPaid)}{" "}
                    <span className="text-[10px] font-normal">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block font-medium">
                    {currentSummary.paidInvoicesCount} مسددة بالكامل
                  </span>
                </div>

                <div className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">المبالغ المستحقة (ديون)</span>
                  <p className="font-mono text-base sm:text-lg font-black text-rose-600 dark:text-rose-400 tabular-nums">
                    {formatNumber(currentSummary.outstanding)}{" "}
                    <span className="text-[10px] font-normal">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80 block font-medium">
                    {currentSummary.unpaidInvoicesCount} غير مسددة | {currentSummary.overdueInvoicesCount} متأخرة
                  </span>
                </div>

                <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-1">
                  <span className="text-[10px] font-bold text-muted-foreground block">أرصدة مقدمة / دفعات دائنة</span>
                  <p className="font-mono text-base sm:text-lg font-black text-foreground tabular-nums">
                    {formatNumber(currentSummary.advanceCredit)}{" "}
                    <span className="text-[10px] font-normal text-muted-foreground">{selectedCurrency}</span>
                  </p>
                  <span className="text-[10px] text-muted-foreground block font-medium">
                    رصيد لصالح العميل
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Direct Actions Bar inside Profile */}
          <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-border/60 bg-muted/15 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  playTapSound();
                  if (onCreateInvoice) {
                    onCreateInvoice(customer);
                    onOpenChange(false);
                  } else {
                    toast.info("يرجى فتح صفحة الفواتير لإصدار فاتورة");
                  }
                }}
                className="h-9 px-4 rounded-xl text-xs font-black gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.97] touch-manipulation cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>إصدار فاتورة جديدة</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  setTargetReceiptInvoiceId(null);
                  setReceiptDialogOpen(true);
                }}
                className="h-9 px-4 rounded-xl text-xs font-black gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-[0.97] touch-manipulation cursor-pointer"
              >
                <ArrowDownLeft className="h-4 w-4" />
                <span>تحصيل دفعة (سند قبض)</span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExportingStatement || !statement}
                onClick={handlePrintStatement}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 text-foreground hover:bg-secondary active:scale-[0.97] touch-manipulation cursor-pointer"
                title="طباعة كشف الحساب المالي"
              >
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">طباعة الكشف</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExportingStatement || !statement}
                onClick={handleShareStatement}
                className="h-9 px-3 rounded-xl text-xs font-bold gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 active:scale-[0.97] touch-manipulation cursor-pointer"
                title="مشاركة كشف الحساب عبر واتساب"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">مشاركة واتساب</span>
              </Button>
            </div>
          </div>

          {/* 4. Tab Navigation */}
          <div className="px-4 sm:px-5 border-b border-border/60 bg-card flex items-center gap-1.5 text-xs font-black shrink-0 overflow-x-auto scrollbar-none py-2">
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
                className={`px-3.5 py-1.5 rounded-full transition-all cursor-pointer touch-manipulation active:scale-95 shrink-0 ${
                  activeTab === tab.key
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 5. Tab Content Area (Scrollable) */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-5 overscroll-contain relative touch-pan-y"
          >
            {/* ── TAB 1: INVOICES ── */}
            {activeTab === "invoices" && (
              <div className="space-y-3">
                {/* Search, Sort, View Mode & Page Size Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/80 p-2.5 rounded-2xl border border-border/70">
                  {/* Search box */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="بحث برقم الفاتورة، التاريخ، المشروع، المبلغ..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="h-8.5 pr-8 pl-3 text-xs bg-secondary/50 rounded-xl border-border/70 placeholder:text-muted-foreground/70"
                    />
                    {invoiceSearch && (
                      <button
                        type="button"
                        onClick={() => setInvoiceSearch("")}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Controls cluster: Sort, Size, View Mode */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-between sm:justify-end">
                    {/* Sort selector */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-xl border border-border/60">
                      <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
                      <select
                        aria-label="ترتيب الفواتير"
                        value={invoiceSort}
                        onChange={(e) => setInvoiceSort(e.target.value as any)}
                        className="bg-transparent text-[11px] font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value="date-desc">الأحدث تاريخاً</option>
                        <option value="date-asc">الأقدم تاريخاً</option>
                        <option value="debt-desc">الأعلى متبقي (مديونية)</option>
                        <option value="amount-desc">الأعلى قيمة</option>
                        <option value="amount-asc">الأقل قيمة</option>
                      </select>
                    </div>

                    {/* Page Size selector */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-xl border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold">عرض:</span>
                      <select
                        aria-label="عدد الفواتير لكل صفحة"
                        value={invoicePageSize}
                        onChange={(e) => setInvoicePageSize(Number(e.target.value))}
                        className="bg-transparent text-[11px] font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-secondary/70 p-0.5 rounded-xl border border-border/60">
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
                        title="عرض البطاقات التفصيلية"
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </button>
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
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status sub-filter pills with live counts */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
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
                      className={`px-3 py-1 rounded-full font-bold shrink-0 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                        invoiceStatusFilter === sub.key
                          ? "bg-primary text-white shadow-2xs"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Results count & page summary metrics bar */}
                {processedInvoices.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between text-[11px] px-1 text-muted-foreground gap-2">
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

                    <div className="flex items-center gap-3 font-mono text-[10.5px]">
                      <span>
                        إجمالي الصفحة:{" "}
                        <strong className="text-foreground">{formatNumber(pageFinancials.pageTotal)}</strong>
                      </span>
                      <span>
                        المتبقي:{" "}
                        <strong className={pageFinancials.pageRemaining > 0 ? "text-rose-600 font-bold" : "text-emerald-600 font-bold"}>
                          {formatNumber(pageFinancials.pageRemaining)}
                        </strong>{" "}
                        {selectedCurrency}
                      </span>
                    </div>
                  </div>
                )}

                {/* List / Table Content */}
                {processedInvoices.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl bg-card/40">
                    لا توجد فواتير مطابقة لهذا التصنيف أو نتيجة البحث
                  </div>
                ) : invoiceViewMode === "table" ? (
                  /* High Density Table View with Sticky Header */
                  <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-2xs">
                    <div className="overflow-x-auto max-h-[520px] overscroll-contain">
                      <table className="w-full text-right text-xs">
                        <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground text-[11px] border-b border-border/70 z-10 shadow-xs">
                          <tr>
                            <th className="py-2.5 px-3 font-black">رقم الفاتورة</th>
                            <th className="py-2.5 px-3 font-black">التاريخ</th>
                            <th className="py-2.5 px-3 font-black">المشروع</th>
                            <th className="py-2.5 px-3 font-black text-left" dir="ltr">الإجمالي</th>
                            <th className="py-2.5 px-3 font-black text-left" dir="ltr">المتبقي</th>
                            <th className="py-2.5 px-3 font-black text-center">الحالة</th>
                            <th className="py-2.5 px-3 font-black text-center">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                          {paginatedInvoices.map((inv) => (
                            <tr key={inv.id} className="hover:bg-secondary/40 transition-colors">
                              <td className="py-2.5 px-3 font-black text-primary" dir="ltr">
                                {inv.reference || `#${inv.serial}`}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground font-sans">
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
                              <td className="py-2.5 px-3 text-muted-foreground font-sans">
                                {inv.projectReference || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-left font-black tabular-nums text-foreground" dir="ltr">
                                {formatNumber(inv.totalAmount)} {inv.currency}
                              </td>
                              <td className="py-2.5 px-3 text-left font-black tabular-nums" dir="ltr">
                                {inv.remainingAmount > 0 ? (
                                  <span className="text-rose-600 dark:text-rose-400">
                                    {formatNumber(inv.remainingAmount)} {inv.currency}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-sans font-bold">مسددة</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <span
                                  className={`inline-block rounded-full px-2 py-0.5 text-[9.5px] font-sans font-black border ${inv.statusBadgeColor}`}
                                >
                                  {inv.statusLabel}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-center font-sans">
                                <div className="flex items-center justify-center gap-1">
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
                                      className="h-7 px-2 rounded-lg text-[10.5px] font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 cursor-pointer"
                                      title="تحصيل دفعة"
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
                                    title="طباعة"
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleInvoiceShare(inv.id)}
                                    className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                    title="مشاركة واتساب"
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
                  /* Cards View */
                  <div className="space-y-2">
                    {paginatedInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="rounded-2xl border border-border/70 bg-card hover:bg-secondary/30 transition-all p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-primary" dir="ltr">
                              {inv.reference || `#${inv.serial}`}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[9.5px] font-black border ${inv.statusBadgeColor}`}
                            >
                              {inv.statusLabel}
                            </span>
                            {inv.projectReference && (
                              <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded-md text-muted-foreground border border-border/60">
                                {inv.projectReference}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>التاريخ: {inv.date}</span>
                            {inv.dueDate && (
                              <span className={inv.status === "overdue" ? "text-rose-600 font-bold" : ""}>
                                الاستحقاق: {inv.dueDate}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Amounts & Row Actions */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <div className="text-right sm:text-left">
                            <div className="font-mono text-sm font-black text-foreground tabular-nums">
                              {formatNumber(inv.totalAmount)}{" "}
                              <span className="text-[10px] font-normal text-muted-foreground">{inv.currency}</span>
                            </div>
                            <div className="text-[10.5px]">
                              {inv.remainingAmount > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold font-mono tabular-nums">
                                  متبقي: {formatNumber(inv.remainingAmount)} {inv.currency}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold">مسددة</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
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
                                className="h-8 px-2.5 rounded-xl text-xs font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 cursor-pointer active:scale-95"
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
                              title="مشاركة الفاتورة واتساب"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Bottom Pagination Bar for Invoices */}
                {totalInvoicePages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/60 text-xs">
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <div className="px-3 py-1 bg-secondary/60 rounded-lg font-mono font-bold text-foreground text-[11px] border border-border/50">
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                        title="الصفحة الأخيرة"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
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
                        className="h-8 w-16 text-center text-xs font-mono font-bold bg-secondary/50 rounded-lg border-border/70 p-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: STATEMENT (كشف الحساب المحاسبي) ── */}
            {activeTab === "statement" && (
              <div className="space-y-3">
                {/* Statement Search & Type Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/80 p-2.5 rounded-2xl border border-border/70">
                  {/* Search box */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="بحث في الحركات: البيان، المرجع، المبلغ..."
                      value={statementSearch}
                      onChange={(e) => setStatementSearch(e.target.value)}
                      className="h-8.5 pr-8 pl-3 text-xs bg-secondary/50 rounded-xl border-border/70 placeholder:text-muted-foreground/70"
                    />
                    {statementSearch && (
                      <button
                        type="button"
                        onClick={() => setStatementSearch("")}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Filter & Page Size */}
                  <div className="flex items-center gap-1.5 shrink-0 justify-between sm:justify-end">
                    {/* Type Filter Buttons */}
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
                          className={`px-2.5 py-1 text-[10.5px] rounded-lg font-bold transition-all cursor-pointer ${
                            statementTypeFilter === item.key
                              ? "bg-card text-foreground shadow-2xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Page Size */}
                    <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-xl border border-border/60">
                      <span className="text-[10px] text-muted-foreground font-bold">عرض:</span>
                      <select
                        aria-label="عدد أسطر كشف الحساب لكل صفحة"
                        value={statementPageSize}
                        onChange={(e) => setStatementPageSize(Number(e.target.value))}
                        className="bg-transparent text-[11px] font-bold text-foreground border-none outline-hidden cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Statement Table with Sticky Header */}
                <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-2xs">
                  <div className="overflow-x-auto max-h-[520px] overscroll-contain">
                    <table className="w-full text-right text-xs">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground text-[11px] border-b border-border/70 z-10 shadow-xs">
                        <tr>
                          <th className="py-2.5 px-3.5 font-black">التاريخ</th>
                          <th className="py-2.5 px-3.5 font-black">البيان والحركة</th>
                          <th className="py-2.5 px-3.5 font-black text-center">المرجع</th>
                          <th className="py-2.5 px-3.5 font-black text-left" dir="ltr">مدين (+)</th>
                          <th className="py-2.5 px-3.5 font-black text-left" dir="ltr">دائن (-)</th>
                          <th className="py-2.5 px-3.5 font-black text-left" dir="ltr">الرصيد الجاري</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                        {paginatedStatementLines.length > 0 ? (
                          paginatedStatementLines.map((line, idx) => (
                            <tr key={line.id || idx} className="hover:bg-muted/20 transition-colors">
                              <td className="py-2.5 px-3.5 text-muted-foreground font-sans">{line.date}</td>
                              <td className="py-2.5 px-3.5 font-sans font-bold text-foreground">
                                {line.label}
                                {line.notes && (
                                  <span className="block text-[10px] text-muted-foreground font-normal">
                                    {line.notes}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-center text-primary font-bold" dir="ltr">
                                {line.reference || "—"}
                              </td>
                              <td className="py-2.5 px-3.5 text-left text-rose-600 font-bold tabular-nums" dir="ltr">
                                {line.debit > 0 ? formatNumber(line.debit) : "—"}
                              </td>
                              <td className="py-2.5 px-3.5 text-left text-emerald-600 font-bold tabular-nums" dir="ltr">
                                {line.credit > 0 ? formatNumber(line.credit) : "—"}
                              </td>
                              <td
                                className={`py-2.5 px-3.5 text-left font-black tabular-nums ${
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
                            <td colSpan={6} className="py-12 text-center text-muted-foreground font-sans font-bold">
                              لا توجد حركات مالية مطابقة للبحث أو التصفية
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Statement Pagination */}
                {totalStatementPages > 1 && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                        title="الصفحة السابقة"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>

                      <div className="px-3 py-1 bg-secondary/60 rounded-lg font-mono font-bold text-foreground text-[11px] border border-border/50">
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
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
                        className="h-8 w-8 p-0 rounded-lg cursor-pointer"
                        title="الصفحة الأخيرة"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="text-muted-foreground text-[11px]">
                      إجمالي الحركات: <span className="font-bold text-foreground">{processedStatementLines.length}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 3: PROJECTS (المشروعات) ── */}
            {activeTab === "projects" && (
              <div className="space-y-2">
                {projects.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl">
                    لا توجد مشروعات مرتبطة بهذا العميل حالياً
                  </div>
                ) : (
                  projects.map((prj) => (
                    <div
                      key={prj.id}
                      className="rounded-2xl border border-border/70 bg-card p-3.5 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-primary" dir="ltr">
                            {prj.reference}
                          </span>
                          <span className="font-black text-xs text-foreground">{prj.title}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {prj.deliveryDate ? `موعد التسليم: ${prj.deliveryDate}` : `الإنشاء: ${prj.createdAt.slice(0, 10)}`}
                        </div>
                      </div>

                      <div className="text-left font-mono text-xs">
                        <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-secondary border border-border/80 text-foreground">
                          {prj.executionStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── TAB 4: CUSTOMER INFO (بيانات العميل) ── */}
            {activeTab === "info" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold">معرف العميل في النظام (ID)</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">{customer.id}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold">تاريخ التسجيل</span>
                      <p className="font-mono font-bold text-foreground mt-0.5">
                        {customer.createdAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>

                  {customer.openingBalance ? (
                    <div className="border-t border-border/50 pt-3">
                      <span className="text-[10px] text-muted-foreground font-bold">حركة الرصيد الافتتاحي</span>
                      <p className="font-bold text-foreground mt-0.5">
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
                      <span className="text-[10px] text-muted-foreground font-bold">ملاحظات وشروط خاصة</span>
                      <p className="text-foreground mt-0.5">{customer.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Scroll to Top Button */}
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollToTop}
              className="absolute bottom-5 left-5 z-40 p-2.5 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-all cursor-pointer touch-manipulation active:scale-95 animate-in fade-in flex items-center justify-center border border-white/20"
              title="العودة لأعلى القائمة"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
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

      {/* Receipt / Collection Dialog pre-linked to this customer */}
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
    </>
  );
}
