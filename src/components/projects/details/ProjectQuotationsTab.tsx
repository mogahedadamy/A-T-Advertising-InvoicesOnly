import { ArrowLeftRight, CheckCircle2, FileSpreadsheet, Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceType } from "@/lib/billing/types";
import type { LinkedDocumentSummary, ProjectRelations } from "@/lib/repositories/ProjectRepository";
import { money } from "./detailsTypes";

interface ProjectQuotationsTabProps {
  relations: ProjectRelations | null;
  convertingQuoteId: string | null;
  onCreateInvoice: (type: CustomInvoiceType) => void;
  onOpenLinkedInvoice: (docId: string, fallbackType: CustomInvoiceType) => void;
  onConvertQuotation: (item: LinkedDocumentSummary) => void;
}

export function ProjectQuotationsTab({
  relations,
  convertingQuoteId,
  onCreateInvoice,
  onOpenLinkedInvoice,
  onConvertQuotation,
}: ProjectQuotationsTabProps) {
  const quotations = relations?.quotations ?? [];

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => onCreateInvoice("proforma")}
        className="h-10 w-full rounded-xl gap-2 text-xs font-black border-[#C5A059]/40 text-[#C5A059] hover:bg-[#C5A059]/10"
      >
        <Plus className="h-4 w-4" />
        <span>إصدار فاتورة مبدئية (عرض سعر) لهذا المشروع</span>
      </Button>

      {quotations.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center space-y-1">
          <FileSpreadsheet className="h-7 w-7 mx-auto text-muted-foreground/70" />
          <p className="text-xs font-bold text-foreground">لا توجد فواتير مبدئية بعد</p>
          <p className="text-[11px] text-muted-foreground">
            أصدر عرض سعر مبدئي هنا وعند موافقة العميل حوّله بنقرة واحدة إلى فاتورة مبيعات.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {quotations.map((item) => {
            const isConverting = convertingQuoteId === item.id;
            const isConverted = Boolean(item.convertedSalesId);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-2.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C5A059]/12 text-[#C5A059] border border-[#C5A059]/25">
                      <FileSpreadsheet className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs font-black text-foreground">
                          <bdi dir="ltr">{item.reference || "—"}</bdi>
                        </span>
                        <span className="rounded-full bg-[#C5A059]/10 border border-[#C5A059]/30 px-2 py-0.5 text-[10px] font-black text-[#C5A059]">
                          {item.label}
                        </span>
                        {isConverted && (
                          <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            محوَّلة ← <bdi dir="ltr">{item.convertedSalesReference || "مبيعات"}</bdi>
                          </span>
                        )}
                      </div>
                      <p className="text-[10.5px] font-bold text-muted-foreground">
                        التاريخ: <bdi dir="ltr" className="font-mono">{item.date || "—"}</bdi>
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-sm font-black tabular-nums text-foreground">
                    {money(item.total)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                  {isConverted && item.convertedSalesId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onOpenLinkedInvoice(item.convertedSalesId!, "sales")}
                      className="h-9 flex-1 rounded-xl gap-1.5 text-xs font-black border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>فتح فاتورة المبيعات المحوَّلة</span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isConverting}
                      onClick={() => void onConvertQuotation(item)}
                      className="h-9 flex-1 rounded-xl gap-1.5 text-xs font-black bg-primary hover:bg-primary/90 text-white shadow-xs"
                    >
                      {isConverting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      )}
                      <span>تحويل إلى فاتورة مبيعات</span>
                    </Button>
                  )}

                  {item.label === "فاتورة مبدئية" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void onOpenLinkedInvoice(item.id, "proforma")}
                      className="h-9 rounded-xl gap-1.5 px-3 text-xs font-bold"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>تعديل ومعاينة</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
