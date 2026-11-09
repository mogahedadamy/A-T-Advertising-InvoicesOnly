import React from "react";
import { FileText, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playTapSound } from "@/lib/soundEffects";

interface InvoiceDialogHeaderProps {
  serial: string;
  saved: boolean;
  onClose: () => void;
}

/**
 * شريط ترويسة نافذة الفاتورة
 * يوضح رقم الفاتورة وحالة الحفظ وزر الإغلاق المتوافق مع اللمس
 */
export const InvoiceDialogHeader: React.FC<InvoiceDialogHeaderProps> = ({
  serial,
  saved,
  onClose,
}) => {
  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-3.5 py-2.5 bg-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
          <FileText className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-black text-foreground truncate">
            فاتورة ضريبية #{serial}
          </h2>
          <p className="text-[10px] text-muted-foreground hidden sm:block">
            نموذج T.A المعتمد A5 عرضي
          </p>
        </div>
        {saved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            محفوظة
          </span>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => {
          playTapSound();
          onClose();
        }}
        aria-label="إغلاق"
        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground touch-manipulation"
      >
        <X className="h-4 w-4" />
      </Button>
    </header>
  );
};
