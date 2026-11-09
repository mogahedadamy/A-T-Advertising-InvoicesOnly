import React from "react";
import type { ProformaInvoice } from "@/lib/proforma/types";
import { formatNumber } from "@/lib/printCalculator";
import {
  TA_LOGO_GREEN_BASE64,
  TA_STAMP_BASE64,
  TA_QR_CODE_BASE64,
} from "@/assets/invoiceImagesBase64";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";

interface Props {
  invoice: ProformaInvoice;
  id?: string;
  isPrintMode?: boolean;
}

// المطابقة التامة مع النموذج الورقي المعتمد: 18 صفاً كاملاً لملء مساحة A4 بتناسق تام
const EXACT_ROWS_COUNT = 18;

export const ProformaDocument = React.forwardRef<HTMLDivElement, Props>(
  ({ invoice, id = "proforma-document" }, ref) => {
    const { meta, lines, totalAmount } = invoice;

    // تحديد لغة الفاتورة الذكي (عربي / إنجليزي)
    const lang = detectInvoiceLanguage(
      meta.language,
      meta.customerName,
      meta.customerEnName,
      lines
    );
    const isRtl = lang === "ar";

    // Date formatting matching original paper: DD / MM / YYYY
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

    // اسم العميل المعروض
    const clientName = isRtl
      ? (meta.customerName || meta.customerEnName || "")
      : (meta.customerEnName || meta.customerName || "");

    const attnPerson = meta.attn?.trim() || (meta.phone ? `Phone: ${meta.phone}` : "");

    return (
      <div
        id={id}
        ref={ref}
        dir={isRtl ? "rtl" : "ltr"}
        className="proforma-sheet bg-white text-black mx-auto select-text relative flex flex-col justify-between"
        style={{
          width: "210mm",
          height: "297mm",
          maxHeight: "297mm",
          margin: 0,
          padding: "10mm 12mm 10mm 12mm",
          boxSizing: "border-box",
          overflow: "hidden",
          fontFamily: isRtl
            ? "var(--font-arabic, 'Tajawal', system-ui, sans-serif)"
            : "system-ui, -apple-system, sans-serif",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
          backgroundColor: "#ffffff",
        }}
      >
        {/* ─── 1. Header (Logo + Badge in EXACT CENTER) ─── */}
        <div className="relative flex items-center justify-between pb-1 min-h-[80px]">
          {/* Logo on Side */}
          <div className="flex items-center z-10">
            <img
              src={TA_LOGO_GREEN_BASE64}
              alt="T.A Advertising Solution"
              className="h-[78px] w-auto object-contain select-none"
            />
          </div>

          {/* Pro. Invoice Badge in EXACT CENTER of the Top Page */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div
              className="flex items-center justify-center font-black italic tracking-wide text-black select-none pointer-events-auto"
              style={{
                minWidth: "210px",
                padding: "0 20px",
                height: "56px",
                backgroundColor: "#C1D0CD",
                borderRadius: "20px",
                fontSize: isRtl ? "22px" : "26px",
              }}
            >
              {isRtl ? "فاتورة مبدئية" : "Pro. Invoice"}
            </div>
          </div>

          {/* Symmetrical placeholder for balance */}
          <div className="w-[100px] shrink-0" />
        </div>

        {/* ─── 2. Contact Information Bar ─── */}
        <div
          className="my-1.5 flex items-center justify-between font-bold text-black select-none shrink-0"
          style={{
            height: "38px",
            padding: "0 18px",
            backgroundColor: "#C1D0CD",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        >
          <span className="font-extrabold tracking-wide" dir="ltr">
            +249 12371 1444 &nbsp;-&nbsp; +249 91296 8886
          </span>
          <span className="font-extrabold lowercase">t.aadvertising@hotmail.com</span>
          <span className="font-extrabold">
            {isRtl ? "السودان، الخرطوم - بورتسودان" : "Sudan, Khartoum - Portsudan"}
          </span>
        </div>

        {/* ─── 3. Client & Invoice Meta Info (Side by Side Boxes) ─── */}
        <div className="my-1.5 flex gap-3 text-[12px] shrink-0">
          {/* Client Details Box */}
          <div
            className="rounded-[10px] bg-white p-2.5 px-4 flex flex-col justify-center flex-1"
            style={{
              border: "1px solid #1e293b",
              height: "68px",
            }}
          >
            {/* Client Line */}
            <div className="flex items-baseline text-[12px] leading-tight mb-2.5">
              <span className={`font-bold text-black shrink-0 ${isRtl ? "w-[62px]" : "w-[58px]"}`}>
                {isRtl ? "العميل :" : "Client :"}
              </span>
              <div className="flex-1 border-b border-black pb-0.5 font-bold text-[13.5px] text-black px-1 truncate">
                {clientName}
              </div>
            </div>

            {/* Attn Line (عناية السيد / المسؤول) */}
            <div className="flex items-baseline text-[12px] leading-tight">
              <span className={`font-bold text-black shrink-0 ${isRtl ? "w-[62px]" : "w-[58px]"}`}>
                {isRtl ? "عناية السيد :" : "Attn.:"}
              </span>
              <div className="flex-1 border-b border-black pb-0.5 font-semibold text-[12.5px] text-black px-1 truncate">
                {attnPerson}
              </div>
            </div>
          </div>

          {/* Date & Ref Box */}
          <div
            className="rounded-[10px] bg-white p-2.5 px-3 flex flex-col justify-center shrink-0"
            style={{
              border: "1px solid #1e293b",
              height: "68px",
              width: "190px",
            }}
          >
            {/* Date Line */}
            <div className="flex items-baseline text-[12px] leading-tight mb-2.5">
              <span className={`font-bold text-black shrink-0 ${isRtl ? "w-[48px]" : "w-[40px]"}`}>
                {isRtl ? "التاريخ :" : "Date:"}
              </span>
              <div className="flex-1 border-b border-black pb-0.5 font-mono font-bold text-[11px] text-center text-black whitespace-nowrap tracking-tight overflow-hidden">
                {formattedDate}
              </div>
            </div>

            {/* Ref Line */}
            <div className="flex items-baseline text-[12px] leading-tight">
              <span className={`font-bold text-black shrink-0 ${isRtl ? "w-[48px]" : "w-[40px]"}`}>
                {isRtl ? "الرقم :" : "Ref.:"}
              </span>
              <div className="flex-1 border-b border-black pb-0.5 font-mono font-bold text-[11px] text-center text-black whitespace-nowrap tracking-tight overflow-hidden">
                {meta.serial ? `#${meta.serial}` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 4. Items Table (Rounded Box, Halftone Watermark, & Stamp) ─── */}
        <div
          className="relative overflow-hidden mt-1.5 flex-1 flex flex-col justify-between"
          style={{
            border: "1px solid #1e293b",
            borderRadius: "10px",
            minHeight: "560px",
          }}
        >
          {/* Halftone Watermark in Table Center */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
            <img
              src={TA_LOGO_GREEN_BASE64}
              alt="Watermark"
              className="w-[460px] h-auto object-contain select-none"
              style={{
                opacity: 0.12,
              }}
            />
          </div>

          {/* Official Stamp */}
          <div
            className="pointer-events-none absolute z-20 flex items-center"
            style={{
              bottom: "44px",
              ...(isRtl ? { right: "32px" } : { left: "32px" }),
            }}
          >
            <img
              src={TA_STAMP_BASE64}
              alt="Official Stamp"
              className="h-[74px] w-auto object-contain select-none"
              style={{
                opacity: 0.92,
              }}
            />
          </div>

          {/* Table Structure */}
          <table className="w-full border-collapse relative z-10 text-[12px] h-full flex flex-col justify-between">
            <thead className="w-full shrink-0">
              <tr
                className="w-full flex"
                style={{
                  backgroundColor: "#C1D0CD",
                  height: "38px",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <th
                  className="py-2 px-3 text-center font-black italic text-[14px] text-black flex items-center justify-center"
                  style={{
                    width: "63%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "البيان والمواصفات" : "Description"}
                </th>
                <th
                  className="py-2 px-2 text-center font-black italic text-[14px] text-black flex items-center justify-center"
                  style={{
                    width: "8.5%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "العدد" : "Qty"}
                </th>
                <th
                  className="py-2 px-2 text-center font-black italic text-[14px] text-black flex items-center justify-center"
                  style={{
                    width: "12.5%",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "سعر الوحدة" : "Unit Price"}
                </th>
                <th
                  className="py-2 px-3 text-center font-black italic text-[14px] text-black flex items-center justify-center"
                  style={{ width: "16%" }}
                >
                  {isRtl ? "الإجمالي" : "Total"}
                </th>
              </tr>
            </thead>
            <tbody className="w-full flex-1 flex flex-col justify-between">
              {lines.map((line, idx) => (
                <tr
                  key={line.id || idx}
                  className="w-full flex flex-1 items-center"
                  style={{
                    minHeight: "29px",
                    borderBottom: "1px solid #94a3b8",
                  }}
                >
                  <td
                    className={`py-0.5 px-3 font-bold text-black flex items-center justify-between h-full ${
                      isRtl ? "text-right" : "text-left"
                    }`}
                    style={{
                      width: "63%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    <span>{line.description}</span>
                    {line.width > 0 && line.height > 0 && (
                      <span className="text-[10px] font-mono text-slate-600 font-semibold" dir="ltr">
                        ({line.width} × {line.height} cm {line.material ? `· ${line.material}` : ""})
                      </span>
                    )}
                  </td>
                  <td
                    className="py-0.5 px-1 text-center font-mono font-bold text-black flex items-center justify-center h-full"
                    style={{
                      width: "8.5%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    {line.qty}
                  </td>
                  <td
                    className={`py-0.5 px-2 font-mono font-bold text-black flex items-center h-full ${
                      isRtl ? "justify-start pl-3" : "justify-end pr-3"
                    }`}
                    style={{
                      width: "12.5%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    {formatNumber(line.unitPrice)}
                  </td>
                  <td
                    className={`py-0.5 px-3 font-mono font-black text-black flex items-center h-full ${
                      isRtl ? "justify-start" : "justify-end"
                    }`}
                    style={{ width: "16%" }}
                  >
                    {formatNumber(line.total)}
                  </td>
                </tr>
              ))}

              {/* Empty Filler Rows up to EXACT_ROWS_COUNT (18 rows total) */}
              {Array.from({ length: emptyRowsCount }).map((_, i) => (
                <tr
                  key={`empty-${i}`}
                  className="w-full flex flex-1 items-center"
                  style={{
                    minHeight: "29px",
                    borderBottom: i === emptyRowsCount - 1 ? "none" : "1px solid #94a3b8",
                  }}
                >
                  <td
                    className="py-0.5 px-3 text-transparent select-none h-full"
                    style={{
                      width: "63%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    -
                  </td>
                  <td
                    className="py-0.5 px-1 text-center text-transparent select-none flex items-center justify-center h-full"
                    style={{
                      width: "8.5%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    -
                  </td>
                  <td
                    className="py-0.5 px-2 text-transparent select-none flex items-center justify-end h-full"
                    style={{
                      width: "12.5%",
                      ...(isRtl
                        ? { borderLeft: "1px solid #94a3b8" }
                        : { borderRight: "1px solid #94a3b8" }),
                    }}
                  >
                    -
                  </td>
                  <td
                    className="py-0.5 px-3 text-transparent select-none flex items-center justify-end h-full"
                    style={{ width: "16%" }}
                  >
                    -
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="w-full shrink-0">
              {/* Subtotal Row */}
              <tr
                className="w-full flex"
                style={{
                  height: "38px",
                  borderTop: "1px solid #1e293b",
                }}
              >
                <td
                  style={{
                    width: "71.5%",
                    backgroundColor: "#E0E6E4",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                ></td>
                <td
                  className="flex items-center justify-center font-black italic text-[14.5px] text-black"
                  style={{
                    width: "12.5%",
                    backgroundColor: "#ffffff",
                    ...(isRtl
                      ? { borderLeft: "1px solid #1e293b" }
                      : { borderRight: "1px solid #1e293b" }),
                  }}
                >
                  {isRtl ? "المجموع" : "Subtotal"}
                </td>
                <td
                  className={`py-1 px-3 flex items-center font-mono font-black text-[15.5px] text-black ${
                    isRtl ? "justify-start" : "justify-end"
                  }`}
                  style={{
                    width: "16%",
                    backgroundColor: "#ffffff",
                  }}
                >
                  {formatNumber(totalAmount)}
                  {isRtl && <span className="text-[10px] font-sans font-bold mr-1 text-slate-700">ج.س</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* ─── 5. Terms of Payment & Bank Account Bar ─── */}
        <div className="my-2 flex items-center justify-between text-[11.5px] font-bold text-black px-1 shrink-0">
          {/* Terms of payment */}
          <div>
            <span className="italic">{isRtl ? "شروط الدفع: " : "Terms of payment: "}</span>
            <span className="font-extrabold not-italic text-black">
              {isRtl
                ? "70% عند الاعتماد و 30% عند التسليم"
                : "70% upon approval & 30% upon delivery"}
            </span>
          </div>

          {/* Bank of Khartoum Account Details */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg border font-bold text-black"
            style={{
              backgroundColor: "#F1F5F4",
              borderColor: "#C1D0CD",
            }}
          >
            <span className="text-slate-700">{isRtl ? "بنك الخرطوم:" : "Bank of Khartoum:"}</span>
            <span className="font-mono font-black text-[12.5px] text-black tracking-wider">3283046</span>
            <span className="text-slate-400">|</span>
            <span className="font-bold text-slate-800">
              {meta.accountName || (isRtl ? "طارق عثمان علي" : "Tariq Osman Ali")}
            </span>
          </div>
        </div>

        {/* ─── 6. Footer Boxes (Prepared By, Official QR Code, Client's Approval) ─── */}
        <div className="grid grid-cols-12 gap-3.5 items-end pt-1 shrink-0">
          {/* Prepared By Box */}
          <div
            className="col-span-5 rounded-[12px] p-3 flex flex-col justify-between bg-white"
            style={{
              border: "1px solid #1e293b",
              height: "76px",
            }}
          >
            <span className="text-[12px] font-bold italic text-black">
              {isRtl ? "إعداد: " : "Prepared by: "}
              <span className="not-italic font-extrabold">
                {meta.accountName || (isRtl ? "طارق عثمان علي" : "Tarig osman Ali")}
              </span>
            </span>
          </div>

          {/* Official QR Code (Center - NO OUTER FRAME) */}
          <div className="col-span-2 flex flex-col items-center justify-center text-center">
            <div className="w-[66px] h-[66px] flex items-center justify-center bg-transparent">
              <img
                src={TA_QR_CODE_BASE64}
                alt="QR Code"
                className="w-full h-full object-contain"
              />
            </div>
            <span className="text-[9.5px] font-bold text-black mt-1 tracking-tight">
              {isRtl ? "الخرطوم - بورتسودان" : "Khartoum - Portsudan"}
            </span>
          </div>

          {/* Client's Approval */}
          <div
            className="col-span-5 rounded-[12px] p-3 flex flex-col justify-between bg-white"
            style={{
              border: "1px solid #1e293b",
              height: "76px",
            }}
          >
            <span className="text-[12px] font-bold italic text-black">
              {isRtl ? "اعتماد واستلام العميل:" : "Client's approval:"}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

ProformaDocument.displayName = "ProformaDocument";
