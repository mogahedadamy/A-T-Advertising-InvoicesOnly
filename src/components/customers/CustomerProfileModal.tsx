import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Phone,
  PhoneCall,
  MapPin,
  Building,
  Calendar,
  FileText,
  CreditCard,
  PlusCircle,
  Printer,
  Share2,
  FolderGit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  ChevronRight,
  ExternalLink,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

  // Invoice tab sub-filters
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<"all" | "paid" | "partial" | "unpaid" | "overdue">("all");

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
    if (customer?.id) {
      const stmt = await getCustomerStatement(customer.id, {}, cur);
      setStatement(stmt);
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchStatus = invoiceStatusFilter === "all" || inv.status === invoiceStatusFilter;
      const matchCur = !selectedCurrency || inv.currency === selectedCurrency;
      return matchStatus && matchCur;
    });
  }, [invoices, invoiceStatusFilter, selectedCurrency]);

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
          className="max-w-4xl w-[96vw] max-h-[92vh] flex flex-col p-3 sm:p-5 rounded-3xl bg-card border-border shadow-2xl overflow-hidden gap-3"
        >
          {/* 1. Header: Customer Identity & Actions */}
          <div className="border-b border-border/60 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Building className="h-5 w-5" />
                </span>
                <h2 className="text-base sm:text-lg font-black text-foreground">
                  {customer.name}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-black border ${cfg.bg} ${cfg.color} border-current/20 shrink-0`}
                >
                  {cfg.label}
                </span>

                {/* Status Badge */}
                {financialProfile && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-black border ${financialProfile.statusBg} ${financialProfile.statusColor} shrink-0 flex items-center gap-1`}
                  >
                    <span>{financialProfile.statusLabel}</span>
                  </span>
                )}

                {customer.isArchived && (
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-black bg-muted text-muted-foreground border border-border shrink-0">
                    مؤرشف
                  </span>
                )}
              </div>

              {/* Contact info row */}
              <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                {customer.phone ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${customer.phone}`}
                      className="inline-flex items-center gap-1 text-primary font-mono font-bold hover:underline"
                      dir="ltr"
                    >
                      <PhoneCall className="h-3 w-3" />
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
                    <MapPin className="h-3 w-3 text-muted-foreground/80" />
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
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                title="تعديل بيانات العميل"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تعديل</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleArchiveToggle}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                title={customer.isArchived ? "إلغاء الأرشفة" : "أرشفة العميل"}
              >
                {customer.isArchived ? <ArchiveRestore className="h-3.5 w-3.5 text-primary" /> : <Archive className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{customer.isArchived ? "استعادة" : "أرشفة"}</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDeleteAttempt}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                title="حذف العميل نهائياً"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* 2. Multi-Currency Financial KPI Bar & Currency Switcher */}
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3.5 w-3.5 text-primary" />
                <span>الملخص المالي حسب العملة:</span>
              </span>

              {/* Currency Selector Pills */}
              <div className="flex items-center gap-1">
                {Object.keys(financialProfile?.summariesByCurrency || { SDG: {} }).map((cur) => (
                  <button
                    key={cur}
                    type="button"
                    onClick={() => handleCurrencyChange(cur)}
                    className={`px-2.5 py-0.5 rounded-lg text-[10.5px] font-mono font-black transition cursor-pointer ${
                      selectedCurrency === cur
                        ? "bg-primary text-white shadow-2xs"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl border border-border/80 bg-secondary/30 p-2.5 space-y-0.5">
                <span className="text-[10px] font-bold text-muted-foreground block">إجمالي الفواتير والمطالبات</span>
                <p className="font-mono text-base font-black text-foreground tabular-nums">
                  {formatNumber(currentSummary.totalInvoiced)}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">{selectedCurrency}</span>
                </p>
                <span className="text-[9.5px] text-muted-foreground block">
                  {currentSummary.totalInvoicesCount} فاتورة صادرة
                </span>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 block">إجمالي المدفوع والمحصل</span>
                <p className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {formatNumber(currentSummary.totalPaid)}{" "}
                  <span className="text-[10px] font-normal">{selectedCurrency}</span>
                </p>
                <span className="text-[9.5px] text-emerald-700/80 dark:text-emerald-400/80 block">
                  {currentSummary.paidInvoicesCount} مسددة بالكامل
                </span>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 space-y-0.5">
                <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block">المبالغ المستحقة (دين)</span>
                <p className="font-mono text-base font-black text-rose-600 dark:text-rose-400 tabular-nums">
                  {formatNumber(currentSummary.outstanding)}{" "}
                  <span className="text-[10px] font-normal">{selectedCurrency}</span>
                </p>
                <span className="text-[9.5px] text-rose-700/80 dark:text-rose-400/80 block">
                  {currentSummary.unpaidInvoicesCount} غير مسددة | {currentSummary.overdueInvoicesCount} متأخرة
                </span>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-2.5 space-y-0.5">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 block">أرصدة مقدمة / دفعات دائنة</span>
                <p className="font-mono text-base font-black text-blue-600 dark:text-blue-400 tabular-nums">
                  {formatNumber(currentSummary.advanceCredit)}{" "}
                  <span className="text-[10px] font-normal">{selectedCurrency}</span>
                </p>
                <span className="text-[9.5px] text-blue-700/80 dark:text-blue-400/80 block">
                  رصيد لصالح العميل
                </span>
              </div>
            </div>
          </div>

          {/* 3. Direct Actions Bar inside Profile */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border/50 py-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
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
                className="h-8 px-3 rounded-xl text-xs font-black gap-1.5 bg-primary text-white shadow-2xs cursor-pointer active:scale-95"
              >
                <PlusCircle className="h-3.5 w-3.5" />
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
                className="h-8 px-3 rounded-xl text-xs font-black gap-1.5 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 cursor-pointer active:scale-95"
              >
                <ArrowDownLeft className="h-3.5 w-3.5" />
                <span>تحصيل دفعة (سند قبض)</span>
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExportingStatement || !statement}
                onClick={handlePrintStatement}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 cursor-pointer"
                title="طباعة كشف الحساب المالي"
              >
                <Printer className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">طباعة الكشف</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExportingStatement || !statement}
                onClick={handleShareStatement}
                className="h-8 px-2.5 rounded-xl text-xs font-bold gap-1 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                title="مشاركة كشف الحساب عبر واتساب"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">مشاركة واتساب</span>
              </Button>
            </div>
          </div>

          {/* 4. Tab Navigation */}
          <div className="flex items-center gap-1 border-b border-border/50 pb-1 text-xs font-black shrink-0">
            {[
              { key: "invoices", label: `الفواتير (${invoices.length})` },
              { key: "statement", label: `كشف الحساب (${statement?.lines.length || 0})` },
              { key: "projects", label: `المشاريع (${projects.length})` },
              { key: "info", label: "بيانات العميل" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  playTapSound();
                  setActiveTab(tab.key as any);
                }}
                className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
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
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            {/* ── TAB 1: INVOICES ── */}
            {activeTab === "invoices" && (
              <div className="space-y-2.5">
                {/* Status sub-filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                  {[
                    { key: "all", label: "كل الفواتير" },
                    { key: "unpaid", label: "غير مسددة" },
                    { key: "partial", label: "مسددة جزئياً" },
                    { key: "overdue", label: "متأخرة" },
                    { key: "paid", label: "مسددة بالكامل" },
                  ].map((sub) => (
                    <button
                      key={sub.key}
                      type="button"
                      onClick={() => setInvoiceStatusFilter(sub.key as any)}
                      className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                        invoiceStatusFilter === sub.key
                          ? "bg-secondary text-foreground border border-border"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {filteredInvoices.length === 0 ? (
                  <div className="py-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl">
                    لا توجد فواتير مطابقة لهذا التصنيف
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredInvoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="rounded-2xl border border-border/70 bg-secondary/20 hover:bg-secondary/40 transition p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-primary" dir="ltr">
                              {inv.reference || `#${inv.serial}`}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.2 text-[9.5px] font-black border ${inv.statusBadgeColor}`}
                            >
                              {inv.statusLabel}
                            </span>
                            {inv.projectReference && (
                              <span className="text-[10px] font-mono bg-secondary px-2 py-0.5 rounded-md text-muted-foreground">
                                {inv.projectReference}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
                            <div className="font-mono text-xs font-black text-foreground">
                              {formatNumber(inv.totalAmount)}{" "}
                              <span className="text-[10px] font-normal">{inv.currency}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {inv.remainingAmount > 0 ? (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  متبقي: {formatNumber(inv.remainingAmount)} {inv.currency}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold">مسددة</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
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
                                className="h-7 px-2 rounded-lg text-[10.5px] font-bold text-emerald-600 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15"
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
                              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                              title="طباعة الفاتورة"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleInvoiceShare(inv.id)}
                              className="h-7 w-7 p-0 rounded-lg text-emerald-600 hover:bg-emerald-500/10"
                              title="مشاركة الفاتورة واتساب"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 2: STATEMENT (كشف الحساب) ── */}
            {activeTab === "statement" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-border/70 overflow-hidden bg-card">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-secondary/60 text-muted-foreground text-[10.5px] border-b border-border/70">
                        <th className="py-2.5 px-3 font-black">التاريخ</th>
                        <th className="py-2.5 px-3 font-black">البيان والحركة</th>
                        <th className="py-2.5 px-3 font-black text-center">المرجع</th>
                        <th className="py-2.5 px-3 font-black text-left" dir="ltr">مدين (+)</th>
                        <th className="py-2.5 px-3 font-black text-left" dir="ltr">دائن (-)</th>
                        <th className="py-2.5 px-3 font-black text-left" dir="ltr">الرصيد الجاري</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                      {statement?.lines && statement.lines.length > 0 ? (
                        statement.lines.map((line, idx) => (
                          <tr key={line.id || idx} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 text-muted-foreground">{line.date}</td>
                            <td className="py-2.5 px-3 font-sans font-bold text-foreground">
                              {line.label}
                              {line.notes && (
                                <span className="block text-[9.5px] text-muted-foreground font-normal">
                                  {line.notes}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center text-primary" dir="ltr">
                              {line.reference || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-left text-rose-600 font-bold" dir="ltr">
                              {line.debit > 0 ? formatNumber(line.debit) : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-left text-emerald-600 font-bold" dir="ltr">
                              {line.credit > 0 ? formatNumber(line.credit) : "—"}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-left font-black ${
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
                          <td colSpan={6} className="py-10 text-center text-muted-foreground font-sans font-bold">
                            لا توجد حركات مالية مسجلة في كشف الحساب
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
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
                      className="rounded-2xl border border-border/70 bg-secondary/30 p-3 flex items-center justify-between gap-3 shadow-2xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-primary" dir="ltr">
                            {prj.reference}
                          </span>
                          <span className="font-black text-xs text-foreground">{prj.title}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {prj.deliveryDate ? `التسليم: ${prj.deliveryDate}` : `الإنشاء: ${prj.createdAt.slice(0, 10)}`}
                        </div>
                      </div>

                      <div className="text-left font-mono text-xs">
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-secondary border border-border text-foreground">
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
                <div className="rounded-2xl border border-border/70 bg-secondary/20 p-4 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold">معرف العميل (ID)</span>
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
                    <div className="border-t border-border/50 pt-2.5">
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
                    <div className="border-t border-border/50 pt-2.5">
                      <span className="text-[10px] text-muted-foreground font-bold">ملاحظات وشروط خاصة</span>
                      <p className="text-foreground mt-0.5">{customer.notes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
