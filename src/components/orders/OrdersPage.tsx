import { PageShell } from "@/components/layout/PageShell";
import { OrdersPageContent } from "./OrdersPageContent";

export function OrdersPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-7xl p-3 sm:p-4">
        <OrdersPageContent />
      </div>
    </PageShell>
  );
}
