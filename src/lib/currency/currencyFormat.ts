import { AppCurrency, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "./types";
import { formatNumber } from "@/lib/printCalculator";

export interface FormatCurrencyOptions {
  showIso?: boolean;
  decimals?: number;
  useFixedDecimals?: boolean;
}

/**
 * تنسيق المبالغ المالية مع كود الآيزو للعملة المحددة
 * مثال: formatCurrencyAmount(65000, "SDG") -> "65,000.00 SDG"
 */
export function formatCurrencyAmount(
  amount: number | undefined | null,
  currency: AppCurrency = DEFAULT_CURRENCY,
  options: FormatCurrencyOptions = {}
): string {
  const { showIso = true, decimals = 2, useFixedDecimals = true } = options;
  const num = typeof amount === "number" && !isNaN(amount) ? amount : 0;
  
  // تنسيق الأرقام مع فواصل الآلاف
  let formattedNumber: string;
  if (useFixedDecimals) {
    const fixed = num.toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const withCommas = Number(intPart).toLocaleString("en-US");
    formattedNumber = decPart !== undefined ? `${withCommas}.${decPart}` : withCommas;
  } else {
    formattedNumber = formatNumber(num);
  }

  if (!showIso) {
    return formattedNumber;
  }

  return `${formattedNumber} ${currency}`;
}

/**
 * جلب اسم العملة المترجم
 */
export function getCurrencyDisplayName(
  currency: AppCurrency = DEFAULT_CURRENCY,
  locale: "ar" | "en" = "ar"
): string {
  const conf = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  return locale === "en" ? conf.nameEn : conf.nameAr;
}

