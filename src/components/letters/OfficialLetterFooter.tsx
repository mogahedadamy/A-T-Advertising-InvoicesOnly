import React from "react";
import {
  TA_QR_CODE_BASE64,
  TA_SIGNATURE_TARIG_BASE64,
  TA_STAMP_BASE64,
} from "@/assets/invoiceImagesBase64";
import type { OfficialLetter } from "@/lib/letters/types";

interface Props {
  letter: OfficialLetter;
  companyAddress: string;
  email: string;
  phone: string;
  isRtl: boolean;
}

/**
 * تذييل الورقة المروّسة:
 * - ختم رسمي مكبّر بحجم بارز وواضح (185px)
 * - قسم توقيع نظيف يحتوي فقط على الاسم + المنصب + التوقيع بدون ازدحام
 * - باركود QR مكبّر (96×96px) بجودة أصلية غير مضغوطة
 * - شريط تواصل متساوي الأحجام بين الموقع والبريد وأرقام الهاتف
 */
export const OfficialLetterFooter: React.FC<Props> = ({
  letter,
  companyAddress,
  email,
  phone,
  isRtl,
}) => {
  const defaultName = isRtl ? "طارق عثمان علي" : "Tarig Osman Ali";
  const defaultTitle = isRtl
    ? "المدير العام — T.A Advertising Solution"
    : "General Manager — T.A Advertising Solution";

  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
      {/* منطقة الاعتماد: رمز QR المكبّر + الختم الرسمي المكبّر + الاسم والمنصب والتوقيع فقط */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "110px 1fr 1.15fr",
          alignItems: "center",
          gap: "14px",
          paddingBottom: "14px",
        }}
      >
        {/* رمز التوثيق QR مكبّر وبدقة أصلية بدون ضغط */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
          {letter.includeQr && (
            <div
              style={{
                width: "96px",
                height: "96px",
                padding: "4px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              <img
                src={TA_QR_CODE_BASE64}
                alt="QR Code"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  imageRendering: "pixelated",
                }}
              />
            </div>
          )}
        </div>

        {/* الختم الرسمي بحجم كبير وواضح */}
        <div
          style={{
            minHeight: "120px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {letter.includeStamp && (
            <img
              src={TA_STAMP_BASE64}
              alt="T.A Official Stamp"
              style={{
                width: "185px",
                maxHeight: "138px",
                height: "auto",
                opacity: 0.92,
                objectFit: "contain",
                mixBlendMode: "multiply",
              }}
            />
          )}
        </div>

        {/* قسم التوقيع المبسّط: الاسم + المدير العام T.A Advertising Solution + التوقيع فقط */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "4px",
            padding: "6px 8px",
          }}
        >
          <div style={{ fontSize: "14.5px", fontWeight: 900, color: "#0D4A39", lineHeight: 1.3 }}>
            {letter.signatoryName || defaultName}
          </div>
          <div style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", lineHeight: 1.35 }}>
            {letter.signatoryTitle || defaultTitle}
          </div>

          {letter.includeSignature && (
            <div
              style={{
                marginTop: "6px",
                height: "56px",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={TA_SIGNATURE_TARIG_BASE64}
                alt="Signature"
                style={{
                  maxHeight: "54px",
                  width: "auto",
                  objectFit: "contain",
                  mixBlendMode: "multiply",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* شريط التواصل الرسمي بأحجام بصرية متساوية تماماً بين الموقع والبريد والأرقام */}
      <div
        style={{
          borderTop: "2px solid #0D4A39",
          paddingTop: "9px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          fontSize: "12px",
          fontWeight: 800,
          color: "#0f172a",
          lineHeight: 1.4,
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 800 }}>{companyAddress}</span>
        <bdi dir="ltr" style={{ fontSize: "12px", fontWeight: 800 }}>
          {email}
        </bdi>
        <bdi
          dir="ltr"
          style={{
            fontSize: "12px",
            fontWeight: 800,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {phone}
        </bdi>
      </div>
    </div>
  );
};
