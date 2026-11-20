import React from "react";
import {
  TA_QR_CODE_BASE64,
  TA_SIGNATURE_TARIG_BASE64,
  TA_STAMP_BASE64,
} from "@/assets/invoiceImagesBase64";
import type { OfficialLetter } from "@/lib/letters/types";

interface Props {
  letter: OfficialLetter;
  addressAr: string;
  email: string;
  phone: string;
  monoStyle: React.CSSProperties;
}

export const OfficialLetterFooter: React.FC<Props> = ({
  letter,
  addressAr,
  email,
  phone,
  monoStyle,
}) => {
  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
      {/* منطقة الاعتماد: رمز QR + الختم الرسمي + التوقيع واسم الموقّع */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "flex-end",
          gap: "12px",
          paddingBottom: "14px",
        }}
      >
        {/* رمز التوثيق QR */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-start" }}>
          {letter.includeQr && (
            <div
              style={{
                width: "66px",
                height: "66px",
                padding: "4px",
                backgroundColor: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxSizing: "border-box",
              }}
            >
              <img
                src={TA_QR_CODE_BASE64}
                alt="QR Code"
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
          )}
        </div>

        {/* الختم الرسمي */}
        <div
          style={{
            minWidth: "126px",
            minHeight: "92px",
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
                width: "122px",
                maxHeight: "96px",
                height: "auto",
                opacity: 0.9,
                objectFit: "contain",
                mixBlendMode: "multiply",
              }}
            />
          )}
        </div>

        {/* التوقيع واسم الموقّع والمنصب */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            padding: "8px 12px",
            borderTop: "1px solid #e2e8f0",
          }}
        >
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", marginBottom: "2px" }}>
            عن وكالة T.A Advertising Solution
          </div>
          <div style={{ fontSize: "13px", fontWeight: 900, color: "#0D4A39" }}>
            {letter.signatoryName || "طارق عثمان علي"}
          </div>
          <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
            {letter.signatoryTitle || "المدير العام"}
          </div>

          <div
            style={{
              height: "44px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            {letter.includeSignature && (
              <img
                src={TA_SIGNATURE_TARIG_BASE64}
                alt="Signature"
                style={{
                  maxHeight: "42px",
                  width: "auto",
                  objectFit: "contain",
                  mixBlendMode: "multiply",
                }}
              />
            )}
          </div>

          <div
            style={{
              width: "148px",
              borderTop: "1px dashed #94a3b8",
              marginTop: "2px",
              paddingTop: "2px",
              fontSize: "9px",
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            التوقيع المعتمد
          </div>
        </div>
      </div>

      {/* تذييل الورقة المروّسة (بيانات الاتصال الرسمية) */}
      <div
        style={{
          borderTop: "2px solid #0D4A39",
          paddingTop: "7px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          fontSize: "10px",
          fontWeight: 800,
          color: "#334155",
        }}
      >
        <span>{addressAr}</span>
        <bdi dir="ltr">{email}</bdi>
        <bdi dir="ltr" style={monoStyle}>
          {phone}
        </bdi>
      </div>
    </div>
  );
};
