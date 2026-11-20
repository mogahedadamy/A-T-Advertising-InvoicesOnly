// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import {
  LETTER_TEMPLATES,
  createLetterFromTemplate,
} from "@/lib/letters/templates";
import {
  deleteOfficialLetter,
  getNextLetterReference,
  getOfficialLettersSnapshot,
  saveOfficialLetter,
} from "@/lib/letters/store";
import { INVOICE_STANDALONE_CSS } from "@/lib/pdfExportStyles";
import { OfficialLetterDocument } from "./OfficialLetterDocument";

afterEach(cleanup);

describe("Official Corporate Letters Feature", () => {
  it("provides 3 authoritative legal templates with complete Arabic defaults", () => {
    expect(LETTER_TEMPLATES.length).toBe(3);
    const ids = LETTER_TEMPLATES.map((t) => t.id);
    expect(ids).toEqual(["introduction", "financial_claim", "authorization"]);

    for (const tpl of LETTER_TEMPLATES) {
      const draft = createLetterFromTemplate(tpl.id, "TA-26-001");
      expect(draft.letterTitle.trim().length).toBeGreaterThan(5);
      expect(draft.subject.trim().length).toBeGreaterThan(10);
      expect(draft.body.trim().length).toBeGreaterThan(40);
      expect(draft.signatoryName).toBe("طارق عثمان علي");
      expect(draft.includeSignature).toBe(true);
      expect(draft.includeStamp).toBe(true);
      expect(draft.includeQr).toBe(true);
    }
  });

  it("renders OfficialLetterDocument on centered A4 letterhead with safe margins, subject box, stamp, signature, and lossless QR", () => {
    const letter = createLetterFromTemplate("financial_claim", "TA-26-007", {
      recipientName: "شركة زادنا للمواد الغذائية",
      recipientTitle: "عناية السيد / المدير المالي",
    });

    const { container } = render(<OfficialLetterDocument letter={letter} />);
    const sheet = container.querySelector<HTMLElement>(".official-letter-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet!.style.width).toBe("210mm");
    expect(sheet!.style.height).toBe("297mm");
    expect(sheet!.style.paddingTop).toBe("18mm");
    expect(sheet!.style.paddingRight).toBe("20mm");
    expect(sheet!.style.paddingBottom).toBe("16mm");
    expect(sheet!.style.paddingLeft).toBe("20mm");

    expect(sheet!.textContent).toContain("خطاب مطالبة مالية رسمية");
    expect(sheet!.textContent).toContain("شركة زادنا للمواد الغذائية");
    expect(sheet!.textContent).toContain("عناية السيد / المدير المالي");
    expect(sheet!.textContent).toContain("الموضوع:");
    expect(sheet!.textContent).toContain("TA-26-007");
    expect(sheet!.textContent).toContain("طارق عثمان علي");
    expect(sheet!.querySelector('img[alt="QR Code"]')).not.toBeNull();
    expect(sheet!.querySelector('img[alt="T.A Official Stamp"]')).not.toBeNull();
    expect(sheet!.querySelector('img[alt="Signature"]')).not.toBeNull();

    // Standalone print CSS must enforce diplomatic safe paper margins for official letters
    expect(INVOICE_STANDALONE_CSS).toContain(".official-letter-sheet");
    expect(INVOICE_STANDALONE_CSS).toContain("padding: 18mm 20mm 16mm 20mm !important;");
  });

  it("persists, increments sequential references, and deletes letters cleanly in the archive store", async () => {
    const ref1 = getNextLetterReference("2026-11-20");
    expect(ref1).toMatch(/^TA-26-\d{3}$/);

    const draft = createLetterFromTemplate("authorization", ref1, {
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
