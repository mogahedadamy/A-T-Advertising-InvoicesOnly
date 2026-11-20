/**
 * ═══════════════════════════════════════════════════════════════
 * Local calendar date utilities (timezone-safe)
 * ═══════════════════════════════════════════════════════════════
 * Pure module: avoids UTC midnight shifts (e.g. 00:00–01:59 UTC+2 in Sudan
 * shifting to the previous day/year when using `toISOString().slice(0, 10)`).
 */

function normalizeDate(date: Date): Date {
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function pad4(value: number): string {
  return String(value).padStart(4, "0");
}

/** Returns `YYYY-MM-DD` in the device's local calendar timezone. */
export function getLocalIsoDate(date: Date = new Date()): string {
  const safe = normalizeDate(date);
  return `${pad4(safe.getFullYear())}-${pad2(safe.getMonth() + 1)}-${pad2(safe.getDate())}`;
}

/** Returns the 4-digit calendar year in the device's local timezone. */
export function getLocalYear(date: Date = new Date()): number {
  return normalizeDate(date).getFullYear();
}
