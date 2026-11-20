import React from "react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";

interface Props {
  letterTitle: string;
  formattedDate: string;
  reference: string;
  monoStyle: React.CSSProperties;
}

export const OfficialLetterHeader: React.FC<Props> = ({
  letterTitle,
  formattedDate,
  reference,
  monoStyle,
}) => {
  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
      {/* الشريط المعماري المزدوج (زمردي + ذهبي هادئ) */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ height: "3px", width: "100%", backgroundColor: "#0D4A39", borderRadius: "2px" }} />
        <div style={{ height: "1px", width: "100%", backgroundColor: "#C5A059", marginTop: "2px" }} />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          paddingBottom: "12px",
          borderBottom: "1px solid #cbd5e1",
        }}
      >
        {/* الشعار المعتمد (يمين) */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img
            src={TA_LOGO_GREEN_BASE64}
            alt="T.A Advertising Solution"
            style={{ height: "64px", width: "auto", objectFit: "contain" }}
          />
        </div>

        {/* عنوان الخطاب الرسمي في المنتصف */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 8px",
          }}
        >
          <div
            style={{
              fontSize: "17px",
              fontWeight: 900,
              color: "#0D4A39",
              lineHeight: 1.25,
            }}
          >
            {letterTitle || "خطاب رسمي"}
          </div>
          <div
            style={{
              width: "52px",
              height: "2px",
              backgroundColor: "#C5A059",
              margin: "5px 0 3px 0",
              borderRadius: "1px",
            }}
          />
          <div
            style={{
              fontSize: "8.5px",
              fontWeight: 800,
              color: "#64748b",
              letterSpacing: "1.4px",
              textTransform: "uppercase",
            }}
          >
            OFFICIAL CORRESPONDENCE
          </div>
        </div>

        {/* صندوق التاريخ والرقم الإشاري (يسار) */}
        <div
          style={{
            width: "162px",
            flexShrink: 0,
            border: "1px solid #cbd5e1",
            borderTop: "2px solid #0D4A39",
            borderRadius: "6px",
            padding: "6px 10px",
            backgroundColor: "#f8faf9",
            fontSize: "10.5px",
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
            <span style={{ color: "#475569", fontWeight: 800 }}>التاريخ:</span>
            <bdi dir="ltr" style={{ color: "#0f172a", fontWeight: 800, whiteSpace: "nowrap", ...monoStyle }}>
              {formattedDate}
            </bdi>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "6px",
              marginTop: "3px",
              paddingTop: "3px",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <span style={{ color: "#475569", fontWeight: 800 }}>المرجع:</span>
            <bdi dir="ltr" style={{ color: "#0D4A39", fontWeight: 900, whiteSpace: "nowrap", ...monoStyle }}>
              {reference || "TA-001"}
            </bdi>
          </div>
        </div>
      </div>
    </div>
  );
};
