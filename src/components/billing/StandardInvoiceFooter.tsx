import React from "react";
import { TA_QR_CODE_BASE64, TA_SIGNATURE_TARIG_BASE64 } from "@/assets/invoiceImagesBase64";
import type { CustomInvoiceMeta } from "@/lib/billing/types";

interface Props {
  meta: CustomInvoiceMeta;
  isRtl: boolean;
}

export const StandardInvoiceFooter: React.FC<Props> = ({ meta, isRtl }) => {
  const printedName = isRtl
    ? "طارق عثمان علي"
    : "Tarig Osman Ali";

  const rawAccountName = meta.accountName?.trim();
  const bankAccountName = (!rawAccountName ||
    rawAccountName === "طارق عثمان علي" ||
    rawAccountName === "طارق عثمان علي / T.A Advertising" ||
    rawAccountName === "Tariq Osman Ali")
    ? "طارق عثمان / تي ايه للدعايه والاعلان"
    : rawAccountName;

  return (
    <>
      {/* ─── 5. شروط الدفع والحساب البنكي ─── */}
      <div
        className="my-2 flex items-center justify-between font-bold text-black px-1 shrink-0"
        style={{
          flexWrap: "nowrap",
          gap: "8px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* شروط الدفع */}
        <div
          style={{
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontSize: isRtl ? "11.5px" : "10px",
          }}
        >
          <span className="italic">{isRtl ? "شروط الدفع: " : "Terms of payment: "}</span>
          <span className="font-extrabold not-italic text-black">
            {isRtl
              ? "70% عند الاعتماد و 30% عند التسليم"
              : "70% upon approval & 30% upon delivery"}
          </span>
        </div>

        {/* بيانات بنك الخرطوم الرسمية */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold text-black"
          style={{
            backgroundColor: "#F1F5F4",
            borderColor: "#C1D0CD",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontSize: isRtl ? "11.5px" : "10px",
          }}
        >
          <span className="text-slate-700">{isRtl ? "بنك الخرطوم:" : "Bank of Khartoum:"}</span>
          <span className="font-mono font-black text-[12px] text-black tracking-wider">
            {meta.accountNumber || "3283046"}
          </span>
          <span className="text-slate-400">|</span>
          <span
            className="font-bold text-slate-800"
            style={{
              letterSpacing: "normal",
              fontFamily: isRtl
                ? "'Cairo', 'Tajawal', system-ui, sans-serif"
                : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {bankAccountName}
          </span>
        </div>
      </div>

      {/* ─── 6. صناديق التذييل (الإعداد مع التوقيع المصغر والمفصول، الرمز الشريطي QR، والاعتماد) ─── */}
      <div
        className="grid grid-cols-12 gap-3.5 items-end pt-1 shrink-0"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "14px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* صندوق الإعداد مع الاسم في الأعلى والتوقيع الرسمي أسفله مباشرة */}
        <div
          className="col-span-5 rounded-[12px] p-2.5 px-3.5 flex flex-col justify-between bg-white relative"
          style={{
            flex: "5 5 0%",
            minWidth: 0,
            border: "1px solid #1e293b",
            height: "88px",
            boxSizing: "border-box",
            textAlign: isRtl ? "right" : "left",
          }}
        >
          {/* عنوان الإعداد والاسم المطبوع في الأعلى */}
          <div className="flex items-center gap-1.5 leading-tight">
            <span className="text-[11.5px] font-bold italic text-slate-700">
              {isRtl ? "إعداد:" : "Prepared by:"}
            </span>
            <span
              className="text-[13px] font-bold text-black"
              style={{
                letterSpacing: "normal",
                fontFamily: isRtl
                  ? "'Cairo', 'Tajawal', system-ui, sans-serif"
                  : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                fontFeatureSettings: "'liga' 1, 'calt' 1",
                textRendering: "geometricPrecision",
              }}
            >
              {printedName}
            </span>
          </div>

          {/* التوقيع الرسمي أسفل الاسم مباشرة بحجم مكبر قليلاً مع الحفاظ التام على الأبعاد والوضوح */}
          <div
            className={`flex items-center ${isRtl ? "justify-start pr-1" : "justify-start pl-1"}`}
            style={{ height: "48px" }}
          >
            <img
              src={TA_SIGNATURE_TARIG_BASE64}
              alt="التوقيع الرسمي"
              className="pointer-events-none select-none"
              style={{
                height: "48px",
                maxHeight: "48px",
                width: "auto",
                maxWidth: "180px",
                objectFit: "contain",
                transform: "rotate(-1deg)",
                mixBlendMode: "multiply",
              }}
            />
          </div>
        </div>

        {/* الرمز الشريطي QR المعتمد مع خلفية بيضاء نقية وحواف هادئة لضمان القراءة الفورية عبر الكاميرا */}
        <div
          className="col-span-2 flex flex-col items-center justify-center text-center"
          style={{
            flex: "2 2 0%",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <div
            className="w-[74px] h-[74px] flex items-center justify-center bg-white p-1 rounded-md"
            style={{
              backgroundColor: "#ffffff",
              boxSizing: "border-box",
            }}
          >
            <img
              src={TA_QR_CODE_BASE64}
              alt="QR Code"
              className="w-full h-full object-contain"
              style={{
                imageRendering: "-webkit-optimize-contrast",
                backgroundColor: "#ffffff",
              }}
            />
          </div>
          <span
            className="text-[9.5px] font-bold text-black mt-1"
            style={{
              letterSpacing: "normal",
              fontFamily: isRtl
                ? "'Cairo', 'Tajawal', system-ui, sans-serif"
                : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            }}
          >
            {isRtl ? "الخرطوم - بورتسودان" : "Khartoum - Portsudan"}
          </span>
        </div>

        {/* صندوق اعتماد واستلام العميل / المورد */}
        <div
          className="col-span-5 rounded-[12px] p-2.5 px-3.5 flex flex-col justify-between bg-white"
          style={{
            flex: "5 5 0%",
            minWidth: 0,
            border: "1px solid #1e293b",
            height: "88px",
            boxSizing: "border-box",
            textAlign: isRtl ? "right" : "left",
          }}
        >
          <span
            className={`text-[11.5px] font-bold italic text-black ${
              isRtl ? "text-right" : "text-left"
            }`}
          >
            {isRtl
              ? (meta.type === "purchase" ? "اعتماد واستلام المشتريات:" : "اعتماد واستلام العميل:")
              : (meta.type === "purchase" ? "Received & Approved by:" : "Client's approval:")}
          </span>
        </div>
      </div>
    </>
  );
};

