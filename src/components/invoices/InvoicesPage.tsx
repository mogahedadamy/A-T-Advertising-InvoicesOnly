import { PageShell } from "@/components/layout/PageShell";
import { InvoicesPageContent } from "./InvoicesPageContent";

export function InvoicesPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-7xl p-3 sm:p-4">
        <InvoicesPageContent />
      </div>
    </PageShell>
  );
}
