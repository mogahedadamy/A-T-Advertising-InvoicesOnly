import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Edit3 } from "lucide-react";
import type { CustomInvoice } from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import { StandardInvoiceViewer } from "./StandardInvoiceViewer";
import { CustomInvoicePrintButton, CustomInvoiceWhatsAppButton } from "./CustomInvoicePrintButton";

interface Props {
  invoice: CustomInvoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (invoice: CustomInvoice) => void;
}

export function BillingPreviewModal({ invoice, open, onOpenChange, onEdit }: Props) {
  if (!invoice) return null;

  const title = INVOICE_TYPE_LABELS[invoice.meta.type] || "فاتورة";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[98vw] sm:w-[96vw] max-w-4xl h-[94dvh] sm:h-[90dvh] max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-0.5rem)] flex flex-col p-0 rounded-2xl sm:rounded-3xl border-border/60 bg-card shadow-2xl overflow-hidden"
        dir="rtl"
      >
        <DialogHeader className="p-2.5 sm:p-4 pr-3 pl-12 sm:pr-6 sm:pl-16 shrink-0 border-b border-border/50 flex flex-row items-center justify-between text-right bg-card z-10 gap-2">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-xs sm:text-base font-black text-foreground truncate">
              معاينة {title} {invoice.reference || (invoice.meta.serial ? `#${invoice.meta.serial}` : "")}
            </DialogTitle>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1.5">
              <span>{invoice.meta.partyName || invoice.meta.partyEnName || "عميل"}</span>
              <span>•</span>
              <span className="font-mono font-bold text-primary">
                {invoice.currency || invoice.meta.currency || "SDG"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(invoice);
                }}
                className="h-8 px-2 sm:px-3 rounded-xl font-bold text-xs gap-1 cursor-pointer"
                title="تعديل الفاتورة"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تعديل</span>
              </Button>
            )}
            <CustomInvoiceWhatsAppButton
              invoice={invoice}
              size="sm"
            />
            <CustomInvoicePrintButton
              invoice={invoice}
              size="sm"
              className="h-8 px-2.5 sm:px-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs cursor-pointer"
            />
          </div>
        </DialogHeader>

        {/* مساحة العرض المرنة للورقة مع دعم التكبير والتصغير باللمس والسحب */}
        <div className="flex-1 min-h-0 w-full overflow-hidden p-0 relative bg-slate-950/80">
          <StandardInvoiceViewer invoice={invoice} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
