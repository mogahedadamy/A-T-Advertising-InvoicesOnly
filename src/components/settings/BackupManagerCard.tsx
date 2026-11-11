import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronLeft,
  Database,
  DownloadCloud,
  FileCheck,
  FolderOpen,
  HardDriveDownload,
  History,
  Lock,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShieldOff,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { backupBridge, isBackupEngineAvailable } from "@/lib/backup/bridge";
import { createManualBackup } from "@/lib/backup/autoBackup";
import { importLegacyJson, restoreBackup } from "@/lib/backup/restoreService";
import { saveBackupSettings, getBackupSettingsSnapshot } from "@/lib/backup/settingsStore";
import { useBackupDashboard } from "@/lib/backup/useBackupStatus";
import {
  BACKUP_KIND_LABELS,
  type BackupFileInfo,
  type ProtectionStatus,
  type RestoreMode,
} from "@/lib/backup/types";
import { playSuccessSound, playTapSound } from "@/lib/soundEffects";
import { bytesToBase64 } from "@/lib/backup/crypto";

// ── formatting helpers ─────────────────────────────────────────────────────

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = AR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} — ${hh}:${mm}`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "لم يتم بعد";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.floor(days / 30);
  return `قبل ${months} شهر`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "غير متاح";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} جيجابايت`;
}

const PROTECTION_META: Record<
  ProtectionStatus,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  protected: {
    label: "محمي",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  unproven: {
    label: "بحاجة لتأكيد",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  outdated: {
    label: "فشل آخر نسخ",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  stale: {
    label: "متأخر",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  unprotected: {
    label: "غير محمي",
    tone: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
  browser: {
    label: "داخل التطبيق فقط",
    tone: "bg-muted text-muted-foreground border-border",
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
};

const STATUS_LABEL: Record<BackupFileInfo["status"], { label: string; tone: string }> = {
  verified: { label: "سليمة", tone: "text-emerald-600 dark:text-emerald-400" },
  corrupt: { label: "تالفة", tone: "text-destructive" },
  incompatible: { label: "غير متوافقة", tone: "text-amber-600 dark:text-amber-400" },
  unreadable: { label: "غير قابلة للقراءة", tone: "text-muted-foreground" },
  encrypted: { label: "مشفّرة بدون مفتاح", tone: "text-amber-600 dark:text-amber-400" },
};

// ── main component ─────────────────────────────────────────────────────────

export function BackupManagerCard() {
  const dashboard = useBackupDashboard();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<string | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<BackupFileInfo | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("replace");
  const [showHistory, setShowHistory] = useState(false);

  const settings = dashboard.settings;
  const protection = PROTECTION_META[dashboard.protection.status] ?? PROTECTION_META.unprotected;
  const newest = useMemo(
    () =>
      dashboard.backups
        .filter((b) => b.status === "verified" && b.manifest)
        .sort((a, b) => Date.parse(b.manifest!.createdAt) - Date.parse(a.manifest!.createdAt))[0] ?? null,
    [dashboard.backups]
  );

  const handleChooseFolder = useCallback(async () => {
    playTapSound();
    setBusy("folder");
    try {
      const result = await backupBridge.chooseFolder();
      if (!result.ok) {
        if (result.errorCode !== "CANCELLED") toast.error(result.message || "تعذّر اختيار المجلد.");
        return;
      }
      await saveBackupSettings({ folderUri: result.folderUri ?? "", folderLabel: result.folderLabel ?? "" });
      playSuccessSound();
      toast.success("تم ربط مجلد النسخ الاحتياطي: " + (result.folderLabel || ""));
      await dashboard.refresh();
    } catch (err: any) {
      toast.error(err?.message === "NATIVE_UNAVAILABLE" ? "وحدة النسخ الاحتياطي غير مثبّتة في هذا البناء." : "تعذّر فتح مدير الملفات.");
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
          `تم إنشاء النسخة الاحتياطية والتحقق منها (${result.manifest?.invoiceCount ?? 0} فاتورة، ${formatBytes(result.sizeBytes)})`
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
          toast.success("النسخة سليمة: بصمة SHA-256 وفحص سلامة قاعدة البيانات ناجحان.");
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

  const handleExport = useCallback(
    async (fileName: string) => {
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
          androidPrint.saveFile(exported.base64, fileName, "application/octet-stream");
          playSuccessSound();
          toast.success("تم حفظ النسخة في مجلد التنزيلات لمشاركتها أو نقلها لجهاز آخر.");
        } else {
          toast.error("التصدير متاح داخل تطبيق أندرويد.");
        }
      } finally {
        setBusy(null);
      }
    },
    []
  );

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
          } else {
            toast.error(result.message);
          }
        } else {
          const bytes = new Uint8Array(await file.arrayBuffer());
          const base64 = bytesToBase64(bytes);
          const result = await backupBridge.importArchive(base64, file.name);
          if (result.ok) {
            playSuccessSound();
            toast.success("تم استيراد النسخة إلى مجلد النسخ الاحتياطي.");
          } else {
            toast.error(result.message || "الملف غير صالح أو غير متوافق.");
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

  const handleRestore = useCallback(async () => {
    if (!restoreTarget) return;
    setBusy("restore");
    try {
      const result = await restoreBackup(restoreTarget.fileName, restoreMode);
      if (result.ok) {
        playSuccessSound();
        toast.success(
          `تمت الاستعادة بنجاح (${result.counts.custom_invoices ?? 0} مبيعات، ${result.counts.proforma_invoices ?? 0} عروض، ${result.counts.print_invoices ?? 0} حاسبة)` +
            (result.safetyBackupId ? " — تم الاحتفاظ بنسخة أمان للبيانات السابقة." : "")
        );
        setRestoreTarget(null);
        await dashboard.refresh();
      } else {
        toast.error(result.message || "فشلت الاستعادة، ولم يتم المساس ببياناتك الحالية.");
      }
    } finally {
      setBusy(null);
    }
  }, [dashboard, restoreMode, restoreTarget]);

  const toggleEncryption = useCallback(
    async (enabled: boolean) => {
      if (!dashboard.encryptionAvailable) {
        toast.error("التشفير غير متاح على هذا الجهاز (مخزن مفاتيح أندرويد غير متاح).");
        return;
      }
      await saveBackupSettings({ encryptionEnabled: enabled });
      await backupBridge.saveSettings({
        encryptionEnabled: enabled,
        autoDaily: getBackupSettingsSnapshot().autoDaily,
        retentionDaily: settings.retention.daily,
        retentionWeekly: settings.retention.weekly,
        retentionMonthly: settings.retention.monthly,
        retentionMinimum: settings.retention.keepMinimum,
        staleAfterHours: settings.staleAfterHours,
        transactionThrottleMinutes: settings.transactionThrottleMinutes,
      });
      toast.success(enabled ? "تم تفعيل تشفير AES-256 للنسخ الجديدة." : "تم إيقاف تشفير النسخ الجديدة.");
      await dashboard.refresh();
    },
    [dashboard, dashboard.encryptionAvailable, settings]
  );

  if (!Capacitor.isNativePlatform()) {
    return (
      <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black">
          <Database className="h-4 w-4 text-primary" />
          النسخ الاحتياطي وحماية البيانات
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          نظام الحماية يعمل داخل تطبيق أندرويد. في المتصفح لا يمكن الوصول إلى مجلد النسخ الآمن.
        </p>
      </section>
    );
  }

  const engineMissing = !dashboard.available && !dashboard.loading;

  return (
    <section className="space-y-3" dir="rtl">
      {/* ── Status header ─────────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-foreground truncate">حماية البيانات والنسخ الاحتياطي</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                نسخ مستقلة مشفّرة خارج ذاكرة التطبيق — تبقى بعد مسح البيانات أو إعادة التثبيت
              </p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shrink-0", protection.tone)}>
            {dashboard.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : protection.icon}
            <span>{protection.label}</span>
          </span>
        </div>

        {engineMissing && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            وحدة النسخ الاحتياطي الأصلية غير مثبّتة في هذه النسخة من التطبيق. أعد بناء التطبيق (assembleDebug) لتفعيلها.
          </div>
        )}

        {dashboard.error && !engineMissing && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
            {dashboard.error}
          </div>
        )}

        {/* Warning banner */}
        {dashboard.protection.status !== "protected" && dashboard.protection.reason && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">{dashboard.protection.reason}</p>
          </div>
        )}

        {/* Dashboard grid */}
        <div className="grid grid-cols-2 gap-2">
          <Stat label="آخر نسخة ناجحة" value={formatDateTime(settings.lastBackupAt)} sub={formatRelative(settings.lastBackupAt)} />
          <Stat
            label="الجدولة التلقائية"
            value={settings.autoDaily ? "يومية — 24 ساعة" : "موقوفة"}
            sub={settings.afterTransaction ? "بعد كل عملية + أسبوعية + شهرية" : "أسبوعية + شهرية"}
          />
          <Stat label="الفواتير المحمية" value={String(newest?.manifest?.invoiceCount ?? 0)} sub={`الجهاز: ${dashboard.database?.invoiceCount ?? 0}`} />
          <Stat
            label="عدد النسخ"
            value={String(dashboard.storage?.backupCount ?? 0)}
            sub={`الحجم: ${formatBytes(dashboard.storage?.backupBytes)}`}
          />
          <Stat label="المساحة المتاحة" value={formatBytes(dashboard.storage?.freeBytes)} sub="على وحدة التخزين" />
          <Stat
            label="حجم قاعدة البيانات"
            value={formatBytes(dashboard.database?.fileBytes)}
            sub={`سلامة: ${dashboard.database?.quickCheckOk ? "سليمة" : "تحتاج فحص"}`}
          />
        </div>

        {/* Folder row */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-muted-foreground">مجلد النسخ الاحتياطي</p>
              <p className="text-xs font-black text-foreground truncate" dir="ltr">
                {dashboard.storage?.folderLabel || "(لم يتم الاختيار)"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleChooseFolder}
              disabled={busy === "folder"}
              className="shrink-0 h-9 rounded-xl gap-1.5 text-[11px] font-bold"
            >
              {busy === "folder" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
              <span>{dashboard.storage?.folderUri ? "تغيير" : "اختيار مجلد"}</span>
            </Button>
          </div>
          {!dashboard.storage?.folderUri && (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              اختر مجلداً في مستندات الهاتف (يفضّل <span dir="ltr">Documents/InvoiceBackups</span>). بعد إعادة تثبيت
              التطبيق، اضغط «اختيار مجلد» واختر المجلد نفسه لاستعادة الوصول إلى نسخك السابقة.
            </p>
          )}
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={handleBackupNow}
            disabled={busy !== null || !dashboard.storage?.folderUri}
            className="h-11 rounded-2xl gap-2 font-bold text-xs"
          >
            {busy === "backup" ? <Loader2 className="h-4 w-4 animate-spin" /> : <HardDriveDownload className="h-4 w-4" />}
            <span>إنشاء نسخة الآن</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy !== null || !dashboard.storage?.folderUri}
            className="h-11 rounded-2xl gap-2 font-bold text-xs border-border/80"
          >
            <UploadCloud className="h-4 w-4" />
            <span>استيراد نسخة</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => newest && handleExport(newest.fileName)}
            disabled={busy !== null || !newest}
            className="h-11 rounded-2xl gap-2 font-bold text-xs border-primary/30 text-primary"
          >
            <DownloadCloud className="h-4 w-4" />
            <span>تصدير أحدث نسخة</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => newest && handleVerify(newest.fileName)}
            disabled={busy !== null || !newest}
            className="h-11 rounded-2xl gap-2 font-bold text-xs border-border/80"
          >
            {busy?.startsWith("verify:") ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
            <span>فحص السلامة</span>
          </Button>
        </div>

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

        {/* Encryption + schedule toggles */}
        <div className="space-y-3 border-t border-border/60 pt-3">
          <ToggleRow
            icon={<Lock className="h-4 w-4" />}
            title="تشفير AES-256-GCM"
            subtitle={
              dashboard.encryptionAvailable
                ? "يُحمى المفتاح داخل مخزن مفاتيح أندرويد ولا يُحفظ بجانب النسخ"
                : "غير متاح على هذا الجهاز"
            }
            checked={settings.encryptionEnabled}
            onCheckedChange={toggleEncryption}
            disabled={!dashboard.encryptionAvailable}
          />
          <ToggleRow
            icon={<RefreshCw className="h-4 w-4" />}
            title="النسخ التلقائي المجدول"
            subtitle="نسخة يومية + أسبوعية + شهرية وأخرى قبل كل تحديث"
            checked={settings.autoDaily}
            onCheckedChange={async (v) => {
              await saveBackupSettings({ autoDaily: v });
              await dashboard.refresh();
            }}
          />
          <ToggleRow
            icon={<Archive className="h-4 w-4" />}
            title="نسخة تلقائية بعد كل عملية"
            subtitle="فوراً بعد إصدار فاتورة أو أوامر شغل أو تعديل العملاء"
            checked={settings.afterTransaction}
            onCheckedChange={async (v) => {
              await saveBackupSettings({ afterTransaction: v });
              await dashboard.refresh();
            }}
          />
        </div>
      </div>

      {/* ── History ───────────────────────────────────────────────── */}
      <div className="rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowHistory((v) => !v)}
          className="flex w-full items-center justify-between gap-2"
        >
          <span className="flex items-center gap-2 text-sm font-black">
            <History className="h-4 w-4 text-primary" />
            سجل النسخ الاحتياطية
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {dashboard.backups.length}
            </span>
          </span>
          <ChevronLeft className={cn("h-4 w-4 text-muted-foreground transition-transform", showHistory ? "-rotate-90" : "")} />
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2">
            {dashboard.backups.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">لا توجد نسخ احتياطية بعد.</p>
            )}
            {dashboard.backups.map((b) => {
              const status = STATUS_LABEL[b.status] ?? STATUS_LABEL.unreadable;
              const kind = b.manifest ? BACKUP_KIND_LABELS[b.manifest.kind] ?? b.manifest.kind : "—";
              return (
                <div key={b.fileName} className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground">
                        {formatDateTime(b.manifest?.createdAt)} · {kind}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate" dir="ltr">
                        {b.fileName}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
                        <span className={`font-bold ${status.tone}`}>{status.label}</span>
                        <span>· {formatBytes(b.sizeBytes)}</span>
                        <span>· {b.manifest?.invoiceCount ?? 0} فاتورة</span>
                        <span>· مخطط v{b.manifest?.databaseSchemaVersion ?? "?"}</span>
                        {b.manifest?.encrypted && <span className="flex items-center gap-0.5"><Lock className="h-2.5 w-2.5" />مشفّرة</span>}
                      </p>
                      {b.issue && <p className="mt-1 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">{b.issue}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <IconButton
                        label="فحص"
                        onClick={() => handleVerify(b.fileName)}
                        busy={busy === "verify:" + b.fileName}
                        disabled={busy !== null}
                      >
                        <FileCheck className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="استعادة"
                        onClick={() => {
                          playTapSound();
                          setRestoreTarget(b);
                        }}
                        disabled={busy !== null || b.status !== "verified"}
                        tone="primary"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton
                        label="تصدير"
                        onClick={() => handleExport(b.fileName)}
                        busy={busy === "export:" + b.fileName}
                        disabled={busy !== null}
                      >
                        <DownloadCloud className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Restore confirmation ──────────────────────────────────── */}
      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black">استعادة نسخة احتياطية</DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              سيتم إنشاء نسخة أمان من بياناتك الحالية أولاً، ثم استبدال قاعدة البيانات بمحتوى النسخة المختارة.
            </DialogDescription>
          </DialogHeader>

          {restoreTarget?.manifest && (
            <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-xs">
              <Row label="تاريخ النسخة" value={formatDateTime(restoreTarget.manifest.createdAt)} />
              <Row label="عدد الفواتير" value={String(restoreTarget.manifest.invoiceCount)} />
              <Row label="الحجم" value={formatBytes(restoreTarget.sizeBytes)} />
              <Row label="حالة النسخة" value={STATUS_LABEL[restoreTarget.status].label} />
              <Row label="الفواتير الحالية" value={String(dashboard.database?.invoiceCount ?? 0)} />
              {restoreTarget.manifest.databaseSchemaVersion !== dashboard.database?.schemaVersion && (
                <p className="rounded-lg bg-amber-500/10 p-2 text-[11px] text-amber-700 dark:text-amber-300">
                  إصدار قاعدة البيانات في النسخة مختلف — سيتم ترقيتها تلقائياً بعد الاستعادة.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-foreground">طريقة الاستعادة</p>
            <div className="grid grid-cols-2 gap-2">
              <ModeOption
                active={restoreMode === "replace"}
                title="استبدال كامل"
                subtitle="جودة بيانات النسخة تصبح الحالة النهائية"
                onClick={() => setRestoreMode("replace")}
              />
              <ModeOption
                active={restoreMode === "merge"}
                title="دمج آمن"
                subtitle="يضيف الناقص فقط دون حذف أو تكرار"
                onClick={() => setRestoreMode("merge")}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setRestoreTarget(null)} className="flex-1 h-10 rounded-xl text-xs font-bold">
              إلغاء
            </Button>
            <Button type="button" onClick={handleRestore} disabled={busy === "restore"} className="flex-1 h-10 rounded-xl text-xs font-bold">
              {busy === "restore" ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
              تأكيد الاستعادة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

// ── small presentational pieces ────────────────────────────────────────────

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5">
      <p className="text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-black text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-bold text-foreground">{value}</span>
    </div>
  );
}

function ToggleRow({
  icon,
  title,
  subtitle,
  checked,
  onCheckedChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn("grid h-8 w-8 place-items-center rounded-lg shrink-0", checked ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-foreground">{title}</p>
          <p className="text-[10px] leading-snug text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={title} />
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  disabled,
  busy,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  busy?: boolean;
  tone?: "primary";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "grid h-8 w-8 place-items-center rounded-lg border transition-all active:scale-95 disabled:opacity-40",
        tone === "primary"
          ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border/70 bg-card text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

function ModeOption({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-2.5 text-right transition-all",
        active ? "border-primary bg-primary/10" : "border-border/70 bg-card hover:bg-muted/40"
      )}
    >
      <p className={cn("text-xs font-black", active ? "text-primary" : "text-foreground")}>{title}</p>
      <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{subtitle}</p>
    </button>
  );
}
