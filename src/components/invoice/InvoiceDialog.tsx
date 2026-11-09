import { createPortal } from "react-dom";
import { InvoiceForm } from "./InvoiceForm";
import { InvoiceViewer } from "./InvoiceViewer";
import { InvoiceDocument } from "./InvoiceDocument";
import { InvoiceDialogHeader } from "./InvoiceDialogHeader";
import { InvoiceDialogTabs } from "./InvoiceDialogTabs";
import { InvoiceDialogFooter } from "./InvoiceDialogFooter";
import { useInvoiceDialogLifecycle } from "./useInvoiceDialogLifecycle";
import type { InvoiceLine, InvoiceMeta } from "@/lib/invoice/types";

interface Props {
  open: boolean;
  onClose: () => void;
  lines: InvoiceLine[];
  initialMeta?: InvoiceMeta;
}

/**
 * شاشة إصدار ومعاينة الفاتورة القياسية A5:
 * تم إعادة هيكلتها وتقسيمها معمارياً لتفصل:
 * 1. دورة الحياة والطباعة والتسجيل: useInvoiceDialogLifecycle
 * 2. ترويسة الفاتورة والإغلاق: InvoiceDialogHeader
 * 3. تبويب التبديل السريع للموبايل: InvoiceDialogTabs
 * 4. تذييل الإجراءات والطباعة: InvoiceDialogFooter
 * 5. نموذج البيانات: InvoiceForm
 * 6. عارض المعاينة والتكبير: InvoiceViewer
 */
export function InvoiceDialog({ open, onClose, lines, initialMeta }: Props) {
  const {
    tab,
    setTab,
    saved,
    meta,
    setMeta,
    invoice,
    recordInvoiceAndOrder,
  } = useInvoiceDialogLifecycle({ open, onClose, lines, initialMeta });

  if (!open) return null;

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="إصدار فاتورة"
        className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] md:items-center md:justify-center md:bg-black/75 md:p-4"
        dir="rtl"
      >
        <div className="flex h-full w-full flex-col bg-card md:h-[92vh] md:max-h-[880px] md:max-w-6xl lg:max-w-7xl md:rounded-3xl md:border md:border-border/80 md:shadow-2xl overflow-hidden">
          {/* 1. ترويسة الفاتورة */}
          <InvoiceDialogHeader
            serial={meta.serial}
            saved={saved}
            onClose={onClose}
          />

          {/* 2. تبويب التبديل للموبايل */}
          <InvoiceDialogTabs tab={tab} setTab={setTab} />

          {/* 3. جسم المحتوى (النموذج + المعاينة الحية) */}
          <main className="min-h-0 flex-1 overflow-hidden p-0 md:grid md:grid-cols-12">
            {/* عمود نموذج الإدخال */}
            <div
              className={`h-full overflow-y-auto p-3.5 md:col-span-5 md:border-l md:border-border/70 ${
                tab === "edit" ? "block" : "hidden md:block"
              }`}
            >
              <div className="space-y-3">
                <InvoiceForm meta={meta} onChange={setMeta} lines={lines} />
              </div>
            </div>

            {/* عمود المعاينة الحية A5 */}
            <div
              className={`h-full min-h-0 bg-slate-950 p-1 md:p-3 md:col-span-7 flex flex-col ${
                tab === "preview" ? "block" : "hidden md:flex"
              }`}
            >
              <div className="flex-1 min-h-0 rounded-xl overflow-hidden">
                <InvoiceViewer invoice={invoice} isVisible={tab === "preview"} />
              </div>
            </div>
          </main>

          {/* 4. تذييل الأزرار والإجراءات */}
          <InvoiceDialogFooter
            tab={tab}
            setTab={setTab}
            saved={saved}
            serial={meta.serial}
            onRecord={recordInvoiceAndOrder}
            onClose={onClose}
          />
        </div>
      </div>

      {/* بوابة الطباعة الفيزيائية المخفية للمتصفح والأندرويد */}
      {createPortal(
        <div className="invoice-print-root">
          <InvoiceDocument invoice={invoice} isPrintMode={true} />
        </div>,
        document.body
      )}
    </>
  );
}
