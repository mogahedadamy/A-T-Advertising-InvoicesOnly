import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Receipt, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { addCustomer, useCustomers } from "@/lib/customersStore";
import { useProjects } from "@/lib/projectsStore";
import { getAllAccounts, getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import {
  getCustomerAccount,
  getOpenSalesInvoices,
  type CustomerAccount,
  type OpenSalesInvoiceRow,
} from "@/lib/repositories/LedgerRepository";
import { recordCustomerReceipt } from "@/lib/repositories/PaymentRepository";
import { notifyFinanceUpdated } from "@/lib/financeStore";
import { PAYMENT_METHOD_LABELS, type FinancialAccount, type PaymentMethod } from "@/lib/domain/finance";
import { formatNumber } from "@/lib/printCalculator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** فاتورة محددة مسبقاً (تسجيل دفعة من سياق الفاتورة — PRD §7.3) */
  initialInvoiceId?: string | null;
  /** عميل محدد مسبقاً عند الفتح من بطاقة عميل أو ذمم */
  initialCustomerId?: string | null;
  onRecorded?: () => void;
}

interface AllocationRow {
  invoiceId: string;
  amount: string;
}

function resolveCustomerIdForInvoice(
  invoice: OpenSalesInvoiceRow,
  customers: { id: string; name: string }[]
): string {
  if (invoice.customerId && customers.some((c) => c.id === invoice.customerId)) {
    return invoice.customerId;
  }
  const normalizedParty = invoice.customerName.trim().toLowerCase();
  if (!normalizedParty) return "";
  return customers.find((c) => c.name.trim().toLowerCase() === normalizedParty)?.id ?? "";
}

/**
 * تسجيل تحصيل من العميل مع تخصيص صريح للفواتير (PRD §6.2، §4.2).
 * المبلغ غير المخصَّص يبقى دفعة مقدّمة مشروعة، لا خطأ.
 */
export function ReceiptDialog({
  open,
  onOpenChange,
  initialInvoiceId,
  initialCustomerId,
  onRecorded,
}: Props) {
  const customers = useCustomers();
  const projects = useProjects();
  const customersRef = useRef(customers);
  customersRef.current = customers;

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [openInvoices, setOpenInvoices] = useState<OpenSalesInvoiceRow[]>([]);
  const [customerSummary, setCustomerSummary] = useState<CustomerAccount | null>(null);
  const [loadingInit, setLoadingInit] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [unmatchedInvoiceCustomer, setUnmatchedInvoiceCustomer] = useState<string | null>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [quickCustomerPhone, setQuickCustomerPhone] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // تحميل مرة واحدة عند فتح الحوار فقط (بدون اعتماد على openInvoices لمنع حلقة إعادة التصفير اللانهائية)
  useEffect(() => {
    if (!open) {
      setDuplicateWarning(null);
      setQuickAddOpen(false);
      return;
    }

    let cancelled = false;
    setLoadingInit(true);
    setNotes("");
    setMethod("cash");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setDuplicateWarning(null);
    setQuickAddOpen(false);
    setUnmatchedInvoiceCustomer(null);

    void (async () => {
      try {
        let [accountList, invoices] = await Promise.all([getAllAccounts(), getOpenSalesInvoices()]);
        if (accountList.length === 0) {
          await getDefaultAccountId();
          accountList = await getAllAccounts();
        }
        if (cancelled) return;

        setAccounts(accountList);
        setOpenInvoices(invoices);
        setAccountId((current) =>
          current && accountList.some((a) => a.id === current) ? current : accountList[0]?.id ?? ""
        );

        if (initialInvoiceId) {
          const invoice = invoices.find((inv) => inv.id === initialInvoiceId);
          const matchedCustomerId = invoice
            ? resolveCustomerIdForInvoice(invoice, customersRef.current)
            : initialCustomerId ?? "";
          setRows([{ invoiceId: initialInvoiceId, amount: invoice ? String(invoice.settlement.outstanding) : "" }]);
          setAmount(invoice ? String(invoice.settlement.outstanding) : "");
          setCustomerId(matchedCustomerId);
          setProjectId(invoice?.projectId ?? null);
          if (invoice && !matchedCustomerId && invoice.customerName.trim()) {
            setUnmatchedInvoiceCustomer(invoice.customerName.trim());
            setQuickCustomerName(invoice.customerName.trim());
          }
        } else {
          setCustomerId(initialCustomerId ?? "");
          setProjectId(null);
          setRows([]);
          setAmount("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[ReceiptDialog] init failed:", err);
          toast.error("تعذّر تحميل بيانات التحصيل.");
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialInvoiceId, initialCustomerId]);

  useEffect(() => {
    if (!open || !customerId) {
      setCustomerSummary(null);
      return;
    }
    let cancelled = false;
    void getCustomerAccount(customerId)
      .then((summary) => {
        if (!cancelled) setCustomerSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setCustomerSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, customerId]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId]
  );

  // فواتير العميل المفتوحة فقط — عزل محاسبي صارم يمنع ظهور أو سداد فواتير أي عميل آخر نهائياً
  const customerOpenInvoices = useMemo(() => {
    if (!customerId) return [];
    const targetName = selectedCustomer?.name.trim().toLowerCase() ?? "";
    return openInvoices.filter(
      (inv) =>
        inv.customerId === customerId ||
        (Boolean(targetName) && inv.customerName.trim().toLowerCase() === targetName)
    );
  }, [openInvoices, customerId, selectedCustomer]);

  const allocatedTotal = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0),
    [rows]
  );
  const paymentAmount = Number(amount) || 0;
  const remaining = Math.max(0, paymentAmount - allocatedTotal);

  // الفواتير المتبقية للعميل الحالي التي لم تدرج بعد في السند
  const unallocatedCustomerInvoices = useMemo(() => {
    const usedIds = new Set(rows.map((r) => r.invoiceId));
    return customerOpenInvoices.filter((inv) => !usedIds.has(inv.id));
  }, [customerOpenInvoices, rows]);

  const handleSelectCustomer = (nextId: string) => {
    setCustomerId(nextId);
    setDuplicateWarning(null);
    setUnmatchedInvoiceCustomer(null);
    // تفريغ أي فواتير محددة لا تخص العميل الجديد لمنع أي خطأ محاسبي
    if (!nextId) {
      setRows([]);
    } else {
      const nextCust = customers.find((c) => c.id === nextId);
      const nextName = nextCust?.name.trim().toLowerCase() ?? "";
      setRows((current) =>
        current.filter((row) => {
          const inv = openInvoices.find((i) => i.id === row.invoiceId);
          if (!inv) return false;
          return (
            inv.customerId === nextId ||
            (Boolean(nextName) && inv.customerName.trim().toLowerCase() === nextName)
          );
        })
      );
    }
  };

  const handleQuickAddCustomer = async () => {
    const trimmedName = quickCustomerName.trim();
    if (!trimmedName) {
      toast.error("أدخل اسم العميل أولاً");
      return;
    }
    setCreatingCustomer(true);
    try {
      const created = await addCustomer({
        name: trimmedName,
        phone: quickCustomerPhone.trim(),
        type: "individual",
        address: "",
        balance: 0,
      });
      setCustomerId(created.id);
      setQuickCustomerName("");
      setQuickCustomerPhone("");
      setQuickAddOpen(false);
      setUnmatchedInvoiceCustomer(null);
      toast.success(`تمت إضافة العميل «${created.name}» واختياره`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إضافة العميل.");
    } finally {
      setCreatingCustomer(false);
    }
  };

  // إضافة الفاتورة التالية غير المخصصة الخاصة بالعميل
  const addRow = () => {
    const candidate = unallocatedCustomerInvoices[0];
    if (!candidate) return;
    const suggested =
      paymentAmount > 0
        ? Math.min(Math.max(remaining, 0), candidate.settlement.outstanding)
        : candidate.settlement.outstanding;

    setRows((current) => [
      ...current,
      { invoiceId: candidate.id, amount: suggested > 0 ? String(suggested) : String(candidate.settlement.outstanding) },
    ]);

    if (!(paymentAmount > 0)) {
      setAmount(String(candidate.settlement.outstanding));
    }
    if (!projectId && candidate.projectId) {
      setProjectId(candidate.projectId);
    }
  };

  // اختيار فاتورة تابعة للعميل لإدراجها في السداد
  const handlePickInvoiceToPay = (invId: string) => {
    const candidate = customerOpenInvoices.find((inv) => inv.id === invId);
    if (!candidate) return;
    if (rows.some((r) => r.invoiceId === invId)) return;

    const suggested =
      paymentAmount > 0
        ? Math.min(Math.max(remaining, 0), candidate.settlement.outstanding)
        : candidate.settlement.outstanding;

    setRows((current) => [
      ...current,
      { invoiceId: candidate.id, amount: suggested > 0 ? String(suggested) : String(candidate.settlement.outstanding) },
    ]);

    if (!(paymentAmount > 0)) {
      setAmount(String(candidate.settlement.outstanding));
    }
    if (!projectId && candidate.projectId) {
      setProjectId(candidate.projectId);
    }
  };

  // سداد كامل قيمة فاتورة معينة
  const handlePayFullInvoice = (index: number) => {
    setRows((current) => {
      const row = current[index];
      if (!row) return current;
      const inv = customerOpenInvoices.find((i) => i.id === row.invoiceId);
      if (!inv) return current;
      const fullAmount = inv.settlement.outstanding;
      const updated = current.map((r, i) => (i === index ? { ...r, amount: String(fullAmount) } : r));
      const newTotal = updated.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      if (newTotal > (Number(amount) || 0)) {
        setAmount(String(newTotal));
      }
      return updated;
    });
  };

  const autoAllocateCustomerInvoices = () => {
    if (customerOpenInvoices.length === 0) return;

    if (paymentAmount > 0) {
      let budget = paymentAmount;
      const nextRows: AllocationRow[] = [];
      for (const inv of customerOpenInvoices) {
        if (budget <= 0) break;
        const share = Math.min(budget, inv.settlement.outstanding);
        if (share > 0) {
          nextRows.push({ invoiceId: inv.id, amount: String(share) });
          budget = Math.max(0, Number((budget - share).toFixed(2)));
        }
      }
      setRows(nextRows);
      return;
    }

    const totalOutstanding = customerOpenInvoices.reduce((sum, inv) => sum + inv.settlement.outstanding, 0);
    setRows(customerOpenInvoices.map((inv) => ({ invoiceId: inv.id, amount: String(inv.settlement.outstanding) })));
    setAmount(String(totalOutstanding));
    if (!projectId) {
      const firstProject = customerOpenInvoices.find((inv) => inv.projectId)?.projectId ?? null;
      if (firstProject) setProjectId(firstProject);
    }
  };

  const handleSave = async (confirmDuplicate = false) => {
    if (!customerId) {
      toast.error("يجب اختيار العميل");
      return;
    }
    if (!(paymentAmount > 0)) {
      toast.error("قيمة الدفعة يجب أن تكون أكبر من صفر");
      return;
    }
    if (!accountId) {
      toast.error("يجب تحديد الحساب المالي المستلم");
      return;
    }
    if (allocatedTotal > paymentAmount + 0.009) {
      toast.error("مجموع التخصيصات يتجاوز قيمة الدفعة");
      return;
    }

    setBusy(true);
    try {
      const { payment } = await recordCustomerReceipt({
        customerId,
        projectId,
        amount: paymentAmount,
        paidAt,
        method,
        accountId,
        notes: notes.trim() || undefined,
        allocations: rows
          .filter((row) => Number(row.amount) > 0)
          .map((row) => ({ invoiceId: row.invoiceId, amount: Number(row.amount) })),
        confirmDuplicate,
      });
      setDuplicateWarning(null);
      toast.success(`تم تسجيل التحصيل ${payment.reference} بمبلغ ${formatNumber(payment.amount)} ج.س`);
      await notifyFinanceUpdated();
      onRecorded?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذّر تسجيل الدفعة.";
      const code = (err as { code?: string })?.code;
      // التكرار المحتمل يُعرض كتأكيد صريح داخل النافذة (بديلاً عن window.confirm المعطل على WebView)
      if (!confirmDuplicate && (code === "DUPLICATE_PAYMENT" || /مطابقة/.test(message))) {
        setDuplicateWarning(message);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">تحصيل من عميل</DialogTitle>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-xs font-bold">جارٍ تجهيز بيانات التحصيل…</span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-black text-foreground">
                  العميل <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setQuickAddOpen((v) => !v)}
                  className="inline-flex items-center gap-1 text-[10.5px] font-black text-primary hover:underline touch-manipulation"
                >
                  <UserPlus className="h-3 w-3" />
                  <span>{quickAddOpen ? "إغلاق الإضافة السريعة" : "عميل جديد"}</span>
                </button>
              </div>

              <Select value={customerId || "__none__"} onValueChange={(v) => handleSelectCustomer(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">— اختر العميل —</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {unmatchedInvoiceCustomer && !customerId && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-[10.5px]">
                  <span className="font-bold text-amber-800 dark:text-amber-300">
                    الفاتورة باسم «{unmatchedInvoiceCustomer}» غير مسجل بقائمة العملاء.
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={creatingCustomer}
                    onClick={() => void handleQuickAddCustomer()}
                    className="h-7 shrink-0 rounded-lg text-[10px] font-black border-amber-500/40"
                  >
                    إضافته تلقائياً
                  </Button>
                </div>
              )}

              {quickAddOpen && (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-2.5 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input
                      value={quickCustomerName}
                      onChange={(e) => setQuickCustomerName(e.target.value)}
                      placeholder="اسم العميل *"
                      className="h-9 rounded-lg text-xs font-bold bg-background text-right"
                    />
                    <Input
                      value={quickCustomerPhone}
                      onChange={(e) => setQuickCustomerPhone(e.target.value)}
                      placeholder="رقم الهاتف (اختياري)"
                      inputMode="tel"
                      className="h-9 rounded-lg text-xs font-bold bg-background text-right"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={creatingCustomer || !quickCustomerName.trim()}
                    onClick={() => void handleQuickAddCustomer()}
                    className="w-full h-8 rounded-lg text-[11px] font-black"
                  >
                    {creatingCustomer && <Loader2 className="h-3 w-3 animate-spin me-1" />}
                    حفظ العميل واختياره للتحصيل
                  </Button>
                </div>
              )}

              {customerSummary && (
                <p className="text-[10px] font-bold text-muted-foreground">
                  مفوتر {formatNumber(customerSummary.invoicedTotal)} · محصّل{" "}
                  {formatNumber(customerSummary.collectedTotal)} · متبقي{" "}
                  <span className="text-foreground font-black">
                    {formatNumber(customerSummary.outstanding)} ج.س
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="المبلغ" required>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d.]/g, ""));
                    setDuplicateWarning(null);
                  }}
                  className="h-10 rounded-xl text-xs font-bold bg-background text-center tabular-nums"
                  placeholder="0"
                />
              </Field>
              <Field label="التاريخ" required>
                <Input
                  type="date"
                  value={paidAt}
                  onChange={(e) => {
                    setPaidAt(e.target.value);
                    setDuplicateWarning(null);
                  }}
                  className="h-10 rounded-xl text-xs font-mono font-bold bg-background text-right"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="طريقة الدفع">
                <Select
                  value={method}
                  onValueChange={(v) => {
                    setMethod(v as PaymentMethod);
                    setDuplicateWarning(null);
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {PAYMENT_METHOD_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="الحساب المستلم" required>
                <Select value={accountId || "__none__"} onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                    <SelectValue placeholder="اختر الحساب" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="__none__">— اختر الحساب —</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            {/* ربط وسداد فواتير العميل — عزل محاسبي كامل وواجهة بديهية */}
            <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    <Receipt className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-foreground">سداد فواتير العميل</h4>
                    <p className="text-[10px] text-muted-foreground">اختر الفاتورة التي يريد العميل سدادها من هذه الدفعة</p>
                  </div>
                </div>

                {customerOpenInvoices.length > 0 && (
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[10.5px] font-black">
                    {customerOpenInvoices.length} فواتير مستحقة
                  </span>
                )}
              </div>

              {!customerId ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3 text-center">
                  <p className="text-xs font-bold text-muted-foreground">
                    يرجى اختيار العميل أولاً لعرض قائمة فواتيره المستحقة واختيار ما يريد سداده.
                  </p>
                </div>
              ) : customerOpenInvoices.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">لا توجد فواتير مستحقة على هذا العميل</p>
                    <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                      لا توجد فواتير مبيعات معلقة لهذا العميل حالياً. سيتم قيد هذا المبلغ كدفعة مقدمة (رصيد دائن) في حسابه تلقائياً.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* شريط الإجراءات: إضافة فاتورة أو توزيع تلقائي */}
                  <div className="flex items-center justify-between gap-2">
                    {unallocatedCustomerInvoices.length > 0 ? (
                      <div className="flex-1">
                        <Select
                          value="__none__"
                          onValueChange={(val) => {
                            if (val && val !== "__none__") {
                              handlePickInvoiceToPay(val);
                            }
                          }}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs font-bold bg-background border-primary/40 hover:border-primary text-right">
                            <SelectValue placeholder="➕ اختر الفاتورة المراد سدادها..." />
                          </SelectTrigger>
                          <SelectContent dir="rtl" className="max-h-60">
                            <SelectItem value="__none__" disabled className="text-xs font-bold text-muted-foreground">
                              — اضغط لاختيار الفاتورة المراد سدادها —
                            </SelectItem>
                            {unallocatedCustomerInvoices.map((inv) => (
                              <SelectItem key={inv.id} value={inv.id} className="py-2">
                                <div className="flex items-center justify-between gap-3 text-xs w-full">
                                  <div className="flex items-center gap-1.5 font-mono font-black text-primary" dir="ltr">
                                    <span>{inv.reference}</span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{inv.date}</span>
                                  <span className="font-bold text-foreground">
                                    المتبقي: {formatNumber(inv.settlement.outstanding)} ج.س
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-[10.5px] font-bold text-muted-foreground">
                        تم إدراج جميع فواتير العميل المستحقة
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={addRow}
                        disabled={unallocatedCustomerInvoices.length === 0}
                        className="h-9 rounded-xl gap-1 text-[10.5px] font-bold border-border/80"
                      >
                        <Plus className="h-3 w-3" />
                        إضافة فاتورة
                      </Button>
                      {customerOpenInvoices.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={autoAllocateCustomerInvoices}
                          className="h-9 shrink-0 rounded-xl gap-1 text-[10.5px] font-bold border-border/80"
                        >
                          <SlidersHorizontal className="h-3 w-3 text-primary" />
                          توزيع تلقائي
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* قائمة الفواتير المختارة للسداد */}
                  {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 p-3 text-center">
                      <p className="text-[11px] font-bold text-muted-foreground">
                        لم يتم اختيار أي فاتورة للسداد حتى الآن. اختر الفاتورة من القائمة أعلاه أو سجّل المبلغ كدفعة مقدّمة.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((row, index) => {
                        const invoice = customerOpenInvoices.find((inv) => inv.id === row.invoiceId);
                        const rowAmount = Number(row.amount) || 0;
                        const outstanding = invoice?.settlement.outstanding ?? 0;
                        const isFull = rowAmount >= outstanding && outstanding > 0;

                        return (
                          <div
                            key={row.invoiceId}
                            className="rounded-xl border border-border/80 bg-background p-2.5 space-y-2 transition-all"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-xs font-black text-primary" dir="ltr">
                                  {invoice?.reference ?? row.invoiceId}
                                </span>
                                {invoice?.date && (
                                  <span className="text-[10px] text-muted-foreground">({invoice.date})</span>
                                )}
                                {isFull ? (
                                  <span className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 text-[9.5px] font-black">
                                    سداد كامل
                                  </span>
                                ) : rowAmount > 0 ? (
                                  <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 text-[9.5px] font-black">
                                    سداد جزئي
                                  </span>
                                ) : null}
                              </div>

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                aria-label="إلغاء اختيار هذه الفاتورة"
                                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                                className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                              <div className="text-[10.5px]">
                                <span className="text-muted-foreground">المتبقي على الفاتورة: </span>
                                <span className="font-black text-foreground tabular-nums">
                                  {formatNumber(outstanding)} ج.س
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isFull && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePayFullInvoice(index)}
                                    className="h-8 rounded-lg text-[10px] font-black text-primary border-primary/30 hover:bg-primary/5 px-2"
                                  >
                                    سداد كامل الفاتورة
                                  </Button>
                                )}
                                <div className="flex items-center gap-1">
                                  <span className="text-[10px] font-bold text-muted-foreground">المسدد:</span>
                                  <Input
                                    inputMode="decimal"
                                    value={row.amount}
                                    onChange={(e) =>
                                      setRows((current) =>
                                        current.map((r, i) =>
                                          i === index ? { ...r, amount: e.target.value.replace(/[^\d.]/g, "") } : r
                                        )
                                      )
                                    }
                                    placeholder="0"
                                    className="h-8 w-24 rounded-lg text-xs font-bold text-center tabular-nums bg-background"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ملخص المبالغ والتوزيع */}
                  {paymentAmount > 0 && (
                    <div className="rounded-xl bg-muted/40 p-2.5 flex items-center justify-between gap-2 text-[10.5px] font-bold">
                      <span>
                        المسدد للفواتير:{" "}
                        <strong className="text-foreground">{formatNumber(allocatedTotal)} ج.س</strong>
                      </span>
                      {remaining > 0 ? (
                        <span className="text-muted-foreground">
                          متبقي كدفعة مقدمة:{" "}
                          <strong className="text-primary">{formatNumber(remaining)} ج.س</strong>
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-400 font-black">
                          ✓ تمت تسوية كامل المبلغ
                        </span>
                      )}
                    </div>
                  )}

                  {allocatedTotal > paymentAmount + 0.009 && (
                    <p className="flex items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 p-2 text-[10.5px] font-black text-destructive">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      مجموع المبالغ المسددة للفواتير ({formatNumber(allocatedTotal)}) يتجاوز إجمالي سند القبض ({formatNumber(paymentAmount)}).
                    </p>
                  )}
                </div>
              )}
            </div>

            {projects.length > 0 && (
              <Field label="المشروع (اختياري)">
                <Select value={projectId ?? "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                    <SelectValue placeholder="بلا مشروع" />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="__none__">بلا مشروع</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        <span className="font-mono text-[10px] text-primary">{project.reference}</span>
                        <span className="mx-1.5 text-muted-foreground">·</span>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field label="ملاحظات (اختياري)">
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم إيصال، اسم المسلّم، أو ملاحظة…"
                className="h-10 rounded-xl text-xs font-bold bg-background text-right"
              />
            </Field>

            {duplicateWarning && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{duplicateWarning}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleSave(true)}
                    className="flex-1 h-8 rounded-lg gap-1 text-[11px] font-black bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    تأكيد التسجيل رغم التكرار
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDuplicateWarning(null)}
                    className="h-8 rounded-lg text-[11px] font-bold"
                  >
                    تراجع
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
            إلغاء
          </Button>
          <Button type="button" onClick={() => void handleSave(false)} disabled={busy || loadingInit} className="flex-1 h-10 rounded-xl text-xs font-bold">
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            تسجيل التحصيل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-foreground">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export default ReceiptDialog;
