import { useEffect, useMemo, useState, useCallback } from "react";
import { peekNextSerial } from "@/lib/invoice/serial";
import { saveInvoice } from "@/lib/invoicesStore";
import { addOrder } from "@/lib/ordersStore";
import { registerBackHandler } from "@/lib/backButtonHandler";
import { playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";
import type { Invoice, InvoiceLine, InvoiceMeta } from "@/lib/invoice/types";
import { invoiceTotal } from "@/lib/invoice/types";

const today = () => new Date().toISOString().slice(0, 10);

interface UseInvoiceDialogLifecycleProps {
  open: boolean;
  onClose: () => void;
  lines: InvoiceLine[];
  initialMeta?: InvoiceMeta;
}

/**
 * خطاف مخصص لإدارة دورة حياة نافذة الفاتورة:
 * 1. تهيئة الرقم التسلسلي والبيانات الافتراضية
 * 2. ربط زر الرجوع الهاردوير لهواتف أندرويد
 * 3. التبديل التفاعلي بين التعديل والمعاينة
 * 4. حفظ الفاتورة وإدراجها كأمر تشغيل في خط الإنتاج
 */
export function useInvoiceDialogLifecycle({
  open,
  onClose,
  lines,
  initialMeta,
}: UseInvoiceDialogLifecycleProps) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [saved, setSaved] = useState(false);
  const [meta, setMeta] = useState<InvoiceMeta>({
    serial: "0001",
    date: today(),
    customerName: "",
    phone: "",
    clientTypes: [],
    shipTo: "",
    branch: "امدرمان",
    currency: "SDG",
  });

  // ربط زر الرجوع الهاردوير لهواتف أندرويد (Hardware Back Button Handling)
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  // تهيئة وتحديث بيانات الفاتورة عند فتح النافذة
  useEffect(() => {
    if (open) {
      if (initialMeta) {
        setMeta(initialMeta);
        setSaved(true);
        setTab("preview");
      } else {
        setMeta({
          serial: peekNextSerial(),
          date: today(),
          customerName: "",
          phone: "",
          clientTypes: [],
          shipTo: "",
          branch: "امدرمان",
          currency: "SDG",
        });
        setSaved(false);
        setTab("edit");
      }
    }
  }, [open, initialMeta]);

  const invoice: Invoice = useMemo(() => ({ meta, lines }), [meta, lines]);

  // تسجيل الفاتورة وإدراجها تلقائياً في جدول أوامر الإنتاج
  const recordInvoiceAndOrder = useCallback(() => {
    if (saved) return;
    saveInvoice(invoice);
    const totalCost = invoiceTotal(invoice.lines);
    const totalArea = invoice.lines.reduce(
      (s, l) => s + (l.width * l.height * l.qty) / 10000,
      0
    );

    addOrder({
      orderNumber: meta.serial,
      customerName: meta.customerName || "عميل نقدي",
      customerPhone: meta.phone || "",
      clientType: (meta.clientTypes[0] as any) || "takeaway",
      status: "ready_to_print",
      priority: "normal",
      branch: meta.branch || "امدرمان",
      paidAmount: totalCost,
      totalArea: Number(totalArea.toFixed(2)),
      totalCost,
      invoiceSerial: meta.serial,
      items: invoice.lines.map((l, i) => ({
        id: `item-${Date.now()}-${i}`,
        description: l.description || "بند طباعة",
        material: "flex",
        width: l.width,
        height: l.height,
        qty: l.qty,
        rollUsed: `${Math.max(l.width, l.height)} سم`,
        area: Number(((l.width * l.height * l.qty) / 10000).toFixed(2)),
        unitPrice: l.unitPrice,
        total: l.total,
      })),
    });

    setSaved(true);
    playSuccessSound();
    toast.success(`تم حفظ الفاتورة #${meta.serial} وإدراجها في خط الإنتاج`);
  }, [invoice, meta, saved]);

  return {
    tab,
    setTab,
    saved,
    meta,
    setMeta,
    invoice,
    recordInvoiceAndOrder,
  };
}
