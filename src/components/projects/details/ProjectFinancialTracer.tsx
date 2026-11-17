import {
  AlertTriangle,
  ArrowLeftRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Plus,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CustomInvoiceType } from "@/lib/billing/types";
import {
  EXECUTION_STATUS_LABELS,
  EXECUTION_STATUS_TONES,
  type Project,
  type ProjectExecutionStatus,
  type ProjectFinancialSummary,
} from "@/lib/domain/projects";
import type { LinkedDocumentSummary, ProjectRelations } from "@/lib/repositories/ProjectRepository";
import { money } from "./detailsTypes";
import { MetricTile, Section, SummaryRow } from "./ProjectDetailShared";

interface ProjectFinancialTracerProps {
  project: Project | null;
  summary: ProjectFinancialSummary | null;
  relations: ProjectRelations | null;
  convertingQuoteId: string | null;
  onConvertQuotation: (item: LinkedDocumentSummary) => void;
  onCreateInvoice: (type: CustomInvoiceType) => void;
  onOpenReceipt: () => void;
  onExecutionChange: (status: ProjectExecutionStatus) => void;
}

export function ProjectFinancialTracer({
  project,
  summary,
  relations,
  convertingQuoteId,
  onConvertQuotation,
  onCreateInvoice,
  onOpenReceipt,
  onExecutionChange,
}: ProjectFinancialTracerProps) {
  return (
    <div className="space-y-3.5">
      {/* 1. لوحة مسار التتبع الذكي التلقائي (Automatic Project Tracer) */}
      <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-3.5 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-xs font-black text-foreground">مسار التتبع الذكي للمشروع (Automatic Tracer)</h4>
              <p className="text-[10px] text-muted-foreground">تتبع دورة حياة المشروع والفوترة وسداد الدفعات تلقائياً</p>
            </div>
          </div>

          {/* شارة حالة السداد */}
          {summary && summary.invoicedAmount > 0 ? (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[10px] font-black border",
                summary.customerOutstanding <= 0.009
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : summary.collectedAmount > 0
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-rose-500/10 text-rose-600 border-rose-500/30"
              )}
            >
              {summary.customerOutstanding <= 0.009
                ? "✓ مدفوع بالكامل"
                : summary.collectedAmount > 0
                ? `سداد جزئي (${Math.round((summary.collectedAmount / summary.invoicedAmount) * 100)}%)`
                : "بانتظار السداد (0%)"}
            </span>
          ) : (
            <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold bg-muted text-muted-foreground border">
              لم تصدر فاتورة بعد
            </span>
          )}
        </div>

        {/* شريط مراحل التتبع الـ 4 التفاعلية */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          {/* 1. العرض المبدئي */}
          <div
            className={cn(
              "rounded-xl p-2.5 border space-y-1 transition-all",
              (relations?.quotations.length ?? 0) > 0
                ? "bg-card border-[#C5A059]/40 shadow-2xs"
                : "bg-muted/30 border-border/60"
            )}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="h-3.5 w-3.5 text-[#C5A059]" />
                <span>1. العرض المبدئي</span>
              </span>
              {(relations?.quotations.length ?? 0) > 0 ? (
                <span className="text-[10px] font-black text-[#C5A059]">مُعد ({relations?.quotations.length})</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">غير مُنشأ</span>
              )}
            </div>
            {(relations?.quotations.length ?? 0) > 0 ? (
              <div className="space-y-1">
                <p className="text-[10.5px] font-mono font-bold text-foreground truncate" dir="ltr">
                  {relations?.quotations[0]?.reference || "—"}
                </p>
                {!relations?.quotations[0]?.convertedSalesId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onConvertQuotation(relations!.quotations[0])}
                    disabled={Boolean(convertingQuoteId)}
                    className="w-full h-7 rounded-lg text-[10px] font-black gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <ArrowLeftRight className="h-3 w-3" />
                    <span>تحويل لمبيعات ⚡</span>
                  </Button>
                ) : (
                  <span className="block text-center text-[10px] font-bold text-emerald-600 bg-emerald-500/10 py-0.5 rounded-md">
                    ✓ محوّل لمبيعات
                  </span>
                )}
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => onCreateInvoice("proforma")}
                className="w-full h-7 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-foreground"
              >
                + إنشاء عرض مبدئي
              </Button>
            )}
          </div>

          {/* 2. الفوترة والاعتماد */}
          <div
            className={cn(
              "rounded-xl p-2.5 border space-y-1 transition-all",
              (relations?.salesInvoices.length ?? 0) > 0
                ? "bg-card border-primary/40 shadow-2xs"
                : "bg-muted/30 border-border/60"
            )}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                <span>2. الفوترة</span>
              </span>
              {(relations?.salesInvoices.length ?? 0) > 0 ? (
                <span className="text-[10px] font-black text-primary">صدرت ({relations?.salesInvoices.length})</span>
              ) : (
                <span className="text-[10px] text-muted-foreground">بانتظار الفاتورة</span>
              )}
            </div>
            {(relations?.salesInvoices.length ?? 0) > 0 ? (
              <div className="space-y-0.5">
                <p className="text-[10.5px] font-mono font-bold text-foreground truncate" dir="ltr">
                  {relations?.salesInvoices[0]?.reference || "—"}
                </p>
                <p className="text-[10px] font-black text-foreground tabular-nums">
                  {money(summary?.invoicedAmount ?? 0)}
                </p>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onCreateInvoice("sales")}
                className="w-full h-7 rounded-lg text-[10px] font-bold text-primary border-primary/30"
              >
                + إصدار فاتورة الآن
              </Button>
            )}
          </div>

          {/* 3. التحصيل والسداد المالي */}
          <div
            className={cn(
              "rounded-xl p-2.5 border space-y-1 transition-all",
              summary && summary.collectedAmount > 0
                ? "bg-card border-emerald-500/40 shadow-2xs"
                : "bg-muted/30 border-border/60"
            )}
          >
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                <span>3. السداد والتحصيل</span>
              </span>
              <span className="text-[10px] font-black text-emerald-600 tabular-nums">
                {summary && summary.invoicedAmount > 0
                  ? `${Math.min(100, Math.round((summary.collectedAmount / summary.invoicedAmount) * 100))}%`
                  : "—"}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] tabular-nums">
                <span className="text-muted-foreground">المحصّل:</span>
                <span className="font-bold text-emerald-600">{money(summary?.collectedAmount ?? 0)}</span>
              </div>
              {summary && summary.customerOutstanding > 0.009 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={onOpenReceipt}
                  className="w-full h-7 rounded-lg text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <Plus className="h-3 w-3 ml-1" />
                  <span>تسجيل تحصيل فوري</span>
                </Button>
              ) : summary && summary.invoicedAmount > 0 ? (
                <span className="block text-center text-[10px] font-bold text-emerald-600 bg-emerald-500/10 py-0.5 rounded-md">
                  ✓ مسدد بالكامل
                </span>
              ) : null}
            </div>
          </div>

          {/* 4. مرحلة التنفيذ بنقرة واحدة */}
          <div className="rounded-xl p-2.5 border border-border/60 bg-card space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>4. مرحلة التنفيذ</span>
              </span>
              <span className={cn("text-[10px] font-black", EXECUTION_STATUS_TONES[project?.executionStatus ?? "new"])}>
                {EXECUTION_STATUS_LABELS[project?.executionStatus ?? "new"]}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {(["in_progress", "partially_delivered", "completed"] as ProjectExecutionStatus[]).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => onExecutionChange(st)}
                  className={cn(
                    "h-6 rounded-md text-[9.5px] font-black border transition-all cursor-pointer",
                    project?.executionStatus === st
                      ? "bg-primary text-white border-primary shadow-xs"
                      : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/40"
                  )}
                >
                  {st === "in_progress" ? "تنفيذ" : st === "partially_delivered" ? "جزئي" : "مكتمل"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* أزرار الإجراءات السريعة داخل المشروع */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          type="button"
          onClick={() => onCreateInvoice("proforma")}
          variant="outline"
          className="h-10 rounded-xl gap-1.5 text-[11px] sm:text-xs font-black border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/10"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">عرض مبدئي</span>
        </Button>
        <Button
          type="button"
          onClick={() => onCreateInvoice("sales")}
          className="h-10 rounded-xl gap-1.5 text-[11px] sm:text-xs font-black"
        >
          <TrendingUp className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">فاتورة مبيعات</span>
        </Button>
        <Button
          type="button"
          onClick={() => onCreateInvoice("purchase")}
          variant="outline"
          className="h-10 rounded-xl gap-1.5 text-[11px] sm:text-xs font-black"
        >
          <ShoppingBag className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">فاتورة شراء</span>
        </Button>
      </div>

      {/* بطاقات KPI المالية */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MetricTile label="المُفوتر للعميل" value={money(summary?.invoicedAmount ?? 0)} />
        <MetricTile
          label="المحصّل فعلاً"
          value={money(summary?.collectedAmount ?? 0)}
          tone={summary && summary.collectedAmount > 0 ? "good" : "neutral"}
        />
        <MetricTile
          label="المتبقي على العميل"
          value={money(summary?.customerOutstanding ?? 0)}
          tone={summary && summary.customerOutstanding > 0 ? "warn" : "neutral"}
        />
        <MetricTile
          label="هامش المشروع"
          value={money(summary?.margin ?? 0)}
          tone="primary"
        />
      </div>

      {/* تفاصيل التكاليف والسيولة */}
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2 shadow-2xs">
        <p className="flex items-center gap-1.5 text-xs font-black text-foreground">
          <Wallet className="h-4 w-4 text-primary" />
          <span>التكاليف والالتزامات والسيولة</span>
        </p>
        <div className="divide-y divide-border/50 text-xs">
          <SummaryRow label="تكاليف التنفيذ المسجّلة" value={money(summary?.directCosts ?? 0)} />
          <SummaryRow label="المدفوع للموردين" value={money(summary?.paidToSuppliers ?? 0)} />
          <SummaryRow
            label="المستحق للموردين"
            value={money(summary?.supplierOutstanding ?? 0)}
            tone={summary && summary.supplierOutstanding > 0 ? "warn" : "muted"}
          />
          <SummaryRow label="صافي النقد (محصّل − مدفوع)" value={money(summary?.netCash ?? 0)} strong />
        </div>

        {summary && summary.isComplete ? (
          <p className="flex items-start gap-1.5 rounded-xl bg-emerald-500/10 p-2.5 text-[10.5px] leading-relaxed text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>كل الجوانب المالية مسجّلة: فاتورة، تحصيل، وتكاليف مسدَّدة.</span>
          </p>
        ) : (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 space-y-1">
            <p className="flex items-center gap-1.5 text-[11px] font-black text-amber-700 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>الأرقام أعلاه غير مكتملة</span>
            </p>
            <ul className="list-disc ps-5 space-y-0.5 text-[10.5px] leading-relaxed text-amber-700 dark:text-amber-300">
              {(summary?.completenessNotes ?? ["لا توجد بيانات مالية بعد."]).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {project?.description && (
        <Section title="وصف المشروع">
          <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {project.description}
          </p>
        </Section>
      )}

      {project?.requestNotes && (
        <Section title="ملاحظات الطلب">
          <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {project.requestNotes}
          </p>
        </Section>
      )}
    </div>
  );
}
