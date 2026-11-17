/**
 * ═══════════════════════════════════════════════════════════════
 * Document reference system — Production Invoice Numbering (YY-NNNN)
 * ═══════════════════════════════════════════════════════════════
 * Pure module: no Capacitor, no DOM, no SQLite.
 *
 * Formats:
 *   Production Standard Invoices:  YY-NNNN       (e.g. 26-0001, 26-0002, 27-0001)
 *   Historical / Daily Invoices:   INV-DDMMYYYY-NNN / PINV-DDMMYYYY-NNN
 *   Project:                       PRJ-YYYY-NNN  (annual sequence)
 *   Receipt:                       RCV-DDMMYYYY-NNN
 *   Supplier Payment:              PAY-DDMMYYYY-NNN
 */

export type ReferenceScope = "sales" | "purchase" | "project" | "receipt" | "supplier_payment";
export type InvoiceReferenceScope = "sales" | "purchase";

export const REFERENCE_SCOPES: ReferenceScope[] = [
  "sales",
  "purchase",
  "project",
  "receipt",
  "supplier_payment",
];

export const REFERENCE_PREFIX: Record<ReferenceScope, string> = {
  sales: "INV",
  purchase: "PINV",
  project: "PRJ",
  receipt: "RCV",
  supplier_payment: "PAY",
};

export const REFERENCE_SEQUENCE_DIGITS: Record<ReferenceScope, number> = {
  sales: 3,
  purchase: 3,
  project: 3,
  receipt: 3,
  supplier_payment: 3,
};

const PATTERNS: Record<ReferenceScope, RegExp> = {
  sales: /^INV-(\d{2})(\d{2})(\d{4})-(\d{3,6})$/,
  purchase: /^PINV-(\d{2})(\d{2})(\d{4})-(\d{3,6})$/,
  project: /^PRJ-(\d{4})-(\d{3,6})$/,
  receipt: /^RCV-(\d{2})(\d{2})(\d{4})-(\d{3,6})$/,
  supplier_payment: /^PAY-(\d{2})(\d{2})(\d{4})-(\d{3,6})$/,
};

export interface LocalDateParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

export interface ParsedReference {
  scope: ReferenceScope;
  date: LocalDateParts;
  sequence: number;
  raw: string;
}

export function localDateParts(at: Date | number, timeZoneOffsetMinutes: number): LocalDateParts {
  const ms = typeof at === "number" ? at : at.getTime();
  const shifted = new Date(ms - timeZoneOffsetMinutes * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function dateKeyFromParts(scope: ReferenceScope, parts: LocalDateParts): string {
  if (scope === "project" || scope === "sales" || scope === "purchase") return String(parts.year);
  return `${pad(parts.day, 2)}${pad(parts.month, 2)}${parts.year}`;
}

export function sequenceDateKey(
  scope: ReferenceScope,
  at: Date | number,
  timeZoneOffsetMinutes: number
): string {
  return dateKeyFromParts(scope, localDateParts(at, timeZoneOffsetMinutes));
}

export function localPartsFromIsoDate(value: string | null | undefined): LocalDateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function pad(value: number, digits: number): string {
  return String(value).padStart(digits, "0");
}

/** Formats standard annual invoice reference YY-NNNN (e.g. 26-0001, 27-0001). */
export function formatInvoiceReference(year: number | string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`invoice reference sequence must be a positive integer, got ${sequence}`);
  }
  const yy = String(year).trim().slice(-2);
  return `${yy}-${pad(sequence, 4)}`;
}

/**
 * Ensures any reference or serial is displayed cleanly in the standard annual format YY-NNNN (e.g. 26-0001).
 * Never prints raw single digits like "001" or complex legacy strings.
 */
export function formatDisplayReference(
  reference?: string | null,
  serial?: string | null,
  date?: string | null
): string {
  if (reference && reference.trim()) {
    const trimmed = reference.trim();
    if (/^\d{2}-\d{4}$/.test(trimmed)) return trimmed;
    const parsed = parseReference(trimmed);
    if (parsed) {
      const yy = String(parsed.date.year).slice(-2);
      return `${yy}-${pad(parsed.sequence, 4)}`;
    }
    return trimmed;
  }
  if (serial && serial.trim()) {
    const clean = serial.trim().replace(/^#/, "");
    const num = parseInt(clean, 10);
    if (!isNaN(num)) {
      const yr = date ? date.split("-")[0] : String(new Date().getFullYear());
      const yy = (yr || String(new Date().getFullYear())).slice(-2);
      return `${yy}-${pad(num, 4)}`;
    }
  }
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${yy}-0001`;
}

/**
 * Builds a reference string.
 * Supports both standard annual YY-NNNN (when dateKey is a 2 or 4-digit year)
 * and legacy/PRD formats (when dateKey is 8-digit DDMMYYYY).
 */
export function formatReference(scope: ReferenceScope, dateKey: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`reference sequence must be a positive integer, got ${sequence}`);
  }

  // Annual YY-NNNN standard format when given a year (e.g. "2026" or "26")
  if ((scope === "sales" || scope === "purchase") && /^\d{2,4}$/.test(dateKey)) {
    const yy = dateKey.slice(-2);
    return `${yy}-${pad(sequence, 4)}`;
  }

  const digits = REFERENCE_SEQUENCE_DIGITS[scope];
  const prefix = REFERENCE_PREFIX[scope];

  if (scope === "project") {
    if (!/^\d{4}$/.test(dateKey)) throw new Error(`project date key must be a 4-digit year, got ${dateKey}`);
    return `${prefix}-${dateKey}-${pad(sequence, digits)}`;
  }

  if (!/^\d{8}$/.test(dateKey)) throw new Error(`invoice date key must be DDMMYYYY, got ${dateKey}`);
  return `${prefix}-${dateKey}-${pad(sequence, digits)}`;
}

/** Parses a reference; returns null when the string is not a valid reference. */
export function parseReference(raw: string | null | undefined): ParsedReference | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  // 1. Standard format: YY-NNNN (e.g. 26-0001, 27-0001)
  const yyMatch = /^(\d{2})-(\d{4,6})$/.exec(value);
  if (yyMatch) {
    const yy = Number(yyMatch[1]);
    const sequence = Number(yyMatch[2]);
    const year = 2000 + yy;
    return {
      scope: "sales",
      date: { year, month: 1, day: 1 },
      sequence,
      raw: value,
    };
  }

  // 2. Historical & other scopes
  for (const scope of REFERENCE_SCOPES) {
    const match = PATTERNS[scope].exec(value);
    if (!match) continue;
    if (scope === "project") {
      return {
        scope,
        date: { year: Number(match[1]), month: 1, day: 1 },
        sequence: Number(match[2]),
        raw: value,
      };
    }
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const sequence = Number(match[4]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { scope, date: { year, month, day }, sequence, raw: value };
  }
  return null;
}

export function isValidReference(raw: string | null | undefined): boolean {
  return parseReference(raw) !== null;
}

export function isInvoiceReference(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  if (/^(\d{2})-(\d{4,6})$/.test(value)) return true;
  const parsed = parseReference(raw);
  return parsed !== null && (parsed.scope === "sales" || parsed.scope === "purchase");
}

export function isMoneyReference(raw: string | null | undefined): boolean {
  const parsed = parseReference(raw);
  return parsed !== null && (parsed.scope === "receipt" || parsed.scope === "supplier_payment");
}

export function scopeForInvoiceType(type: string | null | undefined): InvoiceReferenceScope | null {
  if (type === "sales") return "sales";
  if (type === "purchase") return "purchase";
  return null;
}

export interface BackfillCandidate {
  id: string;
  date: string | null;
  createdAt: string | null;
}

export function compareForBackfill(a: BackfillCandidate, b: BackfillCandidate): number {
  const dateA = (a.date ?? "").trim();
  const dateB = (b.date ?? "").trim();
  if (dateA !== dateB) return dateA < dateB ? -1 : 1;
  const createdA = (a.createdAt ?? "").trim();
  const createdB = (b.createdAt ?? "").trim();
  if (createdA !== createdB) return createdA < createdB ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function planReferenceBackfill(
  scope: Exclude<ReferenceScope, "project">,
  candidates: BackfillCandidate[],
  timeZoneOffsetMinutes: number
): {
  assignments: { id: string; dateKey: string; sequence: number; reference: string }[];
  maxSequenceByDateKey: Record<string, number>;
} {
  const assignments: { id: string; dateKey: string; sequence: number; reference: string }[] = [];
  const maxSequenceByDateKey: Record<string, number> = {};

  const ordered = [...candidates].sort(compareForBackfill);
  for (const candidate of ordered) {
    const parts =
      localPartsFromIsoDate(candidate.date) ??
      localDateParts(parseIsoInstant(candidate.createdAt) ?? Date.UTC(1970, 0, 1, 12), timeZoneOffsetMinutes);
    const dateKey = dateKeyFromParts(scope, parts);
    const next = (maxSequenceByDateKey[dateKey] ?? 0) + 1;
    maxSequenceByDateKey[dateKey] = next;
    assignments.push({ id: candidate.id, dateKey, sequence: next, reference: formatReference(scope, dateKey, next) });
  }

  return { assignments, maxSequenceByDateKey };
}

export function parseIsoLocalDate(value: string | null | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec((value ?? "").trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return Date.UTC(year, month - 1, day, 12, 0, 0);
}

export function parseIsoInstant(value: string | null | undefined): number | null {
  const ms = Date.parse((value ?? "").trim());
  return Number.isFinite(ms) ? ms : null;
}
