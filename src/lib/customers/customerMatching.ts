import type { CustomerRecord } from "@/lib/customersStore";

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670\u0640]/g;

/**
 * Normalizes Arabic and Latin customer names for duplicate detection and
 * instant auto-matching without changing the user-visible display string.
 */
export function normalizeCustomerName(raw: string): string {
  return String(raw || "")
    .replace(ARABIC_DIACRITICS_REGEX, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Converts Arabic-Indic/Eastern-Arabic numerals to ASCII digits and strips
 * non-digit separators so phone searches match across formatting styles.
 */
export function normalizePhoneDigits(raw: string): string {
  return String(raw || "")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D+/g, "");
}

export interface CustomerMatchResult {
  exactActive: CustomerRecord | null;
  exactArchived: CustomerRecord | null;
  suggestions: CustomerRecord[];
}

/**
 * Looks up exact active/archived matches and ranked autocomplete suggestions
 * for a customer name or phone query.
 */
export function findCustomerMatch(
  customers: CustomerRecord[],
  queryName: string
): CustomerMatchResult {
  const normQuery = normalizeCustomerName(queryName);
  const phoneQuery = normalizePhoneDigits(queryName);

  if (!normQuery && !phoneQuery) {
    return { exactActive: null, exactArchived: null, suggestions: [] };
  }

  let exactActive: CustomerRecord | null = null;
  let exactArchived: CustomerRecord | null = null;
  const startsWithMatches: CustomerRecord[] = [];
  const containsMatches: CustomerRecord[] = [];

  for (const customer of customers) {
    const normName = normalizeCustomerName(customer.name);
    const isArchived = Boolean(customer.isArchived);

    if (normQuery && normName === normQuery) {
      if (!isArchived && !exactActive) {
        exactActive = customer;
      } else if (isArchived && !exactArchived) {
        exactArchived = customer;
      }
    }

    if (isArchived) continue;

    const normPhone = normalizePhoneDigits(customer.phone);
    const matchesNamePrefix = Boolean(normQuery && normName.startsWith(normQuery));
    const matchesNameContains = Boolean(normQuery && normName.includes(normQuery));
    const matchesPhone = Boolean(phoneQuery.length >= 3 && normPhone.includes(phoneQuery));

    if (matchesNamePrefix) {
      startsWithMatches.push(customer);
    } else if (matchesNameContains || matchesPhone) {
      containsMatches.push(customer);
    }
  }

  return {
    exactActive,
    exactArchived,
    suggestions: [...startsWithMatches, ...containsMatches].slice(0, 6),
  };
}

/**
 * Returns the first customer matching the normalized name.
 */
export function findCustomerByNormalizedName(
  customers: CustomerRecord[],
  name: string,
  options?: { includeArchived?: boolean }
): CustomerRecord | undefined {
  const normTarget = normalizeCustomerName(name);
  if (!normTarget) return undefined;

  return customers.find((c) => {
    if (!options?.includeArchived && c.isArchived) return false;
    return normalizeCustomerName(c.name) === normTarget;
  });
}
