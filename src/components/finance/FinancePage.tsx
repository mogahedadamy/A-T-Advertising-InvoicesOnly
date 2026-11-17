import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Loader2,
  Plus,
  Receipt,
  RefreshCw,
  RotateCcw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { createAccount, getAccountBalances, getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import {
  getCashSummary,
  getCompanyProfitability,
  getCustomerReceipts,
  getMoneyMovements,
  getOpenSalesInvoices,
  getPayablesSummary,
  getReceivablesSummary,
  getSupplierPayments,
  type CashSummary,
  type CustomerReceiptRow,
  type MoneyMovement,
  type OpenSalesInvoiceRow,
  type PayablesSummary,
  type ReceivablesSummary,
  type SupplierPaymentRow,
} from "@/lib/repositories/LedgerRepository";
import { cancelPayment } from "@/lib/repositories/PaymentRepository";
import {
  ACCOUNT_KIND_LABELS,
  LEDGER_KIND_LABELS,
  PAYMENT_METHOD_LABELS,
  type AccountBalanceReport,
  type AccountKind,
  type CompanyProfitability,
  type PaymentMethod,
} from "@/lib/domain/finance";
import { notifyFinanceUpdated, refreshSettlements } from "@/lib/financeStore";
import { formatNumber } from "@/lib/printCalculator";
import { ReceiptDialog } from "./ReceiptDialog";
import { SupplierPaymentDialog } from "./SupplierPaymentDialog";
import { TransferDialog } from "./TransferDialog";
import { ExpenseDialog } from "./ExpenseDialog";

type FinanceTab = "overview" | "accounts" | "receipts" | "payments" | "ledger";

interface CancelTarget {
  kind: "receipt" | "supplier_payment";
  id: string;
  reference: string;
  partyName: string;
  amount: number;
}

/**
 * صفحة المالية (PRD §8، §10، §11): النقد الفعلي، الذمم، الربحية، والحركات.
 * الأرقام الثلاثة (الربحية/التحصيل/السيولة) معروضة منفصلة دائماً ولا تُدمج.
 */
export function FinancePage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FinanceTab>("overview");
  const [accounts, setAccounts] = useState<AccountBalanceReport[]>([]);
  const [cash, setCash] = useState<CashSummary | null>(null);
  const [receivables, setReceivables] = useState<ReceivablesSummary | null>(null);
  const [payables, setPayables] = useState<PayablesSummary | null>(null);
  const [profitability, setProfitability] = useState<CompanyProfitability | null>(null);
  const [movements, setMovements] = useState<MoneyMovement[]>([]);
  const [receipts, setReceipts] = useState<CustomerReceiptRow[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPaymentRow[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenSalesInvoiceRow[]>([]);

  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptInvoiceId, setReceiptInvoiceId] = useState<string | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountKind, setNewAccountKind] = useState<AccountKind>("bank");
  const [creatingAccount, setCreatingAccount] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let [
        accountReports,
        cashSummary,
        recv,
        pay,
        profit,
        moves,
        receiptRows,
        supplierRows,
        openSales,
      ] = await Promise.all([
        getAccountBalances(),
        getCashSummary(),
        getReceivablesSummary(),
        getPayablesSummary(),
        getCompanyProfitability(),
        getMoneyMovements(60),
        getCustomerReceipts(60),
        getSupplierPayments(60),
        getOpenSalesInvoices(100),
      ]);
      if (accountReports.length === 0) {
        await getDefaultAccountId();
        accountReports = await getAccountBalances();
      }
      setAccounts(accountReports);
      setCash(cashSummary);
      setReceivables(recv);
      setPayables(pay);
      setProfitability(profit);
      setMovements(moves);
      setReceipts(receiptRows);
      setSupplierPayments(supplierRows);
      setOpenInvoices(openSales);
    } catch (err) {
      console.error("[FinancePage] load failed:", err);
      toast({ title: "تعذّر تحميل البيانات المالية", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
    void refreshSettlements();
    const onRefresh = () => {
      void load();
    };
    window.addEventListener("native-storage-ready", onRefresh);
    window.addEventListener("finance-changed", onRefresh);
    return () => {
      window.removeEventListener("native-storage-ready", onRefresh);
      window.removeEventListener("finance-changed", onRefresh);
    };
  }, [load]);

  const openReceiptDialog = (invoiceId: string | null = null) => {
    setReceiptInvoiceId(invoiceId);
    setReceiptOpen(true);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      toast({ title: "اسم الحساب مطلوب", variant: "destructive" });
      return;
    }
    setCreatingAccount(true);
    try {
      await createAccount({ name: newAccountName, kind: newAccountKind });
      setNewAccountName("");
      toast({ title: "تم إنشاء الحساب المالي" });
      await notifyFinanceUpdated();
      await load();
    } catch (err) {
      toast({
        title: "تعذّر إنشاء الحساب",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreatingAccount(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelPayment(cancelTarget.kind, cancelTarget.id, cancelReason.trim() || null);
      toast({
        title: `تم إلغاء ${cancelTarget.reference || "السند"} وعكس أثره المالي`,
      });
      setCancelTarget(null);
      setCancelReason("");
      await notifyFinanceUpdated();
      await load();
    } catch (err) {
      toast({
        title: "تعذّر إلغاء السند",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <PageShell>
      <main
        className="w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-36 md:pb-16"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3.5 w-full">
          {/* 1. ترويسة الصفحة التنفيذية */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div className="flex items-start gap-2.5">
              <Link
                to="/"
                aria-label="رجوع"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-foreground transition-all hover:border-primary/40 hover:text-primary active:scale-95 touch-manipulation"
              >
                <ArrowRight className="h-4 w-4" />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20 shrink-0">
                    <Wallet className="h-4 w-4" />
                  </span>
                  <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                    الإدارة المالية والخزينة
                  </h1>
                  <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                    {accounts.length} حساب
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                  النقد الفعلي المتاح، ذمم العملاء والموردين، الربحية التشغيلية وسجل الحركات المالية
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              aria-label="تحديث"
              className="h-9 px-3 rounded-xl gap-1.5 text-xs font-bold text-muted-foreground self-end sm:self-center"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span>تحديث</span>
            </Button>
          </div>

          {/* 2. ثلاث مقاييس منفصلة كما تفرضه المواصفات — لا دمج */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <Metric
              label="النقد الفعلي المتاح"
              value={formatNumber(cash?.liquidity ?? 0)}
              tone="primary"
              icon={<Wallet className="h-3.5 w-3.5" />}
              className="col-span-2 sm:col-span-1"
              onClick={() => setActiveTab("accounts")}
            />
            <Metric
              label="ذمم العملاء (لك)"
              value={formatNumber(receivables?.outstanding ?? 0)}
              tone="warn"
              onClick={() => setActiveTab("receipts")}
            />
            <Metric
              label="مستحق للموردين (عليك)"
              value={formatNumber(payables?.outstanding ?? 0)}
              tone="danger"
              onClick={() => setActiveTab("payments")}
            />
          </div>

          {/* 3. أزرار العمليات السريعة */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              type="button"
              onClick={() => openReceiptDialog(null)}
              className="h-10 rounded-xl gap-1.5 text-xs font-black bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/20"
            >
              <Receipt className="h-4 w-4" />
              <span>تحصيل دفعة من عميل</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSupplierOpen(true)}
              className="h-10 rounded-xl gap-1.5 text-xs font-black border-border/70 bg-card hover:border-primary/40"
            >
              <Plus className="h-4 w-4" />
              <span>سداد دفعة لمورد</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(true)}
              className="h-10 rounded-xl gap-1.5 text-xs font-black border-border/70 bg-card hover:border-primary/40"
            >
              <ArrowLeftRight className="h-4 w-4" />
              <span>تحويل بين الحسابات</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpenseOpen(true)}
              className="h-10 rounded-xl gap-1.5 text-xs font-black border-border/70 bg-card hover:border-primary/40"
            >
              <Plus className="h-4 w-4" />
              <span>تسجيل مصروف</span>
            </Button>
          </div>

          {/* 4. التبويبات */}
          <div className="rounded-2xl border border-border/70 bg-card/90 backdrop-blur-md p-3 sm:p-4 shadow-2xs">
            {loading && accounts.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FinanceTab)} dir="rtl" className="space-y-3">
                <TabsList className="w-full justify-start gap-1 overflow-x-auto no-scrollbar rounded-xl bg-muted/60 p-1 h-auto">
                  {[
                    { value: "overview", label: "نظرة عامة" },
                    { value: "accounts", label: `الحسابات (${accounts.length})` },
                    { value: "receipts", label: `التحصيلات (${receipts.length})` },
                    { value: "payments", label: `المدفوعات (${supplierPayments.length})` },
                    { value: "ledger", label: "سجل الحركات" },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-3 py-2 text-[11px] sm:text-xs font-black data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-xs whitespace-nowrap"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="overview" className="m-0 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card title="الربحية (مسجّلة)" icon={<TrendingUp className="h-3.5 w-3.5 text-primary" />}>
                    <Row label="الإيراد المُفوتر" value={formatNumber(profitability?.revenue ?? 0)} />
                    <Row label="تكاليف مباشرة" value={formatNumber(profitability?.directCosts ?? 0)} />
                    <Row label="هامش إجمالي" value={formatNumber(profitability?.grossMargin ?? 0)} strong />
                    <Row label="مصروفات تشغيلية" value={formatNumber(profitability?.operatingExpenses ?? 0)} />
                    <Row label="صافي الربح" value={formatNumber(profitability?.netProfit ?? 0)} strong />
                    <p className="pt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                      الإيراد هو قيمة الفواتير الصادرة، وليس نقداً محصّلاً. النقد الفعلي المتاح أعلاه هو السيولة الجاهزة.
                    </p>
                  </Card>

                  <Card title="التحصيل والالتزامات" icon={<Wallet className="h-3.5 w-3.5 text-primary" />}>
                    <Row label="مُفوتر للعملاء" value={formatNumber(receivables?.invoiced ?? 0)} />
                    <Row label="محصّل فعلاً" value={formatNumber(receivables?.collected ?? 0)} />
                    <Row label="متبقي على العملاء" value={formatNumber(receivables?.outstanding ?? 0)} strong />
                    <Row label="فواتير متأخرة" value={String(receivables?.overdueCount ?? 0)} />
                    <Row label="مشتريات الموردين" value={formatNumber(payables?.purchased ?? 0)} />
                    <Row label="مدفوع للموردين" value={formatNumber(payables?.paid ?? 0)} />
                    <Row label="مستحق للموردين" value={formatNumber(payables?.outstanding ?? 0)} strong />
                    <div className="pt-2.5 flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => openReceiptDialog(null)}
                        className="flex-1 h-8 rounded-xl text-[11px] font-black"
                      >
                        تحصيل من عميل
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSupplierOpen(true)}
                        className="flex-1 h-8 rounded-xl text-[11px] font-black"
                      >
                        سداد لمورد
                      </Button>
                    </div>
                  </Card>

                  <div className="md:col-span-2 surface-panel space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="surface-panel-title">
                        <Receipt className="h-3.5 w-3.5 text-primary" />
                        فواتير المبيعات بانتظار التحصيل ({openInvoices.length})
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openReceiptDialog(null)}
                        className="h-7 rounded-lg text-[10.5px] font-black gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        تحصيل دفعة جديدة
                      </Button>
                    </div>
                    {openInvoices.length === 0 ? (
                      <p className="text-xs font-bold text-muted-foreground py-2">
                        لا توجد فواتير مبيعات مفتوحة حالياً — يمكنك تحصيل دفعة مقدّمة من أي عميل.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card overflow-hidden">
                        {openInvoices.slice(0, 12).map((inv) => (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2.5 p-3 text-right hover:bg-muted/20 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-black text-foreground truncate">
                                <span className="font-mono text-primary" dir="ltr">
                                  {inv.reference || "—"}
                                </span>
                                <span className="mx-1.5 text-muted-foreground">·</span>
                                <span>{inv.customerName || "عميل غير محدد"}</span>
                              </p>
                              <p className="text-[10.5px] text-muted-foreground mt-0.5">
                                {inv.date} · مدفوع {formatNumber(inv.settlement.paid)} من {formatNumber(inv.settlement.total)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="text-left">
                                <span className="font-mono text-xs font-black text-amber-600 dark:text-amber-400 tabular-nums">
                                  {formatNumber(inv.settlement.outstanding)}
                                </span>
                                <p className="text-[9.5px] text-muted-foreground">متبقي</p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => openReceiptDialog(inv.id)}
                                className="h-8 rounded-lg px-3 text-[11px] font-black gap-1"
                              >
                                <Receipt className="h-3 w-3" />
                                تحصيل
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="accounts" className="m-0 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {accounts.map((report) => (
                      <div
                        key={report.account.id}
                        className="rounded-2xl border border-border/70 bg-card p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-foreground truncate">{report.account.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {ACCOUNT_KIND_LABELS[report.account.kind]} · وارد {formatNumber(report.inflow)} · صادر{" "}
                            {formatNumber(report.outflow)}
                          </p>
                        </div>
                        <div className="text-left shrink-0">
                          <span
                            className={cn(
                              "font-mono text-sm font-black tabular-nums",
                              report.balance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                            )}
                          >
                            {formatNumber(report.balance)}
                          </span>
                          <p className="text-[10px] text-muted-foreground">ج.س</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="surface-panel space-y-2.5">
                    <p className="surface-panel-title">إضافة حساب مالي جديد</p>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_auto] gap-2">
                      <Input
                        value={newAccountName}
                        onChange={(e) => setNewAccountName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleCreateAccount();
                        }}
                        placeholder="اسم الحساب (مثال: خزنة المكتب / حساب بنك الخرطوم)"
                        className="h-10 rounded-xl text-xs font-bold bg-background text-right"
                      />
                      <Select
                        dir="rtl"
                        value={newAccountKind}
                        onValueChange={(v) => setNewAccountKind(v as AccountKind)}
                      >
                        <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="cash" className="text-xs font-bold">نقدي</SelectItem>
                          <SelectItem value="bank" className="text-xs font-bold">بنكي</SelectItem>
                          <SelectItem value="other" className="text-xs font-bold">أخرى</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        disabled={creatingAccount}
                        onClick={() => void handleCreateAccount()}
                        className="h-10 rounded-xl px-4 gap-1.5 text-xs font-black bg-primary hover:bg-primary/90 text-white"
                      >
                        {creatingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        <span>إضافة حساب</span>
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="receipts" className="m-0 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-foreground">سجل تحصيلات العملاء ({receipts.length})</p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openReceiptDialog(null)}
                      className="h-8 rounded-xl gap-1 text-[11px] font-black"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      تحصيل جديد
                    </Button>
                  </div>
                  <List
                    items={receipts}
                    emptyLabel="لا توجد تحصيلات مسجّلة بعد."
                    render={(row) => ({
                      key: row.id,
                      title: row.reference ?? "—",
                      titleIsCode: true,
                      subtitle: `${row.customerName} · ${row.paidAt} · ${
                        PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method
                      }${row.notes ? ` · ${row.notes}` : ""}`,
                      amount: row.amount,
                      actionLabel: "إلغاء",
                      onAction: () => {
                        setCancelReason("");
                        setCancelTarget({
                          kind: "receipt",
                          id: row.id,
                          reference: row.reference ?? row.id,
                          partyName: row.customerName,
                          amount: row.amount,
                        });
                      },
                    })}
                  />
                </TabsContent>

                <TabsContent value="payments" className="m-0 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-foreground">سجل مدفوعات الموردين ({supplierPayments.length})</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSupplierOpen(true)}
                      className="h-8 rounded-xl gap-1 text-[11px] font-black"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      دفعة لمورد
                    </Button>
                  </div>
                  <List
                    items={supplierPayments}
                    emptyLabel="لا توجد مدفوعات للموردين بعد."
                    render={(row) => ({
                      key: row.id,
                      title: row.reference ?? "—",
                      titleIsCode: true,
                      subtitle: `${row.supplierName} · ${row.paidAt} · ${
                        PAYMENT_METHOD_LABELS[row.method as PaymentMethod] ?? row.method
                      }${row.notes ? ` · ${row.notes}` : ""}`,
                      amount: -row.amount,
                      actionLabel: "إلغاء",
                      onAction: () => {
                        setCancelReason("");
                        setCancelTarget({
                          kind: "supplier_payment",
                          id: row.id,
                          reference: row.reference ?? row.id,
                          partyName: row.supplierName,
                          amount: row.amount,
                        });
                      },
                    })}
                  />
                </TabsContent>

                <TabsContent value="ledger" className="m-0">
                  <List
                    items={movements}
                    emptyLabel="لا توجد حركات مالية بعد."
                    render={(row) => ({
                      key: row.id,
                      title: `${LEDGER_KIND_LABELS[row.kind]} · ${row.accountName}`,
                      subtitle: `${row.occurredAt}${row.reference ? ` · ${row.reference}` : ""}${
                        row.reversed ? " · ملغاة" : ""
                      }`,
                      amount: row.kind === "receipt" || row.kind === "transfer_in" ? row.amount : -row.amount,
                      muted: row.reversed,
                    })}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </main>

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={(v) => {
          setReceiptOpen(v);
          if (!v) setReceiptInvoiceId(null);
        }}
        initialInvoiceId={receiptInvoiceId}
        onRecorded={() => void load()}
      />
      <SupplierPaymentDialog open={supplierOpen} onOpenChange={setSupplierOpen} onRecorded={() => void load()} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} onRecorded={() => void load()} />
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} onSaved={() => void load()} />

      <AlertDialog open={Boolean(cancelTarget)} onOpenChange={(v) => !v && !cancelling && setCancelTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right text-sm font-black">
              إلغاء السند المالي {cancelTarget?.reference}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right text-xs leading-relaxed">
              سيتم إنشاء قيد عكسي لإلغاء {cancelTarget?.kind === "receipt" ? "تحصيل العميل" : "دفعة المورد"} «
              {cancelTarget?.partyName}» بمبلغ {formatNumber(cancelTarget?.amount ?? 0)} ج.س وإعادة الرصيد المتبقي إلى
              الفواتير المرتبطة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-1">
            <label className="text-[11px] font-black text-foreground">سبب الإلغاء (اختياري)</label>
            <Input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="مثال: خطأ في المبلغ أو ارتداد التحويل البنكي"
              className="h-9 rounded-xl text-xs font-bold bg-background text-right"
            />
          </div>
          <AlertDialogFooter className="gap-2 sm:justify-start">
            <AlertDialogCancel disabled={cancelling} className="rounded-xl text-xs font-bold">
              تراجع
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelling}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmCancel();
              }}
              className="rounded-xl text-xs font-black bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling && <Loader2 className="h-3.5 w-3.5 animate-spin me-1" />}
              تأكيد الإلغاء والعكس
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
  className,
  onClick,
}: {
  label: string;
  value: string;
  tone: "primary" | "warn" | "danger";
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-3 sm:p-3.5 shadow-2xs space-y-1 text-right transition-all hover:shadow-sm active:scale-[0.99] cursor-pointer",
        tone === "primary" && "border-primary/30 bg-primary/[0.04] hover:border-primary/50",
        tone === "warn" && "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50",
        tone === "danger" && "border-rose-500/30 bg-rose-500/[0.04] hover:border-rose-500/50",
        className
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
        {icon}
        <span>{label}</span>
      </p>
      <p className="font-mono text-base sm:text-lg font-black tabular-nums text-foreground">
        {value} <span className="text-[10px] font-sans font-normal text-muted-foreground">ج.س</span>
      </p>
    </button>
  );
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="surface-panel space-y-2">
      <p className="surface-panel-title">
        {icon}
        {title}
      </p>
      <div className="row-sep">{children}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="data-row">
      <span className="data-row-label">{label}</span>
      <span className={cn("font-mono tabular-nums", strong ? "font-black text-foreground" : "font-bold text-foreground")}>
        {value}
      </span>
    </div>
  );
}

function List<T>({
  items,
  emptyLabel,
  render,
}: {
  items: T[];
  emptyLabel: string;
  render: (item: T) => {
    key?: string;
    title: string;
    titleIsCode?: boolean;
    subtitle: string;
    amount: number;
    muted?: boolean;
    actionLabel?: string;
    onAction?: () => void;
  };
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
        <p className="text-xs font-bold text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card divide-y divide-border/50">
      {items.map((item, index) => {
        const row = render(item);
        return (
          <div key={row.key ?? index} className="flex items-center justify-between gap-2.5 p-3.5 text-right">
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-xs font-bold",
                  row.titleIsCode && "font-mono",
                  row.muted ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {row.titleIsCode ? <bdi dir="ltr">{row.title}</bdi> : row.title}
              </p>
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">{row.subtitle}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="text-left">
                <span
                  className={cn(
                    "font-mono text-xs sm:text-sm font-black tabular-nums",
                    row.muted
                      ? "text-muted-foreground"
                      : row.amount < 0
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {row.amount < 0 ? "-" : "+"}
                  {formatNumber(Math.abs(row.amount))}
                </span>
                <p className="text-[9.5px] text-muted-foreground">ج.س</p>
              </div>
              {row.actionLabel && row.onAction && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={row.onAction}
                  className="h-8 rounded-lg px-2 text-[10.5px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>{row.actionLabel}</span>
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FinancePage;
