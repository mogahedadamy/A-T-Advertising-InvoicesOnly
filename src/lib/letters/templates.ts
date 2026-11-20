/**
 * ═══════════════════════════════════════════════════════════════
 * Unified Official Corporate Letterhead Defaults (AR / EN)
 * ═══════════════════════════════════════════════════════════════
 * Single flexible legal & corporate letterhead template for
 * T.A Advertising Solution. Users edit only the key details
 * (recipient, subject, optional title, body) in Arabic or English.
 */

import { getLocalIsoDate } from "@/lib/dateUtils";
import type { LetterLanguage, OfficialLetter } from "./types";

export const DEFAULT_SIGNATORY_NAME_AR = "طارق عثمان علي";
export const DEFAULT_SIGNATORY_TITLE_AR = "المدير العام — T.A Advertising Solution";
export const DEFAULT_SALUTATION_AR = "السلام عليكم ورحمة الله وبركاته،،،";
export const DEFAULT_CLOSING_AR = "وتفضلوا بقبول فائق الاحترام والتقدير،،،";

export const DEFAULT_SIGNATORY_NAME_EN = "Tarig Osman Ali";
export const DEFAULT_SIGNATORY_TITLE_EN = "General Manager — T.A Advertising Solution";
export const DEFAULT_SALUTATION_EN = "Dear Sir / Madam,";
export const DEFAULT_CLOSING_EN = "Yours sincerely,";

export const RECIPIENT_HONORIFIC_OPTIONS_AR = [
  "السادة /",
  "السيد /",
  "إدارة /",
  "إلى من يهمه الأمر",
] as const;

export const RECIPIENT_HONORIFIC_OPTIONS_EN = [
  "Messrs.",
  "Mr. / Ms.",
  "Management of",
  "To Whom It May Concern",
] as const;

export const DEFAULT_SUBJECT_AR = "تعاون ومراسلة رسمية — وكالة T.A Advertising Solution";
export const DEFAULT_SUBJECT_EN = "Official Corporate Correspondence — T.A Advertising Solution";

export const DEFAULT_BODY_AR = [
  "تهديكم وكالة T.A Advertising Solution أطيب التحيات وأصدق الأمنيات بدوام التوفيق والنجاح في أعمالكم.",
  "بالإشارة إلى الموضوع أعلاه، نود إفادتكم بالتفاصيل التالية: [اكتب التفاصيل المهمة هنا، مثل رقم الفاتورة أو نطاق العمل أو الطلب المطلوب]، وذلك وفقاً للاتفاق المعتمد بين الطرفين وبأعلى معايير الجودة والالتزام.",
  "نثمن عالياً ثقتكم وتعاونكم الدائم معنا، ونتطلع إلى استمرار الشراكة المثمرة بين مؤسستينا.",
].join("\n\n");

export const DEFAULT_BODY_EN = [
  "T.A Advertising Solution extends its warmest greetings and sincere wishes for your continued success and prosperity.",
  "With reference to the subject mentioned above, we would like to inform you of the following details: [Enter the key details here, such as invoice number, scope of work, or formal request], in accordance with our agreed terms and highest quality standards.",
  "We highly value your continued trust and cooperation, and we look forward to a fruitful ongoing partnership between our organizations.",
].join("\n\n");

export function createOfficialLetter(
  reference: string,
  language: LetterLanguage = "ar",
  overrides?: Partial<OfficialLetter>
): OfficialLetter {
  const isEn = language === "en";
  const nowIso = new Date().toISOString();
  return {
    id: `ltr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reference,
    language,
    date: getLocalIsoDate(),
    showLetterTitle: false,
    letterTitle: "",
    recipientHonorific: isEn ? "Messrs." : "السادة /",
    recipientName: "",
    recipientTitle: "",
    salutation: isEn ? DEFAULT_SALUTATION_EN : DEFAULT_SALUTATION_AR,
    subject: isEn ? DEFAULT_SUBJECT_EN : DEFAULT_SUBJECT_AR,
    body: isEn ? DEFAULT_BODY_EN : DEFAULT_BODY_AR,
    closingPhrase: isEn ? DEFAULT_CLOSING_EN : DEFAULT_CLOSING_AR,
    signatoryName: isEn ? DEFAULT_SIGNATORY_NAME_EN : DEFAULT_SIGNATORY_NAME_AR,
    signatoryTitle: isEn ? DEFAULT_SIGNATORY_TITLE_EN : DEFAULT_SIGNATORY_TITLE_AR,
    includeSignature: true,
    includeStamp: true,
    includeQr: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}
