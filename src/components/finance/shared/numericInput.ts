/**
 * Cleans user numeric input to a non-negative decimal string with at most one decimal point.
 */
export function sanitizePositiveDecimal(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [intPart = "", ...decParts] = cleaned.split(".");
  return decParts.length > 0 ? `${intPart}.${decParts.join("")}` : intPart;
}
