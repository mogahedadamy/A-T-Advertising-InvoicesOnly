import React, { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { BillingCards } from "./BillingCards";
import { BillingArchiveTable } from "./BillingArchiveTable";
import { CustomInvoiceDialog } from "./CustomInvoiceDialog";
import { CustomInvoicePrintPortal } from "./CustomInvoicePrintButton";
import { useCustomInvoices } from "@/lib/billing/store";
import type { CustomInvoice, CustomInvoiceType } from "@/lib/billing/types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import { InvoicesModalsManager } from "@/components/invoices/InvoicesModalsManager";
import { ProformaDialog } from "@/components/proforma/ProformaDialog";
import { useUnifiedInvoices } from "@/components/invoices/useUnifiedInvoices";
import { Receipt, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BillingPage() {
  const invoices = useCustomInvoices();
  const { stats } = useUnifiedInvoices();

  // نوافذ إنشاء وتعديل الفواتير المخصصة (مبيعات / مشتريات)
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<CustomInvoiceType>("sales");
  const [editingCustomInvoice, setEditingCustomInvoice] = useState<CustomInvoice | null>(null);

  // نافذة إنشاء فاتورة مبدئية جديدة
  const [newProformaOpen, setNewProformaOpen] = useState(false);

  // حالات المعاينة والتعديل عبر InvoicesModalsManager لجميع الأنواع
  const [previewCalcInvoice, setPreviewCalcInvoice] = useState<InvoiceRecord | null>(null);
  const [previewCustomInvoice, setPreviewCustomInvoice] = useState<CustomInvoice | null>(null);
  const [previewProformaInvoice, setPreviewProformaInvoice] = useState<ProformaInvoice | null>(null);
  const [editingProformaInvoice, setEditingProformaInvoice] = useState<ProformaInvoice | null>(null);

  const handleOpenCreate = (type: CustomInvoiceType) => {
    if (type === "proforma") {
      setNewProformaOpen(true);
    } else {
      setEditingCustomInvoice(null);
      setDialogType(type);
      setCustomDialogOpen(true);
    }
  };

  return (
    <PageShell>
      <main
        className="w-full flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 scroll-smooth touch-pan-y pb-24 md:pb-10"
        dir="rtl"
      >
        <div className="mx-auto max-w-7xl space-y-3 sm:space-y-4 w-full max-w-full">
          {/* شريط رأس قسم الفواتير التنفيذي المدمج (بدون مساحات مهدورة) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card/90 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl border border-border/70 shadow-2xs border-r-4 border-r-primary">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Receipt className="h-4 w-4" />
                </span>
                <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                  مركز الفواتير والمطالبات المالية
                </h1>
                <span className="text-[11px] font-mono font-black text-primary px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 tabular-nums shrink-0">
                  {stats.totalCount} فاتورة
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground font-medium mt-1">
                إصدار وإدارة فواتير المبيعات، المشتريات، والعروض المبدئية مباشرة بنموذج A4 الرسمي المعتمد
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={() => handleOpenCreate("sales")}
                className="h-9 px-4 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30 active:scale-[0.98] transition-all w-full sm:w-auto justify-center"
              >
                <Plus className="h-4 w-4" />
                <span>إصدار فاتورة بيع جديدة</span>
              </Button>
            </div>
          </div>

          {/* بطاقات الإجراءات السريعة المدمجة والإحصائيات المباشرة (Action Hub) */}
          <BillingCards invoices={invoices} onCreateClick={handleOpenCreate} />

          {/* جدول الأرشيف والسجل الكامل المرتبط بنظام الفواتير الشامل */}
          <div className="space-y-2 pt-1">
            <BillingArchiveTable
              invoices={invoices}
              onEditCustom={(inv) => {
                setEditingCustomInvoice(inv);
                setDialogType(inv.meta.type);
                setCustomDialogOpen(true);
              }}
              onPreviewCustom={(inv) => setPreviewCustomInvoice(inv)}
              onEditProforma={(proforma) => setEditingProformaInvoice(proforma)}
              onPreviewProforma={(proforma) => setPreviewProformaInvoice(proforma)}
              onPreviewCalc={(calc) => setPreviewCalcInvoice(calc)}
              onCreateNew={handleOpenCreate}
            />
          </div>

          {/* نافذة إنشاء وتعديل الفاتورة المخصصة (مبيعات ومشتريات) */}
          <CustomInvoiceDialog
            open={customDialogOpen}
            onOpenChange={setCustomDialogOpen}
            initialType={dialogType}
            invoiceToEdit={editingCustomInvoice}
            onSaved={(saved) => {
              setCustomDialogOpen(false);
              setPreviewCustomInvoice(saved);
            }}
          />

          {/* نافذة إصدار فاتورة مبدئية جديدة */}
          {newProformaOpen && (
            <ProformaDialog
              open={newProformaOpen}
              onClose={() => setNewProformaOpen(false)}
            />
          )}

          {/* مدير النوافذ المنبثقة الموحد للمعاينة والطباعة والتعديل */}
          <InvoicesModalsManager
            previewCalcInvoice={previewCalcInvoice}
            setPreviewCalcInvoice={setPreviewCalcInvoice}
            previewCustomInvoice={previewCustomInvoice}
            setPreviewCustomInvoice={setPreviewCustomInvoice}
            editingCustomInvoice={editingCustomInvoice}
            setEditingCustomInvoice={setEditingCustomInvoice}
            previewProformaInvoice={previewProformaInvoice}
            setPreviewProformaInvoice={setPreviewProformaInvoice}
            editingProformaInvoice={editingProformaInvoice}
            setEditingProformaInvoice={setEditingProformaInvoice}
          />

          {/* بورتال الطباعة المعزول مباشرة إلى document.body عند استدعاء window.print() */}
          <CustomInvoicePrintPortal />
        </div>
      </main>
    </PageShell>
  );
}
