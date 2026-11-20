import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { countInvoices } from "@/lib/backup/validation";
import {
  type BackupFileInfo,
  type RestoreResult,
  formatDateTime,
} from "./types";

interface RestoreSuccessViewProps {
  successResult: RestoreResult;
  onCloseSuccess: () => void;
}

export function RestoreSuccessView({
  successResult,
  onCloseSuccess,
}: RestoreSuccessViewProps) {
  return (
    <div className="py-4 space-y-4 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-black text-foreground">
          تمت استعادة البيانات بنجاح!
        </h3>
        <p className="text-xs text-muted-foreground">
          تم تحديث جميع السجلات والفواتير المحفوظة في قاعدة البيانات.
        </p>
      </div>

      <div className="rounded-2xl border border-border/80 bg-muted/30 p-3 text-xs space-y-1.5 text-right font-medium">
        <div className="flex justify-between">
          <span className="text-muted-foreground">الفواتير المستعادة:</span>
          <span className="font-bold text-foreground font-mono">
            {successResult.counts.custom_invoices ?? 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">العروض المبدئية:</span>
          <span className="font-bold text-foreground font-mono">
            {successResult.counts.proforma_invoices ?? 0}
          </span>
        </div>
        {successResult.safetyBackupId && (
          <p className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1 border-t border-border/40 font-bold">
            ✓ تم حفظ نسخة أمان تلقائية للبيانات السابقة قبل التطبيق.
          </p>
        )}
      </div>

      <Button
        type="button"
        onClick={onCloseSuccess}
        className="w-full h-11 rounded-2xl font-black text-xs bg-primary text-primary-foreground shadow-sm active:scale-[0.98] touch-manipulation"
      >
        إتمام والعودة للتطبيق
      </Button>
    </div>
  );
}

interface RestoreArchiveSelectorProps {
  backups: BackupFileInfo[];
  selectedFile: BackupFileInfo | null;
  showOtherBackups: boolean;
  onToggleShowOther: () => void;
  onSelectFile: (file: BackupFileInfo) => void;
}

export function RestoreArchiveSelector({
  backups,
  selectedFile,
  showOtherBackups,
  onToggleShowOther,
  onSelectFile,
}: RestoreArchiveSelectorProps) {
  if (backups.length <= 1) return null;

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={onToggleShowOther}
        className="flex items-center justify-between w-full text-xs font-bold text-primary hover:underline px-1 py-0.5"
      >
        <span className="flex items-center gap-1">
          <span>اختيار نسخة أخرى من الأرشيف ({backups.length} نسخة متوفرة)</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform duration-200",
            showOtherBackups ? "rotate-180" : ""
          )}
        />
      </button>

      {showOtherBackups && (
        <div className="rounded-2xl border border-border/80 bg-muted/30 p-2 space-y-1 max-h-48 overflow-y-auto">
          {backups.map((b) => {
            const count =
              b.manifest?.invoiceCount ?? countInvoices(b.manifest?.counts);
            const isSelected = selectedFile?.fileName === b.fileName;
            return (
              <button
                key={b.fileName}
                type="button"
                onClick={() => onSelectFile(b)}
                className={cn(
                  "w-full text-right p-2 rounded-xl text-xs flex items-center justify-between transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground font-black"
                    : "hover:bg-muted text-foreground font-medium"
                )}
              >
                <div className="min-w-0 flex-1 truncate pl-2">
                  <p className="truncate text-xs font-bold">
                    {formatDateTime(b.manifest?.createdAt)}
                  </p>
                  <p className="text-[10px] opacity-80" dir="ltr">
                    {b.fileName}
                  </p>
                </div>
                <span className="text-[10px] font-mono shrink-0">
                  {count} فاتورة
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
