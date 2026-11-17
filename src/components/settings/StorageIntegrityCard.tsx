import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Gauge, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { optimizeStorage, runIntegrityCheck, type IntegrityReport } from "@/lib/repositories/MaintenanceRepository";
import { formatBytes } from "@/components/settings/BackupManagerCard";
import { playSuccessSound, playTapSound } from "@/lib/soundEffects";

/**
 * لوحة سلامة التخزين (PRD §12, Blueprint §10): تعرض نتيجة فحص SQLite الحقيقي
 * على هذا الجهاز — سلامة الصفحات، تماسك العلاقات، وإصدار المخطط.
 * تعرض الحقائق فقط، ولا تقول «سليم» إلا بعد فحص فعلي ناجح.
 */
export function StorageIntegrityCard() {
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [busy, setBusy] = useState<"check" | "optimize" | null>(null);

  const handleCheck = async () => {
    playTapSound();
    setBusy("check");
    try {
      const result = await runIntegrityCheck();
      setReport(result);
      if (result.ok) {
        playSuccessSound();
        toast.success("قاعدة البيانات سليمة والعلاقات متسقة.");
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إجراء الفحص.");
    } finally {
      setBusy(null);
    }
  };

  const handleOptimize = async () => {
    playTapSound();
    setBusy("optimize");
    try {
      const result = await optimizeStorage();
      if (result.ok) {
        playSuccessSound();
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="surface-panel space-y-3" dir="rtl">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <Database className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground">سلامة قاعدة البيانات</h2>
            <p className="field-hint mt-0.5">فحص فعلي لصفحات SQLite وتماسك العلاقات بين السجلات</p>
          </div>
        </div>
        {report && (
          <span
            className={cn(
              "status-pill",
              report.ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            )}
          >
            {report.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {report.ok ? "سليمة" : "تحتاج مراجعة"}
          </span>
        )}
      </div>

      {report && (
        <div className="row-sep">
          <div className="data-row">
            <span className="data-row-label">فحص سلامة الصفحات (quick_check)</span>
            <span className={cn("data-row-value", report.quickCheck === "ok" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")} dir="ltr">
              {report.quickCheck}
            </span>
          </div>
          <div className="data-row">
            <span className="data-row-label">علاقات مكسورة بين السجلات</span>
            <span className={cn("data-row-value", report.foreignKeyViolations.length === 0 ? "" : "text-destructive")}>
              {report.foreignKeyViolations.length}
            </span>
          </div>
          <div className="data-row">
            <span className="data-row-label">إصدار المخطط</span>
            <span className="data-row-value" dir="ltr">
              v{report.schemaVersion} / v{report.appSchemaVersion}
            </span>
          </div>
          <div className="data-row">
            <span className="data-row-label">وضع التسجيل (journal)</span>
            <span className="data-row-value" dir="ltr">
              {report.journalMode || "—"}
            </span>
          </div>
          <div className="data-row">
            <span className="data-row-label">إجمالي السجلات المفحوصة</span>
            <span className="data-row-value">{report.totalRows}</span>
          </div>
        </div>
      )}

      {report && report.foreignKeyViolations.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-2.5">
          <p className="field-hint text-destructive">جداول بها علاقات مكسورة:</p>
          <p className="ref-mono mt-1 text-destructive" dir="ltr">
            {Array.from(new Set(report.foreignKeyViolations.map((v) => v.table))).join(", ")}
          </p>
        </div>
      )}

      <p className="field-hint">{report?.message ?? "لم يُجرَ فحص بعد على هذا الجهاز."}</p>

      <div className="flex gap-2">
        <Button
          type="button"
          onClick={() => void handleCheck()}
          disabled={busy !== null}
          className="h-10 flex-1 gap-1.5 rounded-xl text-xs font-black"
        >
          {busy === "check" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          فحص السلامة الآن
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleOptimize()}
          disabled={busy !== null}
          className="h-10 flex-1 gap-1.5 rounded-xl text-xs font-black"
        >
          {busy === "optimize" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gauge className="h-4 w-4" />}
          تحديث الإحصاءات
        </Button>
      </div>

      {report && report.counts.length > 0 && (
        <details className="rounded-xl border border-border/60 bg-muted/20 p-3">
          <summary className="cursor-pointer text-2xs font-black text-muted-foreground">
            عدد السجلات لكل جدول
          </summary>
          <div className="row-sep mt-2">
            {report.counts
              .filter((row) => row.rows > 0)
              .map((row) => (
                <div key={row.table} className="data-row">
                  <span className="data-row-label" dir="ltr">
                    {row.table}
                  </span>
                  <span className="data-row-value">{row.rows}</span>
                </div>
              ))}
          </div>
        </details>
      )}

      <p className="field-hint">
        حجم القاعدة الحالي: {formatBytes(report?.databaseBytes ?? 0)} — يُحدَّث عند تشغيل الفحص.
      </p>

      {/* قدرات الجهاز (توافق أندرويد): تُقرأ على الجهاز نفسه بدل التخمين */}
      <details className="rounded-xl border border-border/60 bg-muted/20 p-3">
        <summary className="cursor-pointer text-2xs font-black text-muted-foreground">قدرات الجهاز والتوافق</summary>
        <div className="row-sep mt-2">
          {deviceCapabilities().map((row) => (
            <div key={row.label} className="data-row">
              <span className="data-row-label">{row.label}</span>
              <span className="data-row-value truncate max-w-[60%]" dir="ltr" title={row.value}>
                {row.value}
              </span>
            </div>
          ))}
        </div>
        <p className="field-hint mt-2">
          التشفير وكلمة المرور يحتاجان دعم WebCrypto في متصفح النظام. إن ظهر «غير مدعوم» فيُحدَّث تطبيق
          «متصفح النظام / Android System WebView» من متجر Play لإكمال عمل النسخ الاحتياطي المشفّر.
        </p>
      </details>
    </section>
  );
}

/** Facts read from the running device — no assumptions about the host. */
function deviceCapabilities(): { label: string; value: string }[] {
  if (typeof navigator === "undefined") return [{ label: "البيئة", value: "غير معروفة" }];
  const ua = navigator.userAgent || "";
  const android = /Android\s+([\d.]+)/.exec(ua);
  const chrome = /Chrome\/([\d.]+)/.exec(ua);
  const subtle = typeof crypto !== "undefined" && Boolean((crypto as Crypto).subtle);
  return [
    { label: "نظام أندرويد", value: android ? `Android ${android[1]}` : "متصفح/سطح مكتب" },
    { label: "إصدار محرّك العرض", value: chrome ? `Chromium ${chrome[1]}` : "غير معروف" },
    {
      label: "تشفير WebCrypto (AES-GCM / PBKDF2)",
      value: subtle ? "مدعوم" : "غير مدعوم",
    },
    {
      label: "مولّد أرقام عشوائية آمن",
      value: typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function" ? "متاح" : "غير متاح",
    },
    { label: "التخزين المحلي", value: typeof localStorage !== "undefined" ? "متاح" : "غير متاح" },
  ];
}

export default StorageIntegrityCard;
