import React from "react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
import type { CustomInvoiceMeta } from "@/lib/billing/types";
import { formatDisplayReference } from "@/lib/domain/references";

interface Props {
  meta: CustomInvoiceMeta;
  badgeTitle: string;
  clientName: string;
  attnPerson: string;
  formattedDate: string;
  reference?: string;
  isRtl: boolean;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
}

export const StandardInvoiceHeader: React.FC<Props> = ({
  meta,
  badgeTitle,
  clientName,
  attnPerson,
  formattedDate,
  reference,
  isRtl,
  companyEmail,
  companyPhone,
  companyAddress,
}) => {
  return (
    <>
      {/* ─── 1. الترويسة الرئيسية (الشعار + شارة الفاتورة بالمنتصف تماماً) ─── */}
      <div className="relative flex items-center justify-between mb-1 min-h-[80px] shrink-0">
        {/* الشعار المعتمد */}
        <div className="flex items-center z-10">
          <img
            src={TA_LOGO_GREEN_BASE64}
            alt="T.A Advertising Solution"
            className="h-[78px] w-auto object-contain select-none"
          />
        </div>

        {/* شارة عنوان الفاتورة في منتصف الصفحة تماماً */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div
            className={`flex items-center justify-center font-black text-black select-none pointer-events-auto text-center ${
              isRtl ? "not-italic" : "italic tracking-wide"
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
              {badgeTitle}
            </span>
          </div>
        </div>

        {/* مسافة موازنة هندسية بالطرف المقابل */}
        <div className="w-[100px] shrink-0" />
      </div>

      {/* ─── 2. شريط بيانات الاتصال والتواصل الرسمي (مع البريد القابل للتكوين) ─── */}
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

      {/* ─── 3. بيانات العميل والفاتورة (صندوقان جانبيان متناسقان) ─── */}
      <div className="my-1.5 flex gap-3 text-[12px] shrink-0">
        {/* صندوق بيانات العميل / الجهة والشخص المسؤول (Attn) */}
        <div
          className="rounded-[10px] bg-white p-2.5 px-4 flex flex-col justify-center flex-1"
          style={{
            border: "1px solid #1e293b",
            height: "68px",
          }}
        >
          {/* سطر اسم الشركة أو المؤسسة أو المورد */}
          <div className="flex items-baseline text-[12px] leading-tight mb-2">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "78px" : "60px", width: isRtl ? "78px" : "60px" }}
            >
              {isRtl
                ? (meta.type === "purchase" ? "المورد :" : "العميل :")
                : (meta.type === "purchase" ? "Supplier :" : "Client :")}
            </span>
            <div
              className={`flex-1 border-b border-black pb-0.5 font-bold text-[13.5px] text-black px-1 truncate ${
                isRtl ? "text-right" : "text-left"
              }`}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {clientName}
            </div>
          </div>

          {/* سطر الشخص المعني المسؤول (Attn) */}
          <div className="flex items-baseline text-[12px] leading-tight">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "78px" : "60px", width: isRtl ? "78px" : "60px" }}
            >
              {isRtl ? "عناية السيد :" : "Attn.:"}
            </span>
            <div
              className={`flex-1 border-b border-black pb-0.5 font-semibold text-[12.5px] text-black px-1 truncate ${
                isRtl ? "text-right" : "text-left"
              }`}
              dir={isRtl ? "rtl" : "ltr"}
            >
              {attnPerson}
            </div>
          </div>
        </div>

        {/* صندوق التاريخ والرقم المرجعي المعياري (YY-NNNN) */}
        <div
          className="rounded-[10px] bg-white p-2.5 px-3 flex flex-col justify-center shrink-0"
          style={{
            border: "1px solid #1e293b",
            height: "68px",
            width: "190px",
          }}
        >
          {/* سطر التاريخ */}
          <div className="flex items-baseline text-[12px] leading-tight mb-2">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "52px" : "42px", width: isRtl ? "52px" : "42px" }}
            >
              {isRtl ? "التاريخ :" : "Date:"}
            </span>
            <div className="flex-1 border-b border-black pb-0.5 font-mono font-bold text-[11.5px] text-center text-black whitespace-nowrap tracking-tight truncate">
              {formattedDate}
            </div>
          </div>

          {/* سطر الرقم المرجعي المعياري YY-NNNN */}
          <div className="flex items-baseline text-[12px] leading-tight">
            <span
              className="font-bold text-black shrink-0 select-none whitespace-nowrap"
              style={{ minWidth: isRtl ? "52px" : "42px", width: isRtl ? "52px" : "42px" }}
            >
              {isRtl ? "الرقم :" : "Ref.:"}
            </span>
            <div className="flex-1 border-b border-black pb-0.5 font-mono font-bold text-[12px] text-center text-black whitespace-nowrap tracking-wider truncate">
              {formatDisplayReference(reference, meta.serial, meta.date)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

