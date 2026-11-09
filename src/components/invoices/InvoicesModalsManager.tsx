import React from "react";
import type { InvoiceRecord } from "@/lib/invoicesStore";
import type { CustomInvoice } from "@/lib/billing/types";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { InvoiceDialog } from "@/components/invoice/InvoiceDialog";
import { BillingPreviewModal } from "@/components/billing/BillingPreviewModal";
import { CustomInvoiceDialog } from "@/components/billing/CustomInvoiceDialog";
import { ProformaDialog } from "@/components/proforma/ProformaDialog";

interface InvoicesModalsManagerProps {
  previewCalcInvoice: InvoiceRecord | null;
  setPreviewCalcInvoice: (inv: InvoiceRecord | null) => void;
  previewCustomInvoice: CustomInvoice | null;
  setPreviewCustomInvoice: (inv: CustomInvoice | null) => void;
  editingCustomInvoice: CustomInvoice | null;
  setEditingCustomInvoice: (inv: CustomInvoice | null) => void;
  previewProformaInvoice: ProformaInvoice | null;
  setPreviewProformaInvoice: (inv: ProformaInvoice | null) => void;
  editingProformaInvoice: ProformaInvoice | null;
  setEditingProformaInvoice: (inv: ProformaInvoice | null) => void;
}

/**
 * مدير نوافذ المعاينة والتعديل والطباعة لسجل الفواتير
 * يدعم الفواتير المخصصة، إيصالات الحاسبة، والفواتير المبدئية المعتمدة A4
 */
export const InvoicesModalsManager: React.FC<InvoicesModalsManagerProps> = ({
  previewCalcInvoice,
  setPreviewCalcInvoice,
  previewCustomInvoice,
  setPreviewCustomInvoice,
  editingCustomInvoice,
  setEditingCustomInvoice,
  previewProformaInvoice,
  setPreviewProformaInvoice,
  editingProformaInvoice,
  setEditingProformaInvoice,
}) => {
  return (
    <>
      {/* 1. نافذة معاينة وطباعة فواتير الحاسبة القياسية A5 */}
      {previewCalcInvoice && (
        <InvoiceDialog
          open={!!previewCalcInvoice}
          onClose={() => setPreviewCalcInvoice(null)}
          lines={previewCalcInvoice.lines}
          initialMeta={{
            serial: previewCalcInvoice.serial,
            date: previewCalcInvoice.date,
            customerName: previewCalcInvoice.customerName,
            phone: previewCalcInvoice.phone,
            branch: previewCalcInvoice.branch,
            shipTo: previewCalcInvoice.shipTo,
            clientTypes: previewCalcInvoice.clientTypes as any,
          }}
        />
      )}

      {/* 2. نافذة معاينة وطباعة فواتير المبيعات والمطالبات Standard Invoice */}
      {previewCustomInvoice && (
        <BillingPreviewModal
          invoice={previewCustomInvoice}
          open={!!previewCustomInvoice}
          onOpenChange={(open) => {
            if (!open) setPreviewCustomInvoice(null);
          }}
          onEdit={(inv) => {
            setPreviewCustomInvoice(null);
            setEditingCustomInvoice(inv);
          }}
        />
      )}

      {/* 3. نافذة تعديل الفاتورة المخصصة مباشرة من السجل */}
      {editingCustomInvoice && (
        <CustomInvoiceDialog
          open={!!editingCustomInvoice}
          onOpenChange={(open) => {
            if (!open) setEditingCustomInvoice(null);
          }}
          initialType={editingCustomInvoice.meta.type || "proforma"}
          invoiceToEdit={editingCustomInvoice}
          onSaved={(saved) => {
            setEditingCustomInvoice(null);
            setPreviewCustomInvoice(saved);
          }}
        />
      )}

      {/* 4. نافذة معاينة وطباعة وتعديل الفاتورة المبدئية Proforma A4 الرسمية */}
      {(previewProformaInvoice || editingProformaInvoice) && (
        <ProformaDialog
          open={!!(previewProformaInvoice || editingProformaInvoice)}
          onClose={() => {
            setPreviewProformaInvoice(null);
            setEditingProformaInvoice(null);
          }}
          existingInvoice={editingProformaInvoice || previewProformaInvoice || undefined}
        />
      )}
    </>
  );
};
