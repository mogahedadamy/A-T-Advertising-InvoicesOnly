import { FileText, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceType } from "@/lib/billing/types";
import type { LinkedDocumentSummary, ProjectRelations } from "@/lib/repositories/ProjectRepository";
import { DocumentList } from "./ProjectDetailShared";

interface ProjectInvoicesTabProps {
  relations: ProjectRelations | null;
  onCreateInvoice: (type: CustomInvoiceType) => void;
  onOpenLinkedInvoice: (docId: string, fallbackType: CustomInvoiceType) => void;
}

export function ProjectInvoicesTab({
  relations,
  onCreateInvoice,
  onOpenLinkedInvoice,
}: ProjectInvoicesTabProps) {
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          onClick={() => onCreateInvoice("sales")}
          className="h-10 rounded-xl gap-1.5 text-xs font-black"
        >
          <Plus className="h-4 w-4" />
          <span>فاتورة مبيعات جديدة</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onCreateInvoice("purchase")}
          className="h-10 rounded-xl gap-1.5 text-xs font-black"
        >
          <Plus className="h-4 w-4" />
          <span>فاتورة مشتريات جديدة</span>
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black text-foreground flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span>فواتير المبيعات ({relations?.salesInvoices.length ?? 0})</span>
        </p>
        <DocumentList
          items={relations?.salesInvoices ?? []}
          emptyLabel="لا توجد فواتير مبيعات مرتبطة بهذا المشروع بعد. يمكنك إصدار فاتورة جديدة أو تحويل عرض مبدئي من تبويب «العروض»."
          icon={<Wallet className="h-4 w-4 text-primary" />}
          onItemClick={(item) => void onOpenLinkedInvoice(item.id, "sales")}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black text-foreground flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-amber-600" />
          <span>فواتير المشتريات المرتبطة ({relations?.purchaseInvoices.length ?? 0})</span>
        </p>
        <DocumentList
          items={relations?.purchaseInvoices ?? []}
          emptyLabel="لا توجد فواتير مشتريات مرتبطة بهذا المشروع بعد."
          icon={<FileText className="h-4 w-4 text-amber-600" />}
          onItemClick={(item) => void onOpenLinkedInvoice(item.id, "purchase")}
        />
      </div>
    </div>
  );
}
