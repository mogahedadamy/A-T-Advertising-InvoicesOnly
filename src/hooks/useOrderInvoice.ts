import { useMemo, useState } from "react";
import { toInvoiceLines, type OrderItem } from "@/lib/invoice/fromCalc";

export function useOrderInvoice(order: OrderItem[]) {
  const [open, setOpen] = useState(false);
  const lines = useMemo(() => toInvoiceLines(order), [order]);
  return {
    open,
    lines,
    issue: () => { if (order.length > 0) setOpen(true); },
    close: () => setOpen(false),
  };
}