/**
 * ═══════════════════════════════════════════════════════════════
 * Official Corporate Letters — Domain Types
 * ═══════════════════════════════════════════════════════════════
 */

export type LetterTemplateId = "introduction" | "financial_claim" | "authorization";

export interface LetterTemplateMeta {
  id: LetterTemplateId;
  shortLabel: string;
  title: string;
  description: string;
  defaultHonorific: string;
  defaultSubject: string;
  defaultSalutation: string;
  defaultBody: string;
  defaultClosingPhrase: string;
}

export interface OfficialLetter {
  id: string;
  reference: string;
  templateId: LetterTemplateId;
  date: string;
  recipientHonorific: string;
  recipientName: string;
  recipientTitle?: string;
  salutation: string;
  letterTitle: string;
  subject: string;
  body: string;
  closingPhrase: string;
  signatoryName: string;
  signatoryTitle: string;
  includeSignature: boolean;
  includeStamp: boolean;
  includeQr: boolean;
  createdAt: string;
  updatedAt: string;
}
