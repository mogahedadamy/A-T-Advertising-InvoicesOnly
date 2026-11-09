import type { OrderItem } from "@/lib/invoice/fromCalc";
import { materialLabel } from "@/lib/printCalculator";
import type { ProformaLine } from "./types";

export const toProformaLines = (items: OrderItem[]): ProformaLine[] =>
  items.map((it, idx) => ({
    id: `pline-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    width: it.width,
    height: it.height,
    qty: it.qty,
    material: materialLabel(it.material),
    description: it.description?.trim() ? it.description.trim() : `بند طباعة ${materialLabel(it.material)}`,
    unitPrice: it.unitPrice,
    area: Number(it.area.toFixed(2)),
    total: it.cost,
  }));
