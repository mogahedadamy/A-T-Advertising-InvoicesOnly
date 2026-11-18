import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { refreshProjectsFromDb } from "@/lib/projectsStore";
import { playTapSound } from "@/lib/soundEffects";
import { CustomInvoiceDialog } from "@/components/billing/CustomInvoiceDialog";
import { ReceiptDialog } from "@/components/finance/ReceiptDialog";
import { ProjectFormDialog } from "./ProjectFormDialog";
import { useProjectDetails } from "./details/useProjectDetails";
import { ProjectHeaderBanner } from "./details/ProjectHeaderBanner";
import { ProjectFinancialTracer } from "./details/ProjectFinancialTracer";
import { ProjectInvoicesTab } from "./details/ProjectInvoicesTab";
import { ProjectQuotationsTab } from "./details/ProjectQuotationsTab";
import { ProjectExecutionTab } from "./details/ProjectExecutionTab";
import type { Project } from "@/lib/domain/projects";

interface Props {
  projectId: string | null;
  onOpenChange: (open: boolean) => void;
  initialProject?: Project | null;
}

/**
 * مساحة عمل المشروع (PRD §4.3): واجهة عربية RTL كاملة تضم
 * الملخص المالي الفوري، الفواتير، عروض الأسعار (مع التحويل المباشر لفاتورة مبيعات)، وحالة التنفيذ.
 * تم تفكيك المكون المعماري إلى وحدات فرعية نظيفة (< 250 سطر) تحت مجلد details/.
 */
export function ProjectDetailsDialog({ projectId, onOpenChange, initialProject }: Props) {
  const { toast } = useToast();
  const {
    project,
    relations,
    summary,
    loading,
    error,
    activeTab,
    setActiveTab,
    editOpen,
    setEditOpen,
    invoiceOpen,
    setInvoiceOpen,
    invoiceDialogType,
    editingInvoice,
    setEditingInvoice,
    convertingQuoteId,
    receiptDialogOpen,
    setReceiptDialogOpen,
    customerName,
    derivedFinancialStatus,
    load,
    openCreateInvoice,
    openLinkedCustomInvoice,
    handleConvertQuotationToSales,
    handleCancelProject,
    handleQuickExecutionChange,
  } = useProjectDetails(projectId, onOpenChange, initialProject);

  return (
    <>
      <Dialog open={Boolean(projectId)} onOpenChange={onOpenChange}>
        <DialogContent
          dir="rtl"
          className="w-full sm:max-w-3xl h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-none sm:rounded-3xl border-border/80 bg-background"
        >
          <ProjectHeaderBanner
            project={project}
            customerName={customerName}
            derivedFinancialStatus={derivedFinancialStatus}
            onEditClick={() => setEditOpen(true)}
            onCancelClick={handleCancelProject}
          />

          {loading && !summary ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load()}
                className="rounded-xl text-xs font-bold"
              >
                إعادة المحاولة
              </Button>
            </div>
          ) : (
            <Tabs
              dir="rtl"
              value={activeTab}
              onValueChange={(v) => {
                playTapSound();
                setActiveTab(v);
              }}
              className="flex flex-1 min-h-0 flex-col"
            >
              <div className="border-b border-border/60 bg-card/60 px-3 py-2 sm:px-4 shrink-0">
                <TabsList className="grid w-full grid-cols-4 gap-1 h-10 rounded-xl bg-secondary/80 p-1">
                  {[
                    { value: "overview", label: "نظرة عامة" },
                    {
                      value: "invoices",
                      label: `الفواتير (${(relations?.salesInvoices.length ?? 0) + (relations?.purchaseInvoices.length ?? 0)})`,
                    },
                    { value: "quotations", label: `العروض (${relations?.quotations.length ?? 0})` },
                    { value: "execution", label: `التنفيذ (${relations?.orders.length ?? 0})` },
                  ].map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="rounded-lg px-2 py-1.5 text-[11px] sm:text-xs font-black truncate"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
                <TabsContent value="overview" className="m-0 space-y-3.5">
                  <ProjectFinancialTracer
                    project={project}
                    summary={summary}
                    relations={relations}
                    convertingQuoteId={convertingQuoteId}
                    onConvertQuotation={handleConvertQuotationToSales}
                    onCreateInvoice={openCreateInvoice}
                    onOpenReceipt={() => {
                      playTapSound();
                      setReceiptDialogOpen(true);
                    }}
                    onExecutionChange={handleQuickExecutionChange}
                  />
                </TabsContent>

                <TabsContent value="invoices" className="m-0 space-y-3.5">
                  <ProjectInvoicesTab
                    relations={relations}
                    onCreateInvoice={openCreateInvoice}
                    onOpenLinkedInvoice={openLinkedCustomInvoice}
                  />
                </TabsContent>

                <TabsContent value="quotations" className="m-0 space-y-3">
                  <ProjectQuotationsTab
                    relations={relations}
                    convertingQuoteId={convertingQuoteId}
                    onCreateInvoice={openCreateInvoice}
                    onOpenLinkedInvoice={openLinkedCustomInvoice}
                    onConvertQuotation={handleConvertQuotationToSales}
                  />
                </TabsContent>

                <TabsContent value="execution" className="m-0 space-y-3">
                  <ProjectExecutionTab project={project} relations={relations} />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        onSaved={() => void load()}
      />

      <CustomInvoiceDialog
        open={invoiceOpen}
        onOpenChange={(nextOpen) => {
          setInvoiceOpen(nextOpen);
          if (!nextOpen) setEditingInvoice(null);
        }}
        initialType={invoiceDialogType}
        invoiceToEdit={editingInvoice}
        initialProjectId={project?.id ?? null}
        onSaved={() => {
          void load();
          void refreshProjectsFromDb();
        }}
      />

      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        initialCustomerId={project?.customerId}
        initialInvoiceId={relations?.salesInvoices?.[0]?.id}
        onRecorded={async () => {
          await Promise.all([load(), refreshProjectsFromDb()]);
          toast({ title: "تم تسجيل الدفعة وتحديث حساب المشروع تلقائياً" });
        }}
      />
    </>
  );
}

export default ProjectDetailsDialog;
