import type { OrderItem } from "@/lib/invoice/fromCalc";
import { materialLabel } from "@/lib/printCalculator";
import type { CustomInvoiceItem } from "./types";

/**
 * تحويل بنود حاسبة الرولات والمقاسات مباشرة إلى بنود فاتورة مبيعات معتمدة
 * تدمج الأبعاد ونوع الخامة والمساحة في وصف البند بدقة محاسبية
 */
export const toCustomInvoiceItems = (items: OrderItem[]): CustomInvoiceItem[] =>
  (items || []).map((it, idx) => {
    const mat = materialLabel(it.material);
    const desc = it.description?.trim()
      ? `${it.description.trim()} — ${mat} (${it.width} × ${it.height} سم)`
      : `طباعة ${mat} (${it.width} × ${it.height} سم — مساحة ${it.area.toFixed(2)} م²)`;

    return {
      id: `ci-calc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      description: desc,
      qty: it.qty || 1,
      unitPrice: it.unitPrice || 0,
      total: it.cost || 0,
    };
  });

