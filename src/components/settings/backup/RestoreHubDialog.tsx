import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  RotateCcw,
  CheckCircle2,
  Sparkles,
  FileCheck,
  AlertTriangle,
  UploadCloud,
  Loader2,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { playTapSound } from "@/lib/soundEffects";
import { countInvoices } from "@/lib/backup/validation";
import {
  type BackupFileInfo,
  type RestoreMode,
  type RestoreResult,
  formatBytes,
  formatDateTime,
  formatRelative,
  STATUS_LABEL,
} from "./types";

interface RestoreHubDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backups: BackupFileInfo[];
  currentInvoiceCount: number;
  currentSchemaVersion: number;
  busy: string | null;
  onRestore: (fileName: string, mode: RestoreMode) => Promise<void>;
  onImportExternal: () => void;
  successResult: RestoreResult | null;
  onCloseSuccess: () => void;
  initialSelected?: BackupFileInfo | null;
}

export function RestoreHubDialog({
  open,
  onOpenChange,
  backups,
  currentInvoiceCount,
  currentSchemaVersion,
  busy,
  onRestore,
  onImportExternal,
  successResult,
  onCloseSuccess,
  initialSelected,
}: RestoreHubDialogProps) {
  const [selectedFile, setSelectedFile] = useState<BackupFileInfo | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
  const [showOtherBackups, setShowOtherBackups] = useState(false);

  // Auto-select the best backup on open, giving priority to initialSelected
  useEffect(() => {
    if (open) {
      if (initialSelected) {
        setSelectedFile(initialSelected);
        return;
      }
      if (backups.length > 0 && !selectedFile) {
        // Find newest backup with data, or fallback to first verified
        const best =
          backups.find((b) => {
            const invCount =
              b.manifest?.invoiceCount ?? countInvoices(b.manifest?.counts);
            return b.status === "verified" && invCount > 0;
          }) ||
          backups.find((b) => b.status === "verified") ||
          backups[0];

        if (best) {
          setSelectedFile(best);
        }
      }
    } else {
      setSelectedFile(null);
      setShowOtherBackups(false);
    }
  }, [open, backups, selectedFile, initialSelected]);

  const handleSelectFile = (file: BackupFileInfo) => {
    playTapSound();
    setSelectedFile(file);
    setShowOtherBackups(false);
  };

  const handleConfirmRestore = async () => {
    if (!selectedFile) return;
    playTapSound();
    await onRestore(selectedFile.fileName, restoreMode);
  };

  const isRestoring = busy === "restore";
  const selectedInvoices = selectedFile
    ? selectedFile.manifest?.invoiceCount ??
      countInvoices(selectedFile.manifest?.counts)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-md p-5 rounded-3xl border border-primary/20 bg-card shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain"
      >
        <DialogHeader className="text-right space-y-1.5 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 border border-amber-500/20 shrink-0">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                مركز استعادة النسخ الاحتياطية
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                استرجاع آمن للفواتير مع حماية تلقائية مسبقة للبيانات الحالية
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successResult ? (
          /* Success state */
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
        ) : (
          /* Normal restore view */
          <div className="py-2 space-y-4">
            {/* 1. Main Selected Backup Card */}
            {selectedFile ? (
              <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card to-amber-500/5 p-4 space-y-3 relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>النسخة المحددة للاستعادة</span>
                  </span>
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {formatRelative(selectedFile.manifest?.createdAt)}
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground" dir="ltr">
                    {selectedFile.fileName}
                  </p>
                  <p className="text-[11px] text-muted-foreground font-medium">
                    {formatDateTime(selectedFile.manifest?.createdAt)} •{" "}
                    {formatBytes(selectedFile.sizeBytes)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 font-black px-2.5 py-1">
                    {selectedInvoices} فاتورة وعرض
                  </span>
                  <span className="rounded-lg bg-muted text-foreground font-bold px-2 py-1">
                    {STATUS_LABEL[selectedFile.status]?.label ?? "سليمة"}
                  </span>
                  <span className="rounded-lg bg-muted text-muted-foreground font-mono px-2 py-1">
                    حجم الجهاز: {currentInvoiceCount} فاتورة
                  </span>
                </div>

                {selectedInvoices === 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-[11px] text-amber-700 dark:text-amber-300 border border-amber-500/20">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      تنبيه: هذه النسخة خالية من الفواتير (0 فواتير). اختر نسخة أخرى إذا كنت تريد استعادة فواتير سابقة.
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-muted-foreground/30 p-4 text-center space-y-2">
                <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                <p className="text-xs font-bold text-muted-foreground">
                  لم يتم العثور على نسخ احتياطية في المجلد المحدد.
                </p>
              </div>
            )}

            {/* 2. Switch backup dropdown / selector */}
            {backups.length > 1 && (
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setShowOtherBackups((prev) => !prev)}
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
                          onClick={() => handleSelectFile(b)}
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
            )}

            {/* External File Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onImportExternal}
              className="w-full h-10 rounded-xl gap-2 text-xs font-bold border-dashed border-border hover:bg-primary/5 hover:text-primary active:scale-95 touch-manipulation"
            >
              <UploadCloud className="h-4 w-4 text-primary" />
              <span>استعراض واستيراد ملف خارجي (.tabk / .json)</span>
            </Button>

            {/* 3. Restore Mode Selection */}
            <div className="space-y-2 pt-1 border-t border-border/50">
              <label className="text-xs font-black text-foreground block">
                طريقة الاستعادة:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setRestoreMode("replace");
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1",
                    restoreMode === "replace"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/70 bg-card hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground">
                      استبدال كامل
                    </span>
                    {restoreMode === "replace" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    استبدال قاعدة البيانات مع أخذ نسخة حماية تلقائية لما هو موجود
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playTapSound();
                    setRestoreMode("merge");
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1",
                    restoreMode === "merge"
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/70 bg-card hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-foreground">
                      دمج ذكي آمن
                    </span>
                    {restoreMode === "merge" && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    إضافة السجلات الجديدة فقط دون حذف أو تكرار أي سجل حالي
                  </p>
                </button>
              </div>
            </div>

            {/* 4. Action Buttons */}
            <DialogFooter className="gap-2 pt-3 border-t border-border/50 flex-col sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isRestoring}
                className="w-full sm:w-1/3 h-11 rounded-2xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleConfirmRestore}
                disabled={isRestoring || !selectedFile}
                className="w-full sm:w-2/3 h-11 rounded-2xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-md active:scale-[0.98] touch-manipulation"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin ml-2" />
                    <span>جاري استعادة البيانات...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 ml-2" />
                    <span>تأكيد الاستعادة الآن ({selectedInvoices} فاتورة)</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
