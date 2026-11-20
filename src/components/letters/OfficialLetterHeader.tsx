import React from "react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";

interface Props {
  showTitle: boolean;
  letterTitle: string;
  formattedDate: string;
  reference: string;
  isRtl: boolean;
  monoStyle: React.CSSProperties;
}

/**
 * ترويسة الورقة المروّسة:
 * - عند وجود عنوان للخطاب: الشعار في الطرف البادئ، العنوان بالمنتصف، والتاريخ والمرجع بالطرف المقابل.
 * - عند إخفاء العنوان (أو تركه فارغاً): يتوسّط الشعار الرسمي مركز الصفحة تماماً بدون أي عنوان أو نص إضافي.
 */
export const OfficialLetterHeader: React.FC<Props> = ({
  showTitle,
  letterTitle,
  formattedDate,
  reference,
  isRtl,
  monoStyle,
}) => {
  const hasVisibleTitle = Boolean(showTitle && letterTitle.trim());

  const dateRefBox = (
    <div
      style={{
        width: "168px",
        flexShrink: 0,
        border: "1px solid #cbd5e1",
        borderTop: "2px solid #0D4A39",
        borderRadius: "6px",
        padding: "7px 11px",
        backgroundColor: "#f8faf9",
        fontSize: "11px",
        lineHeight: 1.55,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#475569", fontWeight: 800 }}>{isRtl ? "التاريخ:" : "Date:"}</span>
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
          marginTop: "4px",
          paddingTop: "4px",
          borderTop: "1px solid #e2e8f0",
        }}
      >
        <span style={{ color: "#475569", fontWeight: 800 }}>{isRtl ? "المرجع:" : "Ref.:"}</span>
        <bdi dir="ltr" style={{ color: "#0D4A39", fontWeight: 900, whiteSpace: "nowrap", ...monoStyle }}>
          {reference || "TA-001"}
        </bdi>
      </div>
    </div>
  );

  return (
    <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
      {/* الشريط المعماري المزدوج (زمردي + ذهبي هادئ) */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ height: "3px", width: "100%", backgroundColor: "#0D4A39", borderRadius: "2px" }} />
        <div style={{ height: "1px", width: "100%", backgroundColor: "#C5A059", marginTop: "2px" }} />
      </div>

      {hasVisibleTitle ? (
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
          {/* الشعار المعتمد */}
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
            <img
              src={TA_LOGO_GREEN_BASE64}
              alt="T.A Advertising Solution"
              style={{ height: "66px", width: "auto", objectFit: "contain" }}
            />
          </div>

          {/* عنوان الخطاب فقط (بدون أي نصوص افتراضية أو إنجليزية إضافية) */}
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
                fontSize: "18px",
                fontWeight: 900,
                color: "#0D4A39",
                lineHeight: 1.3,
              }}
            >
              {letterTitle.trim()}
            </div>
            <div
              style={{
                width: "54px",
                height: "2px",
                backgroundColor: "#C5A059",
                marginTop: "6px",
                borderRadius: "1px",
              }}
            />
          </div>

          {dateRefBox}
        </div>
      ) : (
        /* بدون عنوان خطاب: يتوسّط الشعار مركز الترويسة تماماً بدقة هندسية */
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "168px 1fr 168px",
            alignItems: "center",
            gap: "10px",
            paddingBottom: "12px",
            borderBottom: "1px solid #cbd5e1",
          }}
        >
          <div aria-hidden="true" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img
              src={TA_LOGO_GREEN_BASE64}
              alt="T.A Advertising Solution"
              style={{ height: "76px", width: "auto", objectFit: "contain" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>{dateRefBox}</div>
        </div>
      )}
    </div>
  );
};
