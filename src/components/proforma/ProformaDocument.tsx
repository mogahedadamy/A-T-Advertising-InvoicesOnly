import React from "react";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { formatNumber } from "@/lib/printCalculator";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { getInvoiceTafqeet } from "@/lib/proforma/tafqeet";
import type { AppCurrency } from "@/lib/currency/types";
import { useCompanyProfile } from "@/lib/settings/companyProfileStore";
import { ProformaDocumentHeader } from "./ProformaDocumentHeader";
import { ProformaDocumentFooter } from "./ProformaDocumentFooter";
import { StandardInvoiceStampWatermark } from "@/components/billing/StandardInvoiceStampWatermark";
import { formatBiDiDimensions } from "@/lib/bidiUtils";

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
        {/* ─── 1-3. Header, Contact Bar & Metadata ─── */}
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

        {/* ─── 4. Items Table with Enlarged Stamp and Watermark ─── */}
        <div
          className="relative overflow-hidden mt-1.5 flex-1 flex flex-col justify-between"
          style={{
            border: "1px solid #1e293b",
            borderRadius: "10px",
            minHeight: "560px",
          }}
        >
          {/* Watermark & Enlarged Stamp */}
          <StandardInvoiceStampWatermark isRtl={isRtl} />

          {/* Table Structure */}
          <table
            className="w-full border-collapse relative z-10 text-[12px] h-full flex flex-col justify-between"
            style={{ backgroundColor: "transparent" }}
          >
            <thead className="w-full shrink-0">
              <tr
                className="w-full flex"
                style={{
                  backgroundColor: "#C1D0CD",
                  minHeight: "38px",
                  height: "38px",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <th
                  className="py-1 px-3 text-center font-black italic text-[13.5px] text-black flex items-center justify-center"
                  style={{
                    width: "54%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "البيان وتفاصيل العمل" : "Description & Specifications"}
                </th>
                <th
                  className="py-1 px-2 text-center font-black italic text-[13.5px] text-black flex items-center justify-center"
                  style={{
                    width: "10%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "العدد" : "Qty"}
                </th>
                <th
                  className="py-1 px-2 text-center font-black italic text-[13px] text-black flex items-center justify-center whitespace-nowrap"
                  style={{
                    width: "18%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? `الفئة (${currency})` : `Unit Price (${currency})`}
                </th>
                <th
                  className="py-1 px-3 text-center font-black italic text-[13px] text-black flex items-center justify-center whitespace-nowrap"
                  style={{ width: "18%" }}
                >
                  {isRtl ? `الجملة (${currency})` : `Total (${currency})`}
                </th>
              </tr>
            </thead>

            <tbody
              className="w-full flex-1 flex flex-col justify-between font-bold text-black"
              style={{ backgroundColor: "transparent" }}
            >
              {lines.map((line, idx) => (
                <tr
                  key={line.id || idx}
                  className="flex flex-1 items-stretch"
                  style={{
                    minHeight: "27px",
                    backgroundColor: "transparent",
                    borderBottom: idx === rowCount - 1 ? "none" : "1px solid #1e293b",
                  }}
                >
                  <td
                    className="py-1 px-3 flex items-center text-[12px] font-extrabold text-black"
                    style={{
                      width: "54%",
                      backgroundColor: "transparent",
                      ...(isRtl
                        ? { borderLeft: "1px solid #1e293b" }
                        : { borderRight: "1px solid #1e293b" }),
                    }}
                  >
                    <bdi
                      dir="auto"
                      className="block w-full text-start leading-normal"
                      style={{ unicodeBidi: "isolate", lineHeight: "1.35", overflow: "visible" }}
                    >
                      {formatBiDiDimensions(line.description)}
                    </bdi>
                  </td>
                  <td
                    className="py-1 px-2 flex items-center justify-center font-mono font-black text-[12.5px] text-black leading-normal"
                    style={{
                      width: "10%",
                      backgroundColor: "transparent",
                      ...(isRtl
                        ? { borderLeft: "1px solid #1e293b" }
                        : { borderRight: "1px solid #1e293b" }),
                    }}
                  >
                    {line.qty || ""}
                  </td>
                  <td
                    className="py-1 px-2 flex items-center justify-center font-mono font-black text-[12.5px] text-black leading-normal"
                    style={{
                      width: "18%",
                      backgroundColor: "transparent",
                      ...(isRtl
                        ? { borderLeft: "1px solid #1e293b" }
                        : { borderRight: "1px solid #1e293b" }),
                    }}
                  >
                    {line.unitPrice !== undefined ? formatAccountingNumber(line.unitPrice) : ""}
                  </td>
                  <td
                    className="py-1 px-3 flex items-center justify-center font-mono font-black text-[13px] text-black leading-normal"
                    style={{
                      width: "18%",
                      backgroundColor: "transparent",
                    }}
                  >
                    {formatAccountingNumber(line.total)}
                  </td>
                </tr>
              ))}

              {Array.from({ length: emptyRowsCount }).map((_, idx) => {
                const isLast = lines.length + idx === rowCount - 1;
                return (
                  <tr
                    key={`empty-${idx}`}
                    className="flex flex-1 items-stretch"
                    style={{
                      minHeight: "27px",
                      backgroundColor: "transparent",
                      borderBottom: isLast ? "none" : "1px solid #1e293b",
                    }}
                  >
                    <td
                      className="py-1 px-3 flex items-center"
                      style={{
                        width: "54%",
                        backgroundColor: "transparent",
                        ...(isRtl
                          ? { borderLeft: "1px solid #1e293b" }
                          : { borderRight: "1px solid #1e293b" }),
                      }}
                    />
                    <td
                      className="py-1 px-2 flex items-center justify-center"
                      style={{
                        width: "10%",
                        backgroundColor: "transparent",
                        ...(isRtl
                          ? { borderLeft: "1px solid #1e293b" }
                          : { borderRight: "1px solid #1e293b" }),
                      }}
                    />
                    <td
                      className="py-1 px-2 flex items-center justify-center"
                      style={{
                        width: "18%",
                        backgroundColor: "transparent",
                        ...(isRtl
                          ? { borderLeft: "1px solid #1e293b" }
                          : { borderRight: "1px solid #1e293b" }),
                      }}
                    />
                    <td
                      className="py-1 px-3 flex items-center justify-center"
                      style={{
                        width: "18%",
                        backgroundColor: "transparent",
                      }}
                    />
                  </tr>
                );
              })}
            </tbody>

            {/* سطر الإجمالي الكلي المالي المعياري المتناسق هندسياً بدون أي تجاوز */}
            <tfoot className="w-full shrink-0">
              <tr
                className="w-full flex items-center"
                style={{
                  minHeight: "42px",
                  height: "42px",
                  borderTop: "1px solid #1e293b",
                  backgroundColor: "#C1D0CD",
                }}
              >
                <td
                  className="px-3 flex items-center font-black italic text-[12px] text-black h-full py-1"
                  style={{
                    width: "64%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  <span className="shrink-0 leading-normal select-none" style={{ whiteSpace: "nowrap" }}>
                    {isRtl ? "المجموع الكلي:\u00A0\u00A0" : "Grand Total:\u00A0\u00A0"}
                  </span>
                  <span
                    className="not-italic font-bold text-[11px] text-slate-900 leading-normal"
                    style={{ lineHeight: "1.25", whiteSpace: "normal", marginInlineStart: "6px" }}
                  >
                    {invoiceTafqeet}
                  </span>
                </td>
                <td
                  className="px-3 flex items-center justify-between font-mono font-black text-black h-full py-1"
                  style={{
                    width: "36%",
                    minWidth: 0,
                    boxSizing: "border-box",
                    backgroundColor: "#ffffff",
                  }}
                >
                  <span className="text-[14.5px] font-black tracking-tight tabular-nums leading-normal">
                    {formatNumber(totalAmount)}
                  </span>
                  <span
                    className="inline-flex items-center justify-center font-sans font-black text-[11px] px-2 py-0.5 rounded border tracking-wider shrink-0 uppercase leading-normal"
                    style={{
                      backgroundColor: "#F1F5F4",
                      borderColor: "#C1D0CD",
                      color: "#0D4A39",
                    }}
                  >
                    {currency}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ─── 5-6. Payment Terms & Footer Boxes ─── */}
        <ProformaDocumentFooter meta={meta} isRtl={isRtl} />
      </div>
    );
  }
);

ProformaDocument.displayName = "ProformaDocument";
