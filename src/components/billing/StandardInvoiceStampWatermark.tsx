import React from "react";
import { TA_WATERMARK_BASE64, TA_STAMP_BASE64 } from "@/assets/invoiceImagesBase64";

interface Props {
  isRtl?: boolean;
}

/**
 * العلامة المائية والختم الرسمي المعتمد لشركة T.A:
 * 1. العلامة المائية (Halftone Watermark): الشعار الرسمي المعتمد كبير وأنيق في منتصف جدول الفاتورة تماماً
 *    بشفافية هادئة (0.16) تتيح وضوح الهوية دون أن تعيق قراءة بنود وأرقام الفاتورة إطلاقاً.
 * 2. الختم الرسمي (Official Stamp): مكبر ومصقول (170px) بالأسفل جهة اليسار (الصفوف 14-17) بنقاء ووضوح رسمي عالٍ (0.92).
 */
export const StandardInvoiceStampWatermark: React.FC<Props> = ({ isRtl = false }) => {
  return (
    <>
      {/* 1. العلامة المائية الكبيرة الشفافة في منتصف الجدول - هالفتون رسمي بارز وأنيق يطابق الأصل */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
        style={{
          zIndex: 1,
          pointerEvents: "none",
        }}
      >
        <img
          src={TA_WATERMARK_BASE64}
          alt="T.A Halftone Watermark"
          style={{
            width: "520px",
            maxWidth: "88%",
            maxHeight: "340px",
            height: "auto",
            opacity: 0.22,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>

      {/* 2. الختم الرسمي المعتمد بالأسفل جهة اليسار (الصفوف 14-17) بحجم مكبر رسمي بارز */}
      <div
        className="pointer-events-none absolute z-20 select-none"
        style={{
          bottom: "38px",
          left: "16px",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <img
          src={TA_STAMP_BASE64}
          alt="T.A Official Stamp"
          style={{
            width: "198px",
            maxWidth: "212px",
            height: "auto",
            opacity: 0.92,
            objectFit: "contain",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
      </div>
    </>
  );
};

