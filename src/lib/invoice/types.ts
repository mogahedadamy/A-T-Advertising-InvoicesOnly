// نماذج بيانات الفاتورة — مستقلة عن واجهة الحاسبة
export type ClientType = "A" | "B" | "takeaway" | "inhouse";

export const CLIENT_TYPES: { key: ClientType; label: string }[] = [
  { key: "A", label: "عميل (أ)" },
  { key: "B", label: "عميل (ب)" },
  { key: "takeaway", label: "سفري" },
  { key: "inhouse", label: "إن دور" },
];

export interface InvoiceLine {
  width: number; // cm
  height: number; // cm
  qty: number;
  material: string;
  description: string; // البيان
  unitPrice: number;
  total: number;
}

export interface InvoiceMeta {
  serial: string;
  date: string; // yyyy-mm-dd
  customerName: string;
  phone: string;
  clientTypes: ClientType[];
  shipTo: string;
  branch: string;
}

export interface Invoice {
  meta: InvoiceMeta;
  lines: InvoiceLine[];
}

export const invoiceTotal = (lines: InvoiceLine[]) =>
  lines.reduce((s, l) => s + l.total, 0);
