import { getStoredJsonSync, setStoredJson } from "./nativeStorage";
import { toast } from "sonner";

export interface InvoiceBackupPayload {
  version: string;
  exportedAt: string;
  appId: string;
  stats: {
    customInvoicesCount: number;
    proformaInvoicesCount: number;
    printInvoicesCount: number;
    totalInvoices: number;
  };
  data: {
    customInvoices: any[];
    proformaInvoices: any[];
    printInvoices: any[];
    sequences: {
      invoiceSeq?: string;
      proformaSeq?: string;
    };
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  addedCount: number;
  existingCount: number;
  totalCount: number;
}

export interface IntegrityReport {
  isHealthy: boolean;
  totalInvoices: number;
  customCount: number;
  proformaCount: number;
  printCount: number;
  issues: string[];
}

const STORAGE_KEYS = {
  CUSTOM: "future_custom_invoices_v2",
  PROFORMA: "future_proforma_invoices_v2",
  PRINT: "future_print_invoices_v2",
  INVOICE_SEQ: "future_invoice_seq",
  PROFORMA_SEQ: "future_proforma_seq",
};

/**
 * تصدير كامل قاعدة بيانات الفواتير كنسخة احتياطية آمنة (JSON)
 */
export async function exportInvoiceDatabase(): Promise<boolean> {
  const toastId = toast.loading("جاري تجميع وتصدير النسخة الاحتياطية للفواتير...");
  try {
    const customInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOM, []);
    const proformaInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.PROFORMA, []);
    const printInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.PRINT, []);

    const invoiceSeq = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.INVOICE_SEQ) || "" : "";
    const proformaSeq = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEYS.PROFORMA_SEQ) || "" : "";

    const payload: InvoiceBackupPayload = {
      version: "1.2.3-INVOICE",
      exportedAt: new Date().toISOString(),
      appId: "com.taadvertising.invoicing",
      stats: {
        customInvoicesCount: customInvoices.length,
        proformaInvoicesCount: proformaInvoices.length,
        printInvoicesCount: printInvoices.length,
        totalInvoices: customInvoices.length + proformaInvoices.length + printInvoices.length,
      },
      data: {
        customInvoices,
        proformaInvoices,
        printInvoices,
        sequences: {
          invoiceSeq,
          proformaSeq,
        },
      },
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `TA-Invoices-Backup-${dateStr}.json`;

    // 1. فحص توفر جسر أندرويد لحفظ الملف مباشرة في الجهاز
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.savePdf === "function") {
      // تحويل النص إلى Base64
      const utf8Bytes = new TextEncoder().encode(jsonString);
      let binary = "";
      const len = utf8Bytes.byteLength;
      for (let i = 0; i < len; i += 8192) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(utf8Bytes.subarray(i, Math.min(i + 8192, len)))
        );
      }
      const base64 = window.btoa(binary);
      androidPrint.savePdf(base64, fileName);
      toast.success(`تم حفظ النسخة الاحتياطية (${payload.stats.totalInvoices} فاتورة) بنجاح`, { id: toastId });
      return true;
    }

    // 2. تنزيل المتصفح
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);

    toast.success(`تم تنزيل النسخة الاحتياطية (${payload.stats.totalInvoices} فاتورة) بنجاح`, { id: toastId });
    return true;
  } catch (err: any) {
    console.error("Export invoice database error:", err);
    toast.error(`تعذر تصدير النسخة الاحتياطية: ${err?.message || "خطأ غير متوقع"}`, { id: toastId });
    return false;
  }
}

/**
 * استعادة ودمج النسخة الاحتياطية دون حذف أي فواتير حالية (Safe Non-Destructive Merge)
 */
export async function importInvoiceDatabase(jsonContent: string): Promise<ImportResult> {
  const toastId = toast.loading("جاري التحقق من النسخة الاحتياطية واستعادة الفواتير...");
  try {
    if (!jsonContent || typeof jsonContent !== "string") {
      throw new Error("ملف النسخة الاحتياطية فارغ أو غير صالح.");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonContent);
    } catch {
      throw new Error("صيغة الملف غير متوافقة (ليس ملف JSON صحيح).");
    }

    const backupData = parsed.data || parsed;
    const incomingCustom = Array.isArray(backupData.customInvoices) ? backupData.customInvoices : [];
    const incomingProforma = Array.isArray(backupData.proformaInvoices) ? backupData.proformaInvoices : [];
    const incomingPrint = Array.isArray(backupData.printInvoices) ? backupData.printInvoices : [];

    // قراءة البيانات الحالية
    const currentCustom = getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOM, []);
    const currentProforma = getStoredJsonSync<any[]>(STORAGE_KEYS.PROFORMA, []);
    const currentPrint = getStoredJsonSync<any[]>(STORAGE_KEYS.PRINT, []);

    let addedCount = 0;
    let existingCount = 0;

    // 1. دمج فواتير Custom (مبيعات / مبدئية / مشتريات)
    const customMap = new Map<string, any>();
    for (const inv of currentCustom) {
      const key = `${inv.meta?.type || "sales"}-${inv.meta?.serial || inv.id}`;
      customMap.set(key, inv);
    }
    for (const inv of incomingCustom) {
      const key = `${inv.meta?.type || "sales"}-${inv.meta?.serial || inv.id}`;
      if (customMap.has(key)) {
        existingCount++;
      } else {
        customMap.set(key, inv);
        addedCount++;
      }
    }
    const mergedCustom = Array.from(customMap.values());

    // 2. دمج الفواتير المبدئية القديمة (Proforma)
    const proformaMap = new Map<string, any>();
    for (const p of currentProforma) {
      proformaMap.set(p.meta?.serial || p.id, p);
    }
    for (const p of incomingProforma) {
      const key = p.meta?.serial || p.id;
      if (proformaMap.has(key)) {
        existingCount++;
      } else {
        proformaMap.set(key, p);
        addedCount++;
      }
    }
    const mergedProforma = Array.from(proformaMap.values());

    // 3. دمج فواتير الحاسبة (Print Invoices)
    const printMap = new Map<string, any>();
    for (const inv of currentPrint) {
      printMap.set(inv.serial || inv.id, inv);
    }
    for (const inv of incomingPrint) {
      const key = inv.serial || inv.id;
      if (printMap.has(key)) {
        existingCount++;
      } else {
        printMap.set(key, inv);
        addedCount++;
      }
    }
    const mergedPrint = Array.from(printMap.values());

    // حفظ البيانات المدمجة في كافة الطبقات
    await setStoredJson(STORAGE_KEYS.CUSTOM, mergedCustom);
    await setStoredJson(STORAGE_KEYS.PROFORMA, mergedProforma);
    await setStoredJson(STORAGE_KEYS.PRINT, mergedPrint);

    // إشعار التطبيق لتحديث كافة الشاشات والقوائم فورياً
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("native-storage-ready"));
    }

    const totalCount = mergedCustom.length + mergedProforma.length + mergedPrint.length;
    const msg = `تمت الاستعادة بنجاح: أضيفت ${addedCount} فاتورة جديدة، ووجد ${existingCount} مسبقاً. الإجمالي: ${totalCount} فاتورة.`;
    toast.success(msg, { id: toastId });

    return {
      success: true,
      message: msg,
      addedCount,
      existingCount,
      totalCount,
    };
  } catch (err: any) {
    console.error("Import invoice database error:", err);
    const msg = err?.message || "تعذر استعادة الفواتير، يرجى التأكد من صحة الملف.";
    toast.error(msg, { id: toastId });
    return {
      success: false,
      message: msg,
      addedCount: 0,
      existingCount: 0,
      totalCount: 0,
    };
  }
}

/**
 * فحص وتدقيق سلامة بيانات الفواتير وصلاحيتها الكاملة
 */
export function verifyInvoiceDatabaseIntegrity(): IntegrityReport {
  const custom = getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOM, []);
  const proforma = getStoredJsonSync<any[]>(STORAGE_KEYS.PROFORMA, []);
  const print = getStoredJsonSync<any[]>(STORAGE_KEYS.PRINT, []);

  const issues: string[] = [];

  // فحص الفواتير المعتمدة
  custom.forEach((inv, i) => {
    if (!inv.id) issues.push(`فاتورة مخصصة [${i}] مفقودة المعرف (ID).`);
    if (!inv.meta?.serial) issues.push(`فاتورة [${inv.id || i}] تفتقر لرقم تسلسلي.`);
    if (typeof inv.totalAmount !== "number" || isNaN(inv.totalAmount) || inv.totalAmount < 0) {
      issues.push(`فاتورة #${inv.meta?.serial || i} تحتوي على إجمالي غير صالح.`);
    }
    if (!Array.isArray(inv.items)) {
      issues.push(`فاتورة #${inv.meta?.serial || i} تفتقر لقائمة بنود صالحة.`);
    }
  });

  // فحص الفواتير المبدئية
  proforma.forEach((p, i) => {
    if (!p.id) issues.push(`فاتورة مبدئية [${i}] مفقودة المعرف (ID).`);
    if (!p.meta?.serial) issues.push(`فاتورة مبدئية [${p.id || i}] تفتقر لرقم تسلسلي.`);
  });

  const totalInvoices = custom.length + proforma.length + print.length;

  return {
    isHealthy: issues.length === 0,
    totalInvoices,
    customCount: custom.length,
    proformaCount: proforma.length,
    printCount: print.length,
    issues,
  };
}

