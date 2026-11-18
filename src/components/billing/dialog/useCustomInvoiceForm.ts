import { useState, useEffect, useRef } from "react";
import type {
  CustomInvoice,
  CustomInvoiceItem,
  CustomInvoiceMeta,
  CustomInvoiceType,
} from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import {
  calculateCustomInvoiceTotals,
  convertProformaToSalesInvoice,
  saveCustomInvoice,
} from "@/lib/billing/store";
import { AppCurrency } from "@/lib/currency/types";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { getCustomersSnapshot, type CustomerRecord } from "@/lib/customersStore";
import { getProjectsSnapshot, refreshProjectsFromDb } from "@/lib/projectsStore";
import { printCustomInvoiceDocument, saveCustomInvoiceAsPdf, shareCustomInvoiceViaWhatsApp } from "../CustomInvoicePrintButton";
import { useToast } from "@/hooks/use-toast";
import { playSuccessSound, playErrorSound } from "@/lib/soundEffects";

interface UseCustomInvoiceFormParams {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: CustomInvoiceType;
  initialItems?: CustomInvoiceItem[];
  invoiceToEdit?: CustomInvoice | null;
  onSaved?: (invoice: CustomInvoice) => void;
  initialProjectId?: string | null;
  initialCustomerId?: string | null;
  initialCustomer?: CustomerRecord | null;
}

export function useCustomInvoiceForm({
  open,
  onOpenChange,
  initialType = "sales",
  initialItems,
  invoiceToEdit,
  onSaved,
  initialProjectId,
  initialCustomerId,
  initialCustomer,
}: UseCustomInvoiceFormParams) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [type, setType] = useState<CustomInvoiceType>(initialType);
  const [serial, setSerial] = useState<string>("");
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [customerId, setCustomerId] = useState<string | null>(invoiceToEdit?.customerId ?? null);
  const [supplierId, setSupplierId] = useState<string | null>(invoiceToEdit?.supplierId ?? null);
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(invoiceToEdit?.supplierInvoiceNumber ?? "");
  const [savedReference, setSavedReference] = useState<string | undefined>(invoiceToEdit?.reference);
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(invoiceToEdit?.id || null);
  const [date, setDate] = useState<string>("");
  const [partyName, setPartyName] = useState<string>("");
  const [partyEnName, setPartyEnName] = useState<string>("");
  const [attn, setAttn] = useState<string>("");
  const [language, setLanguage] = useState<"auto" | "ar" | "en">("auto");
  const [currency, setCurrency] = useState<AppCurrency>("SDG");
  const [items, setItems] = useState<CustomInvoiceItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const draftIdRef = useRef<string>("");
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    saveLockRef.current = false;
    setIsProcessing(false);
    void refreshProjectsFromDb();

    if (invoiceToEdit) {
      draftIdRef.current = invoiceToEdit.id;
      setCurrentInvoiceId(invoiceToEdit.id);
      setType(invoiceToEdit.meta.type || "sales");
      setSerial(invoiceToEdit.meta.serial || "");
      setSavedReference(invoiceToEdit.reference);
      setProjectId(invoiceToEdit.projectId ?? initialProjectId ?? null);
      setCustomerId(invoiceToEdit.customerId ?? null);
      setSupplierId(invoiceToEdit.supplierId ?? null);
      setSupplierInvoiceNumber(invoiceToEdit.supplierInvoiceNumber ?? "");
      setDate(invoiceToEdit.meta.date || new Date().toISOString().split("T")[0]);
      setPartyName(invoiceToEdit.meta.partyName || "");
      setPartyEnName(invoiceToEdit.meta.partyEnName || "");
      setAttn(invoiceToEdit.meta.attn || "");
      setLanguage(invoiceToEdit.meta.language || "auto");
      setCurrency((invoiceToEdit.currency || invoiceToEdit.meta.currency || "SDG") as AppCurrency);
      setItems(invoiceToEdit.items || []);
    } else {
      draftIdRef.current = `custom-inv-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setCurrentInvoiceId(null);
      setType(initialType);
      setSerial("");
      setSavedReference(undefined);
      const nextProjectId = initialProjectId ?? null;
      setProjectId(nextProjectId);
      setSupplierId(null);
      setSupplierInvoiceNumber("");
      setDate(new Date().toISOString().split("T")[0]);

      let prefilledCustomerId: string | null = initialCustomerId ?? initialCustomer?.id ?? null;
      let prefilledPartyName = initialCustomer?.name ?? "";

      if (!prefilledCustomerId && nextProjectId && initialType !== "purchase") {
        const linkedProject = getProjectsSnapshot().find((p) => p.id === nextProjectId);
        if (linkedProject?.customerId) {
          const linkedCustomer = getCustomersSnapshot().find((c) => c.id === linkedProject.customerId);
          if (linkedCustomer) {
            prefilledCustomerId = linkedCustomer.id;
            prefilledPartyName = linkedCustomer.name;
          }
        }
      }

      if (prefilledCustomerId && !prefilledPartyName) {
        const found = getCustomersSnapshot().find((c) => c.id === prefilledCustomerId);
        if (found) {
          prefilledPartyName = found.name;
        }
      }

      setCustomerId(prefilledCustomerId);
      setPartyName(prefilledPartyName);
      setPartyEnName("");
      setAttn("");
      setLanguage("auto");
      setCurrency("SDG");

      if (initialItems && initialItems.length > 0) {
        setItems(initialItems);
      } else {
        setItems([
          {
            id: `item-${Date.now()}-1`,
            description: "",
            qty: 1,
            unitPrice: 0,
            total: 0,
          },
        ]);
      }
    }
    setActiveTab("edit");
  }, [open, invoiceToEdit, initialType, initialItems, initialProjectId, initialCustomerId, initialCustomer]);

  const effectiveLang = detectInvoiceLanguage(language, partyName, partyEnName, items);
  const isRtl = effectiveLang === "ar";
  const { totalAmount, totalInWords } = calculateCustomInvoiceTotals(items, currency, isRtl);

  const buildCurrentInvoice = (): CustomInvoice => {
    const meta: CustomInvoiceMeta = {
      serial: serial || "001",
      type,
      date: date || new Date().toISOString().split("T")[0],
      partyName: (partyName || "").trim(),
      partyEnName: (partyEnName || "").trim() || undefined,
      attn: (attn || "").trim() || undefined,
      language,
      currency,
      salutation: "بعد التحية والاحترام ،،،،،،،،",
      closingNote: "لكم جزيل الشكر والتقدير ،،،،،،،،،،،،،،،،،،،،،،،",
      accountNumber: "3283046",
      accountName: "طارق عثمان علي",
      signatoryTitle: "الإدارة",
    };

    const stableId =
      currentInvoiceId ||
      invoiceToEdit?.id ||
      draftIdRef.current ||
      (draftIdRef.current = `custom-inv-${serial || Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

    return {
      id: stableId,
      meta,
      items: items.map((it) => ({
        ...it,
        qty: it.qty || 1,
      })),
      totalAmount,
      totalInWords,
      currency,
      projectId: projectId ?? undefined,
      supplierId: type === "purchase" ? supplierId ?? undefined : undefined,
      supplierInvoiceNumber: type === "purchase" ? supplierInvoiceNumber.trim() || undefined : undefined,
      customerId: type !== "purchase" ? customerId ?? undefined : undefined,
      reference: savedReference ?? invoiceToEdit?.reference,
      referenceAssignedAt: invoiceToEdit?.referenceAssignedAt,
      createdAt: invoiceToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const validateAndBuild = (): CustomInvoice | null => {
    const finalParty = (partyName || "").trim() || (partyEnName || "").trim();
    if (!finalParty) {
      playErrorSound();
      toast({
        title: "حقل مطلوب",
        description: "يرجى إدخال اسم العميل أو الجهة الاعتبارية",
        variant: "destructive",
      });
      return null;
    }
    const hasValidItem = items.some((item) => (item?.description || "").trim().length > 0);
    if (!hasValidItem) {
      playErrorSound();
      toast({
        title: "حقل مطلوب",
        description: "يرجى كتابة تفاصيل بند واحد على الأقل",
        variant: "destructive",
      });
      return null;
    }
    return buildCurrentInvoice();
  };

  const runLockedSave = async (
    describeSuccess: (saved: CustomInvoice) => string,
    afterSave: (saved: CustomInvoice) => Promise<unknown> | unknown
  ) => {
    if (saveLockRef.current || isProcessing) return;
    const invoice = validateAndBuild();
    if (!invoice) return;

    saveLockRef.current = true;
    setIsProcessing(true);
    try {
      const saved = await saveCustomInvoice(invoice);
      draftIdRef.current = saved.id;
      setCurrentInvoiceId(saved.id);
      setSavedReference(saved.reference);
      playSuccessSound();
      toast({
        title: "تم حفظ الفاتورة",
        description: describeSuccess(saved),
      });
      onSaved?.(saved);
      await afterSave(saved);
    } catch (err) {
      playErrorSound();
      toast({
        title: "تعذّر حفظ الفاتورة",
        description: err instanceof Error ? err.message : "خطأ غير متوقع أثناء حفظ الفاتورة.",
        variant: "destructive",
      });
    } finally {
      saveLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const handleSave = () =>
    runLockedSave(
      (saved) => `تم حفظ ${INVOICE_TYPE_LABELS[type]} بالمرجع ${saved.reference || "—"}`,
      () => onOpenChange(false)
    );

  const handleSaveAndPrint = () =>
    runLockedSave(
      (saved) => `تم حفظ ${INVOICE_TYPE_LABELS[type]} بالمرجع ${saved.reference || "—"} وجاري تشغيل أمر الطباعة...`,
      (saved) => printCustomInvoiceDocument(saved)
    );

  const handleSaveAndExportPdf = () =>
    runLockedSave(
      (saved) => `تم حفظ ${INVOICE_TYPE_LABELS[type]} بالمرجع ${saved.reference || "—"} وجاري تصدير وحفظ ملف PDF...`,
      (saved) => saveCustomInvoiceAsPdf(saved)
    );

  const handleSaveAndShareWhatsApp = () =>
    runLockedSave(
      (saved) => `تم حفظ ${INVOICE_TYPE_LABELS[type]} بالمرجع ${saved.reference || "—"} وجاري مشاركتها عبر واتساب...`,
      (saved) => shareCustomInvoiceViaWhatsApp(saved)
    );

  const handleConvertToSales = async () => {
    if (saveLockRef.current || isProcessing || type !== "proforma") return;
    const invoice = validateAndBuild();
    if (!invoice) return;

    saveLockRef.current = true;
    setIsProcessing(true);
    try {
      const savedProforma = await saveCustomInvoice(invoice);
      draftIdRef.current = savedProforma.id;
      setCurrentInvoiceId(savedProforma.id);
      setSavedReference(savedProforma.reference);

      const { salesInvoice, alreadyConverted } = await convertProformaToSalesInvoice(savedProforma, {
        projectId,
        customerId,
      });
      playSuccessSound();
      toast({
        title: alreadyConverted ? "العرض محوَّل مسبقاً" : "تم التحويل إلى فاتورة مبيعات",
        description: `فاتورة المبيعات بالمرجع ${salesInvoice.reference || "—"} محفوظة في سجل المبيعات والمشروع.`,
      });
      onSaved?.(salesInvoice);
      onOpenChange(false);
    } catch (err) {
      playErrorSound();
      toast({
        title: "تعذّر التحويل إلى فاتورة مبيعات",
        description: err instanceof Error ? err.message : "خطأ غير متوقع أثناء التحويل.",
        variant: "destructive",
      });
    } finally {
      saveLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const previewInvoice = buildCurrentInvoice();

  return {
    activeTab,
    setActiveTab,
    type,
    setType,
    serial,
    projectId,
    setProjectId,
    customerId,
    setCustomerId,
    supplierId,
    setSupplierId,
    supplierInvoiceNumber,
    setSupplierInvoiceNumber,
    savedReference,
    date,
    setDate,
    partyName,
    setPartyName,
    partyEnName,
    setPartyEnName,
    attn,
    setAttn,
    language,
    setLanguage,
    currency,
    setCurrency,
    items,
    setItems,
    isProcessing,
    totalAmount,
    totalInWords,
    previewInvoice,
    handleSave,
    handleSaveAndPrint,
    handleSaveAndExportPdf,
    handleSaveAndShareWhatsApp,
    handleConvertToSales,
  };
}

export default useCustomInvoiceForm;
