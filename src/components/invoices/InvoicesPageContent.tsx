import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import type { CustomInvoice } from "@/lib/billing/types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { useUnifiedInvoices } from "./useUnifiedInvoices";
import { InvoicesStatsHeader } from "./InvoicesStatsHeader";
import { InvoicesSearchBar } from "./InvoicesSearchBar";
import { InvoiceRecordCard } from "./InvoiceRecordCard";
import { InvoicesEmptyState } from "./InvoicesEmptyState";
import { InvoicesModalsManager } from "./InvoicesModalsManager";

/**
 * محتوى شاشة سجل وأرشيف الفواتير والمطالبات الشاملة لكافة مصادر النظام
 * تشمل: الفواتير المبدئية Proforma A4 + فواتير المبيعات والمطالبات + إيصالات الحاسبة
 */
export function InvoicesPageContent() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  // الحالات النشطة للنوافذ المنبثقة
  const [previewCalcInvoice, setPreviewCalcInvoice] = useState<InvoiceRecord | null>(null);
  const [previewCustomInvoice, setPreviewCustomInvoice] = useState<CustomInvoice | null>(null);
  const [editingCustomInvoice, setEditingCustomInvoice] = useState<CustomInvoice | null>(null);
  const [previewProformaInvoice, setPreviewProformaInvoice] = useState<ProformaInvoice | null>(null);
  const [editingProformaInvoice, setEditingProformaInvoice] = useState<ProformaInvoice | null>(null);

  // استخدام الخطاف الموحد لإدارة البيانات
  const { filteredRecords, stats } = useUnifiedInvoices(search, filterType);

  return (
    <div className="mx-auto max-w-7xl p-3 space-y-3" dir="rtl">
      {/* 1. الترويسة الرئيسية وزر إنشاء فاتورة جديدة */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3 shadow-xs border-r-4 border-r-primary">
        <div>
          <h2 className="text-base font-black text-foreground">سجل وأرشيف الفواتير والمطالبات</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            سجل موحد ودائم مرتبط بالحاسبة، الفواتير، وعروض الأسعار ({stats.totalCount} فاتورة محفوظة)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/proforma-invoices"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/12 px-3.5 text-xs font-black text-[#C5A059] dark:text-[#E0BC75] shadow-xs transition-all active:scale-95 touch-manipulation hover:bg-[#C5A059]/25 hover:border-[#C5A059]/60"
          >
            <PlusCircle className="h-4 w-4" />
            <span>فاتورة مبدئية</span>
          </Link>
          <Link
            to="/billing"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 transition-all active:scale-95 touch-manipulation hover:bg-primary/90"
          >
            <PlusCircle className="h-4 w-4" />
            <span>فاتورة مبيعات</span>
          </Link>
        </div>
      </div>

      {/* 2. مؤشرات الإجماليات المالية */}
      <InvoicesStatsHeader stats={stats} />

      {/* 3. صندوق البحث والفرز مع شبكة البطاقات */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2.5">
        <InvoicesSearchBar
          search={search}
          setSearch={setSearch}
          filterType={filterType}
          setFilterType={setFilterType}
        />

        {/* شبكة بطاقات الفواتير */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {filteredRecords.length === 0 ? (
            <InvoicesEmptyState />
          ) : (
            filteredRecords.map((item) => (
              <InvoiceRecordCard
                key={`${item.kind}-${item.id}`}
                item={item}
                onPreviewCustom={setPreviewCustomInvoice}
                onPreviewCalc={setPreviewCalcInvoice}
                onPreviewProforma={setPreviewProformaInvoice}
                onEditCustom={setEditingCustomInvoice}
                onEditProforma={setEditingProformaInvoice}
              />
            ))
          )}
        </div>
      </div>

      {/* 4. مدير النوافذ المنبثقة والمعاينة والطباعة */}
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
    </div>
  );
}
