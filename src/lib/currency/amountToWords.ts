import { AppCurrency, DEFAULT_CURRENCY, SUPPORTED_CURRENCIES } from "./types";

/* ═══════════════════════════════════════════════════════════════
 * محرك تحويل الأرقام إلى نصوص باللغة العربية (Arabic Tafqeet)
 * ═══════════════════════════════════════════════════════════════ */

const AR_ONES = [
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

const AR_FEMININE_ONES = [
  "",
  "واحدة",
  "اثنتان",
  "ثلاث",
  "أربع",
  "خمس",
  "ست",
  "سبع",
  "ثمان",
  "تسع",
  "عشر",
  "إحدى عشرة",
  "اثنتا عشرة",
  "ثلاث عشرة",
  "أربع عشرة",
  "خمس عشرة",
  "ست عشرة",
  "سبع عشرة",
  "ثماني عشرة",
  "تسع عشرة",
];

const AR_TENS = [
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

const AR_HUNDREDS = [
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

function convertGroupAr(n: number, isFeminine = false): string {
  let result = "";
  const h = Math.floor(n / 100);
  const remainder = n % 100;

  if (h > 0) {
    result += AR_HUNDREDS[h];
  }

  if (remainder > 0) {
    if (result) result += " و";

    const onesTable = isFeminine ? AR_FEMININE_ONES : AR_ONES;

    if (remainder < 20) {
      result += onesTable[remainder];
    } else {
      const o = remainder % 10;
      const t = Math.floor(remainder / 10);
      if (o > 0) {
        result += `${onesTable[o]} و${AR_TENS[t]}`;
      } else {
        result += AR_TENS[t];
      }
    }
  }

  return result;
}

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
    else if (billions >= 3 && billions <= 10) parts.push(`${convertGroupAr(billions)} مليارات`);
    else parts.push(`${convertGroupAr(billions)} مليار`);
  }

  if (millions > 0) {
    if (millions === 1) parts.push("مليون");
    else if (millions === 2) parts.push("مليونان");
    else if (millions >= 3 && millions <= 10) parts.push(`${convertGroupAr(millions)} ملايين`);
    else parts.push(`${convertGroupAr(millions)} مليون`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push("ألف");
    else if (thousands === 2) parts.push("ألفان");
    else if (thousands >= 3 && thousands <= 10) parts.push(`${convertGroupAr(thousands)} آلاف`);
    else parts.push(`${convertGroupAr(thousands)} ألف`);
  }

  if (remainder > 0) {
    parts.push(convertGroupAr(remainder));
  }

  return parts.join(" و");
}

/**
 * تحديد الصيغة الإعرابية المناسبة لاسم العملة حسب العدد المنتهي به المبلغ
 */
function getArabicCurrencyDenomination(n: number, currency: AppCurrency): string {
  const g = SUPPORTED_CURRENCIES[currency].arabicGrammar;
  const intVal = Math.floor(Math.abs(n));
  if (intVal === 0) return g.singular;
  if (intVal === 1) return `${g.singular} واحد`;
  if (intVal === 2) return g.dual;

  const rem1000 = intVal % 1000;
  const rem100 = intVal % 100;

  // إذا كان الرقم ينتهي بمضاعفات المائة أو الألف أو الملايين (مثل 65,000 أو 8,000 أو 2,500)
  if (rem100 === 0) {
    return g.singular;
  }

  // تمييز الأعداد من 3 إلى 10 (جمع مجرور)
  if (rem100 >= 3 && rem100 <= 10) {
    return g.plural;
  }

  // تمييز الأعداد من 11 إلى 99 (مفرد منصوب)
  if (rem100 >= 11 && rem100 <= 99) {
    return g.accusative;
  }

  // 1 أو 2 بعد العشرات والمئات
  if (rem100 === 1) return g.singular;
  if (rem100 === 2) return g.dual;

  return g.singular;
}

/**
 * تفقيط الكسور والأجزاء (القروش / السنتات / الهللات)
 */
function getArabicSubunitText(cents: number, currency: AppCurrency): string {
  if (cents <= 0) return "";
  const g = SUPPORTED_CURRENCIES[currency].arabicGrammar;
  const isFeminine = currency === "SAR"; // هللة مؤنث
  const words = convertGroupAr(cents, isFeminine);

  if (cents === 1) {
    return isFeminine ? `${g.subunitSingular} واحدة` : `${g.subunitSingular} واحد`;
  }
  if (cents === 2) {
    return g.subunitDual;
  }
  if (cents >= 3 && cents <= 10) {
    return `${words} ${g.subunitPlural}`;
  }
  return `${words} ${g.subunitAccusative}`;
}

/**
 * تحويل المبلغ الكامل بالعملة المحددة إلى كلمات باللغة العربية
 */
export function tafqeetArabic(amount: number, currency: AppCurrency = DEFAULT_CURRENCY): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    const g = SUPPORTED_CURRENCIES[currency].arabicGrammar;
    return `صفر ${g.singular} لا غير`;
  }

  const intPart = Math.floor(amount);
  const fracPart = Math.round((amount - intPart) * 100);

  let result = "";

  if (intPart === 1) {
    result = SUPPORTED_CURRENCIES[currency].arabicGrammar.singular;
  } else if (intPart === 2) {
    result = SUPPORTED_CURRENCIES[currency].arabicGrammar.dual;
  } else if (intPart > 0) {
    const words = numberToArabicWords(intPart);
    const denom = getArabicCurrencyDenomination(intPart, currency);
    result = `${words} ${denom}`;
  }

  // إضافة الكسر إن وُجد
  if (fracPart > 0) {
    const subText = getArabicSubunitText(fracPart, currency);
    if (result) {
      result += ` و${subText}`;
    } else {
      result = subText;
    }
  }

  return `${result} لا غير`;
}

/* ═══════════════════════════════════════════════════════════════
 * محرك تحويل الأرقام إلى نصوص باللغة الإنجليزية (English Tafqeet)
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
    if (str) str += " and ";
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
 * تحويل المبلغ الكامل بالعملة المحددة إلى كلمات باللغة الإنجليزية
 */
export function tafqeetEnglish(amount: number, currency: AppCurrency = DEFAULT_CURRENCY): string {
  const eg = SUPPORTED_CURRENCIES[currency].englishGrammar;
  if (!Number.isFinite(amount) || amount <= 0) {
    return `Zero ${eg.plural} Only.`;
  }

  const intPart = Math.floor(amount);
  const fracPart = Math.round((amount - intPart) * 100);

  let result = "";

  if (intPart > 0) {
    const words = numberToEnglishWords(intPart);
    const denom = intPart === 1 ? eg.singular : eg.plural;
    result = `${words} ${denom}`;
  }

  if (fracPart > 0) {
    const subWords = numberToEnglishWords(fracPart);
    const subDenom = fracPart === 1 ? eg.subunitSingular : eg.subunitPlural;
    if (result) {
      result += ` and ${subWords} ${subDenom}`;
    } else {
      result = `${subWords} ${subDenom}`;
    }
  }

  return `${result} Only.`;
}

/**
 * دالة التفقيط الموحدة الموجهة لكافة مستندات الفواتير
 */
export function getInvoiceAmountInWords(
  amount: number,
  currency: AppCurrency = DEFAULT_CURRENCY,
  isRtl = true
): string {
  return isRtl ? tafqeetArabic(amount, currency) : tafqeetEnglish(amount, currency);
}

