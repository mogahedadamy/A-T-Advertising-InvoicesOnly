/**
 * ═══════════════════════════════════════════════════════════════
 * محول التفقيط المالي المتوافق مع كافة العملات (Tafqeet Facade)
 * ═══════════════════════════════════════════════════════════════
 */

import {
  numberToArabicWords,
  numberToEnglishWords,
  tafqeetArabic,
  tafqeetEnglish,
  getInvoiceAmountInWords,
} from "@/lib/currency/amountToWords";
import type { AppCurrency } from "@/lib/currency/types";
import { DEFAULT_CURRENCY } from "@/lib/currency/types";

export { numberToArabicWords, numberToEnglishWords, tafqeetArabic, tafqeetEnglish };

/**
 * تفقيط المبلغ المالي بالجنيه السوداني للفواتير (للتوافق القديم)
 */
export function tafqeetSDG(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "صفر جنيه سوداني";
  return tafqeetArabic(amount, "SDG");
}

/**
 * المساعد الموحد للتفقيط حسب لغة المستند والعملة المحددة
 */
export function getInvoiceTafqeet(
  amount: number,
  isRtl: boolean,
  currency: AppCurrency = DEFAULT_CURRENCY
): string {
  return getInvoiceAmountInWords(amount, currency, isRtl);
}
