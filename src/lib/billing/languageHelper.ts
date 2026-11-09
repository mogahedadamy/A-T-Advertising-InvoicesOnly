/**
 * مساعد تحديد لغة الفاتورة الذكي (عربي / إنجليزي)
 */
export function detectInvoiceLanguage(
  explicitLang?: "ar" | "en" | "auto" | string,
  primaryName?: string,
  secondaryName?: string,
  itemsOrLines?: Array<{ description?: string }>
): "ar" | "en" {
  if (explicitLang === "ar") return "ar";
  if (explicitLang === "en") return "en";

  // الكشف التلقائي: إذا وُجدت حروف عربية في الاسم أو في بنود الفاتورة
  const textToScan = [
    primaryName || "",
    secondaryName || "",
    ...(itemsOrLines || []).map((i) => i.description || ""),
  ].join(" ");

  const hasArabic = /[\u0600-\u06FF]/.test(textToScan);
  return hasArabic ? "ar" : "en";
}

