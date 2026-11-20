import React from "react";
import type { CustomInvoice } from "@/lib/billing/types";
import { formatNumber } from "@/lib/printCalculator";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { getInvoiceTafqeet } from "@/lib/proforma/tafqeet";
import type { AppCurrency } from "@/lib/currency/types";
import { useCompanyProfile } from "@/lib/settings/companyProfileStore";
import { StandardInvoiceHeader } from "./StandardInvoiceHeader";
import { StandardInvoiceFooter } from "./StandardInvoiceFooter";
import { OfficialA4ItemsTable } from "./OfficialA4ItemsTable";

interface Props {
  invoice: CustomInvoice;
  id?: string;
  isPrintMode?: boolean;
}

const EXACT_ROWS_COUNT = 18;

export const formatAccountingNumber = (n: number | undefined): string =>
  n !== undefined && !isNaN(n) ? formatNumber(n) : "0";

export const StandardInvoiceDocument = React.forwardRef<HTMLDivElement, Props>(
  ({ invoice, id = "standard-invoice-doc" }, ref) => {
    const { meta, items, totalAmount } = invoice;
    const { email: companyEmail, phone: companyPhone, addressAr, addressEn } = useCompanyProfile();

    const lang = detectInvoiceLanguage(
      meta.language,
      meta.partyName,
      meta.partyEnName,
      items
    );
    const isRtl = lang === "ar";
    const currency = ((invoice as any).currency || meta.currency || "SDG") as AppCurrency;
    const invoiceTafqeet = getInvoiceTafqeet(totalAmount, isRtl, currency);

    const formattedDate = (() => {
      try {
        const parts = meta.date.split("-");
        if (parts.length === 3) {
          return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
        }
      } catch {}
      return meta.date || "";
    })();

    const rowCount = Math.max(items.length, EXACT_ROWS_COUNT);
    const emptyRowsCount = Math.max(0, rowCount - items.length);

    const badgeTitle = (() => {
      if (!isRtl) {
        if (meta.type === "purchase") return "Purchase Invoice";
        if (meta.type === "sales") return "Sales Invoice";
        return "Pro-invoice";
      }
      if (meta.type === "purchase") return "فاتورة مشتريات";
      if (meta.type === "sales") return "فاتورة مبيعات";
      return "فاتورة مبدئية";
    })();

    const rawClientName = isRtl
      ? (meta.partyName || meta.partyEnName || "")
      : (meta.partyEnName || meta.partyName || "");
    const clientName = rawClientName === "عميل غير محدد" ? "" : rawClientName;

    const attnPerson = meta.attn?.trim() || "";

    return (
      <div
        id={id}
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        className={`proforma-sheet standard-invoice-sheet bg-white text-black mx-auto select-text relative flex flex-col justify-between ${
          isRtl ? "text-right" : "text-left"
        }`}
        style={{
          width: "210mm",
          height: "297mm",
          maxHeight: "297mm",
          margin: 0,
          padding: "10mm 12mm 10mm 12mm",
          boxSizing: "border-box",
          overflow: "hidden",
          fontFamily: isRtl
            ? "'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
          backgroundColor: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          textAlign: isRtl ? "right" : "left",
        }}
      >
        <StandardInvoiceHeader
          meta={meta}
          badgeTitle={badgeTitle}
          clientName={clientName}
          attnPerson={attnPerson}
          formattedDate={formattedDate}
          reference={invoice.reference}
          isRtl={isRtl}
          companyEmail={companyEmail}
          companyPhone={companyPhone}
          companyAddress={isRtl ? addressAr : addressEn}
        />

        <OfficialA4ItemsTable
          rows={items}
          rowCount={rowCount}
          emptyRowsCount={emptyRowsCount}
          isRtl={isRtl}
          currency={currency}
          totalAmount={totalAmount}
          invoiceTafqeet={invoiceTafqeet}
          formatAccountingNumber={formatAccountingNumber}
        />

        <StandardInvoiceFooter meta={meta} isRtl={isRtl} />
      </div>
    );
  }
);

StandardInvoiceDocument.displayName = "StandardInvoiceDocument";
