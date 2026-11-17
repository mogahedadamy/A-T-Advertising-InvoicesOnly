import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles, X } from "lucide-react";
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
import { useProjects } from "@/lib/projectsStore";
import { getAllAccounts, getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import { getAllSuppliers, getSupplierAccount, type SupplierAccount } from "@/lib/repositories/SupplierRepository";
import { recordSupplierPayment } from "@/lib/repositories/PaymentRepository";
import { notifyFinanceUpdated } from "@/lib/financeStore";
import { PAYMENT_METHOD_LABELS, type FinancialAccount, type PaymentMethod } from "@/lib/domain/finance";
import { formatNumber } from "@/lib/printCalculator";
import type { Supplier } from "@/lib/repositories/SupplierRepository";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSupplierId?: string | null;
  initialInvoiceId?: string | null;
  onRecorded?: () => void;
}

/** تسجيل دفعة لمورد مقابل فواتير الشراء (§7.3) — تقلّل الالتزام والرصيد النقدي معاً. */
export function SupplierPaymentDialog({ open, onOpenChange, initialSupplierId, initialInvoiceId, onRecorded }: Props) {
  const projects = useProjects();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [account, setAccount] = useState<SupplierAccount | null>(null);
  const [supplierId, setSupplierId] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [accountId, setAccountId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<{ invoiceId: string; amount: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDuplicateWarning(null);
      return;
    }
    let cancelled = false;
    setSupplierId(initialSupplierId ?? "");
    setProjectId(null);
    setNotes("");
    setMethod("cash");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setRows([]);
    setAmount("");
    setDuplicateWarning(null);

    void (async () => {
      let [supplierList, accountList] = await Promise.all([getAllSuppliers(), getAllAccounts()]);
      if (accountList.length === 0) {
        await getDefaultAccountId();
        accountList = await getAllAccounts();
      }
      if (cancelled) return;
      setSuppliers(supplierList);
      setAccounts(accountList);
      setAccountId((current) =>
        current && accountList.some((a) => a.id === current) ? current : accountList[0]?.id ?? ""
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [open, initialSupplierId]);

  const loadSupplier = useCallback(async (id: string) => {
    if (!id) {
      setAccount(null);
      return;
    }
    const data = await getSupplierAccount(id);
    setAccount(data);
    if (initialInvoiceId) {
      const invoice = data.invoices.find((inv) => inv.invoiceId === initialInvoiceId);
      if (invoice) {
        setRows([{ invoiceId: invoice.invoiceId, amount: String(invoice.settlement.outstanding) }]);
        setAmount(String(invoice.settlement.outstanding));
      }
    }
  }, [initialInvoiceId]);

  useEffect(() => {
    if (!open) return;
    void loadSupplier(supplierId);
  }, [open, supplierId, loadSupplier]);

  const openInvoices = useMemo(
    () => (account?.invoices ?? []).filter((inv) => inv.settlement.outstanding > 0),
    [account]
  );
  const allocatedTotal = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
  const paymentAmount = Number(amount) || 0;
  const remaining = Math.max(0, paymentAmount - allocatedTotal);

  const addRow = () => {
    const usedIds = new Set(rows.map((r) => r.invoiceId));
    const candidate = openInvoices.find((inv) => !usedIds.has(inv.invoiceId)) ?? openInvoices[0];
    if (!candidate) return;
    const suggested =
      paymentAmount > 0
        ? Math.min(Math.max(remaining, 0), candidate.settlement.outstanding)
        : candidate.settlement.outstanding;
    setRows((c) => [...c, { invoiceId: candidate.invoiceId, amount: suggested > 0 ? String(suggested) : "" }]);
    if (!(paymentAmount > 0)) {
      setAmount(String(candidate.settlement.outstanding));
    }
  };

  const autoAllocate = () => {
    if (openInvoices.length === 0) return;
    if (paymentAmount > 0) {
      let budget = paymentAmount;
      const nextRows: { invoiceId: string; amount: string }[] = [];
      for (const inv of openInvoices) {
        if (budget <= 0) break;
        const share = Math.min(budget, inv.settlement.outstanding);
        if (share > 0) {
          nextRows.push({ invoiceId: inv.invoiceId, amount: String(share) });
          budget = Math.max(0, Number((budget - share).toFixed(2)));
        }
      }
      setRows(nextRows);
      return;
    }
    const totalOutstanding = openInvoices.reduce((sum, inv) => sum + inv.settlement.outstanding, 0);
    setRows(openInvoices.map((inv) => ({ invoiceId: inv.invoiceId, amount: String(inv.settlement.outstanding) })));
    setAmount(String(totalOutstanding));
  };

  const handleSave = async (confirmDuplicate = false) => {
    if (!supplierId) {
      toast.error("يجب اختيار المورد");
      return;
    }
    if (!(paymentAmount > 0)) {
      toast.error("قيمة الدفعة يجب أن تكون أكبر من صفر");
      return;
    }
    if (!accountId) {
      toast.error("يجب تحديد الحساب المالي");
      return;
    }
    if (allocatedTotal > paymentAmount + 0.009) {
      toast.error("مجموع التخصيصات يتجاوز قيمة الدفعة");
      return;
    }

    setBusy(true);
    try {
      const { payment } = await recordSupplierPayment({
        supplierId,
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
      toast.success(`تم تسجيل الدفعة ${payment.reference} بمبلغ ${formatNumber(payment.amount)} ج.س`);
      await notifyFinanceUpdated();
      onRecorded?.();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذّر تسجيل الدفعة.";
      const code = (err as { code?: string })?.code;
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
          <DialogTitle className="text-sm font-black">دفعة لمورد</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-foreground">
              المورد <span className="text-rose-500">*</span>
            </label>
            <Select value={supplierId || "__none__"} onValueChange={(v) => setSupplierId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                <SelectValue placeholder="اختر المورد" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value="__none__">— اختر المورد —</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {account && (
              <p className="text-[10px] font-bold text-muted-foreground">
                إجمالي الالتزام {formatNumber(account.totalObligations)} · المدفوع {formatNumber(account.totalPaid)} ·
                المتبقي {formatNumber(account.outstanding)}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">
                المبلغ <span className="text-rose-500">*</span>
              </label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                className="h-10 rounded-xl text-xs font-bold bg-background text-center tabular-nums"
                placeholder="0"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">التاريخ</label>
              <Input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className="h-10 rounded-xl text-xs font-mono font-bold bg-background text-right"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">الطريقة</label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
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
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">
                الحساب المالي <span className="text-rose-500">*</span>
              </label>
              <Select value={accountId || "__none__"} onValueChange={(v) => setAccountId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue placeholder="اختر الحساب" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">— اختر الحساب —</SelectItem>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 space-y-2">
            <div className="flex items-center justify-between gap-1.5 flex-wrap">
              <p className="text-[11px] font-black text-foreground">تخصيص لفواتير الشراء</p>
              <div className="flex items-center gap-1">
                {openInvoices.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={autoAllocate}
                    className="h-7 rounded-lg gap-1 text-[10px] font-black text-primary px-2"
                  >
                    <Sparkles className="h-3 w-3" />
                    توزيع تلقائي
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addRow}
                  disabled={openInvoices.length === 0}
                  className="h-7 rounded-lg gap-1 text-[10px] font-bold"
                >
                  <Plus className="h-3 w-3" />
                  إضافة
                </Button>
              </div>
            </div>
            {openInvoices.length === 0 ? (
              <p className="text-[10px] text-muted-foreground">
                لا توجد فواتير شراء بمبالغ متبقية لهذا المورد.
              </p>
            ) : (
              rows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={row.invoiceId}
                    onValueChange={(v) => setRows((c) => c.map((r, i) => (i === index ? { ...r, invoiceId: v } : r)))}
                  >
                    <SelectTrigger className="h-9 flex-1 rounded-lg text-[11px] font-bold bg-background text-right">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      {openInvoices.map((inv) => (
                        <SelectItem key={inv.invoiceId} value={inv.invoiceId}>
                          <span className="font-mono text-[10px]" dir="ltr">
                            {inv.reference}
                          </span>
                          <span className="mx-1.5">·</span>
                          متبقي {formatNumber(inv.settlement.outstanding)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    inputMode="decimal"
                    value={row.amount}
                    onChange={(e) =>
                      setRows((c) =>
                        c.map((r, i) => (i === index ? { ...r, amount: e.target.value.replace(/[^\d.]/g, "") } : r))
                      )
                    }
                    placeholder="0"
                    className="h-9 w-24 rounded-lg text-[11px] font-bold bg-background text-center tabular-nums"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label="حذف"
                    onClick={() => setRows((c) => c.filter((_, i) => i !== index))}
                    className="h-9 w-9 rounded-lg p-0 text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
            {paymentAmount > 0 && (
              <p className="text-[10px] font-bold text-muted-foreground">
                المخصَّص: {formatNumber(allocatedTotal)} · غير مخصَّص: {formatNumber(Math.max(0, paymentAmount - allocatedTotal))}
              </p>
            )}
          </div>

            {projects.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">المشروع (اختياري)</label>
              <Select value={projectId ?? "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue placeholder="بلا مشروع" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  <SelectItem value="__none__">بلا مشروع</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="font-mono text-[10px] text-primary">{project.reference}</span>
                      <span className="mx-1.5">·</span>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-foreground">ملاحظات (اختياري)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم إيصال المورد أو ملاحظة…"
              className="h-10 rounded-xl text-xs font-bold bg-background text-right"
            />
          </div>

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

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
            إلغاء
          </Button>
          <Button type="button" onClick={() => void handleSave(false)} disabled={busy} className="flex-1 h-10 rounded-xl text-xs font-bold">
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            تسجيل الدفعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SupplierPaymentDialog;
