/**
 * ═══════════════════════════════════════════════════════════════
 * Official Corporate Letters — Domain Types (Bilingual AR / EN)
 * ═══════════════════════════════════════════════════════════════
 */

export type LetterLanguage = "ar" | "en";

export interface OfficialLetter {
  id: string;
  reference: string;
  language: LetterLanguage;
  date: string;
  showLetterTitle: boolean;
  letterTitle: string;
  recipientHonorific: string;
  recipientName: string;
  recipientTitle?: string;
  salutation: string;
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
