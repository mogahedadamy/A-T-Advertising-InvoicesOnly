import React from "react";
import { X, FileSpreadsheet, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProformaPrintButton } from "./ProformaPrintButton";
import type { AppCurrency } from "@/lib/currency/types";
import { playTapSound } from "@/lib/soundEffects";

interface ProformaDialogHeaderProps {
  serial: string;
  saved: boolean;
  isSaving: boolean;
  partyName?: string;
  totalAmount: number;
  currency: AppCurrency;
  onSave: () => void;
  onClose: () => void;
}

export function ProformaDialogHeader({
  serial,
  saved,
  isSaving,
  partyName,
  totalAmount,
  currency,
  onSave,
  onClose,
}: ProformaDialogHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-3.5 py-2.5 bg-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
          <FileSpreadsheet className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-foreground truncate">
            فاتورة مبدئية #{serial}
          </h2>
          <p className="text-[10px] text-muted-foreground hidden sm:block">
            عرض أسعار رسمي للعميل مع الختم والتفقيط
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant={saved ? "secondary" : "default"}
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="h-8 gap-1 text-xs font-bold px-2.5 rounded-lg"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isSaving ? "جاري الحفظ..." : saved ? "محفوظة" : "حفظ"}</span>
        </Button>

        <ProformaPrintButton
          serial={serial}
          onBeforePrint={onSave}
          partyName={partyName}
          totalAmount={totalAmount}
          currency={currency}
        />

        <button
          type="button"
          aria-label="إغلاق"
          onClick={() => {
            playTapSound();
            onClose();
          }}
          className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-1"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
    </header>
  );
}

interface ProformaDialogFooterProps {
  tab: "edit" | "preview";
  isSaving: boolean;
  onConvert: () => void;
  onToggleTab: () => void;
}

export function ProformaDialogFooter({
  tab,
  isSaving,
  onConvert,
  onToggleTab,
}: ProformaDialogFooterProps) {
  return (
    <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/80 p-2.5 bg-card">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onConvert}
        disabled={isSaving}
        className="h-8.5 gap-1.5 text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl flex-1"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        <span>تحويل إلى أمر تشغيل بالمطبعة</span>
      </Button>

      <Button
        type="button"
        variant="secondary"
        onClick={onToggleTab}
        className="h-8.5 px-3 rounded-xl text-xs font-bold md:hidden"
      >
        {tab === "edit" ? "عرض المعاينة" : "تعديل البيانات"}
      </Button>
    </footer>
  );
}
