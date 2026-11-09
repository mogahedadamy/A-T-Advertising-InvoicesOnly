import type { OrderItem } from "@/lib/invoice/fromCalc";
import { materialLabel } from "@/lib/printCalculator";
import type { CustomInvoiceItem } from "./types";

/**
 * تحويل بنود حاسبة الرولات والمقاسات مباشرة إلى بنود فاتورة معتمدة
 * يتم فصل البيان والوصف في كولوم مستقل، والخامة في كولوم، والأبعاد في كولوم خاص
 */
export const toCustomInvoiceItems = (items: OrderItem[]): CustomInvoiceItem[] =>
  (items || []).map((it, idx) => {
    const mat = materialLabel(it.material);
    // البيان المستقل الذي كتبه المستخدم
    const userDescription = it.description?.trim() || `طباعة ${mat}`;
    // كولوم المقاسات بالأرقام
    const dims = `${it.width} × ${it.height} سم (${it.area.toFixed(2)} م²)`;

    return {
      id: `ci-calc-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      description: userDescription,
      material: mat,
      dimensions: dims,
      qty: it.qty || 1,
      unitPrice: it.unitPrice || 0,
      total: it.cost || 0,
    };
  });
