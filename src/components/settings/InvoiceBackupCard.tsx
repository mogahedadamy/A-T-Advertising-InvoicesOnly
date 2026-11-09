import React, { useRef, useState } from "react";
import {
  DownloadCloud,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Database,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  exportInvoiceDatabase,
  importInvoiceDatabase,
  verifyInvoiceDatabaseIntegrity,
  type IntegrityReport,
} from "@/lib/invoiceBackupService";
import { playTapSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";

export function InvoiceBackupCard() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);

  const handleExport = async () => {
    playTapSound();
    setIsExporting(true);
    try {
      await exportInvoiceDatabase();
      playSuccessSound();
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerImport = () => {
    playTapSound();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const res = await importInvoiceDatabase(text);
      if (res.success) {
        playSuccessSound();
      }
    } catch (err: any) {
      toast.error(`تعذر قراءة ملف النسخة: ${err?.message || "خطأ غير متوقع"}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCheckIntegrity = () => {
    playTapSound();
    const report = verifyInvoiceDatabaseIntegrity();
    setIntegrityReport(report);
    if (report.isHealthy) {
      playSuccessSound();
      toast.success(
        `قاعدة البيانات سليمة وموثوقة: إجمالي ${report.totalInvoices} فاتورة مسجلة ومحمية.`
      );
    } else {
      toast.warning(`تم العثور على ${report.issues.length} ملاحظة تدقيق في الفواتير.`);
    }
  };

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Database className="h-4.5 w-4.5" />
          </div>
          <div>
            <h2 className="text-sm font-black text-foreground">
              النسخ الاحتياطي وسلامة الفواتير
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              حماية تامة للبيانات وترحيل آمن ومضمون 100% بين النسخ
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="h-3 w-3" />
          <span>حماية دائمة</span>
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        فواتيرك مخزنة محلياً في هاتفك بأمان دائم. يمكنك تصدير نسخة احتياطية كاملة في
        أي وقت، أو استعادتها فوراً على أي جهاز آخر، دون فقدان أي سجلات سابقة.
      </p>

      {/* أزرار التصدير والاستيراد */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* زر التصدير */}
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || isImporting}
          className="h-11 rounded-2xl gap-2 font-bold text-xs border-primary/30 hover:bg-primary/5 text-primary"
        >
          <DownloadCloud className="h-4 w-4" />
          <span>{isExporting ? "جاري التصدير..." : "تصدير نسخة احتياطية (JSON)"}</span>
        </Button>

        {/* زر الاستعادة */}
        <Button
          type="button"
          variant="outline"
          onClick={handleTriggerImport}
          disabled={isExporting || isImporting}
          className="h-11 rounded-2xl gap-2 font-bold text-xs border-border/80 hover:bg-muted"
        >
          <UploadCloud className="h-4 w-4 text-muted-foreground" />
          <span>{isImporting ? "جاري الاستعادة..." : "استعادة نسخة فواتير"}</span>
        </Button>

        {/* حقل ملف مخفي */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* زر تدقيق السلامة */}
      <div className="pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCheckIntegrity}
          className="w-full h-9 rounded-xl gap-2 font-bold text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60"
        >
          <FileCheck className="h-3.5 w-3.5" />
          <span>فحص وتدقيق سلامة قاعدة بيانات الفواتير</span>
        </Button>
      </div>

      {/* تقرير التدقيق في حال تشغيله */}
      {integrityReport && (
        <div className="rounded-2xl border border-border/60 bg-muted/30 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5">
              {integrityReport.isHealthy ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">
                    كافة الفواتير سليمة ومطابقة للمواصفات
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">
                    توجد ملاحظات بحاجة للتدقيق
                  </span>
                </>
              )}
            </span>
            <span className="font-mono font-black text-foreground">
              {integrityReport.totalInvoices} فاتورة
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-muted-foreground">
            <div className="p-2 rounded-xl bg-card border border-border/40 text-center">
              <span className="block font-bold text-foreground">
                {integrityReport.customCount}
              </span>
              <span>فواتير معتمدة</span>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border/40 text-center">
              <span className="block font-bold text-foreground">
                {integrityReport.proformaCount}
              </span>
              <span>عروض أسعار</span>
            </div>
            <div className="p-2 rounded-xl bg-card border border-border/40 text-center">
              <span className="block font-bold text-foreground">
                {integrityReport.printCount}
              </span>
              <span>فواتير حاسبة</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

