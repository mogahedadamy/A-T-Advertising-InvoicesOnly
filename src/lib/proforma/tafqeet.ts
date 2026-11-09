/**
 * تفقيط الأرقام وتحويلها إلى كلمات باللغتين العربية والإنجليزية
 * مصمم خصيصاً للفواتير والمطالبات المالية
 */

const ONES = [
  "",
  "واحد",
  "اثنان",
  "ثلاثة",
  "أربعة",
  "خمسة",
  "ستة",
  "سبعة",
  "ثمانية",
  "تسعة",
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];

const TENS = [
  "",
  "عشرة",
  "عشرون",
  "ثلاثون",
  "أربعون",
  "خمسون",
  "ستون",
  "سبعون",
  "ثمانون",
  "تسعون",
];

const HUNDREDS = [
  "",
  "مائة",
  "مئتان",
  "ثلاثمائة",
  "أربعمائة",
  "خمسمائة",
  "ستمائة",
  "سبعمائة",
  "ثمانمائة",
  "تسعمائة",
];

function convertGroup(n: number): string {
  let result = "";
  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    result += HUNDREDS[h];
  }

  if (remainder > 0) {
    if (result) result += " و";

    if (remainder < 20) {
      result += ONES[remainder];
    } else {
      const o = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (o > 0) {
        result += ONES[o] + " و" + TENS[t];
      } else {
        result += TENS[t];
      }
    }
  }

  return result;
}

/**
 * تحويل رقم صحيح إلى نص عربي
 */
export function numberToArabicWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "صفر";

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    if (billions === 1) parts.push("مليار");
    else if (billions === 2) parts.push("ملياران");
    else if (billions >= 3 && billions <= 10) parts.push(`${convertGroup(billions)} مليارات`);
    else parts.push(`${convertGroup(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroup(millions)} ملايين`);
    else parts.push(`${convertGroup(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroup(thousands)} آلاف`);
    else parts.push(`${convertGroup(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(convertGroup(remainder));
  }

  return parts.join(" و");
}

/**
 * تفقيط المبلغ المالي بالجنيه السوداني للفواتير
 * مثال: 365500 -> "فقط ثلاثمائة وستة وخمسون ألفاً وخمسمائة جنيه سوداني لا غير"
 */
export function tafqeetSDG(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "صفر جنيه سوداني";
  const words = numberToArabicWords(amount);
  return `فقط ${words} جنيه سوداني لا غير`;
}

/* ═══════════════════════════════════════════════════════════════
 * تفقيط الأرقام باللغة الإنجليزية (English Number to Words)
 * ═══════════════════════════════════════════════════════════════ */

const EN_ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const EN_TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertGroupEn(n: number): string {
  let str = "";
  const hundreds = Math.floor(n / 100);
  const remainder = n % 100;

  if (hundreds > 0) {
    str += `${EN_ONES[hundreds]} Hundred`;
  }

  if (remainder > 0) {
    if (str) str += " ";
    if (remainder < 20) {
      str += EN_ONES[remainder];
    } else {
      const t = Math.floor(remainder / 10);
      const o = remainder % 10;
      str += EN_TENS[t];
      if (o > 0) str += `-${EN_ONES[o]}`;
    }
  }

  return str;
}

/**
 * تحويل رقم صحيح إلى نص إنجليزي
 * Example: 96600 -> "Ninety-Six Thousand Six Hundred"
 */
export function numberToEnglishWords(num: number): string {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return "Zero";

  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  const parts: string[] = [];

  if (billions > 0) {
    parts.push(`${convertGroupEn(billions)} Billion`);
  }
  if (millions > 0) {
    parts.push(`${convertGroupEn(millions)} Million`);
  }
  if (thousands > 0) {
    parts.push(`${convertGroupEn(thousands)} Thousand`);
  }
  if (remainder > 0) {
    parts.push(convertGroupEn(remainder));
  }

  return parts.join(" ");
}

/**
 * تفقيط المبلغ المالي باللغة الإنجليزية
 * Example: 96600 -> "Only Ninety-Six Thousand Six Hundred Sudanese Pounds."
 */
export function tafqeetEnglish(amount: number, currency = "Sudanese Pounds"): string {
  if (!Number.isFinite(amount) || amount <= 0) return `Zero ${currency}`;
  const words = numberToEnglishWords(amount);
  return `Only ${words} ${currency}.`;
}

/**
 * المساعد الموحد للتفقيط حسب لغة المستند المحددة
 */
export function getInvoiceTafqeet(amount: number, isRtl: boolean): string {
  return isRtl ? tafqeetSDG(amount) : tafqeetEnglish(amount);
}
