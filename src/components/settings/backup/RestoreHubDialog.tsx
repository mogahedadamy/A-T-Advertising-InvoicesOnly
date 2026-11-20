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
  FileCheck,
  AlertTriangle,
  UploadCloud,
  Loader2,
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
import { RestoreArchiveSelector, RestoreSuccessView } from "./RestoreHubParts";

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

  // Auto-select the best backup on open without overriding manual user selections
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setShowOtherBackups(false);
      return;
    }
    if (initialSelected) {
      setSelectedFile(initialSelected);
      return;
    }
    setSelectedFile((prev) => {
      if (prev && backups.some((b) => b.fileName === prev.fileName)) {
        return prev;
      }
      if (backups.length === 0) return null;
      return (
        backups.find((b) => {
          const invCount =
            b.manifest?.invoiceCount ?? countInvoices(b.manifest?.counts);
          return b.status === "verified" && invCount > 0;
        }) ||
        backups.find((b) => b.status === "verified") ||
        backups[0] ||
        null
      );
    });
  }, [open, backups, initialSelected]);

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
          <RestoreSuccessView
            successResult={successResult}
            onCloseSuccess={onCloseSuccess}
          />
        ) : (
          <div className="py-2 space-y-4">
            {selectedFile ? (
              <div className="rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/5 via-card to-amber-500/5 p-4 space-y-3 relative overflow-hidden shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-black text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    <FileCheck className="h-3.5 w-3.5" />
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

            <RestoreArchiveSelector
              backups={backups}
              selectedFile={selectedFile}
              showOtherBackups={showOtherBackups}
              onToggleShowOther={() => setShowOtherBackups((prev) => !prev)}
              onSelectFile={handleSelectFile}
            />

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
