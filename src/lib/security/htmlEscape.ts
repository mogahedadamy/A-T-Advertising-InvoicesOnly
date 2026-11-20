/**
 * Security utilities for HTML escaping, direction sanitization, and URL validation.
 * Used across print/PDF/statement/HUD HTML template builders to prevent stored XSS.
 */

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_ESCAPE_RE = /[&<>"']/g;

/**
 * Escapes HTML special characters (`&`, `<`, `>`, `"`, `'`) in any dynamic value
 * before interpolating it into an HTML string or attribute.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(HTML_ESCAPE_RE, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

/**
 * Restricts HTML `dir` attribute values strictly to `"rtl"` or `"ltr"`.
 */
export function sanitizeDir(dir: unknown): "rtl" | "ltr" {
  if (typeof dir === "string" && dir.trim().toLowerCase() === "ltr") {
    return "ltr";
  }
  return "rtl";
}

/**
 * Returns true only for safe HTTP(S) URLs without control characters.
 * Rejects `javascript:`, `data:`, `vbscript:`, `file:`, and malformed values.
 */
export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed || /[\u0000-\u001F\u007F]/.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}
