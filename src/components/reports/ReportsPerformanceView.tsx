import React from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";
import type {
  FinancialPerformanceReport,
  IncompleteProjectRow,
} from "@/lib/repositories/ReportsRepository";
import { formatNumber } from "@/lib/printCalculator";
import { cn } from "@/lib/utils";

interface Props {
  performance: FinancialPerformanceReport | null;
  incomplete: IncompleteProjectRow[];
}

export function ReportsPerformanceView({ performance, incomplete }: Props) {
  const money = (val: number | undefined) => `${formatNumber(Number(val) || 0)} ج.س`;

  const rows = [
    { label: "الإيراد المفوتر", value: money(performance?.revenue), tone: "neutral" },
    { label: "تكاليف مباشرة (مشتريات + تنفيذ)", value: money(performance?.directCosts), tone: "neutral" },
    { label: "الهامش الإجمالي", value: money(performance?.grossMargin), tone: "strong" },
    { label: "مصروفات تشغيلية وإدارية", value: money(performance?.operatingExpenses), tone: "neutral" },
    {
      label: "صافي الأرباح",
      value: money(performance?.netProfit),
      tone: Number(performance?.netProfit || 0) >= 0 ? "good" : "danger",
      strong: true,
    },
    { label: "النقد المتاح فعلياً (السيولة)", value: money(performance?.liquidity), tone: "strong" },
    { label: "إجمالي المقبوضات الفعلية", value: money(performance?.receiptsTotal), tone: "good" },
    { label: "إجمالي المدفوعات الفعلية", value: money(performance?.paymentsTotal), tone: "danger" },
  ];

  return (
    <div className="space-y-3.5" dir="rtl">
      {/* بطاقة ملخص الأداء المالي والربحية */}
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-xs sm:text-sm font-black text-foreground">
                الأداء المالي ومؤشرات الربحية
              </h2>
              <p className="text-[10px] text-muted-foreground">
                حساب دقيق يستند إلى السجلات والمقبوضات الفعلية
              </p>
            </div>
          </div>

          <span
            className={cn(
              "rounded-xl px-2.5 py-1 text-xs font-black tabular-nums border",
              Number(performance?.netProfit || 0) >= 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                : "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30"
            )}
          >
            صافي الربح: {money(performance?.netProfit)}
          </span>
        </div>

        {/* شبكة البنود المالية المتناسقة */}
        <div className="divide-y divide-border/50">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between py-2 text-xs">
              <span className="font-semibold text-muted-foreground">{r.label}</span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  r.strong && "font-black text-sm",
                  r.tone === "good" && "text-emerald-600 dark:text-emerald-400",
                  r.tone === "danger" && "text-rose-600 dark:text-rose-400",
                  r.tone === "strong" && "text-foreground",
                  r.tone === "neutral" && "text-foreground"
                )}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* تفاصيل المصروفات التشغيلية */}
      <div className="rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-black text-foreground">
              المصروفات التشغيلية والإدارية التفصيلية
            </h3>
          </div>
          <span className="text-[10px] font-bold text-muted-foreground">
            {performance?.operatingExpenseRows?.length || 0} عملية
          </span>
        </div>

        {!performance?.operatingExpenseRows?.length ? (
          <div className="rounded-xl border border-dashed border-border/70 p-4 text-center">
            <p className="text-xs text-muted-foreground">لا توجد مصروفات تشغيلية مسجلة في هذه الفترة.</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
            {performance.operatingExpenseRows.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-muted/30 p-2 text-xs border border-border/40"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-foreground text-[11px]">
                    {exp.beneficiary || "مصروف عام"}
                  </p>
                  <p className="text-[9.5px] text-muted-foreground">
                    {exp.date} · مسدَّد: {formatNumber(exp.paid)} ج.س
                  </p>
                </div>
                <span className="shrink-0 font-black tabular-nums text-rose-600 dark:text-rose-400">
                  {formatNumber(exp.amount)} ج.س
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* تنبيهات المشاريع ذات الأرقام غير المكتملة */}
      {incomplete.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <h3 className="text-xs font-black">مشاريع تتطلب استكمال بياناتها (PRD §9.6)</h3>
          </div>

          <div className="space-y-2">
            {incomplete.map((row) => (
              <div
                key={row.projectId}
                className="rounded-xl border border-amber-500/20 bg-background/80 p-2.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-foreground">
                    <span className="font-mono text-primary" dir="ltr">
                      {row.reference}
                    </span>{" "}
                    · {row.title}
                  </p>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  متبقي على العميل: {formatNumber(row.customerOutstanding)} ج.س · مستحق للموردين:{" "}
                  {formatNumber(row.supplierOutstanding)} ج.س
                </p>
                <ul className="list-disc pr-4 text-[10px] text-amber-700 dark:text-amber-300">
                  {row.missing.slice(0, 3).map((note, idx) => (
                    <li key={idx}>{note}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
