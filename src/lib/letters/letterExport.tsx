import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { toast } from "sonner";
import { triggerPrintWithElement, shareInvoiceViaWhatsApp } from "@/lib/pdfExport";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { OfficialLetterDocument } from "@/components/letters/OfficialLetterDocument";
import type { OfficialLetter } from "./types";

interface MountedLetterHandle {
  element: HTMLElement;
  cleanup: () => void;
}

async function mountOfficialLetterForExport(
  letter: OfficialLetter
): Promise<MountedLetterHandle | null> {
  if (typeof document === "undefined") return null;

  const staging = document.createElement("div");
  staging.id = `official-letter-staging-${Date.now()}`;
  staging.className = "official-letter-print-root";
  staging.setAttribute("dir", letter.language === "en" ? "ltr" : "rtl");
  staging.style.cssText =
    "position:fixed;left:-9999px;top:0;width:210mm;min-height:297mm;background:#ffffff;pointer-events:none;z-index:-9999;";
  document.body.appendChild(staging);

  const root = createRoot(staging);
  flushSync(() => {
    root.render(
      <OfficialLetterDocument
        letter={letter}
        id="active-official-letter-sheet"
        isPrintMode={true}
      />
    );
  });

  await new Promise((r) => setTimeout(r, 60));

  const sheetEl =
    staging.querySelector<HTMLElement>(".official-letter-sheet") ||
    (staging.firstElementChild as HTMLElement) ||
    staging;

  try {
    if (document.fonts) await document.fonts.ready;
    const imgs = Array.from(sheetEl.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return img.decode().catch(() => undefined);
      })
    );
  } catch {}

  const cleanup = () => {
    try {
      root.unmount();
      if (staging.parentNode) staging.parentNode.removeChild(staging);
    } catch {}
  };

  return { element: sheetEl, cleanup };
}

export async function printOfficialLetter(letter: OfficialLetter): Promise<boolean> {
  const handle = await mountOfficialLetterForExport(letter);
  if (!handle) return false;

  const safeName = (letter.recipientName || letter.letterTitle || "خطاب-رسمي").replace(/[\s/\\:*?"<>|]/g, "_");
  const docTitle = `خطاب-${letter.reference || getLocalIsoDate()}-${safeName}`;

  document.body.classList.add("printing-custom-invoice");
  try {
    triggerPrintWithElement(handle.element, docTitle, "a4", () => {
      document.body.classList.remove("printing-custom-invoice");
      handle.cleanup();
    });
    return true;
  } catch {
    document.body.classList.remove("printing-custom-invoice");
    handle.cleanup();
    toast.error("تعذر طباعة الخطاب الرسمي");
    return false;
  }
}

export async function shareOfficialLetterViaWhatsApp(letter: OfficialLetter): Promise<boolean> {
  const handle = await mountOfficialLetterForExport(letter);
  if (!handle) return false;

  const safeName = (letter.recipientName || letter.letterTitle || "خطاب-رسمي").replace(/[\s/\\:*?"<>|]/g, "_");
  const filename = `خطاب-${letter.reference || getLocalIsoDate()}-${safeName}`;

  const isRtl = letter.language !== "en";
  try {
    const ok = await shareInvoiceViaWhatsApp(handle.element, {
      filename,
      format: "a4",
      partyName: letter.recipientName || (isRtl ? "الجهة الموقرة" : "Valued Client"),
      invoiceRef: letter.reference,
      invoiceTypeLabel: letter.showLetterTitle && letter.letterTitle.trim()
        ? letter.letterTitle.trim()
        : (isRtl ? "خطاب رسمي" : "Official Letter"),
      isRtl,
    });
    handle.cleanup();
    return ok;
  } catch {
    handle.cleanup();
    toast.error("تعذر مشاركة الخطاب عبر واتساب");
    return false;
  }
}
