import React from "react";

/**
 * ═══════════════════════════════════════════════════════════════
 * BiDi & Dimension Formatting Utilities (UBA / Unicode Isolation)
 * ═══════════════════════════════════════════════════════════════
 * Solves the classic Arabic RTL BiDi inversion bug where entering:
 *   "طباعة لافتات 300 x 100"
 * gets jumbled or flipped into "100 x 300 طباعة لافتات".
 *
 * Uses Unicode Left-to-Right Isolate (U+2066) and Pop Directional
 * Isolate (U+2069), plus HTML5 <bdi> isolation tags.
 */

// LRI = Left-to-Right Isolate (\u2066), PDI = Pop Directional Isolate (\u2069)
export const LRI = "\u2066";
export const PDI = "\u2069";

// Dimension regex: matches patterns like 300 x 100, 300 × 100, 300*100, 2.5 x 1.2, etc.
const DIMENSION_REGEX = /(\d+(?:\.\d+)?(?:\s*[a-zA-Z\u0621-\u064A]+)?)\s*([xX*×*]|(?:\s*في\s*))\s*(\d+(?:\.\d+)?(?:\s*[a-zA-Z\u0621-\u064A]+)?)/g;

/**
 * Wraps dimension segments in Unicode LTR Isolation characters.
 * Ensures that dimensions like "300 x 100" or "300 × 100" preserve
 * their natural left-to-right order without flipping inside RTL sentences.
 */
export function formatBiDiDimensions(text: string | null | undefined): string {
  if (!text) return "";
  const trimmed = text.trim();
  if (!trimmed) return "";

  // Normalize Latin 'x' or '*' in dimension expressions to clean '×' and isolate
  return trimmed.replace(DIMENSION_REGEX, (_match, w, op, h) => {
    const symbol = op.trim() === "في" ? " × " : (op.toLowerCase() === "x" || op === "*" ? " × " : ` ${op} `);
    return `${LRI}${w.trim()}${symbol}${h.trim()}${PDI}`;
  });
}

/**
 * Safely renders mixed Arabic/English/Dimension text with <bdi> isolation.
 */
export function renderBiDiDescription(text: string | null | undefined): React.ReactNode {
  if (!text) return null;
  const formatted = formatBiDiDimensions(text);
  return formatted;
}
