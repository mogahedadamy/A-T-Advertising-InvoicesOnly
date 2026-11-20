import React from "react";
import {
  TA_LOGO_GREEN_BASE64,
  TA_QR_CODE_BASE64,
  TA_SIGNATURE_TARIG_BASE64,
  TA_STAMP_BASE64,
  TA_WATERMARK_BASE64,
} from "@/assets/invoiceImagesBase64";
import { useCompanyProfile } from "@/lib/settings/companyProfileStore";
import type { OfficialLetter } from "@/lib/letters/types";

interface Props {
  letter: OfficialLetter;
  id?: string;
  isPrintMode?: boolean;
}

function formatLetterDate(isoDate: string): string {
  const parts = (isoDate || "").split("-");
  if (parts.length === 3) {
    return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
  }
  return isoDate || "";
}

/**
 * ═══════════════════════════════════════════════════════════════
 * الورقة الرسمية المروّسة لإصدار الخطابات — T.A Advertising Solution
 * ═══════════════════════════════════════════════════════════════
 * مقاس A4 قياسي (210mm × 297mm) بهوامش أمان دبلوماسية متوازنة
 * (18mm أعلى، 20mm يمين ويسار، 16mm أسفل) مع توسيط مربع الموضوع
 * وتثبيت التوقيع والاسم والختم في أسفل الورقة وفق هوية الوكالة.
 */
export const OfficialLetterDocument = React.forwardRef<HTMLDivElement, Props>(
  ({ letter, id = "official-letter-doc" }, ref) => {
    const { email, phone, addressAr } = useCompanyProfile();

    const formattedDate = formatLetterDate(letter.date);
    const paragraphs = (letter.body || "")
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const isToWhom = letter.recipientHonorific.trim() === "إلى من يهمه الأمر";
    const recipientDisplay = letter.recipientName.trim();
    const honorificSuffix =
      letter.recipientHonorific.includes("السادة") || letter.recipientHonorific.includes("إدارة")
        ? "المحترمين"
        : letter.recipientHonorific.includes("السيد")
        ? "المحترم"
        : "";

    const monoStyle: React.CSSProperties = {
      fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace",
      fontVariantNumeric: "tabular-nums",
    };

    return (
      <div
        id={id}
        ref={ref}
        dir="rtl"
        className="official-letter-sheet bg-white text-slate-900 mx-auto select-text relative flex flex-col justify-between text-right"
        style={{
          width: "210mm",
          minHeight: "297mm",
          height: "297mm",
          maxHeight: "297mm",
          margin: "0 auto",
          padding: "18mm 20mm 16mm 20mm",
          boxSizing: "border-box",
          overflow: "hidden",
          backgroundColor: "#ffffff",
          color: "#0f172a",
          fontFamily:
            "'Tajawal', 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          WebkitPrintColorAdjust: "exact",
          printColorAdjust: "exact",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
        }}
      >
        {/* العلامة المائية الرسمية الخفيفة في قلب الورقة المروّسة */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          <img
            src={TA_WATERMARK_BASE64}
            alt=""
            style={{
              width: "390px",
              maxWidth: "70%",
              height: "auto",
              opacity: 0.08,
              objectFit: "contain",
              userSelect: "none",
            }}
          />
        </div>

        {/* ══════════ 1. الترويسة الرسمية للورقة المروّسة ══════════ */}
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
                {letter.letterTitle || "خطاب رسمي"}
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
                  {letter.reference || "TA-001"}
                </bdi>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ 2. جسم الخطاب الرسمي: المرسل إليه + مربع الموضوع بالمنتصف + المتن ══════════ */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            paddingTop: "16px",
            paddingBottom: "14px",
          }}
        >
          {/* بيانات الشخص أو الجهة المرسل إليها */}
          <div style={{ marginBottom: "10px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: "12px",
              }}
            >
              <div style={{ fontSize: "14.5px", fontWeight: 900, color: "#0f172a", lineHeight: 1.45 }}>
                {isToWhom ? (
                  <span>إلى من يهمه الأمر</span>
                ) : (
                  <>
                    <span style={{ color: "#0D4A39" }}>{letter.recipientHonorific} </span>
                    <span>{recipientDisplay || "................................................"}</span>
                  </>
                )}
              </div>
              {!isToWhom && honorificSuffix && (
                <span style={{ fontSize: "13.5px", fontWeight: 800, color: "#0D4A39", flexShrink: 0 }}>
                  {honorificSuffix}
                </span>
              )}
            </div>

            {letter.recipientTitle?.trim() && (
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#334155", marginTop: "3px" }}>
                {letter.recipientTitle.trim()}
              </div>
            )}

            {letter.salutation?.trim() && (
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b", marginTop: "10px" }}>
                {letter.salutation.trim()}
              </div>
            )}
          </div>

          {/* مربع الموضوع في المنتصف تماماً */}
          <div
            style={{
              margin: "12px auto 18px auto",
              width: "92%",
              backgroundColor: "#f4f7f6",
              border: "1px solid #c5d6d1",
              borderRight: "4px solid #0D4A39",
              borderLeft: "4px solid #C5A059",
              borderRadius: "6px",
              padding: "10px 18px",
              textAlign: "center",
              boxSizing: "border-box",
            }}
          >
            <div style={{ fontSize: "13.5px", fontWeight: 900, color: "#0f172a", lineHeight: 1.5 }}>
              <span style={{ color: "#0D4A39", marginLeft: "6px" }}>الموضوع:</span>
              <span>{letter.subject || "................................................"}</span>
            </div>
          </div>

          {/* نص ومتن الخطاب */}
          <div style={{ flex: 1 }}>
            {paragraphs.length > 0 ? (
              paragraphs.map((para, idx) => (
                <p
                  key={idx}
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#0f172a",
                    lineHeight: 1.95,
                    textAlign: "justify",
                    margin: "0 0 11px 0",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {para}
                </p>
              ))
            ) : (
              <p style={{ fontSize: "12.5px", color: "#94a3b8", textAlign: "center", marginTop: "24px" }}>
                اكتب نص الخطاب الرسمي هنا...
              </p>
            )}

            {letter.closingPhrase?.trim() && (
              <div
                style={{
                  marginTop: "20px",
                  textAlign: "center",
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#0D4A39",
                }}
              >
                {letter.closingPhrase.trim()}
              </div>
            )}
          </div>
        </div>

        {/* ══════════ 3. منطقة الاعتماد: التوقيع والاسم والختم ورمز QR في أسفل الخطاب ══════════ */}
        <div style={{ position: "relative", zIndex: 2, flexShrink: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "flex-end",
              gap: "12px",
              paddingBottom: "14px",
            }}
          >
            {/* رمز التوثيق QR (يمين في الـ RTL أو يمين التذييل للتوازن البصري) */}
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

            {/* الختم الرسمي في المنتصف السفلي بجانب التوقيع */}
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

            {/* التوقيع واسم الموقّع والمنصب (يسار في الـ RTL كما هو متعارف رسمياً) */}
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

          {/* ══════════ 4. تذييل الورقة المروّسة (بيانات الاتصال الرسمية) ══════════ */}
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
      </div>
    );
  }
);

OfficialLetterDocument.displayName = "OfficialLetterDocument";
