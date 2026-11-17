import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { notifyFinanceUpdated } from "@/lib/financeStore";
import { getAllAccounts, getDefaultAccountId } from "@/lib/repositories/FinancialAccountRepository";
import { getAllSuppliers } from "@/lib/repositories/SupplierRepository";
import { createExpense, payExpense, EXPENSE_KIND_LABELS, type Expense, type ExpenseKind } from "@/lib/repositories/ExpenseRepository";
import { PAYMENT_METHOD_LABELS, type FinancialAccount, type PaymentMethod } from "@/lib/domain/finance";
import { formatNumber } from "@/lib/printCalculator";
import type { Supplier } from "@/lib/repositories/SupplierRepository";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** عند تمرير مصروف: النافذة تسجّل سداداً بدل إنشاء مصروف جديد */
  settleExpense?: Expense | null;
  initialProjectId?: string | null;
  onSaved?: () => void;
}

/**
 * مصروف جديد (مباشر أو تشغيلي) أو سداد مصروف قائم.
 * التسجيل لا يعني الدفع، والسداد هو ما يحرّك النقد فعلاً (PRD §7.5).
 */
export function ExpenseDialog({ open, onOpenChange, settleExpense, initialProjectId, onSaved }: Props) {
  const projects = useProjects();
  const isSettlement = Boolean(settleExpense);

  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [kind, setKind] = useState<ExpenseKind>("direct");
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [beneficiary, setBeneficiary] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [evidenceRef, setEvidenceRef] = useState("");
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const [accountList, supplierList] = await Promise.all([getAllAccounts(), getAllSuppliers()]);
      setAccounts(accountList);
      setSuppliers(supplierList);
      setAccountId((current) => current || accountList[0]?.id || "");
    })();

    if (settleExpense) {
      setAmount(String(settleExpense.amount));
      setExpenseDate(new Date().toISOString().slice(0, 10));
    } else {
      setKind(initialProjectId ? "direct" : "direct");
      setProjectId(initialProjectId ?? null);
      setSupplierId(null);
      setBeneficiary("");
      setCategory("");
      setAmount("");
      setExpenseDate(new Date().toISOString().slice(0, 10));
      setEvidenceRef("");
      setNotes("");
    }
  }, [open, settleExpense, initialProjectId]);

  const handleSave = async () => {
    setBusy(true);
    try {
      if (settleExpense) {
        const value = Number(amount) || 0;
        const payment = await payExpense({
          expenseId: settleExpense.id,
          amount: value,
          paidAt: new Date().toISOString().slice(0, 10),
          method,
          accountId,
          notes: notes.trim() || undefined,
        });
        toast.success(`تم تسجيل السداد ${payment.reference} بمبلغ ${formatNumber(payment.amount)} ج.س`);
      } else {
        if (!(Number(amount) > 0)) {
          toast.error("قيمة المصروف يجب أن تكون أكبر من صفر");
          setBusy(false);
          return;
        }
        if (kind === "direct" && !projectId) {
          toast.error("التكلفة المباشرة يجب أن تُربط بمشروع");
          setBusy(false);
          return;
        }
        const expense = await createExpense(
          {
            kind,
            projectId: kind === "direct" ? projectId : null,
            supplierId,
            beneficiary: beneficiary.trim() || undefined,
            category: category.trim() || undefined,
            amount: Number(amount),
            expenseDate,
            evidenceRef: evidenceRef.trim() || undefined,
            notes: notes.trim() || undefined,
          },
          new Date().toISOString()
        );
        toast.success(
          `تم تسجيل ${EXPENSE_KIND_LABELS[expense.kind]} بمبلغ ${formatNumber(expense.amount)} ج.س — لم يُسدَّد بعد`
        );
      }
      await notifyFinanceUpdated();
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر حفظ المصروف.");
    } finally {
      setBusy(false);
    }
  };

  const ensureDefaultAccount = async () => {
    if (!accountId) {
      const id = await getDefaultAccountId();
      if (id) setAccountId(id);
    }
  };
  useEffect(() => {
    void ensureDefaultAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-black">
            {isSettlement ? "سداد مصروف" : "مصروف جديد"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {isSettlement && settleExpense ? (
            <>
              <div className="rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs space-y-1">
                <p className="font-black text-foreground">
                  {settleExpense.beneficiary || settleExpense.category || "مصروف"}
                </p>
                <p className="text-muted-foreground">
                  {EXPENSE_KIND_LABELS[settleExpense.kind]} · قيمة المصروف {formatNumber(settleExpense.amount)} ج.س ·{" "}
                  {settleExpense.expenseDate}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-foreground">
                    مبلغ السداد <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                    className="h-10 rounded-xl text-xs font-bold bg-background text-center tabular-nums"
                  />
                </div>
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
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">نوع المصروف</label>
                <Select value={kind} onValueChange={(v) => setKind(v as ExpenseKind)}>
                  <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent dir="rtl">
                    <SelectItem value="direct">{EXPENSE_KIND_LABELS.direct}</SelectItem>
                    <SelectItem value="operating">{EXPENSE_KIND_LABELS.operating}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] leading-snug text-muted-foreground">
                  التكلفة المباشرة تُنسب لمشروع، والمصروف التشغيلي يخص تشغيل الشركة — ولا يُخلطان في أي حساب.
                </p>
              </div>

              {kind === "direct" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-foreground">
                    المشروع <span className="text-rose-500">*</span>
                  </label>
                  <Select value={projectId ?? "__none__"} onValueChange={(v) => setProjectId(v === "__none__" ? null : v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                      <SelectValue placeholder="اختر المشروع" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="__none__">— اختر المشروع —</SelectItem>
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
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="h-10 rounded-xl text-xs font-mono font-bold bg-background text-right"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">المستفيد</label>
                <Input
                  value={beneficiary}
                  onChange={(e) => setBeneficiary(e.target.value)}
                  placeholder="فريق التركيب، سائق، فني…"
                  className="h-10 rounded-xl text-xs font-bold bg-background text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-foreground">التصنيف</label>
                  <Input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="تركيب، نقل، خدمات"
                    className="h-10 rounded-xl text-xs font-bold bg-background text-right"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-foreground">المورد (اختياري)</label>
                  <Select value={supplierId ?? "__none__"} onValueChange={(v) => setSupplierId(v === "__none__" ? null : v)}>
                    <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                      <SelectValue placeholder="بلا مورد" />
                    </SelectTrigger>
                    <SelectContent dir="rtl">
                      <SelectItem value="__none__">بلا مورد</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">مرجع أو إثبات</label>
                <Input
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                  placeholder="رقم إيصال أو ملاحظة إثبات"
                  className="h-10 rounded-xl text-xs font-bold bg-background text-right"
                />
              </div>
              <p className="rounded-xl bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                تسجيل المصروف يثبت التكلفة ولا يعني دفعها. يُسجَّل خروج النقد عند تنفيذ السداد.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
            إلغاء
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy} className="flex-1 h-10 rounded-xl text-xs font-bold">
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            {isSettlement ? "تسجيل السداد" : "حفظ المصروف"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ExpenseDialog;
