import React, { useEffect, useState } from "react";
import { ArrowLeftRight, Loader2 } from "lucide-react";
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
import { getAccountBalances } from "@/lib/repositories/FinancialAccountRepository";
import { recordTransfer } from "@/lib/repositories/PaymentRepository";
import { notifyFinanceUpdated } from "@/lib/financeStore";
import { getLocalIsoDate } from "@/lib/dateUtils";
import type { AccountBalanceReport } from "@/lib/domain/finance";
import { formatNumber } from "@/lib/printCalculator";
import { sanitizePositiveDecimal } from "./shared/numericInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecorded?: () => void;
}

/**
 * تحويل داخلي بين حسابين (PRD §10.1).
 * ينقل النقد ولا يُحتسب إيراداً ولا مصروفاً — لذلك لا يظهر في الربحية إطلاقاً.
 */
export function TransferDialog({ open, onOpenChange, onRecorded }: Props) {
  const [accounts, setAccounts] = useState<AccountBalanceReport[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => getLocalIsoDate());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const reports = await getAccountBalances();
        if (cancelled) return;
        setAccounts(reports);
        setFromAccountId(reports[0]?.account.id ?? "");
        setToAccountId(reports[1]?.account.id ?? "");
        setAmount("");
        setNotes("");
        setOccurredAt(getLocalIsoDate());
      } catch (err) {
        if (!cancelled) {
          console.error("[TransferDialog] init failed:", err);
          toast.error("تعذّر تحميل الحسابات المالية.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleSave = async () => {
    const value = Number(amount) || 0;
    if (!fromAccountId || !toAccountId) {
      toast.error("يجب تحديد الحساب المحوَّل منه والحساب المحوَّل إليه");
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.error("يجب اختيار حسابين مختلفين لإجراء التحويل");
      return;
    }
    if (!(value > 0)) {
      toast.error("مبلغ التحويل يجب أن يكون أكبر من صفر");
      return;
    }
    const fromAccount = accounts.find((r) => r.account.id === fromAccountId)?.account;
    setBusy(true);
    try {
      await recordTransfer({
        fromAccountId,
        toAccountId,
        amount: value,
        currency: fromAccount?.currency,
        occurredAt,
        notes: notes.trim() || undefined,
      });
      toast.success("تم تسجيل التحويل الداخلي — لا يُحتسب إيراداً ولا مصروفاً");
      await notifyFinanceUpdated();
      onRecorded?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر تنفيذ التحويل.");
    } finally {
      setBusy(false);
    }
  };

  const needsTwoAccounts = accounts.length < 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-black">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            تحويل بين حسابين
          </DialogTitle>
        </DialogHeader>

        {needsTwoAccounts ? (
          <p className="rounded-xl bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            تحتاج حسابين ماليين على الأقل لإجراء تحويل. أضف حساباً بنكياً أو نقدياً آخر من صفحة المالية.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">من حساب</label>
              <Select value={fromAccountId} onValueChange={setFromAccountId}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {accounts.map((report) => (
                    <SelectItem key={report.account.id} value={report.account.id}>
                      {report.account.name} ({formatNumber(report.balance)} {report.account.currency || "SDG"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">إلى حساب</label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-right">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {accounts.map((report) => (
                    <SelectItem key={report.account.id} value={report.account.id}>
                      {report.account.name} ({formatNumber(report.balance)} {report.account.currency || "SDG"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">المبلغ</label>
                <Input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(sanitizePositiveDecimal(e.target.value))}
                  className="h-10 rounded-xl text-xs font-bold bg-background text-center tabular-nums"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">التاريخ</label>
                <Input
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="h-10 rounded-xl text-xs font-mono font-bold bg-background text-right"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground">ملاحظات</label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="h-10 rounded-xl text-xs font-bold bg-background text-right"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10 rounded-xl text-xs font-bold">
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || needsTwoAccounts}
            className="flex-1 h-10 rounded-xl text-xs font-bold"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin me-1" />}
            تنفيذ التحويل
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TransferDialog;
