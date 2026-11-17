import { Capacitor } from "@capacitor/core";
import {
  getStoredJsonSync,
  getStoredSync,
  setMemoryCacheJson,
  setMemoryCacheString,
} from "./sqliteStorage";
import {
  getAllCustomInvoices,
  upsertCustomInvoice,
} from "./repositories/CustomInvoiceRepository";
import {
  getAllProformaInvoices,
  upsertProforma,
} from "./repositories/ProformaRepository";
import {
  getAllPrintInvoices,
  upsertPrintInvoice,
} from "./repositories/PrintInvoiceRepository";
import {
  getAllCustomers,
  upsertCustomer,
} from "./repositories/CustomerRepository";
import {
  getAllOrders,
  upsertOrder,
} from "./repositories/OrderRepository";
import {
  getSequence,
  setSequence,
} from "./repositories/SettingsRepository";
import { toast } from "sonner";

export interface InvoiceBackupPayload {
  version: string;
  exportedAt: string;
  appId: string;
  checksum?: string;
  stats: {
    customInvoicesCount: number;
    proformaInvoicesCount: number;
    printInvoicesCount: number;
    customersCount?: number;
    ordersCount?: number;
    totalInvoices: number;
  };
  data: {
    customInvoices: any[];
    proformaInvoices: any[];
    printInvoices: any[];
    customers?: any[];
    orders?: any[];
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
  CUSTOMERS: "future_print_customers_v2",
  ORDERS: "future_print_orders_v2",
  INVOICE_SEQ: "future_invoice_seq",
  PROFORMA_SEQ: "future_proforma_seq",
};

async function computeSha256(text: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return "";
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * تصدير كامل قاعدة بيانات الفواتير والعملاء وأوامر الشغل كنسخة احتياطية آمنة (JSON)
 *
 * ⚠ Legacy path: kept ONLY because the UI still offers a JSON export/import for
 * interoperability. It is not crash-safe (no atomic write, no verification) —
 * the production protection is the native backup engine in src/lib/backup/
 * exposed through `BackupManagerCard`.
 */
export async function exportInvoiceDatabase(): Promise<boolean> {
  const toastId = toast.loading("جاري تجميع وتصدير النسخة الاحتياطية من قاعدة البيانات...");
  try {
    let customInvoices: any[];
    let proformaInvoices: any[];
    let printInvoices: any[];
    let customers: any[];
    let orders: any[];
    let invoiceSeq: string;
    let proformaSeq: string;

    if (Capacitor.isNativePlatform()) {
      [
        customInvoices,
        proformaInvoices,
        printInvoices,
        customers,
        orders,
        invoiceSeq,
        proformaSeq,
      ] = await Promise.all([
        getAllCustomInvoices(),
        getAllProformaInvoices(),
        getAllPrintInvoices(),
        getAllCustomers(),
        getAllOrders(),
        getSequence(STORAGE_KEYS.INVOICE_SEQ),
        getSequence(STORAGE_KEYS.PROFORMA_SEQ),
      ]);
    } else {
      customInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOM, []);
      proformaInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.PROFORMA, []);
      printInvoices = getStoredJsonSync<any[]>(STORAGE_KEYS.PRINT, []);
      customers = getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOMERS, []);
      orders = getStoredJsonSync<any[]>(STORAGE_KEYS.ORDERS, []);
      invoiceSeq = getStoredSync(STORAGE_KEYS.INVOICE_SEQ, "");
      proformaSeq = getStoredSync(STORAGE_KEYS.PROFORMA_SEQ, "");
    }

    const dataBlock: InvoiceBackupPayload["data"] = {
      customInvoices,
      proformaInvoices,
      printInvoices,
      customers,
      orders,
      sequences: {
        invoiceSeq,
        proformaSeq,
      },
    };

    const checksum = await computeSha256(JSON.stringify(dataBlock));

    const payload: InvoiceBackupPayload = {
      version: "2.0.0-SQLITE",
      exportedAt: new Date().toISOString(),
      appId: "com.taadvertising.invoicing",
      checksum: checksum || undefined,
      stats: {
        customInvoicesCount: customInvoices.length,
        proformaInvoicesCount: proformaInvoices.length,
        printInvoicesCount: printInvoices.length,
        customersCount: customers.length,
        ordersCount: orders.length,
        totalInvoices: customInvoices.length + proformaInvoices.length + printInvoices.length,
      },
      data: dataBlock,
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `TA-Invoices-Backup-${dateStr}.json`;

    // 1. فحص توفر جسر أندرويد لحفظ الملف مباشرة في الجهاز بصيغة JSON صحيحة
    const androidPrint = (window as any).AndroidPrint;
    if (androidPrint && typeof androidPrint.saveFile === "function") {
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
      androidPrint.saveFile(base64, fileName, "application/json");
      toast.success(
        `تم حفظ النسخة الاحتياطية (${payload.stats.totalInvoices} فاتورة، ${customers.length} عميل، ${orders.length} طلب) بنجاح`,
        { id: toastId }
      );
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

    toast.success(
      `تم تنزيل النسخة الاحتياطية (${payload.stats.totalInvoices} فاتورة، ${customers.length} عميل) بنجاح`,
      { id: toastId }
    );
    return true;
  } catch (err: any) {
    console.error("Export invoice database error:", err);
    toast.error(`تعذر تصدير النسخة الاحتياطية: ${err?.message || "خطأ غير متوقع"}`, { id: toastId });
    return false;
  }
}

/**
 * استعادة ودمج النسخة الاحتياطية دون حذف أي فواتير أو سجلات حالية (Safe Non-Destructive Merge)
 */
export async function importInvoiceDatabase(jsonContent: string): Promise<ImportResult> {
  const toastId = toast.loading("جاري التحقق من النسخة الاحتياطية واستعادة قاعدة البيانات...");
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

    // التحقق من سلامة البصمة إن وُجدت
    if (parsed.checksum && parsed.data) {
      const expectedChecksum = await computeSha256(JSON.stringify(parsed.data));
      if (expectedChecksum && expectedChecksum !== parsed.checksum) {
        throw new Error("فشل التحقق من سلامة النسخة الاحتياطية (تعارض Checksum) — قد يكون الملف تالفاً.");
      }
    }

    const incomingCustom = Array.isArray(backupData.customInvoices) ? backupData.customInvoices : [];
    const incomingProforma = Array.isArray(backupData.proformaInvoices) ? backupData.proformaInvoices : [];
    const incomingPrint = Array.isArray(backupData.printInvoices) ? backupData.printInvoices : [];
    const incomingCustomers = Array.isArray(backupData.customers) ? backupData.customers : [];
    const incomingOrders = Array.isArray(backupData.orders) ? backupData.orders : [];

    // قراءة البيانات الحالية
    const currentCustom = Capacitor.isNativePlatform()
      ? await getAllCustomInvoices()
      : getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOM, []);
    const currentProforma = Capacitor.isNativePlatform()
      ? await getAllProformaInvoices()
      : getStoredJsonSync<any[]>(STORAGE_KEYS.PROFORMA, []);
    const currentPrint = Capacitor.isNativePlatform()
      ? await getAllPrintInvoices()
      : getStoredJsonSync<any[]>(STORAGE_KEYS.PRINT, []);
    const currentCustomers = Capacitor.isNativePlatform()
      ? await getAllCustomers()
      : getStoredJsonSync<any[]>(STORAGE_KEYS.CUSTOMERS, []);
    const currentOrders = Capacitor.isNativePlatform()
      ? await getAllOrders()
      : getStoredJsonSync<any[]>(STORAGE_KEYS.ORDERS, []);

    let addedCount = 0;
    let existingCount = 0;
    const addedCustom: any[] = [];
    const addedProforma: any[] = [];
    const addedPrint: any[] = [];
    const addedCustomers: any[] = [];
    const addedOrders: any[] = [];

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
        addedCustom.push(inv);
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
        addedProforma.push(p);
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
        addedPrint.push(inv);
        addedCount++;
      }
    }
    const mergedPrint = Array.from(printMap.values());

    // 4. دمج العملاء (Customers)
    const customerMap = new Map<string, any>();
    for (const c of currentCustomers) {
      customerMap.set(c.id || c.name, c);
    }
    for (const c of incomingCustomers) {
      const key = c.id || c.name;
      if (!customerMap.has(key)) {
        customerMap.set(key, c);
        addedCustomers.push(c);
      }
    }
    const mergedCustomers = Array.from(customerMap.values());

    // 5. دمج أوامر الشغل (Orders)
    const orderMap = new Map<string, any>();
    for (const o of currentOrders) {
      orderMap.set(o.id || o.orderNumber, o);
    }
    for (const o of incomingOrders) {
      const key = o.id || o.orderNumber;
      if (!orderMap.has(key)) {
        orderMap.set(key, o);
        addedOrders.push(o);
      }
    }
    const mergedOrders = Array.from(orderMap.values());

    // حفظ السجلات الجديدة في SQLite وتحديث الكاش مع تعقيم الحقول الأساسية لضمان السلامة
    const nowIso = new Date().toISOString();
    const normalizeId = (prefix: string, rawId: any, idx: number) =>
      rawId ? String(rawId) : `${prefix}-${Date.now()}-${idx}`;

    if (Capacitor.isNativePlatform()) {
      for (let i = 0; i < addedCustom.length; i++) {
        const inv = addedCustom[i];
        await upsertCustomInvoice({
          ...inv,
          id: normalizeId("imp-custom", inv?.id, i),
          meta: {
            serial: String(inv?.meta?.serial || "001"),
            type: inv?.meta?.type || "sales",
            date: String(inv?.meta?.date || nowIso.slice(0, 10)),
            partyName: String(inv?.meta?.partyName || "عميل غير محدد"),
            currency: inv?.currency || inv?.meta?.currency || "SDG",
            ...inv?.meta,
          },
          currency: inv?.currency || inv?.meta?.currency || "SDG",
          items: Array.isArray(inv?.items)
            ? inv.items.map((it: any, j: number) => ({
                ...it,
                id: normalizeId(`imp-ci-${i}`, it?.id, j),
                description: String(it?.description || ""),
                qty: Number(it?.qty) || 1,
                total: Number(it?.total) || 0,
              }))
            : [],
          totalAmount: Number(inv?.totalAmount) || 0,
          createdAt: inv?.createdAt || nowIso,
          updatedAt: inv?.updatedAt || nowIso,
        });
      }
      for (let i = 0; i < addedProforma.length; i++) {
        const p = addedProforma[i];
        await upsertProforma({
          ...p,
          id: normalizeId("imp-pf", p?.id, i),
          meta: {
            serial: String(p?.meta?.serial || "001"),
            date: String(p?.meta?.date || nowIso.slice(0, 10)),
            customerName: String(p?.meta?.customerName || "عميل غير محدد"),
            currency: p?.currency || p?.meta?.currency || "SDG",
            ...p?.meta,
          },
          currency: p?.currency || p?.meta?.currency || "SDG",
          lines: Array.isArray(p?.lines)
            ? p.lines.map((l: any, j: number) => ({
                ...l,
                id: normalizeId(`imp-pl-${i}`, l?.id, j),
                description: String(l?.description || ""),
                material: String(l?.material || "flex"),
                width: Number(l?.width) || 0,
                height: Number(l?.height) || 0,
                qty: Number(l?.qty) || 1,
                area: Number(l?.area) || 0,
                unitPrice: Number(l?.unitPrice) || 0,
                total: Number(l?.total) || 0,
              }))
            : [],
          totalArea: Number(p?.totalArea) || 0,
          totalQty: Number(p?.totalQty) || 0,
          totalAmount: Number(p?.totalAmount) || 0,
          totalInWords: String(p?.totalInWords || ""),
          status: p?.status || "draft",
          createdAt: p?.createdAt || nowIso,
          updatedAt: p?.updatedAt || nowIso,
        });
      }
      for (let i = 0; i < addedPrint.length; i++) {
        const inv = addedPrint[i];
        await upsertPrintInvoice({
          ...inv,
          id: normalizeId("imp-pi", inv?.id, i),
          serial: String(inv?.serial || "001"),
          date: String(inv?.date || nowIso.slice(0, 10)),
          customerName: String(inv?.customerName || "عميل نقدي"),
          phone: String(inv?.phone || ""),
          branch: String(inv?.branch || "امدرمان"),
          shipTo: String(inv?.shipTo || ""),
          clientTypes: Array.isArray(inv?.clientTypes) ? inv.clientTypes : [],
          lines: Array.isArray(inv?.lines) ? inv.lines : [],
          total: Number(inv?.total) || 0,
          paidAmount: Number(inv?.paidAmount) || 0,
          paymentStatus: inv?.paymentStatus || "paid",
          currency: inv?.currency || "SDG",
          createdAt: inv?.createdAt || nowIso,
        });
      }
      for (let i = 0; i < addedCustomers.length; i++) {
        const c = addedCustomers[i];
        await upsertCustomer({
          ...c,
          id: normalizeId("imp-cust", c?.id, i),
          name: String(c?.name || ""),
          phone: String(c?.phone || ""),
          type: c?.type || "individual",
          address: String(c?.address || ""),
          totalOrders: Number(c?.totalOrders) || 0,
          totalSpent: Number(c?.totalSpent) || 0,
          balance: Number(c?.balance) || 0,
          createdAt: c?.createdAt || nowIso,
        });
      }
      for (let i = 0; i < addedOrders.length; i++) {
        const o = addedOrders[i];
        await upsertOrder({
          ...o,
          id: normalizeId("imp-ord", o?.id, i),
          orderNumber: String(o?.orderNumber || "001"),
          customerName: String(o?.customerName || ""),
          customerPhone: String(o?.customerPhone || ""),
          clientType: o?.clientType || "takeaway",
          status: o?.status || "new",
          priority: o?.priority || "normal",
          items: Array.isArray(o?.items)
            ? o.items.map((it: any, j: number) => ({
                ...it,
                id: normalizeId(`imp-oi-${i}`, it?.id, j),
                description: String(it?.description || ""),
                material: it?.material || "flex",
                width: Number(it?.width) || 0,
                height: Number(it?.height) || 0,
                qty: Number(it?.qty) || 1,
                rollUsed: String(it?.rollUsed || ""),
                area: Number(it?.area) || 0,
                unitPrice: Number(it?.unitPrice) || 0,
                total: Number(it?.total) || 0,
              }))
            : [],
          totalArea: Number(o?.totalArea) || 0,
          totalCost: Number(o?.totalCost) || 0,
          paidAmount: Number(o?.paidAmount) || 0,
          branch: String(o?.branch || "امدرمان"),
          createdAt: o?.createdAt || nowIso,
        });
      }

      // تحديث العدادات التسلسلية إن كانت أكبر من الحالية
      const seqs = backupData.sequences || {};
      if (seqs.invoiceSeq) {
        const curInvSeq = parseInt((await getSequence(STORAGE_KEYS.INVOICE_SEQ)) || "0", 10) || 0;
        const incInvSeq = parseInt(String(seqs.invoiceSeq), 10) || 0;
        if (incInvSeq > curInvSeq) {
          await setSequence(STORAGE_KEYS.INVOICE_SEQ, String(incInvSeq));
          setMemoryCacheString(STORAGE_KEYS.INVOICE_SEQ, String(incInvSeq));
        }
      }
      if (seqs.proformaSeq) {
        const curPfSeq = parseInt((await getSequence(STORAGE_KEYS.PROFORMA_SEQ)) || "0", 10) || 0;
        const incPfSeq = parseInt(String(seqs.proformaSeq), 10) || 0;
        if (incPfSeq > curPfSeq) {
          await setSequence(STORAGE_KEYS.PROFORMA_SEQ, String(incPfSeq));
          setMemoryCacheString(STORAGE_KEYS.PROFORMA_SEQ, String(incPfSeq));
        }
      }
    }

    setMemoryCacheJson(STORAGE_KEYS.CUSTOM, mergedCustom);
    setMemoryCacheJson(STORAGE_KEYS.PROFORMA, mergedProforma);
    setMemoryCacheJson(STORAGE_KEYS.PRINT, mergedPrint);
    setMemoryCacheJson(STORAGE_KEYS.CUSTOMERS, mergedCustomers);
    setMemoryCacheJson(STORAGE_KEYS.ORDERS, mergedOrders);

    // إشعار التطبيق لتحديث كافة الشاشات والقوائم فورياً
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("native-storage-ready"));
    }

    const totalCount = mergedCustom.length + mergedProforma.length + mergedPrint.length;
    const msg = `تمت الاستعادة بنجاح: أضيفت ${addedCount} فاتورة جديدة (و${addedCustomers.length} عميل، ${addedOrders.length} طلب)، ووجد ${existingCount} مسبقاً. الإجمالي: ${totalCount} فاتورة.`;
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
