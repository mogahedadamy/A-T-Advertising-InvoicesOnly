export type CustomInvoiceType = "proforma" | "sales" | "purchase";

export interface CustomInvoiceItem {
  id: string;
  description: string;            // البيان / الوصف الذي كتبه المستخدم
  material?: string | undefined;   // نوع الخامة (مثل: بنر كوري، فليكس، فينيل)
  dimensions?: string | undefined; // أبعاد ومقاسات الرول (مثل: 3.00 × 1.50 م)
  qty: number;                    // العدد
  unitPrice?: number | undefined; // سعر الوحدة
  total: number;                  // القيمة الإجمالية
}

export interface CustomInvoiceMeta {
  serial: string;
  type: CustomInvoiceType;
  date: string;              // YYYY-MM-DD
  partyName: string;         // السادة : اسم الشركة أو الجهة الاعتبارية (Client)
  partyEnName?: string | undefined; // Customer in English
  attn?: string | undefined;        // عناية السيد / الشخص المسؤول (Attn) - اختياري
  phone?: string | undefined;
  salutation?: string | undefined;       // بعد التحية والاحترام
  closingNote?: string | undefined;      // لكم جزيل الشكر والتقدير
  accountNumber?: string | undefined;    // رقم الحساب
  accountName?: string | undefined;      // اسم الحساب
  signatoryTitle?: string | undefined;   // عنوان التوقيع (الإدارة / إدارة المبيعات)
  notes?: string | undefined;
  language?: "ar" | "en" | "auto" | undefined;
  /** عملة الفاتورة المحددة (SDG, USD, SAR, EGP) */
  currency?: "SDG" | "USD" | "SAR" | "EGP" | undefined;
  /** تاريخ الاستحقاق (PRD §5.2) */
  dueDate?: string | undefined;
  /** الخصم على الفاتورة (PRD §5.2) */
  discount?: number | undefined;
}

export interface CustomInvoice {
  id: string;
  meta: CustomInvoiceMeta;
  items: CustomInvoiceItem[];
  totalAmount: number;
  /** المجموع قبل الخصم (PRD §5.2) */
  subtotal?: number | undefined;
  totalInWords?: string | undefined;
  /** عملة الفاتورة المحددة */
  currency?: "SDG" | "USD" | "SAR" | "EGP" | undefined;
  /**
   * المرجع الرسمي للفاتورة (INV-DDMMYYYY-NNN / PINV-DDMMYYYY-NNN).
   * يُسند مرة واحدة عند أول حفظ ناجح ولا يتغيّر بعد ذلك (PRD §5.3.3).
   */
  reference?: string | undefined;
  referenceAssignedAt?: string | undefined;
  /** ربط المشروع/العميل/المورد (PRD §4, §7.2) */
  projectId?: string | undefined;
  customerId?: string | undefined;
  supplierId?: string | undefined;
  /** رقم فاتورة المورد الأصلية — لا يُستبدل أبداً بالمرجع الداخلي (PRD §5.3.8) */
  supplierInvoiceNumber?: string | undefined;
  /** إلغاء ناعم: السجل يبقى ويُستبعد من العرض (PRD §12.7) */
  cancelledAt?: string | undefined;
  cancellationReason?: string | undefined;
  createdAt: string;
  updatedAt: string;
}

export const INVOICE_TYPE_LABELS: Record<CustomInvoiceType, string> = {
  proforma: "فاتورة مبدئية",
  sales: "فاتورة مبيعات",
  purchase: "فاتورة مشتريات",
};
