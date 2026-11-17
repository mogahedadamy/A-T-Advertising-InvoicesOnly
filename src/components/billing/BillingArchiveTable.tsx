import React, { useState, useMemo } from "react";
import {
  Search,
  Printer,
  Edit2,
  Trash2,
  Copy,
  Eye,
  FileText,
  TrendingUp,
  ShoppingBag,
  Calculator,
  Receipt,
  ArrowLeftRight,
  Share2,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomInvoice, CustomInvoiceType } from "@/lib/billing/types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import {
  convertProformaToSalesInvoice,
  deleteCustomInvoice,
  saveCustomInvoice,
} from "@/lib/billing/store";
import { deleteProformaInvoice } from "@/lib/proforma/store";
import { deleteInvoice } from "@/lib/invoicesStore";
import { formatAccountingNumber } from "./StandardInvoiceDocument";
import {
  printCustomInvoiceDocument,
  shareCustomInvoiceViaWhatsApp,
} from "./CustomInvoicePrintButton";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedInvoices } from "@/components/invoices/useUnifiedInvoices";
import { settlementFor, useSettlementVersion } from "@/lib/financeStore";
import type { UnifiedInvoiceRecord } from "@/components/invoices/types";

interface Props {
  invoices?: CustomInvoice[];
  onEditCustom: (invoice: CustomInvoice) => void;
  onPreviewCustom: (invoice: CustomInvoice) => void;
  onEditProforma?: (invoice: ProformaInvoice) => void;
  onPreviewProforma?: (invoice: ProformaInvoice) => void;
  onRecordPayment?: (invoiceId: string) => void;
  onPreviewCalc?: (invoice: InvoiceRecord) => void;
  onCreateNew?: (type: CustomInvoiceType) => void;
}

export function BillingArchiveTable({
  onEditCustom,
  onPreviewCustom,
  onEditProforma,
  onPreviewProforma,
  onRecordPayment,
  onPreviewCalc,
  onCreateNew,
}: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const handleConvertProformaToSales = async (rec: UnifiedInvoiceRecord) => {
    if (convertingId) return;
    if (!(rec.kind === "proforma" || (rec.kind === "custom" && rec.type === "proforma"))) return;
    setConvertingId(rec.id);
    try {
      const { salesInvoice, alreadyConverted } = await convertProformaToSalesInvoice(
        rec.raw as CustomInvoice | ProformaInvoice
      );
      toast({
        title: alreadyConverted ? "العرض محوَّل مسبقاً" : "تم التحويل إلى فاتورة مبيعات",
        description: `فاتورة المبيعات ${salesInvoice.reference || "—"} محفوظة في سجل المبيعات.`,
      });
    } catch (err) {
      toast({
        title: "تعذّر التحويل إلى فاتورة مبيعات",
        description: err instanceof Error ? err.message : "خطأ غير متوقع.",
        variant: "destructive",
      });
    } finally {
      setConvertingId(null);
    }
  };

  useSettlementVersion();
  const { filteredRecords } = useUnifiedInvoices(search, selectedType);

  const handleDelete = async (rec: UnifiedInvoiceRecord) => {
    if (!confirm(`هل أنت متأكد من حذف ${rec.typeLabel} #${rec.serial} لـ ${rec.customerName}؟`)) return;
    try {
      if (rec.kind === "proforma") await deleteProformaInvoice(rec.id);
      else if (rec.kind === "custom") await deleteCustomInvoice(rec.id);
      else if (rec.kind === "calculator") deleteInvoice(rec.id);
      toast({ title: "تم الحذف", description: `تم حذف ${rec.typeLabel} #${rec.serial} بنجاح` });
    } catch (err) {
      toast({ title: "تعذّر الحذف", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    }
  };

  const handleDuplicate = async (rec: UnifiedInvoiceRecord) => {
    if (rec.kind !== "custom") {
      toast({ title: "تنبيه", description: "يمكن تكرار فواتير المبيعات والمشتريات السريعة مباشرة من هنا" });
      return;
    }
    const inv = rec.raw as CustomInvoice;
    const duplicated: CustomInvoice = {
      ...inv,
      id: `custom-inv-${Date.now()}`,
      reference: undefined,
      referenceAssignedAt: undefined,
      meta: { ...inv.meta, partyName: `${inv.meta.partyName} (نسخة)`, date: new Date().toISOString().split("T")[0] },
      items: (inv.items || []).map((item, index) => ({
        ...item,
        id: `dup-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      const saved = await saveCustomInvoice(duplicated);
      toast({ title: "تم تكرار الفاتورة", description: `تم إنشاء نسخة جديدة بالمرجع ${saved.reference || "—"}` });
    } catch (err) {
      toast({ title: "تعذّر تكرار الفاتورة", description: err instanceof Error ? err.message : "خطأ غير متوقع.", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-border/60 bg-card/80 backdrop-blur-md shadow-md overflow-hidden w-full max-w-full" dir="rtl">
      {/* شريط البحث والفلترة */}
      <div className="p-3.5 sm:p-5 border-b border-border/50 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
        {/* التبويبات الفئوية لكافة أنواع فواتير النظام */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 rounded-2xl bg-muted/60 w-full md:w-auto overflow-x-auto no-scrollbar scroll-smooth flex-nowrap shrink-0">
          {(
            [
              { id: "all", label: "كافة الفواتير" },
              { id: "sales", label: "فواتير مبيعات" },
              { id: "proforma", label: "فواتير مبدئية" },
              { id: "purchase", label: "فواتير مشتريات" },
            ] as const
          ).map((tab) => {
            const active = selectedType === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedType(tab.id)}
                className={`shrink-0 whitespace-nowrap px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-black transition-all touch-manipulation active:scale-95 ${
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* حقل البحث بالاسم والرقم */}
        <div className="relative w-full md:w-72">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث باسم العميل، الرقم، أو البنود..."
            className="h-10 pr-10 pl-3 rounded-2xl text-xs font-bold bg-background border-border/60 text-right"
            dir="rtl"
          />
        </div>
      </div>

      {/* جدول البيانات الموحد لكافة فواتير النظام */}
      <div className="overflow-x-auto w-full max-w-full touch-pan-x">
        <table className="w-full text-right text-xs min-w-[680px]">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground font-black border-b border-border/50 h-11">
              <th className="py-2 px-4 text-center w-16">الرقم</th>
              <th className="py-2 px-4">نوع الفاتورة</th>
              <th className="py-2 px-4">العميل / الجهة</th>
              <th className="py-2 px-4 text-center">التاريخ</th>
              <th className="py-2 px-4">البنود</th>
              <th className="py-2 px-4 text-left">إجمالي القيمة</th>
              <th className="py-2 px-4 text-center w-40">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <FileText className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm font-bold text-foreground">لا توجد فواتير مطابقة للبحث</p>
                    <p className="text-xs text-muted-foreground">
                      كافة الفواتير الصادرة والمحفوظة في النظام ستظهر هنا تلقائياً
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => {
                const isCustom = rec.kind === "custom";
                const isProforma = rec.kind === "proforma";
                const isCalc = rec.kind === "calculator";
                // المدفوع والمتبقي مشتقان من الدفعات الفعلية، لا من حقل مخزّن
                const settlement = settlementFor(rec.id, Number(rec.total) || 0);

                return (
                  <tr
                    key={`${rec.kind}-${rec.id}`}
                    className="hover:bg-muted/30 transition-colors h-14 group text-foreground font-bold"
                  >
                    {/* رقم الفاتورة / المرجع الرسمي */}
                    <td className="py-2 px-4 text-center font-mono font-black text-primary whitespace-nowrap" dir="ltr">
                      {/^(INV|PINV|PRJ|RCV|PAY)-/.test(rec.serial) ? rec.serial : `#${rec.serial}`}
                    </td>

                    {/* نوع الفاتورة */}
                    <td className="py-2 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border ${rec.badgeColor}`}>
                        {isProforma && <FileText className="h-3 w-3" />}
                        {isCustom && rec.type === "sales" && <TrendingUp className="h-3 w-3" />}
                        {isCustom && rec.type === "purchase" && <ShoppingBag className="h-3 w-3" />}
                        {isCalc && <Calculator className="h-3 w-3" />}
                        <span>{rec.typeLabel}</span>
                      </span>
                    </td>

                    {/* اسم العميل */}
                    <td className="py-2 px-4 font-black text-sm text-foreground">
                      {rec.customerName}
                    </td>

                    {/* التاريخ */}
                    <td className="py-2 px-4 text-center font-mono text-muted-foreground">
                      {rec.date}
                    </td>

                    {/* ملخص البنود */}
                    <td className="py-2 px-4 max-w-xs truncate text-muted-foreground">
                      {rec.itemsCount > 0 ? `${rec.itemsCount} بند مسجل` : "تفاصيل عامة"}
                    </td>

                    {/* إجمالي القيمة والمتبقي المشتق من الدفعات الفعلية */}
                    <td className="py-2 px-4 text-left font-mono text-sm">
                      <span className="font-black text-foreground">
                        {formatAccountingNumber(rec.total)}{" "}
                        <span className="text-[10px] font-mono font-bold text-muted-foreground uppercase">{rec.currency || "SDG"}</span>
                      </span>
                      {isCustom && rec.type === "sales" && (
                        <span
                          className={`mt-0.5 block text-[10px] font-sans font-bold ${
                            settlement.outstanding > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {settlement.outstanding > 0 ? `متبقي ${formatAccountingNumber(settlement.outstanding)}` : "مسدَّدة"}
                        </span>
                      )}
                    </td>

                    {/* أزرار الإجراءات */}
                    <td className="py-2 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {/* تسجيل دفعة مباشرة من سياق الفاتورة (PRD §7.3) */}
                        {isCustom && rec.type === "sales" && settlement.outstanding > 0 && onRecordPayment && (
                          <button
                            type="button"
                            onClick={() => onRecordPayment(rec.id)}
                            title="تسجيل دفعة"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-emerald-600 hover:bg-emerald-500/10 transition-colors active:scale-90"
                          >
                            <Receipt className="h-4 w-4" />
                          </button>
                        )}
                        {/* تحويل الفاتورة المبدئية / عرض السعر مباشرة إلى فاتورة مبيعات */}
                        {(isProforma || (isCustom && rec.type === "proforma")) && (
                          <button
                            type="button"
                            disabled={convertingId === rec.id}
                            onClick={() => void handleConvertProformaToSales(rec)}
                            title="تحويل إلى فاتورة مبيعات"
                            className="h-8 px-2 rounded-lg inline-flex items-center gap-1 text-[10.5px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors active:scale-95 disabled:opacity-50"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            <span>لمبيعات</span>
                          </button>
                        )}
                        {/* زر المعاينة */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isProforma && onPreviewProforma) onPreviewProforma(rec.raw);
                            else if (isCustom) onPreviewCustom(rec.raw);
                            else if (isCalc && onPreviewCalc) onPreviewCalc(rec.raw);
                          }}
                          title="معاينة المستند"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-90"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        {/* زر الطباعة المباشرة */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isProforma && onPreviewProforma) onPreviewProforma(rec.raw);
                            else if (isCustom) printCustomInvoiceDocument(rec.raw);
                            else if (isCalc && onPreviewCalc) onPreviewCalc(rec.raw);
                          }}
                          title="طباعة سريعة / PDF"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors active:scale-90"
                        >
                          <Printer className="h-4 w-4" />
                        </button>

                        {/* زر مشاركة واتساب مباشرة مع مؤشر تحميل تفاعلي */}
                        {isCustom && (
                          <button
                            type="button"
                            disabled={sharingId === rec.id}
                            onClick={async () => {
                              if (sharingId) return;
                              setSharingId(rec.id);
                              try {
                                await shareCustomInvoiceViaWhatsApp(rec.raw);
                              } finally {
                                setSharingId(null);
                              }
                            }}
                            title="مشاركة الفاتورة عبر واتساب"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-[#25D366] hover:bg-[#25D366]/10 transition-colors active:scale-90 disabled:opacity-60"
                          >
                            {sharingId === rec.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#25D366]" />
                            ) : (
                              <Share2 className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        {/* زر التعديل */}
                        {(isCustom || isProforma) && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isProforma && onEditProforma) onEditProforma(rec.raw);
                              else if (isCustom) onEditCustom(rec.raw);
                            }}
                            title="تعديل الفاتورة"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 transition-colors active:scale-90"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}

                        {/* زر التكرار (للفواتير المخصصة) */}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => handleDuplicate(rec)}
                            title="نسخ وتكرار الفاتورة"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors active:scale-90"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}

                        {/* زر الحذف */}
                        <button
                          type="button"
                          onClick={() => handleDelete(rec)}
                          title="حذف الفاتورة"
                          className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors active:scale-90"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
