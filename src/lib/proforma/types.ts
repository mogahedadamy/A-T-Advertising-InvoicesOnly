export interface ProformaLine {
  id: string;
  description: string;
  material: string;
  width: number; // بالسنتمتر
  height: number; // بالسنتمتر
  qty: number;
  unitPrice: number; // سعر المتر / الوحدة
  area: number; // إجمالي المساحة بالمتر المربع
  total: number; // القيمة الإجمالية للبند (ج.س)
}

export interface ProformaMeta {
  serial: string;
  date: string;
  customerName: string;
  customerEnName?: string;
  attn?: string; // عناية السيد / الشخص المسؤول (اختياري)
  phone?: string;
  branch?: string;
  notes?: string;
  validityDays?: number;
  accountName?: string;
  language?: "ar" | "en" | "auto";
}

export interface ProformaInvoice {
  id: string;
  meta: ProformaMeta;
  lines: ProformaLine[];
  totalArea: number;
  totalQty: number;
  totalAmount: number;
  totalInWords: string;
  status: "draft" | "sent" | "approved" | "converted";
  convertedOrderId?: string;
  createdAt: string;
  updatedAt: string;
}

export const MIN_PROFORMA_ROWS = 8;
