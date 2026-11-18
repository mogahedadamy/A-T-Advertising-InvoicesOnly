import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCustomers } from "@/lib/customersStore";
import {
  cancelProject,
  getProjectFromSnapshot,
  refreshProjectsFromDb,
  updateProject,
} from "@/lib/projectsStore";
import {
  getProjectById,
  getProjectFinancialSummary,
  getProjectRelations,
  type LinkedDocumentSummary,
  type ProjectRelations,
} from "@/lib/repositories/ProjectRepository";
import { getCustomInvoiceById } from "@/lib/repositories/CustomInvoiceRepository";
import { getProformaById as repoGetProformaById } from "@/lib/repositories/ProformaRepository";
import {
  convertProformaToSalesInvoice,
  getCustomInvoice,
} from "@/lib/billing/store";
import { getProformaById as getLegacyProformaFromStore } from "@/lib/proforma/store";
import type { CustomInvoice, CustomInvoiceType } from "@/lib/billing/types";
import {
  EXECUTION_STATUS_LABELS,
  type Project,
  type ProjectExecutionStatus,
  type ProjectFinancialSummary,
} from "@/lib/domain/projects";
import { playErrorSound, playSuccessSound, playTapSound } from "@/lib/soundEffects";

export function useProjectDetails(
  projectId: string | null,
  onOpenChange: (open: boolean) => void,
  initialProject?: Project | null
) {
  const { toast } = useToast();
  const customers = useCustomers();

  const [project, setProject] = useState<Project | null>(initialProject ?? null);
  const [relations, setRelations] = useState<ProjectRelations | null>(null);
  const [summary, setSummary] = useState<ProjectFinancialSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceDialogType, setInvoiceDialogType] = useState<CustomInvoiceType>("sales");
  const [editingInvoice, setEditingInvoice] = useState<CustomInvoice | null>(null);
  const [convertingQuoteId, setConvertingQuoteId] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  useEffect(() => {
    if (initialProject && (!projectId || initialProject.id === projectId)) {
      setProject(initialProject);
    }
  }, [initialProject, projectId]);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const memoryProject =
        getProjectFromSnapshot(projectId) ??
        (initialProject?.id === projectId ? initialProject : null);
      if (memoryProject) {
        setProject(memoryProject);
      }

      // 1. Fetch relations with per-query resilience
      const rels = await getProjectRelations(projectId);
      setRelations(rels);

      // 2. Build financial summary directly reusing relations (zero duplicate queries)
      const sum = await getProjectFinancialSummary(projectId, rels);
      setSummary(sum);

      // 3. Keep project data fresh
      const freshProject = await getProjectById(projectId).catch(() => undefined);
      if (freshProject) {
        setProject(freshProject);
      } else if (memoryProject) {
        setProject(memoryProject);
      }
    } catch (err) {
      console.warn("[useProjectDetails] load failed:", err);
      const currentOrSnap =
        getProjectFromSnapshot(projectId) ??
        (initialProject?.id === projectId ? initialProject : null);
      if (currentOrSnap) {
        setProject(currentOrSnap);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "تعذّر تحميل بيانات المشروع.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, initialProject]);

  useEffect(() => {
    if (!projectId) {
      setProject(null);
      setRelations(null);
      setSummary(null);
      setActiveTab("overview");
      return;
    }
    setActiveTab("overview");
    void load();
    const onRefresh = () => {
      void load();
    };
    window.addEventListener("project-relations-changed", onRefresh);
    window.addEventListener("native-storage-ready", onRefresh);
    return () => {
      window.removeEventListener("project-relations-changed", onRefresh);
      window.removeEventListener("native-storage-ready", onRefresh);
    };
  }, [projectId, load]);

  const openCreateInvoice = (nextType: CustomInvoiceType) => {
    playTapSound();
    setEditingInvoice(null);
    setInvoiceDialogType(nextType);
    setInvoiceOpen(true);
  };

  const openLinkedCustomInvoice = async (docId: string, fallbackType: CustomInvoiceType) => {
    playTapSound();
    const found =
      (await getCustomInvoiceById(docId).catch(() => undefined)) ?? getCustomInvoice(docId);
    if (!found) {
      toast({ title: "تعذّر فتح الفاتورة", variant: "destructive" });
      return;
    }
    setEditingInvoice(found);
    setInvoiceDialogType(found.meta.type || fallbackType);
    setInvoiceOpen(true);
  };

  const handleConvertQuotationToSales = async (item: LinkedDocumentSummary) => {
    if (!project || convertingQuoteId) return;
    setConvertingQuoteId(item.id);
    try {
      const source =
        item.label === "عرض سعر"
          ? (await repoGetProformaById(item.id).catch(() => undefined)) ??
            getLegacyProformaFromStore(item.id)
          : (await getCustomInvoiceById(item.id).catch(() => undefined)) ??
            getCustomInvoice(item.id);

      if (!source) {
        playErrorSound();
        toast({
          title: "تعذّر العثور على الفاتورة المبدئية",
          description: "لم يُعثر على بيانات عرض السعر الأصلية لتحويلها.",
          variant: "destructive",
        });
        return;
      }

      const { salesInvoice, alreadyConverted } = await convertProformaToSalesInvoice(source, {
        projectId: project.id,
        customerId: project.customerId,
      });

      await Promise.all([load(), refreshProjectsFromDb()]);
      playSuccessSound();
      toast({
        title: alreadyConverted ? "العرض محوَّل مسبقاً" : "تم تحويل العرض إلى فاتورة مبيعات",
        description: `حُفظت فاتورة المبيعات بالمرجع ${salesInvoice.reference || "—"} داخل مجلد فواتير المبيعات وهذا المشروع.`,
      });
      setActiveTab("invoices");
    } catch (err) {
      playErrorSound();
      toast({
        title: "تعذّر التحويل إلى فاتورة مبيعات",
        description: err instanceof Error ? err.message : "خطأ غير متوقع.",
        variant: "destructive",
      });
    } finally {
      setConvertingQuoteId(null);
    }
  };

  const customerName = project?.customerId
    ? customers.find((c) => c.id === project.customerId)?.name ?? "عميل غير معروف"
    : "بلا عميل";

  const handleCancelProject = async () => {
    if (!project) return;
    try {
      await cancelProject(project.id, "إلغاء من مساحة عمل المشروع");
      toast({ title: "تم إلغاء المشروع", description: "السجل ومرجعه محفوظان في الأرشيف." });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "تعذّر إلغاء المشروع",
        description: err instanceof Error ? err.message : "خطأ غير متوقع.",
        variant: "destructive",
      });
    }
  };

  const handleQuickExecutionChange = async (nextStatus: ProjectExecutionStatus) => {
    if (!project || project.executionStatus === nextStatus) return;
    playTapSound();
    try {
      await updateProject(project.id, { executionStatus: nextStatus });
      setProject((prev) => (prev ? { ...prev, executionStatus: nextStatus } : prev));
      toast({ title: `تم تحديث مرحلة التنفيذ إلى: ${EXECUTION_STATUS_LABELS[nextStatus]}` });
      await Promise.all([load(), refreshProjectsFromDb()]);
    } catch (err) {
      toast({ title: "تعذّر تحديث مرحلة التنفيذ", variant: "destructive" });
    }
  };

  const derivedFinancialStatus =
    summary?.suggestedFinancialStatus ?? project?.financialStatus ?? "not_invoiced";

  return {
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
  };
}
