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
  FileDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CustomInvoice, CustomInvoiceType } from "@/lib/billing/types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import { deleteCustomInvoice, saveCustomInvoice } from "@/lib/billing/store";
import { deleteProformaInvoice } from "@/lib/proforma/store";
import { deleteInvoice } from "@/lib/invoicesStore";
import { formatAccountingNumber } from "./StandardInvoiceDocument";
import { printCustomInvoiceDocument, saveCustomInvoiceAsPdf } from "./CustomInvoicePrintButton";
import { useToast } from "@/hooks/use-toast";
import { useUnifiedInvoices } from "@/components/invoices/useUnifiedInvoices";
import type { UnifiedInvoiceRecord } from "@/components/invoices/types";

interface Props {
  invoices?: CustomInvoice[];
  onEditCustom: (invoice: CustomInvoice) => void;
  onPreviewCustom: (invoice: CustomInvoice) => void;
  onEditProforma?: (invoice: ProformaInvoice) => void;
  onPreviewProforma?: (invoice: ProformaInvoice) => void;
  onPreviewCalc?: (invoice: InvoiceRecord) => void;
  onCreateNew?: (type: CustomInvoiceType) => void;
}

export function BillingArchiveTable({
  onEditCustom,
  onPreviewCustom,
  onEditProforma,
  onPreviewProforma,
  onPreviewCalc,
  onCreateNew,
}: Props) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  // جلب كافة الفواتير الموحدة من محرك السجل الشامل
  const { filteredRecords } = useUnifiedInvoices(search, selectedType);

  const handleDelete = (rec: UnifiedInvoiceRecord) => {
    if (confirm(`هل أنت متأكد من حذف ${rec.typeLabel} #${rec.serial} لـ ${rec.customerName}؟`)) {
      if (rec.kind === "proforma") {
        deleteProformaInvoice(rec.id);
      } else if (rec.kind === "custom") {
        deleteCustomInvoice(rec.id);
      } else if (rec.kind === "calculator") {
        deleteInvoice(rec.id);
      }
      toast({
        title: "تم الحذف",
        description: `تم حذف ${rec.typeLabel} #${rec.serial} بنجاح`,
      });
    }
  };

  const handleDuplicate = (rec: UnifiedInvoiceRecord) => {
    if (rec.kind === "custom") {
      const inv = rec.raw as CustomInvoice;
      const nextSerial = String(Date.now()).slice(-3);
      const duplicated: CustomInvoice = {
        ...inv,
        id: `custom-inv-${Date.now()}`,
        meta: {
          ...inv.meta,
          serial: nextSerial,
          partyName: `${inv.meta.partyName} (نسخة)`,
          date: new Date().toISOString().split("T")[0],
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveCustomInvoice(duplicated);
      toast({
        title: "تم تكرار الفاتورة",
        description: `تم إنشاء نسخة جديدة برقم #${nextSerial}`,
      });
    } else {
      toast({
        title: "تنبيه",
        description: "يمكن تكرار فواتير المبيعات والمشتريات السريعة مباشرة من هنا",
      });
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
              { id: "proforma", label: "فواتير مبدئية Proforma" },
              { id: "purchase", label: "فواتير مشتريات" },
              { id: "calculator", label: "إيصالات حاسبة A5" },
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
                      كافة الفواتير الصادرة من الحاسبة أو النماذج ستظهر هنا تلقائياً
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredRecords.map((rec) => {
                const isCustom = rec.kind === "custom";
                const isProforma = rec.kind === "proforma";
                const isCalc = rec.kind === "calculator";

                return (
                  <tr
                    key={`${rec.kind}-${rec.id}`}
                    className="hover:bg-muted/30 transition-colors h-14 group text-foreground font-bold"
                  >
                    {/* رقم الفاتورة */}
                    <td className="py-2 px-4 text-center font-mono font-black text-primary">
                      #{rec.serial}
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

                    {/* إجمالي القيمة */}
                    <td className="py-2 px-4 text-left font-mono font-black text-sm text-foreground">
                      {formatAccountingNumber(rec.total)}{" "}
                      <span className="text-[10px] font-sans font-bold text-muted-foreground">ج.س</span>
                    </td>

                    {/* أزرار الإجراءات */}
                    <td className="py-2 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
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

                        {/* زر حفظ ملف PDF أصلي */}
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => saveCustomInvoiceAsPdf(rec.raw)}
                            title="حفظ ملف PDF أصلي"
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors active:scale-90"
                          >
                            <FileDown className="h-4 w-4" />
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
