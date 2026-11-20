/**
 * ═══════════════════════════════════════════════════════════════
 * Official Corporate Letter Templates — T.A Advertising Solution
 * ═══════════════════════════════════════════════════════════════
 * Three authoritative legal & corporate Arabic templates tailored
 * for advertising, printing, and commercial client correspondence.
 */

import { getLocalIsoDate } from "@/lib/dateUtils";
import type { LetterTemplateId, LetterTemplateMeta, OfficialLetter } from "./types";

export const DEFAULT_SIGNATORY_NAME = "طارق عثمان علي";
export const DEFAULT_SIGNATORY_TITLE = "المدير العام — T.A Advertising Solution";
export const DEFAULT_SALUTATION = "السلام عليكم ورحمة الله وبركاته،،،";
export const DEFAULT_CLOSING_PHRASE = "وتفضلوا بقبول فائق الاحترام والتقدير،،،";

export const RECIPIENT_HONORIFIC_OPTIONS = [
  "السادة /",
  "السيد /",
  "إدارة /",
  "إلى من يهمه الأمر",
] as const;

export const LETTER_TEMPLATES: readonly LetterTemplateMeta[] = [
  {
    id: "introduction",
    shortLabel: "تعريف وتعاون",
    title: "خطاب تعريف وعرض تعاون تجاري",
    description: "لتقديم الوكالة للشركات والمؤسسات وطلب الاعتماد كمورد معتمد",
    defaultHonorific: "السادة /",
    defaultSubject: "التعريف بخدمات وكالة T.A Advertising Solution وطلب اعتماد كمورد معتمد",
    defaultSalutation: DEFAULT_SALUTATION,
    defaultBody: [
      "تهديكم وكالة T.A Advertising Solution أطيب التحيات وأصدق الأمنيات بدوام التوفيق والنجاح في أعمالكم ومشاريعكم الرائدة.",
      "يسعدنا أن نضع بين أيديكم خدماتنا المتكاملة في مجال الدعاية والإعلان، والطباعة الرقمية عالية الدقة، وتصميم وتنفيذ اللوحات الإعلانية والهويات البصرية والمطبوعات التجارية، وذلك وفق أعلى معايير الجودة والالتزام التام بمواعيد التسليم في كلٍ من الخرطوم وبورتسودان.",
      "نأمل من سيادتكم التكرم بالموافقة على إدراج وكالتنا ضمن قائمة الموردين المعتمدين لديكم، وإتاحة الفرصة لتقديم عروض أسعار تنافسية لاحتياجاتكم الإعلانية والطباعية القادمة، ونؤكد استعدادنا الكامل لتحديد موعد للاجتماع بكم وتقديم نماذج من أعمالنا السابقة.",
    ].join("\n\n"),
    defaultClosingPhrase: DEFAULT_CLOSING_PHRASE,
  },
  {
    id: "financial_claim",
    shortLabel: "مطالبة مالية",
    title: "خطاب مطالبة مالية رسمية",
    description: "لمتابعة تحصيل الفواتير والمستحقات المالية بصفة رسمية وقانونية",
    defaultHonorific: "السادة /",
    defaultSubject: "المطالبة بسداد المستحقات المالية للفواتير الصادرة",
    defaultSalutation: DEFAULT_SALUTATION,
    defaultBody: [
      "بالإشارة إلى التعامل التجاري القائم بيننا والأعمال الإعلانية والطباعية التي تم تنفيذها وتسليمها لجهتكم الموقرة على الوجه الأكمل، نود إفادتكم بأن الرصيد المستحق عن الفاتورة رقم [رقم الفاتورة] بتاريخ [تاريخ الفاتورة] يبلغ [المبلغ والعملة].",
      "وحيث إن المبلغ المذكور قد حل موعد استحقاقه، نرجو من سيادتكم التكرم بتوجيه الإدارة المالية لديكم لإتمام السداد خلال مدة أقصاها [7 أيام عمل] من تاريخه، وذلك عبر التحويل إلى حسابنا البنكي المعتمد: بنك الخرطوم رقم (3283046) باسم (طارق عثمان / تي ايه للدعايه والاعلان)، مع موافاتنا بإشعار التحويل.",
      "نثمن عالياً تعاونكم الدائم وثقتكم المستمرة في خدماتنا، ونتطلع إلى استمرار الشراكة المثمرة بين مؤسستينا.",
    ].join("\n\n"),
    defaultClosingPhrase: DEFAULT_CLOSING_PHRASE,
  },
  {
    id: "authorization",
    shortLabel: "تفويض رسمي",
    title: "خطاب تفويض واعتماد رسمي",
    description: "لتفويض مندوب رسمي لاستلام المستندات أو الشيكات أو متابعة الإجراءات",
    defaultHonorific: "السادة /",
    defaultSubject: "تفويض مندوب رسمي لمتابعة الإجراءات واستلام المستندات",
    defaultSalutation: DEFAULT_SALUTATION,
    defaultBody: [
      "نفيد سيادتكم بأننا قد فوّضنا السيد / [اسم المندوب المفوَّض]، الحامل للرقم الوطني / جواز السفر رقم [رقم الهوية]، بتمثيل وكالة T.A Advertising Solution أمام جهتكم الموقرة.",
      "يشمل هذا التفويض صلاحية [تسليم الفواتير والمستندات الرسمية / استلام الشيكات وإشعارات السداد / التوقيع بالاستلام ومتابعة إجراءات التنفيذ]، وذلك فيما يتعلق بـ [اسم المشروع أو المعاملة].",
      "يسري مفعول هذا التفويض اعتباراً من تاريخ صدوره ولمدة [ثلاثين يوماً] ما لم يُلغَ بخطاب رسمي لاحق، وتتحمل الوكالة كامل المسؤولية القانونية والإدارية المترتبة على ما يقوم به المفوَّض في حدود هذا التفويض.",
    ].join("\n\n"),
    defaultClosingPhrase: DEFAULT_CLOSING_PHRASE,
  },
] as const;

export function getLetterTemplate(id: LetterTemplateId): LetterTemplateMeta {
  return LETTER_TEMPLATES.find((t) => t.id === id) || LETTER_TEMPLATES[0];
}

export function createLetterFromTemplate(
  templateId: LetterTemplateId,
  reference: string,
  overrides?: Partial<OfficialLetter>
): OfficialLetter {
  const tpl = getLetterTemplate(templateId);
  const nowIso = new Date().toISOString();
  return {
    id: `ltr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    reference,
    templateId: tpl.id,
    date: getLocalIsoDate(),
    recipientHonorific: tpl.defaultHonorific,
    recipientName: "",
    recipientTitle: "",
    salutation: tpl.defaultSalutation,
    letterTitle: tpl.title,
    subject: tpl.defaultSubject,
    body: tpl.defaultBody,
    closingPhrase: tpl.defaultClosingPhrase,
    signatoryName: DEFAULT_SIGNATORY_NAME,
    signatoryTitle: DEFAULT_SIGNATORY_TITLE,
    includeSignature: true,
    includeStamp: true,
    includeQr: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}
