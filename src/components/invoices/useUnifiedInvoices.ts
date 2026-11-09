import { useMemo } from "react";
import { useInvoices } from "@/lib/invoicesStore";
import { useCustomInvoices } from "@/lib/billing/store";
import { useProformaInvoices } from "@/lib/proforma/store";
import { INVOICE_TYPE_LABELS } from "@/lib/billing/types";
import { UnifiedInvoiceRecord, InvoicesStats } from "./types";

/**
 * خطاف مخصص لتوحيد بيانات الفواتير من كافة أقسام النظام:
 * 1. فواتير وإيصالات الحاسبة القياسية (Calculator Invoices)
 * 2. الفواتير المخصصة للمبيعات والمشتريات (Billing Invoices)
 * 3. الفواتير المبدئية الرسمية المعتمدة (Proforma Invoices A4)
 * يتولى الدمج، الترتيب الزمني، البحث، وحساب المؤشرات المالية
 */
export function useUnifiedInvoices(searchQuery: string = "", activeFilter: string = "all") {
  const calcInvoices = useInvoices();
  const customInvoices = useCustomInvoices();
  const proformaInvoices = useProformaInvoices();

  // 1. دمج وترتيب كافة الفواتير من المصادر الثلاثة
  const allRecords = useMemo<UnifiedInvoiceRecord[]>(() => {
    const list: UnifiedInvoiceRecord[] = [];

    // أ. الفواتير المبدئية الرسمية المعتمدة (Proforma Invoices)
    (proformaInvoices || []).forEach((inv) => {
      list.push({
        kind: "proforma",
        id: inv.id,
        serial: inv.meta?.serial || "001",
        date: inv.meta?.date || inv.createdAt?.slice(0, 10) || "",
        customerName: inv.meta?.customerName || inv.meta?.customerEnName || "عميل بدون اسم",
        total: Number(inv.totalAmount) || 0,
        type: "proforma",
        typeLabel: "فاتورة مبدئية Proforma",
        badgeColor: "border-[#C5A059]/40 text-[#C5A059] bg-[#C5A059]/10",
        itemsCount: (inv.lines || []).length,
        raw: inv,
      });
    });

    // ب. فواتير قسم الفواتير والمطالبات (Custom Invoices)
    (customInvoices || []).forEach((inv) => {
      const type = inv.meta?.type || "sales";
      // منع تكرار الفواتير المبدئية إذا كانت موجودة بالفعل في سجل الـ Proforma الرسمي بنفس الرقم
      if (type === "proforma" && (proformaInvoices || []).some((p) => p.meta?.serial === inv.meta?.serial)) {
        return;
      }

      const badgeColor =
        type === "sales"
          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : type === "purchase"
          ? "border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-500/10"
          : "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10";

      list.push({
        kind: "custom",
        id: inv.id,
        serial: inv.meta?.serial || "001",
        date: inv.meta?.date || inv.createdAt?.slice(0, 10) || "",
        customerName: inv.meta?.partyName || inv.meta?.partyEnName || "عميل غير محدد",
        total: Number(inv.totalAmount) || 0,
        type,
        typeLabel: INVOICE_TYPE_LABELS[type] || "فاتورة",
        badgeColor,
        itemsCount: (inv.items || []).length,
        raw: inv,
      });
    });

    // ج. إيصالات وفواتير قسم الحاسبة (Calculator Invoices)
    (calcInvoices || []).forEach((inv) => {
      list.push({
        kind: "calculator",
        id: inv.id,
        serial: inv.serial || "001",
        date: inv.date || inv.createdAt?.slice(0, 10) || "",
        customerName: inv.customerName || "عميل حاسبة",
        total: Number(inv.total) || 0,
        type: "calculator",
        typeLabel: "إيصال حاسبة A5",
        badgeColor: "border-primary/30 text-primary bg-primary/10",
        itemsCount: (inv.lines || []).length,
        raw: inv,
      });
    });

    // د. إزالة أي تكرار ناتج عن حفظ متكرر (Deduplication)
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const uniqueList: UnifiedInvoiceRecord[] = [];

    for (const rec of list) {
      const uniqueKey = `${rec.kind}-${rec.serial}`;
      if (!seenIds.has(rec.id) && !seenKeys.has(uniqueKey)) {
        seenIds.add(rec.id);
        seenKeys.add(uniqueKey);
        uniqueList.push(rec);
      }
    }

    // الترتيب من الأحدث للأقدم عددياً وتاريخياً
    return uniqueList.sort((a, b) => {
      const dateCompare = (b.date || "").localeCompare(a.date || "");
      if (dateCompare !== 0) return dateCompare;
      return b.serial.localeCompare(a.serial, undefined, { numeric: true });
    });
  }, [calcInvoices, customInvoices, proformaInvoices]);

  // 2. تصفية السجلات بناءً على نص البحث وتبويب الفرز
  const filteredRecords = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    const filter = activeFilter || "all";
    return allRecords.filter((rec) => {
      const matchSearch =
        !q ||
        (rec.serial || "").toLowerCase().includes(q) ||
        (rec.customerName || "").toLowerCase().includes(q) ||
        (rec.typeLabel || "").toLowerCase().includes(q);

      const matchType = filter === "all" || rec.type === filter;

      return matchSearch && matchType;
    });
  }, [allRecords, searchQuery, activeFilter]);

  // 3. المؤشرات والإحصائيات السريعة المحدثة
  const stats = useMemo<InvoicesStats>(() => {
    const totalCount = allRecords.length;
    const totalAmount = allRecords.reduce((sum, r) => sum + r.total, 0);
    const customCount = (customInvoices || []).length;
    const calcCount = (calcInvoices || []).length;
    const proformaCount = (proformaInvoices || []).length;

    return { totalCount, totalAmount, customCount, calcCount, proformaCount };
  }, [allRecords, customInvoices, calcInvoices, proformaInvoices]);

  return {
    allRecords,
    filteredRecords,
    stats,
  };
}
