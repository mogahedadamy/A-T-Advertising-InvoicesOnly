export interface FifoInvoiceCandidate {
  id: string;
  outstanding: number;
}

export interface AllocationFormRow {
  invoiceId: string;
  amount: string;
}

export function allocateInvoicesFifo(
  invoices: FifoInvoiceCandidate[],
  paymentAmount: number
): { rows: AllocationFormRow[]; suggestedAmount?: string } {
  if (invoices.length === 0) {
    return { rows: [] };
  }
  if (paymentAmount > 0) {
    let budget = paymentAmount;
    const nextRows: AllocationFormRow[] = [];
    for (const inv of invoices) {
      if (budget <= 0) break;
      const share = Math.min(budget, inv.outstanding);
      if (share > 0) {
        nextRows.push({ invoiceId: inv.id, amount: String(share) });
        budget = Math.max(0, Number((budget - share).toFixed(2)));
      }
    }
    return { rows: nextRows };
  }

  const totalOutstanding = Number(
    invoices.reduce((sum, inv) => sum + inv.outstanding, 0).toFixed(2)
  );
  return {
    rows: invoices.map((inv) => ({
      invoiceId: inv.id,
      amount: String(inv.outstanding),
    })),
    suggestedAmount: String(totalOutstanding),
  };
}
