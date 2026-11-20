import React from "react";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { formatNumber } from "@/lib/printCalculator";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { getInvoiceTafqeet } from "@/lib/proforma/tafqeet";
import type { AppCurrency } from "@/lib/currency/types";
import { useCompanyProfile } from "@/lib/settings/companyProfileStore";
import { ProformaDocumentHeader } from "./ProformaDocumentHeader";
import { ProformaDocumentFooter } from "./ProformaDocumentFooter";
import { OfficialA4ItemsTable } from "@/components/billing/OfficialA4ItemsTable";

interface Props {
  invoice: ProformaInvoice;
  id?: string;
  isPrintMode?: boolean;
}

const EXACT_ROWS_COUNT = 18;

export const formatAccountingNumber = (n: number | undefined): string =>
  n !== undefined && !isNaN(n) ? formatNumber(n) : "0";

export const ProformaDocument = React.forwardRef<HTMLDivElement, Props>(
  ({ invoice, id = "proforma-invoice-doc" }, ref) => {
    const { meta, lines = [], totalAmount } = invoice;
    const { email: companyEmail, phone: companyPhone, addressAr, addressEn } = useCompanyProfile();

    const lang = detectInvoiceLanguage(
      meta.language,
      meta.customerName,
      meta.customerEnName,
      lines
    );
    const isRtl = lang === "ar";
    const currency = (invoice.currency || meta.currency || "SDG") as AppCurrency;
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

    const rowCount = Math.max(lines.length, EXACT_ROWS_COUNT);
    const emptyRowsCount = Math.max(0, rowCount - lines.length);

    const rawClientName = isRtl
      ? (meta.customerName || meta.customerEnName || "")
      : (meta.customerEnName || meta.customerName || "");
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
        <ProformaDocumentHeader
          meta={meta}
          clientName={clientName}
          attnPerson={attnPerson}
          formattedDate={formattedDate}
          isRtl={isRtl}
          companyEmail={companyEmail}
          companyPhone={companyPhone}
          companyAddress={isRtl ? addressAr : addressEn}
        />

        <OfficialA4ItemsTable
          rows={lines}
          rowCount={rowCount}
          emptyRowsCount={emptyRowsCount}
          isRtl={isRtl}
          currency={currency}
          totalAmount={totalAmount}
          invoiceTafqeet={invoiceTafqeet}
          formatAccountingNumber={formatAccountingNumber}
        />

        <ProformaDocumentFooter meta={meta} isRtl={isRtl} />
      </div>
    );
  }
);

ProformaDocument.displayName = "ProformaDocument";
