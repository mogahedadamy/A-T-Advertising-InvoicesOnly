import React from "react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
import type { ProformaMeta } from "@/lib/proforma/types";
import { formatDisplayReference } from "@/lib/domain/references";

interface Props {
  meta: ProformaMeta;
  clientName: string;
  attnPerson: string;
  formattedDate: string;
  isRtl: boolean;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
}

export const ProformaDocumentHeader: React.FC<Props> = ({
  meta,
  clientName,
  attnPerson,
  formattedDate,
  isRtl,
  companyEmail,
  companyPhone,
  companyAddress,
}) => {
  return (
    <>
      {/* ─── 1. Header (Logo & Centered Badge) ─── */}
      <div className="relative flex items-center justify-between mb-1 min-h-[80px] shrink-0">
        <div className="flex items-center z-10">
          <img
            src={TA_LOGO_GREEN_BASE64}
            alt="T.A Advertising Solution"
            className="h-[78px] w-auto object-contain select-none"
          />
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className={`flex items-center justify-center font-black italic text-black select-none pointer-events-auto text-center ${
              isRtl ? "" : "tracking-wide"
            }`}
            style={{
              minWidth: "210px",
              padding: "0 20px",
              height: "56px",
              backgroundColor: "#C1D0CD",
              borderRadius: "20px",
              fontSize: isRtl ? "22px" : "26px",
              letterSpacing: isRtl ? "normal" : "0.5px",
              lineHeight: 1,
              fontFamily: isRtl
                ? "var(--font-arabic, 'Tajawal', system-ui, sans-serif)"
                : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            <span
              className="inline-flex items-center justify-center text-center"
              style={{
                lineHeight: 1,
                transform: isRtl ? "none" : "translateY(-1px)",
              }}
            >
              {isRtl ? "فاتورة مبدئية" : "Pro-invoice"}
            </span>
          </div>
        </div>

        <div className="w-[100px] shrink-0" />
      </div>

      {/* ─── 2. Contact Information Bar (Configurable Client Email) ─── */}
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
          {companyPhone || "+249 12371 1444  -  +249 91296 8886"}
        </span>
        <span className="font-extrabold lowercase tracking-tight" dir="ltr">
          {companyEmail || "t.a.advertising@gmail.com"}
        </span>
        <span className="font-extrabold">
          {companyAddress || (isRtl ? "السودان، الخرطوم - بورتسودان" : "Sudan, Khartoum - Portsudan")}
        </span>
      </div>

      {/* ─── 3. Client & Invoice Meta Info (Side by Side Boxes) ─── */}
      <div className="my-1.5 flex gap-3 text-[12px] shrink-0">
        {/* Client Details Box */}
        <div
          className="rounded-[10px] bg-white px-3.5 py-1 flex flex-col justify-center flex-1 overflow-hidden"
          style={{
            border: "1px solid #1e293b",
            height: "68px",
          }}
        >
          <div className="flex items-center text-[12px] mb-1 h-[24px]">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "78px" : "60px", width: isRtl ? "78px" : "60px" }}
            >
              {isRtl ? "العميل :" : "Client :"}
            </span>
            <div
              className={`flex-1 border-b border-black font-black text-[14px] text-black px-1 truncate h-[22px] flex items-center ${
                isRtl ? "text-right" : "text-left"
              }`}
              style={{ lineHeight: "1.2" }}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {clientName}
            </div>
          </div>

          <div className="flex items-center text-[12px] h-[24px]">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "78px" : "60px", width: isRtl ? "78px" : "60px" }}
            >
              {isRtl ? "عناية السيد :" : "Attn.:"}
            </span>
            <div
              className={`flex-1 border-b border-black font-semibold text-[12px] text-black px-1 truncate h-[22px] flex items-center ${
                isRtl ? "text-right" : "text-left"
              }`}
              style={{ lineHeight: "1.2" }}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {attnPerson}
            </div>
          </div>
        </div>

        {/* Date & Ref Box (YY-NNNN) */}
        <div
          className="rounded-[10px] bg-white px-3 py-1 flex flex-col justify-center shrink-0 overflow-hidden"
          style={{
            border: "1px solid #1e293b",
            height: "68px",
            width: "190px",
          }}
        >
          <div className="flex items-center text-[12px] mb-1 h-[24px]">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "52px" : "42px", width: isRtl ? "52px" : "42px" }}
            >
              {isRtl ? "التاريخ :" : "Date:"}
            </span>
            <div
              className="flex-1 border-b border-black font-mono font-bold text-[11.5px] text-center text-black whitespace-nowrap tracking-tight h-[22px] flex items-center justify-center overflow-hidden"
              style={{ lineHeight: "1.2" }}
            >
              {formattedDate}
            </div>
          </div>

          <div className="flex items-center text-[12px] h-[24px]">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "52px" : "42px", width: isRtl ? "52px" : "42px" }}
            >
              {isRtl ? "الرقم :" : "Ref.:"}
            </span>
            <div
              className="flex-1 border-b border-black font-mono font-bold text-[12px] text-center text-black whitespace-nowrap tracking-wider h-[22px] flex items-center justify-center overflow-hidden"
              style={{ lineHeight: "1.2" }}
            >
              {formatDisplayReference(undefined, meta.serial, meta.date)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

