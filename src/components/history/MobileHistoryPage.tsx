import { PageShell } from "@/components/layout/PageShell";
import { InvoicesPageContent } from "@/components/invoices/InvoicesPageContent";

/**
 * شاشة أرشيف الفواتير والمطالبات (نسخة الفواتير والحاسبة المعتمدة):
 * مخصصة حصرياً لأرشيف الفواتير والمطالبات (مبيعات، مبدئية، مشتريات)
 * بدون أي أقسام أو تبويبات لأوامر التشغيل والورشة.
 */
export function MobileHistoryPage() {
  return (
    <PageShell>
      <div className="flex flex-1 flex-col overflow-hidden bg-background" dir="rtl">
        <div className="flex-1 overflow-y-auto">
          <InvoicesPageContent />
        </div>
      </div>
    </PageShell>
  );
}

export default MobileHistoryPage;
