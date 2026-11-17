import React, { useSyncExternalStore } from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { CustomInvoice } from "@/lib/billing/types";
import { detectInvoiceLanguage } from "@/lib/billing/languageHelper";
import { StandardInvoiceDocument } from "./StandardInvoiceDocument";

// مخزن تفاعلي بسيط لحفظ الفاتورة النشطة الجاهزة للطباعة
let currentPrintInvoice: CustomInvoice | null = null;
const listeners = new Set<() => void>();

export function setCustomInvoiceToPrint(invoice: CustomInvoice | null) {
  currentPrintInvoice = invoice;
  listeners.forEach((fn) => fn());
}

export function useCustomInvoiceToPrint(): CustomInvoice | null {
  return useSyncExternalStore(
    (callback) => {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },
    () => currentPrintInvoice,
    () => null
  );
}

/**
 * بورتال الطباعة المعزول: يقوم بتركيب ورقة الفاتورة كابن لـ <body>
 */
export function CustomInvoicePrintPortal() {
  const invoice = useCustomInvoiceToPrint();
  if (!invoice || typeof document === "undefined") return null;

  const isRtl =
    detectInvoiceLanguage(
      invoice.meta.language,
      invoice.meta.partyName,
      invoice.meta.partyEnName,
      invoice.items
    ) === "ar";

  return createPortal(
    <div
      id="custom-invoice-print-portal"
      className="custom-invoice-print-root"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <StandardInvoiceDocument
        invoice={invoice}
        id="active-custom-invoice-print"
        isPrintMode={true}
      />
    </div>,
    document.body
  );
}

export interface PreparedPrintResult {
  element: HTMLElement;
  cleanup: () => void;
}

/**
 * محضر المستند الكنسي الموحد للفاتورة:
 * يضمن 100% الحصول على عنصر الفاتورة الحقيقي جاهزاً للطباعة أو التصدير
 * حتى لو كانت النافذة في وضع التعديل (Edit Tab) أو غير معروضة في الصفحة
 */
export async function prepareCustomInvoiceElement(
  invoice: CustomInvoice,
  onBeforePrint?: () => void
): Promise<PreparedPrintResult | null> {
  onBeforePrint?.();

  // 1. محاولة التحديث المتزامن عبر بورتال الطباعة
  try {
    flushSync(() => {
      setCustomInvoiceToPrint(invoice);
    });
  } catch {
    setCustomInvoiceToPrint(invoice);
  }

  // إعطاء مهلة إطار شاشة للتأكد من اكتمال تركيب العناصر في الـ DOM
  await new Promise((r) => setTimeout(r, 60));

  const portal = document.getElementById("custom-invoice-print-portal");
  if (portal) {
    portal.style.setProperty("opacity", "1", "important");
    portal.style.setProperty("visibility", "visible", "important");
  }

  let el =
    document.getElementById("active-custom-invoice-print") ||
    document.querySelector<HTMLElement>("#custom-invoice-print-portal .standard-invoice-sheet") ||
    document.querySelector<HTMLElement>(".standard-invoice-sheet");

  let cleanup = () => {
    if (portal) {
      portal.style.removeProperty("opacity");
      portal.style.removeProperty("visibility");
    }
  };

  // 2. إذا لم يتوفر العنصر في الـ DOM (مثلاً في تبويب التعديل أو صفحة أخرى)، نبنيه مستقلاً وفورياً
  if (!el && typeof document !== "undefined") {
    const staging = document.createElement("div");
    staging.id = "canonical-invoice-staging-temp";
    staging.setAttribute("dir", "rtl");
    staging.style.position = "fixed";
    staging.style.top = "0";
    staging.style.left = "0";
    staging.style.width = "794px";
    staging.style.height = "1123px";
    staging.style.zIndex = "99997";
    staging.style.backgroundColor = "#ffffff";
    staging.style.opacity = "1";
    staging.style.visibility = "visible";
    staging.style.pointerEvents = "none";
    document.body.appendChild(staging);

    const root = createRoot(staging);
    flushSync(() => {
      root.render(
        <StandardInvoiceDocument
          invoice={invoice}
          id="active-custom-invoice-print"
          isPrintMode={true}
        />
      );
    });

    await new Promise((r) => setTimeout(r, 80));

    el =
      staging.querySelector<HTMLElement>(".standard-invoice-sheet") ||
      (staging.firstElementChild as HTMLElement) ||
      staging;

    cleanup = () => {
      try {
        if (portal) {
          portal.style.removeProperty("opacity");
          portal.style.removeProperty("visibility");
        }
        root.unmount();
        if (staging.parentNode) {
          staging.parentNode.removeChild(staging);
        }
      } catch {}
    };
  }

  if (!el) {
    return null;
  }

  // 3. انتظار اكتمال تحميل الخطوط والصور
  try {
    if (document.fonts) {
      await document.fonts.ready;
    }
    const images = Array.from(el.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return img.decode().catch(() => undefined);
      })
    );
  } catch (e) {
    console.warn("Print assets preparation note:", e);
  }

  return { element: el, cleanup };
}
