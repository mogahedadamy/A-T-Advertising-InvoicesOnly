import { CustomInvoice } from "@/lib/billing/types";
import { InvoiceRecord } from "@/lib/invoicesStore";
import { ProformaInvoice } from "@/lib/proforma/types";

/**
 * الكيان الموحد الشامل لكافة الفواتير والإيصالات في النظام:
 * 1. فواتير مخصصة (Custom: مبيعات، مشتريات، عروض أسعار)
 * 2. إيصالات وفواتير الحاسبة والتشغيل (Calculator Operating Invoices)
 * 3. فواتير مبدئية معتمدة (Proforma Invoices A4)
 */
export type UnifiedInvoiceRecord =
  | {
      kind: "custom";
      id: string;
      serial: string;
      date: string;
      customerName: string;
      total: number;
      type: "proforma" | "sales" | "purchase";
      typeLabel: string;
      badgeColor: string;
      itemsCount: number;
      raw: CustomInvoice;
    }
  | {
      kind: "calculator";
      id: string;
      serial: string;
      date: string;
      customerName: string;
      total: number;
      type: "calculator";
      typeLabel: string;
      badgeColor: string;
      itemsCount: number;
      raw: InvoiceRecord;
    }
  | {
      kind: "proforma";
      id: string;
      serial: string;
      date: string;
      customerName: string;
      total: number;
      type: "proforma";
      typeLabel: string;
      badgeColor: string;
      itemsCount: number;
      raw: ProformaInvoice;
    };

export interface InvoicesFilterTab {
  key: string;
  label: string;
}

export const INVOICES_FILTER_TABS: InvoicesFilterTab[] = [
  { key: "all", label: "جميع الفواتير" },
  { key: "proforma", label: "فواتير مبدئية Proforma" },
  { key: "sales", label: "فواتير مبيعات" },
  { key: "calculator", label: "إيصالات الحاسبة" },
  { key: "purchase", label: "فواتير مشتريات" },
];

export interface InvoicesStats {
  totalCount: number;
  totalAmount: number;
  customCount: number;
  calcCount: number;
  proformaCount: number;
}
