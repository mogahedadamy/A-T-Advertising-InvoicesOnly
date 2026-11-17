import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { backupBridge, isBackupEngineAvailable } from "@/lib/backup/bridge";
import { createManualBackup } from "@/lib/backup/autoBackup";
import { importLegacyJson, restoreBackup } from "@/lib/backup/restoreService";
import { saveBackupSettings } from "@/lib/backup/settingsStore";
import { useBackupDashboard } from "@/lib/backup/useBackupStatus";
import { newestWithData } from "@/lib/backup/validation";
import {
  type BackupFileInfo,
  type RestoreMode,
  type RestoreResult,
  type BackupSettings,
  formatBytes,
} from "./backup/types";
import { playSuccessSound, playTapSound } from "@/lib/soundEffects";
import { bytesToBase64 } from "@/lib/backup/crypto";

// Subcomponents
import { BackupStatusHero } from "./backup/BackupStatusHero";
import { BackupActionsCard } from "./backup/BackupActionsCard";
import { RestoreHubDialog } from "./backup/RestoreHubDialog";
import { BackupSettingsDialog } from "./backup/BackupSettingsDialog";
import { BackupHistoryDialog } from "./backup/BackupHistoryDialog";

export {
  formatBytes,
  formatDateTime,
  formatRelative,
  STATUS_LABEL,
  PROTECTION_META,
} from "./backup/types";

export function BackupManagerCard() {
  const dashboard = useBackupDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [isRestoreHubOpen, setIsRestoreHubOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [restoreSuccessResult, setRestoreSuccessResult] =
    useState<RestoreResult | null>(null);
  const [preSelectedBackup, setPreSelectedBackup] =
    useState<BackupFileInfo | null>(null);

  const settings = dashboard.settings;
  const newest = useMemo(
    () =>
      dashboard.backups
        .filter((b) => b.status === "verified" && b.manifest)
        .sort(
          (a, b) =>
            Date.parse(b.manifest!.createdAt) -
            Date.parse(a.manifest!.createdAt)
        )[0] ?? null,
    [dashboard.backups]
  );

  const newestDataBackup = useMemo(
    () => newestWithData(dashboard.backups),
    [dashboard.backups]
  );

  const handleChooseFolder = useCallback(async () => {
    playTapSound();
    setBusy("folder");
    try {
      const result = await backupBridge.chooseFolder();
      if (!result.ok) {
        if (result.errorCode !== "CANCELLED")
          toast.error(result.message || "تعذّر اختيار المجلد.");
        return;
      }
      await saveBackupSettings({
        folderUri: result.folderUri ?? "",
        folderLabel: result.folderLabel ?? "",
      });
      playSuccessSound();
      toast.success(
        "تم ربط مجلد النسخ الاحتياطي: " + (result.folderLabel || "")
      );
      await dashboard.refresh();
    } catch (err: any) {
      toast.error(
        err?.message === "NATIVE_UNAVAILABLE"
          ? "وحدة النسخ الاحتياطي غير مثبّتة في هذا البناء."
          : "تعذّر فتح مدير الملفات."
      );
    } finally {
      setBusy(null);
    }
  }, [dashboard]);

  const handleBackupNow = useCallback(async () => {
    playTapSound();
    if (!settings.folderUri) {
      toast.error("اختر مجلد النسخ الاحتياطي أولاً.");
      return;
    }
    setBusy("backup");
    try {
      const result = await createManualBackup();
      if (result.ok) {
        playSuccessSound();
        toast.success(
          `تم إنشاء النسخة بنجاح (${result.manifest?.invoiceCount ?? 0} فاتورة، ${formatBytes(result.sizeBytes)})`
        );
      } else {
        toast.error(result.message || "تعذّر إنشاء النسخة الاحتياطية.");
      }
      await dashboard.refresh();
    } finally {
      setBusy(null);
    }
  }, [dashboard, settings.folderUri]);

  const handleVerify = useCallback(
    async (fileName: string) => {
      playTapSound();
      setBusy("verify:" + fileName);
      try {
        const result = await backupBridge.verifyBackup(fileName);
        if (result.ok) {
          playSuccessSound();
          toast.success("النسخة سليمة 100%: البصمة الرقمية وفحص الجداول متطابقان.");
        } else {
          toast.error(result.message || "فشل التحقق من سلامة النسخة.");
        }
        await dashboard.refresh();
      } finally {
        setBusy(null);
      }
    },
    [dashboard]
  );

  const handleExport = useCallback(async (fileName: string) => {
    playTapSound();
    setBusy("export:" + fileName);
    try {
      const exported = await backupBridge.exportArchive(fileName);
      if (!exported.ok || !exported.base64) {
        toast.error(exported.message || "تعذّر تصدير النسخة.");
        return;
      }
      const androidPrint = (window as any).AndroidPrint;
      if (androidPrint && typeof androidPrint.saveFile === "function") {
        androidPrint.saveFile(
          exported.base64,
          fileName,
          "application/octet-stream"
        );
        playSuccessSound();
        toast.success(
          "تم حفظ النسخة في التنزيلات لمشاركتها أو نقلها لجهاز آخر."
        );
      } else {
        toast.error("التصدير متاح داخل تطبيق أندرويد.");
      }
    } finally {
      setBusy(null);
    }
  }, []);

  const handleImportFile = useCallback(
    async (file: File) => {
      setBusy("import");
      try {
        if (file.name.toLowerCase().endsWith(".json")) {
          const text = await file.text();
          const result = await importLegacyJson(text);
          if (result.ok) {
            playSuccessSound();
            toast.success(result.message);
            setRestoreSuccessResult({
              ok: true,
              mode: "merge",
              counts: result.counts || { custom_invoices: result.added },
            });
            setIsRestoreHubOpen(true);
          } else {
            toast.error(result.message);
          }
        } else {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const base64 = bytesToBase64(bytes);
          const result = await backupBridge.importArchive(base64, file.name);
          if (result.ok) {
            playSuccessSound();
            await dashboard.refresh();
            setIsRestoreHubOpen(true);
            toast.success("تم استيراد النسخة بنجاح — اضغط تأكيد الاستعادة.");
            return;
          } else {
            toast.error(
              result.errorCode === "NO_FOLDER"
                ? "اختر مجلد النسخ الاحتياطي أولاً ثم أعد استيراد الملف."
                : result.message || "الملف غير صالح أو غير متوافق."
            );
          }
        }
        await dashboard.refresh();
      } catch (err: any) {
        toast.error("تعذّر استيراد الملف: " + (err?.message ?? err));
      } finally {
        setBusy(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [dashboard]
  );

  const handleRestore = useCallback(
    async (fileName: string, mode: RestoreMode) => {
      if (!fileName) {
        toast.error("يرجى اختيار ملف النسخة الاحتياطية أولاً.");
        return;
      }
      setBusy("restore");
      try {
        const result = await restoreBackup(fileName, mode);
        if (result.ok) {
          playSuccessSound();
          const extraParts: string[] = [];
          if ((result.counts.projects ?? 0) > 0)
            extraParts.push(`${result.counts.projects} مشروع`);
          if ((result.counts.suppliers ?? 0) > 0)
            extraParts.push(`${result.counts.suppliers} مورد`);
          if ((result.counts.expenses ?? 0) > 0)
            extraParts.push(`${result.counts.expenses} مصروف`);
          const extraSummary = extraParts.length
            ? `، ${extraParts.join("، ")}`
            : "";

          toast.success(
            `تمت الاستعادة بنجاح (${result.counts.custom_invoices ?? 0} فواتير، ${result.counts.proforma_invoices ?? 0} عروض${extraSummary})`
          );
          setRestoreSuccessResult(result);
          await dashboard.refresh();
        } else {
          toast.error(
            result.message || "فشلت الاستعادة، ولم يتم المساس ببياناتك الحالية."
          );
        }
      } catch (err: any) {
        toast.error("حدث خطأ أثناء الاستعادة: " + (err?.message ?? err));
      } finally {
        setBusy(null);
      }
    },
    [dashboard]
  );

  const handleSaveSettings = useCallback(
    async (updated: Partial<BackupSettings>) => {
      await saveBackupSettings(updated);
      await dashboard.refresh();
      toast.success("تم حفظ إعدادات النسخ الاحتياطي.");
    },
    [dashboard]
  );

  const engineMissing =
    Capacitor.isNativePlatform() && !isBackupEngineAvailable();

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-primary/20 bg-card p-4 sm:p-5 shadow-sm space-y-4">
      {/* 1. Status Hero */}
      <BackupStatusHero
        dashboard={dashboard}
        newestBackup={newestDataBackup || newest}
        busy={busy}
        onChooseFolder={handleChooseFolder}
        engineMissing={engineMissing}
      />

      {/* 2. Actions Card */}
      <BackupActionsCard
        busy={busy}
        hasFolder={Boolean(dashboard.storage?.folderUri)}
        backupCount={dashboard.backups.length}
        onBackupNow={handleBackupNow}
        onOpenRestoreHub={() => {
          setRestoreSuccessResult(null);
          setIsRestoreHubOpen(true);
        }}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onImportClick={() => fileInputRef.current?.click()}
        onVerifyLatest={() => newest && handleVerify(newest.fileName)}
        hasLatestBackup={Boolean(newest)}
      />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".tabk,.json,application/octet-stream,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleImportFile(f);
        }}
      />

      {/* 3. Streamlined Restore Hub Dialog */}
      <RestoreHubDialog
        open={isRestoreHubOpen}
        onOpenChange={(open) => {
          setIsRestoreHubOpen(open);
          if (!open) {
            setRestoreSuccessResult(null);
            setPreSelectedBackup(null);
          }
        }}
        initialSelected={preSelectedBackup}
        backups={dashboard.backups}
        currentInvoiceCount={dashboard.database?.invoiceCount ?? 0}
        currentSchemaVersion={dashboard.database?.schemaVersion ?? 1}
        busy={busy}
        onRestore={handleRestore}
        onImportExternal={() => fileInputRef.current?.click()}
        successResult={restoreSuccessResult}
        onCloseSuccess={() => {
          setIsRestoreHubOpen(false);
          setRestoreSuccessResult(null);
        }}
      />

      {/* 4. Settings Dialog */}
      <BackupSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        encryptionAvailable={dashboard.encryptionAvailable}
        onSave={handleSaveSettings}
      />

      {/* 5. History Dialog */}
      <BackupHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        backups={dashboard.backups}
        busy={busy}
        onVerify={handleVerify}
        onRestoreSelect={(b) => {
          setPreSelectedBackup(b);
          setIsHistoryOpen(false);
          setRestoreSuccessResult(null);
          setIsRestoreHubOpen(true);
        }}
        onExport={handleExport}
      />
    </section>
  );
}
