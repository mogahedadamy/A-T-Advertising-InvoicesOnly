/**
 * licenseGate.ts — بوابات صلاحيات الأعمال
 *
 * هذا الملف يحدد ما هو مسموح وما هو محجوب بناءً على حالة الترخيص.
 * يُستخدم في جميع أزرار الإنشاء والتعديل لتطبيق القيود بشكل موحد.
 *
 * سياسة الوصول:
 * - ACTIVE: كامل الصلاحيات
 * - EXPIRED / RENEWAL_REQUIRED / CLOCK_TAMPERED: قراءة وتصدير فقط
 * - NOT_ACTIVATED / PENDING / REVOKED: لا شيء (حجب كامل)
 * - CHECKING: انتظار (يُعامَل مؤقتاً كقراءة فقط)
 */

import type { LicenseStatus } from "./licenseStore";

// ─── مستويات الوصول ────────────────────────────────────────────────────────────

/** مستوى الوصول المحسوب من حالة الترخيص */
export type AccessLevel = "full" | "read_only" | "blocked";

/**
 * يحسب مستوى الوصول من حالة الترخيص.
 */
export function getAccessLevel(status: LicenseStatus): AccessLevel {
  switch (status) {
    case "active":
      return "full";

    case "expired":
    case "renewal_required":
    case "clock_tampered":
    case "checking":
      return "read_only";

    case "not_activated":
    case "pending_approval":
    case "revoked":
    default:
      return "blocked";
  }
}

// ─── فحوصات الأعمال ───────────────────────────────────────────────────────────

/** هل يمكن إنشاء أمر شغل جديد؟ */
export function canCreateOrder(status: LicenseStatus): boolean {
  return getAccessLevel(status) === "full";
}

/** هل يمكن حفظ فاتورة جديدة؟ */
export function canCreateInvoice(status: LicenseStatus): boolean {
  return getAccessLevel(status) === "full";
}

/** هل يمكن تعديل أسعار المواد؟ */
export function canEditMaterials(status: LicenseStatus): boolean {
  return getAccessLevel(status) === "full";
}

/** هل يمكن تعديل الملف الشخصي؟ */
export function canEditProfile(status: LicenseStatus): boolean {
  return getAccessLevel(status) === "full";
}

/** هل يمكن قراءة وعرض البيانات؟ */
export function canRead(status: LicenseStatus): boolean {
  return getAccessLevel(status) !== "blocked";
}

/** هل يمكن تصدير البيانات احتياطياً؟ */
export function canExportData(status: LicenseStatus): boolean {
  return getAccessLevel(status) !== "blocked";
}

/** هل يمكن طباعة الفواتير القديمة؟ */
export function canPrintOldInvoices(status: LicenseStatus): boolean {
  return getAccessLevel(status) !== "blocked";
}

// ─── رسائل التوضيح للمستخدم ──────────────────────────────────────────────────

/** رسالة توضيحية لعرضها عند رفض العملية */
export function getBlockMessage(status: LicenseStatus): string {
  switch (status) {
    case "expired":
      return "انتهت صلاحية الترخيص — يمكنك قراءة البيانات فقط. اضغط على «طلب التجديد» للاستمرار.";
    case "renewal_required":
      return "طلب التجديد قيد المراجعة — بمجرد الموافقة ستعود جميع الميزات.";
    case "clock_tampered":
      return "يرجى ضبط توقيت الجهاز لمواصلة العمل.";
    case "not_activated":
      return "التطبيق غير مرخّص — يرجى طلب التفعيل.";
    case "pending_approval":
      return "طلب التفعيل قيد المراجعة — يُرجى الانتظار.";
    case "revoked":
      return "تم إلغاء الترخيص — يرجى التواصل مع إدارة T.A للدعاية والإعلان.";
    default:
      return "غير مصرح بهذه العملية في الوقت الحالي.";
  }
}

// ─── Hook للاستخدام في المكونات ───────────────────────────────────────────────

import { useLicense } from "./licenseStore";

/**
 * Hook يوفر دوال الفحص لاستخدامها مباشرة في المكونات.
 */
export function useLicenseGate() {
  const { state } = useLicense();
  const { status } = state;

  return {
    status,
    accessLevel: getAccessLevel(status),
    canCreate: canCreateOrder(status),
    canCreateInvoice: canCreateInvoice(status),
    canEditMaterials: canEditMaterials(status),
    canEditProfile: canEditProfile(status),
    canRead: canRead(status),
    canExport: canExportData(status),
    blockMessage: getBlockMessage(status),
    isActive: status === "active",
    isExpired: status === "expired" || status === "renewal_required",
    isBlocked: getAccessLevel(status) === "blocked",
    isReadOnly: getAccessLevel(status) === "read_only",
  };
}
