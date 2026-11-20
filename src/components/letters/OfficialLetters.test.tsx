// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { createOfficialLetter } from "@/lib/letters/templates";
import { translateLetterArToEnOffline } from "@/lib/letters/offlineTranslator";
import {
  deleteOfficialLetter,
  getNextLetterReference,
  getOfficialLettersSnapshot,
  saveOfficialLetter,
} from "@/lib/letters/store";
import { INVOICE_STANDALONE_CSS } from "@/lib/pdfExportStyles";
import { OfficialLetterDocument } from "./OfficialLetterDocument";

afterEach(cleanup);

describe("Official Corporate Letters — Unified Bilingual Letterhead", () => {
  it("centers logo and renders NO fallback title or English subtitle when showLetterTitle is OFF", () => {
    const letter = createOfficialLetter("TA-26-007", "ar", {
      showLetterTitle: false,
      letterTitle: "",
      recipientName: "شركة زادنا للمواد الغذائية",
      recipientTitle: "عناية السيد / المدير المالي",
    });

    const { container } = render(<OfficialLetterDocument letter={letter} />);
    const sheet = container.querySelector<HTMLElement>(".official-letter-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet!.getAttribute("dir")).toBe("rtl");
    expect(sheet!.style.paddingTop).toBe("18mm");
    expect(sheet!.style.paddingRight).toBe("20mm");
    expect(sheet!.style.paddingBottom).toBe("16mm");
    expect(sheet!.style.paddingLeft).toBe("20mm");

    // Must NOT render fallback "خطاب رسمي" or "OFFICIAL CORRESPONDENCE"
    expect(sheet!.textContent).not.toContain("خطاب رسمي");
    expect(sheet!.textContent).not.toContain("OFFICIAL CORRESPONDENCE");
    expect(sheet!.textContent).not.toContain("عن وكالة T.A Advertising Solution");
    expect(sheet!.textContent).not.toContain("التوقيع المعتمد");

    // Core clean signatory, bigger stamp & high-res QR
    expect(sheet!.textContent).toContain("شركة زادنا للمواد الغذائية");
    expect(sheet!.textContent).toContain("الموضوع:");
    expect(sheet!.textContent).toContain("طارق عثمان علي");
    expect(sheet!.textContent).toContain("المدير العام — T.A Advertising Solution");

    const stampImg = sheet!.querySelector<HTMLImageElement>('img[alt="T.A Official Stamp"]');
    expect(stampImg).not.toBeNull();
    expect(stampImg!.style.width).toBe("185px");

    const qrImg = sheet!.querySelector<HTMLImageElement>('img[alt="QR Code"]');
    expect(qrImg).not.toBeNull();
    expect(qrImg!.parentElement?.style.width).toBe("96px");

    expect(INVOICE_STANDALONE_CSS).toContain(".official-letter-sheet");
    expect(INVOICE_STANDALONE_CSS).toContain("padding: 18mm 20mm 16mm 20mm !important;");
  });

  it("renders optional custom title when showLetterTitle is ON without extra subtitle clutter", () => {
    const letter = createOfficialLetter("TA-26-008", "ar", {
      showLetterTitle: true,
      letterTitle: "خطاب مطالبة مالية",
      recipientName: "شركة النيل",
    });

    const { container } = render(<OfficialLetterDocument letter={letter} />);
    expect(container.textContent).toContain("خطاب مطالبة مالية");
    expect(container.textContent).not.toContain("OFFICIAL CORRESPONDENCE");
  });

  it("switches to full LTR English mode and translates standard Arabic corporate clauses offline", () => {
    const arLetter = createOfficialLetter("TA-26-009", "ar", {
      showLetterTitle: true,
      letterTitle: "خطاب مطالبة مالية رسمية",
      recipientName: "شركة النور — الخرطوم",
      subject: "المطالبة بسداد المستحقات المالية للفواتير الصادرة",
    });

    const { translated } = translateLetterArToEnOffline(arLetter);
    expect(translated.language).toBe("en");
    expect(translated.recipientHonorific).toBe("Messrs.");
    expect(translated.letterTitle).toBe("Official Financial Claim Letter");
    expect(translated.subject).toBe("Formal Claim for Settlement of Outstanding Invoices");
    expect(translated.signatoryName).toBe("Tarig Osman Ali");
    expect(translated.signatoryTitle).toBe("General Manager — T.A Advertising Solution");

    const { container } = render(<OfficialLetterDocument letter={translated} />);
    const sheet = container.querySelector<HTMLElement>(".official-letter-sheet");
    expect(sheet!.getAttribute("dir")).toBe("ltr");
    expect(sheet!.textContent).toContain("Date:");
    expect(sheet!.textContent).toContain("Ref.:");
    expect(sheet!.textContent).toContain("Subject:");
    expect(sheet!.textContent).toContain("Tarig Osman Ali");
  });

  it("persists, increments sequential references, and deletes letters cleanly", async () => {
    const ref1 = getNextLetterReference("2026-11-20");
    const draft = createOfficialLetter(ref1, "ar", {
      recipientName: "بنك الخرطوم — فرع بورتسودان",
    });
    const saved = await saveOfficialLetter(draft);
    expect(getOfficialLettersSnapshot().some((l) => l.id === saved.id)).toBe(true);

    const ref2 = getNextLetterReference("2026-11-20");
    expect(ref2).not.toBe(ref1);

    await deleteOfficialLetter(saved.id);
    expect(getOfficialLettersSnapshot().some((l) => l.id === saved.id)).toBe(false);
  });
});
