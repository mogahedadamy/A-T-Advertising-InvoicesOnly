import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileSpreadsheet, Eye, Pencil, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProformaForm } from "./ProformaForm";
import { ProformaDocument } from "./ProformaDocument";
import { ProformaViewer } from "./ProformaViewer";
import { ProformaPrintButton } from "./ProformaPrintButton";
import { peekNextProformaSerial } from "@/lib/proforma/serial";
import { saveProformaInvoice, convertProformaToOperatingInvoice } from "@/lib/proforma/store";
import type { ProformaInvoice, ProformaLine, ProformaMeta } from "@/lib/proforma/types";
import { calculateProformaTotals } from "@/lib/proforma/store";
import { registerBackHandler } from "@/lib/backButtonHandler";
import { playTapSound, playSuccessSound, playErrorSound } from "@/lib/soundEffects";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  initialLines?: ProformaLine[];
  existingInvoice?: ProformaInvoice;
  onConverted?: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ProformaDialog({
  open,
  onClose,
  initialLines = [],
  existingInvoice,
  onConverted,
}: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const [currentId, setCurrentId] = useState<string | undefined>(existingInvoice?.id);
  const [meta, setMeta] = useState<ProformaMeta>({
    serial: "0001",
    date: today(),
    customerName: "",
    customerEnName: "",
    phone: "",
    branch: "امدرمان",
  });
  const [lines, setLines] = useState<ProformaLine[]>([]);

  // دعم زر الرجوع الهاردوير
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      if (existingInvoice) {
        setCurrentId(existingInvoice.id);
        setMeta(existingInvoice.meta);
        setLines(existingInvoice.lines);
        setSaved(true);
        setTab("preview");
      } else {
        setCurrentId(undefined);
        setMeta({
          serial: peekNextProformaSerial(),
          date: today(),
          customerName: "",
          customerEnName: "",
          phone: "",
          branch: "امدرمان",
        });
        setLines(initialLines);
        setSaved(false);
        setTab(initialLines.length > 0 ? "preview" : "edit");
      }
    }
  }, [open, existingInvoice, initialLines]);

  const activeInvoice: ProformaInvoice = useMemo(() => {
    const totals = calculateProformaTotals(lines);
    return {
      id: currentId || existingInvoice?.id || `proforma-${meta.serial}`,
      meta,
      lines,
      ...totals,
      status: existingInvoice?.status || "draft",
      createdAt: existingInvoice?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [meta, lines, existingInvoice, currentId]);

  const handleSave = () => {
    const hasCustomer = Boolean(meta.customerName?.trim() || meta.customerEnName?.trim());
    if (!hasCustomer) {
      playErrorSound();
      toast.error("يرجى إدخال اسم العميل (بالعربية أو بالإنجليزية)");
      return;
    }
    if (lines.length === 0) {
      playErrorSound();
      toast.error("يرجى إضافة بند واحد على الأقل في الفاتورة");
      return;
    }

    const effectiveMeta: ProformaMeta = {
      ...meta,
      customerName: meta.customerName?.trim() || "",
      customerEnName: meta.customerEnName?.trim() || undefined,
    };

    const savedRecord = saveProformaInvoice(effectiveMeta, lines, currentId);
    setCurrentId(savedRecord.id);
    setSaved(true);
    playSuccessSound();
    toast.success(`تم حفظ الفاتورة المبدئية #${meta.serial} بنجاح`);
  };

  const handleConvert = () => {
    let targetId = currentId || existingInvoice?.id;
    if (!targetId && !saved) {
      const effectiveMeta: ProformaMeta = {
        ...meta,
        customerName: meta.customerName?.trim() || "",
        customerEnName: meta.customerEnName?.trim() || undefined,
      };
      const created = saveProformaInvoice(effectiveMeta, lines);
      targetId = created.id;
      setCurrentId(created.id);
      setSaved(true);
    }
    if (targetId) {
      const res = convertProformaToOperatingInvoice(targetId);
      if (res) {
        playSuccessSound();
        toast.success(`تم تحويل الفاتورة المبدئية إلى طلب تشغيل رقم #${res.invRecord.serial}`);
        onConverted?.();
        onClose();
        return;
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="فاتورة مبدئية"
      className="fixed inset-0 z-50 flex flex-col bg-background pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] md:items-center md:justify-center md:bg-black/75 md:p-4"
      dir="rtl"
    >
      <div className="flex h-full w-full flex-col bg-card md:h-[94vh] md:max-h-[920px] md:max-w-6xl lg:max-w-7xl md:rounded-3xl md:border md:border-border/80 md:shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/80 px-3.5 py-2.5 bg-card">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-foreground truncate">
                فاتورة مبدئية #{meta.serial}
              </h2>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                عرض أسعار رسمي للعميل مع الختم والتفقيط
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Save Button */}
            <Button
              type="button"
              variant={saved ? "secondary" : "default"}
              size="sm"
              onClick={handleSave}
              className="h-8 gap-1 text-xs font-bold px-2.5 rounded-lg"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{saved ? "محفوظة" : "حفظ"}</span>
            </Button>

            {/* Print Button */}
            <ProformaPrintButton serial={meta.serial} onBeforePrint={handleSave} />

            {/* Close Button */}
            <button
              onClick={() => {
                playTapSound();
                onClose();
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors mr-1"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* Mobile Tabs Switcher */}
        <div className="mx-3 my-2 grid shrink-0 grid-cols-2 rounded-xl bg-secondary p-1 md:hidden">
          <Button
            variant="ghost"
            aria-pressed={tab === "edit"}
            onClick={() => {
              playTapSound();
              setTab("edit");
            }}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              tab === "edit" ? "bg-card text-blue-600 dark:text-blue-400 shadow-xs font-black" : "text-muted-foreground"
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>البيانات والبنود</span>
          </Button>

          <Button
            variant="ghost"
            aria-pressed={tab === "preview"}
            onClick={() => {
              playTapSound();
              setTab("preview");
            }}
            className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition ${
              tab === "preview" ? "bg-card text-blue-600 dark:text-blue-400 shadow-xs font-black" : "text-muted-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>معاينة الفاتورة</span>
          </Button>
        </div>

        {/* Modal Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Form Side */}
          <div
            className={`w-full md:w-[480px] lg:w-[530px] shrink-0 border-l border-border/70 bg-card overflow-hidden flex flex-col ${
              tab === "edit" ? "flex" : "hidden md:flex"
            }`}
          >
            <ProformaForm
              meta={meta}
              lines={lines}
              onMetaChange={(m) => {
                setMeta(m);
                setSaved(false);
              }}
              onLinesChange={(l) => {
                setLines(l);
                setSaved(false);
              }}
            />
          </div>

          {/* Live Document Preview Side */}
          <div
            className={`flex-1 min-w-0 bg-slate-950 overflow-hidden p-1 md:p-3 flex items-center justify-center ${
              tab === "preview" ? "flex" : "hidden md:flex"
            }`}
          >
            <ProformaViewer invoice={activeInvoice} isVisible={tab === "preview"} />
          </div>
        </div>

        {/* Mobile footer for convert option */}
        <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border/80 p-2.5 bg-card">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConvert}
            className="h-8.5 gap-1.5 text-xs font-bold border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl flex-1"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            <span>تحويل إلى أمر تشغيل بالمطبعة</span>
          </Button>

          <Button
            variant="secondary"
            onClick={() => setTab(tab === "edit" ? "preview" : "edit")}
            className="h-8.5 px-3 rounded-xl text-xs font-bold md:hidden"
          >
            {tab === "edit" ? "عرض المعاينة" : "تعديل البيانات"}
          </Button>
        </footer>
      </div>

      {/* Hidden container for printing */}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="proforma-print-root">
            <ProformaDocument invoice={activeInvoice} />
          </div>,
          document.body
        )}
    </div>
  );
}
