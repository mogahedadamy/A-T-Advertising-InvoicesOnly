/**
 * أنظمة العملات المدعومة وتوصيفاتها القياسية
 * مطابقة لمواصفات ISO 4217
 */

export type AppCurrency = "SDG" | "USD" | "SAR" | "EGP";

export interface CurrencyConfig {
  code: AppCurrency;
  symbol: string;
  decimals: number;
  nameAr: string;
  nameEn: string;
  flag: string;
  /** التوصيف اللغوي للعملة بالعربية لقواعد التمييز والتفقيط */
  arabicGrammar: {
    singular: string;      // جنيه سوداني / دولار أمريكي / ريال سعودي / جنيه مصري
    dual: string;          // جنيهان سودانيان / دولاران أمريكيان / ريالان سعوديان / جنيهان مصريان
    plural: string;        // جنيهات سودانية / دولارات أمريكية / ريالات سعودية / جنيهات مصرية (3-10)
    accusative: string;    // جنيهاً سودانياً / دولاراً أمريكياً / ريالاً سعودياً / جنيهاً مصرياً (11-99)
    subunitSingular: string; // قرش / سنت / هللة
    subunitDual: string;     // قرشان / سنتان / هللتان
    subunitPlural: string;   // قروش / سنتات / هللات
    subunitAccusative: string; // قرشاً / سنتاً / هللةً
  };
  /** English currency denominations */
  englishGrammar: {
    singular: string;
    plural: string;
    subunitSingular: string;
    subunitPlural: string;
  };
}

export const SUPPORTED_CURRENCIES: Record<AppCurrency, CurrencyConfig> = {
  SDG: {
    code: "SDG",
    symbol: "ج.س",
    decimals: 2,
    nameAr: "الجنيه السوداني",
    nameEn: "Sudanese Pound",
    flag: "🇸🇩",
    arabicGrammar: {
      singular: "جنيه سوداني",
      dual: "جنيهان سودانيان",
      plural: "جنيهات سودانية",
      accusative: "جنيهاً سودانياً",
      subunitSingular: "قرش",
      subunitDual: "قرشان",
      subunitPlural: "قروش",
      subunitAccusative: "قرشاً",
    },
    englishGrammar: {
      singular: "Sudanese Pound",
      plural: "Sudanese Pounds",
      subunitSingular: "Piastre",
      subunitPlural: "Piastres",
    },
  },
  USD: {
    code: "USD",
    symbol: "$",
    decimals: 2,
    nameAr: "الدولار الأمريكي",
    nameEn: "US Dollar",
    flag: "🇺🇸",
    arabicGrammar: {
      singular: "دولار أمريكي",
      dual: "دولاران أمريكيان",
      plural: "دولارات أمريكية",
      accusative: "دولاراً أمريكياً",
      subunitSingular: "سنت",
      subunitDual: "سنتان",
      subunitPlural: "سنتات",
      subunitAccusative: "سنتاً",
    },
    englishGrammar: {
      singular: "US Dollar",
      plural: "US Dollars",
      subunitSingular: "Cent",
      subunitPlural: "Cents",
    },
  },
  SAR: {
    code: "SAR",
    symbol: "ر.س",
    decimals: 2,
    nameAr: "الريال السعودي",
    nameEn: "Saudi Riyal",
    flag: "🇸🇦",
    arabicGrammar: {
      singular: "ريال سعودي",
      dual: "ريالان سعوديان",
      plural: "ريالات سعودية",
      accusative: "ريالاً سعودياً",
      subunitSingular: "هللة",
      subunitDual: "هللتان",
      subunitPlural: "هللات",
      subunitAccusative: "هللةً",
    },
    englishGrammar: {
      singular: "Saudi Riyal",
      plural: "Saudi Riyals",
      subunitSingular: "Halala",
      subunitPlural: "Halalas",
    },
  },
  EGP: {
    code: "EGP",
    symbol: "ج.م",
    decimals: 2,
    nameAr: "الجنيه المصري",
    nameEn: "Egyptian Pound",
    flag: "🇪🇬",
    arabicGrammar: {
      singular: "جنيه مصري",
      dual: "جنيهان مصريان",
      plural: "جنيهات مصرية",
      accusative: "جنيهاً مصرياً",
      subunitSingular: "قرش",
      subunitDual: "قرشان",
      subunitPlural: "قروش",
      subunitAccusative: "قرشاً",
    },
    englishGrammar: {
      singular: "Egyptian Pound",
      plural: "Egyptian Pounds",
      subunitSingular: "Piastre",
      subunitPlural: "Piastres",
    },
  },
};

export const DEFAULT_CURRENCY: AppCurrency = "SDG";

export const CURRENCY_LIST = Object.values(SUPPORTED_CURRENCIES);

export function isValidCurrency(val: unknown): val is AppCurrency {
  return typeof val === "string" && (val === "SDG" || val === "USD" || val === "SAR" || val === "EGP");
}

export function sanitizeCurrency(val: unknown, fallback: AppCurrency = DEFAULT_CURRENCY): AppCurrency {
  if (isValidCurrency(val)) return val;
  return fallback;
}

