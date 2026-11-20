/**
 * ═══════════════════════════════════════════════════════════════
 * Smart Offline Business & Legal Letter Translator (AR -> EN)
 * ═══════════════════════════════════════════════════════════════
 * 100% offline deterministic translation engine for corporate
 * correspondence, legal phrasing, financial claims, printing/ad
 * agency terminology, Sudanese locations, and standard letterhead
 * fields. Flags any remaining untranslated free-form Arabic words
 * transparently so the user can review them.
 */

import {
  DEFAULT_CLOSING_EN,
  DEFAULT_SALUTATION_EN,
  DEFAULT_SIGNATORY_NAME_EN,
  DEFAULT_SIGNATORY_TITLE_EN,
} from "./templates";
import type { OfficialLetter } from "./types";

const HONORIFIC_MAP: Array<[string, string]> = [
  ["إلى من يهمه الأمر", "To Whom It May Concern"],
  ["السادة /", "Messrs."],
  ["السيد /", "Mr. / Ms."],
  ["إدارة /", "Management of"],
];

const EXACT_PHRASE_MAP: Array<[string, string]> = [
  // Full standard paragraphs & greetings
  [
    "تهديكم وكالة T.A Advertising Solution أطيب التحيات وأصدق الأمنيات بدوام التوفيق والنجاح في أعمالكم ومشاريعكم الرائدة.",
    "T.A Advertising Solution extends its warmest greetings and sincere wishes for your continued success and prosperity in your leading business and projects.",
  ],
  [
    "تهديكم وكالة T.A Advertising Solution أطيب التحيات وأصدق الأمنيات بدوام التوفيق والنجاح في أعمالكم.",
    "T.A Advertising Solution extends its warmest greetings and sincere wishes for your continued success and prosperity.",
  ],
  [
    "بالإشارة إلى الموضوع أعلاه، نود إفادتكم بالتفاصيل التالية:",
    "With reference to the subject mentioned above, we would like to inform you of the following details:",
  ],
  [
    "وذلك وفقاً للاتفاق المعتمد بين الطرفين وبأعلى معايير الجودة والالتزام.",
    "in accordance with the mutual agreement between both parties and the highest standards of quality and commitment.",
  ],
  [
    "نثمن عالياً ثقتكم وتعاونكم الدائم معنا، ونتطلع إلى استمرار الشراكة المثمرة بين مؤسستينا.",
    "We highly value your continued trust and cooperation, and we look forward to a fruitful ongoing partnership between our organizations.",
  ],
  [
    "نثمن عالياً تعاونكم الدائم وثقتكم المستمرة في خدماتنا، ونتطلع إلى استمرار الشراكة المثمرة بين مؤسستينا.",
    "We highly value your continued cooperation and ongoing trust in our services, and we look forward to a fruitful partnership between our organizations.",
  ],
  [
    "تعاون ومراسلة رسمية — وكالة T.A Advertising Solution",
    "Official Corporate Correspondence — T.A Advertising Solution",
  ],
  [
    "المطالبة بسداد المستحقات المالية للفواتير الصادرة",
    "Formal Claim for Settlement of Outstanding Invoices",
  ],
  [
    "التعريف بخدمات وكالة T.A Advertising Solution وطلب اعتماد كمورد معتمد",
    "Company Profile Introduction & Vendor Registration Request — T.A Advertising Solution",
  ],
  [
    "تفويض مندوب رسمي لمتابعة الإجراءات واستلام المستندات",
    "Official Authorization of Representative for Document Collection & Follow-Up",
  ],
  ["السلام عليكم ورحمة الله وبركاته،،،", DEFAULT_SALUTATION_EN],
  ["السلام عليكم ورحمة الله وبركاته", DEFAULT_SALUTATION_EN],
  ["تحية طيبة وبعد،،،", DEFAULT_SALUTATION_EN],
  ["وتفضلوا بقبول فائق الاحترام والتقدير،،،", DEFAULT_CLOSING_EN],
  ["وتفضلوا بقبول فائق الاحترام والتقدير", DEFAULT_CLOSING_EN],
  ["مع خالص الشكر والتقدير", "With sincere thanks and appreciation,"],
  ["طارق عثمان علي", DEFAULT_SIGNATORY_NAME_EN],
  ["المدير العام — T.A Advertising Solution", DEFAULT_SIGNATORY_TITLE_EN],
  ["المدير العام", "General Manager"],
  ["المدير المالي والتشغيلي", "Financial & Operations Manager"],
  ["المدير المالي", "Finance Manager"],
  ["مدير المشتريات والعقود", "Procurement & Contracts Manager"],
  ["مدير المشتريات", "Procurement Manager"],
  ["إدارة المشتريات", "Procurement Department"],
  ["الإدارة المالية", "Finance Department"],

  // Common legal, commercial & advertising business clauses
  ["خطاب مطالبة مالية رسمية", "Official Financial Claim Letter"],
  ["خطاب مطالبة مالية", "Financial Claim Letter"],
  ["خطاب تعريف وعرض تعاون تجاري", "Introduction & Business Cooperation Letter"],
  ["خطاب تفويض واعتماد رسمي", "Official Authorization Letter"],
  ["خطاب تفويض رسمي", "Official Authorization Letter"],
  ["خطاب عرض سعر", "Official Quotation Letter"],
  ["خطاب رسمي", "Official Letter"],
  ["عناية السيد /", "Attn.: Mr. / Ms."],
  ["عناية السيد", "Attn.:"],
  ["بنك الخرطوم", "Bank of Khartoum"],
  ["طارق عثمان / تي ايه للدعايه والاعلان", "Tarig Osman / T.A Advertising"],
  ["تي ايه للدعايه والاعلان", "T.A Advertising Solution"],
  ["وكالة دعاية وإعلان", "Advertising & Printing Agency"],
  ["الدعاية والإعلان", "advertising and marketing"],
  ["الطباعة الرقمية", "digital printing"],
  ["اللوحات الإعلانية", "advertising signboards"],
  ["الهويات البصرية", "visual brand identities"],
  ["المطبوعات التجارية", "commercial print materials"],
  ["فاتورة مبيعات", "Sales Invoice"],
  ["فاتورة مبدئية", "Proforma Invoice"],
  ["عرض سعر", "Quotation"],
  ["كشف حساب مالي", "Financial Statement of Account"],
  ["كشف حساب", "Statement of Account"],
  ["المستحقات المالية", "financial dues"],
  ["الرصيد المستحق", "outstanding balance"],
  ["تاريخ الاستحقاق", "due date"],
  ["التحويل البنكي", "bank transfer"],
  ["إشعار التحويل", "transfer confirmation"],
  ["حسابنا البنكي المعتمد", "our official bank account"],
  ["رقم الفاتورة", "Invoice No."],
  ["تاريخ الفاتورة", "Invoice Date"],
  ["المبلغ الإجمالي", "total amount"],
  ["المبلغ والعملة", "amount and currency"],
  ["جنيه سوداني", "SDG"],
  ["دولار أمريكي", "USD"],
  ["ريال سعودي", "SAR"],
  ["جنيه مصري", "EGP"],
  ["أيام عمل", "business days"],
  ["ثلاثين يوماً", "thirty (30) days"],
  ["الخرطوم", "Khartoum"],
  ["بورتسودان", "Port Sudan"],
  ["السودان", "Sudan"],
  ["شركة ", "Company: "],
  ["مؤسسة ", "Est.: "],
  ["بنك ", "Bank "],
  ["مجموعة ", "Group "],
];

const ARABIC_CHAR_RE = /[\u0600-\u06FF]/;

function translatePhraseText(text: string): string {
  if (!text || !ARABIC_CHAR_RE.test(text)) return text;
  let result = text;
  for (const [ar, en] of EXACT_PHRASE_MAP) {
    if (result.includes(ar)) {
      result = result.split(ar).join(en);
    }
  }
  return result.replace(/،،،/g, ",").replace(/،/g, ",").trim();
}

export function translateLetterArToEnOffline(letter: OfficialLetter): {
  translated: OfficialLetter;
  hasRemainingArabic: boolean;
} {
  const mappedHonorific =
    HONORIFIC_MAP.find(([ar]) => letter.recipientHonorific.trim() === ar)?.[1] ||
    (ARABIC_CHAR_RE.test(letter.recipientHonorific) ? "Messrs." : letter.recipientHonorific);

  const translated: OfficialLetter = {
    ...letter,
    language: "en",
    recipientHonorific: mappedHonorific,
    recipientName: translatePhraseText(letter.recipientName),
    recipientTitle: letter.recipientTitle ? translatePhraseText(letter.recipientTitle) : "",
    salutation: translatePhraseText(letter.salutation) || DEFAULT_SALUTATION_EN,
    letterTitle: letter.letterTitle ? translatePhraseText(letter.letterTitle) : "",
    subject: translatePhraseText(letter.subject),
    body: translatePhraseText(letter.body),
    closingPhrase: translatePhraseText(letter.closingPhrase) || DEFAULT_CLOSING_EN,
    signatoryName: translatePhraseText(letter.signatoryName) || DEFAULT_SIGNATORY_NAME_EN,
    signatoryTitle: translatePhraseText(letter.signatoryTitle) || DEFAULT_SIGNATORY_TITLE_EN,
  };

  const fieldsToInspect = [
    translated.recipientName,
    translated.recipientTitle || "",
    translated.letterTitle,
    translated.subject,
    translated.body,
  ].join(" ");

  return {
    translated,
    hasRemainingArabic: ARABIC_CHAR_RE.test(fieldsToInspect),
  };
}
