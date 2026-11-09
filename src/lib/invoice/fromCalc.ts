import type { CalcResult } from "@/lib/printCalculator";
import { materialLabel } from "@/lib/printCalculator";
import type { InvoiceLine } from "./types";

export type OrderItem = CalcResult & { description?: string };

export const toInvoiceLines = (items: OrderItem[]): InvoiceLine[] =>
  items.map((it) => ({
    width: it.width,
    height: it.height,
    qty: it.qty,
    material: materialLabel(it.material),
    description: it.description ?? "",
    unitPrice: it.unitPrice,
    total: it.cost,
  }));
