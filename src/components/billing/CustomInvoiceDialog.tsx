import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Printer,
  Save,
  Eye,
  Edit3,
  FileText,
  TrendingUp,
  ShoppingBag,
} from "lucide-react";
import type {
  CustomInvoice,
  CustomInvoiceItem,
  CustomInvoiceMeta,
  CustomInvoiceType,
} from "@/lib/billing/types";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import {
  calculateCustomInvoiceTotals,
  getNextCustomInvoiceSerial,
  saveCustomInvoice,
} from "@/lib/billing/store";
import { StandardInvoiceViewer } from "./StandardInvoiceViewer";
import { CustomInvoicePrintButton, printCustomInvoiceDocument } from "./CustomInvoicePrintButton";
import { CustomInvoiceTypeSelector } from "./dialog/CustomInvoiceTypeSelector";
import { CustomInvoiceMetaSection } from "./dialog/CustomInvoiceMetaSection";
import { CustomInvoiceItemsTable } from "./dialog/CustomInvoiceItemsTable";
import { useToast } from "@/hooks/use-toast";
import { registerBackHandler } from "@/lib/backButtonHandler";
import {
  playTapSound,
  playSuccessSound,
  playErrorSound,
} from "@/lib/soundEffects";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: CustomInvoiceType;
  initialItems?: CustomInvoiceItem[];
  invoiceToEdit?: CustomInvoice | null;
  onSaved?: (invoice: CustomInvoice) => void;
}

/**
 * نافذة إصدار وتعديل الفواتير المعتمدة (مبيعات / مبدئية / مشتريات):
 * خالية تماماً من إيصالات أوامر التشغيل وتعتمد المعايير المحاسبية الرسمية
 */
export function CustomInvoiceDialog({
  open,
  onOpenChange,
  initialType = "sales",
  initialItems,
  invoiceToEdit,
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  // دعم زر الرجوع الهاردوير في أندرويد
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onOpenChange(false);
      return true;
    });
    return unregister;
  }, [open, onOpenChange]);

  const [type, setType] = useState<CustomInvoiceType>(initialType);
  const [serial, setSerial] = useState<string>("");
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(invoiceToEdit?.id || null);
  const [date, setDate] = useState<string>("");
  const [partyName, setPartyName] = useState<string>("");
  const [partyEnName, setPartyEnName] = useState<string>("");
  const [attn, setAttn] = useState<string>("");
  const [language, setLanguage] = useState<"auto" | "ar" | "en">("auto");
  const [items, setItems] = useState<CustomInvoiceItem[]>([]);

  // مزامنة الحقول عند فتح النافذة أو استقبال بيانات جديدة
  useEffect(() => {
    if (!open) return;

    if (invoiceToEdit) {
      setCurrentInvoiceId(invoiceToEdit.id);
      setType(invoiceToEdit.meta.type || "sales");
      setSerial(invoiceToEdit.meta.serial || "");
      setDate(invoiceToEdit.meta.date || new Date().toISOString().split("T")[0]);
      setPartyName(invoiceToEdit.meta.partyName || "");
      setPartyEnName(invoiceToEdit.meta.partyEnName || "");
      setAttn(invoiceToEdit.meta.attn || "");
      setLanguage(invoiceToEdit.meta.language || "auto");
      setItems(invoiceToEdit.items || []);
    } else {
      setCurrentInvoiceId(null);
      setType(initialType);
      const nextSerial = getNextCustomInvoiceSerial(initialType);
      setSerial(nextSerial);
      setDate(new Date().toISOString().split("T")[0]);
      setPartyName("");
      setPartyEnName("");
      setAttn("");
      setLanguage("auto");

      // إذا وُجدت بنود قادمة من الحاسبة نملؤها فوراً، وإلا نفتح سطراً فارغاً
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
  }, [open, invoiceToEdit, initialType, initialItems]);

  const { totalAmount, totalInWords } = calculateCustomInvoiceTotals(items);

  const buildCurrentInvoice = (): CustomInvoice => {
    const meta: CustomInvoiceMeta = {
      serial: serial || "001",
      type,
      date: date || new Date().toISOString().split("T")[0],
      partyName: (partyName || "").trim() || "عميل غير محدد",
      partyEnName: (partyEnName || "").trim() || undefined,
      attn: (attn || "").trim() || undefined,
      language,
      salutation: "بعد التحية والاحترام ،،،،،،،،",
      closingNote: "لكم جزيل الشكر والتقدير ،،،،،،،،،،،،،،،،،،،،،،،",
      accountNumber: "3283046",
      accountName: "طارق عثمان علي",
      signatoryTitle: "الإدارة",
    };

    return {
      id: currentInvoiceId || invoiceToEdit?.id || `custom-inv-${serial || Date.now()}`,
      meta,
      items: items.map((it) => ({
        ...it,
        qty: it.qty || 1,
      })),
      totalAmount,
      totalInWords,
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

  const handleSave = () => {
    const invoice = validateAndBuild();
    if (!invoice) return;

    saveCustomInvoice(invoice);
    setCurrentInvoiceId(invoice.id);
    playSuccessSound();

    toast({
      title: "تم حفظ الفاتورة",
      description: `تم حفظ ${INVOICE_TYPE_LABELS[type]} برقم #${invoice.meta.serial}`,
    });

    onSaved?.(invoice);
    onOpenChange(false);
  };

  const handleSaveAndPrint = () => {
    const invoice = validateAndBuild();
    if (!invoice) return;

    saveCustomInvoice(invoice);
    setCurrentInvoiceId(invoice.id);
    onSaved?.(invoice);
    printCustomInvoiceDocument(invoice);
  };

  const previewInvoice = buildCurrentInvoice();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full sm:max-w-4xl h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden bg-card border-border/80 rounded-none sm:rounded-3xl shadow-2xl"
        dir="rtl"
      >
        {/* 1. رأس النافذة */}
        <DialogHeader className="p-3 sm:px-5 sm:py-3 border-b border-border/60 flex flex-row items-center justify-between shrink-0 bg-card">
          <div className="flex items-center gap-2">
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl border text-xs ${
                type === "sales"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : type === "proforma"
                  ? "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/20"
                  : "bg-slate-500/10 text-slate-400 border-slate-500/20"
              }`}
            >
              {type === "sales" && <TrendingUp className="h-4 w-4" />}
              {type === "proforma" && <FileText className="h-4 w-4" />}
              {type === "purchase" && <ShoppingBag className="h-4 w-4" />}
            </span>
            <div>
              <DialogTitle className="text-sm sm:text-base font-black text-foreground">
                {invoiceToEdit
                  ? `تعديل ${INVOICE_TYPE_LABELS[type]}`
                  : `إصدار ${INVOICE_TYPE_LABELS[type]}`}
              </DialogTitle>
              <p className="text-[10.5px] text-muted-foreground">
                نموذج الفاتورة المعتمد والمطابق للمواصفات الرسمية A4 / A5
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 tabular-nums">
              #{serial}
            </span>
          </div>
        </DialogHeader>

        {/* 2. شريط التبويبات */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            playTapSound();
            setActiveTab(v as any);
          }}
          className="w-full flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="px-3 sm:px-5 py-2 border-b border-border/40 flex items-center justify-between bg-muted/20 shrink-0">
            <TabsList className="bg-muted/70 p-1 rounded-xl h-8.5">
              <TabsTrigger
                value="edit"
                className="rounded-lg px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>بيانات الفاتورة والبنود</span>
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="rounded-lg px-3 text-xs font-bold gap-1.5 data-[state=active]:bg-card data-[state=active]:shadow-xs"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>معاينة المستند والطباعة</span>
              </TabsTrigger>
            </TabsList>

            {activeTab === "preview" && (
              <CustomInvoicePrintButton
                invoice={previewInvoice}
                size="sm"
                className="h-8 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs"
              />
            )}
          </div>

          {/* تبويب التحرير */}
          <TabsContent
            value="edit"
            className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 m-0 scroll-smooth touch-pan-y min-h-0"
          >
            <CustomInvoiceTypeSelector type={type} onChange={setType} />

            <CustomInvoiceMetaSection
              type={type}
              partyName={partyName}
              setPartyName={setPartyName}
              partyEnName={partyEnName}
              setPartyEnName={setPartyEnName}
              attn={attn}
              setAttn={setAttn}
              date={date}
              setDate={setDate}
              serial={serial}
              setSerial={setSerial}
              language={language}
              setLanguage={setLanguage}
            />

            <CustomInvoiceItemsTable
              items={items}
              onItemsChange={setItems}
              totalAmount={totalAmount}
              totalInWords={totalInWords}
            />
          </TabsContent>

          {/* تبويب المعاينة */}
          <TabsContent
            value="preview"
            className="flex-1 overflow-y-auto p-2 sm:p-4 bg-muted/30 m-0 scroll-smooth touch-pan-y min-h-0"
          >
            <div className="max-w-3xl mx-auto shadow-lg rounded-2xl overflow-hidden border border-border/70 bg-white dark:bg-card">
              <StandardInvoiceViewer invoice={previewInvoice} />
            </div>
          </TabsContent>
        </Tabs>

        {/* 3. شريط أزرار الحفظ والإغلاق */}
        <DialogFooter className="p-3 sm:px-5 sm:py-3 border-t border-border/60 flex flex-row items-center justify-between shrink-0 bg-card">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 rounded-xl font-bold text-xs"
          >
            إلغاء
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAndPrint}
              className="h-9 px-3.5 rounded-xl font-black text-xs gap-1.5 border-primary/30 hover:bg-primary/5 text-primary"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">حفظ وطباعة فورية</span>
              <span className="sm:hidden">طباعة</span>
            </Button>

            <Button
              type="button"
              onClick={handleSave}
              className="h-9 px-5 rounded-xl font-black text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30"
            >
              <Save className="h-4 w-4" />
              <span>حفظ الفاتورة</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CustomInvoiceDialog;
