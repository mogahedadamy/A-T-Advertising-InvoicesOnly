import { Capacitor } from "@capacitor/core";
import { getStoredSync, setMemoryCacheString } from "@/lib/sqliteStorage";
import { setSequence } from "@/lib/repositories/SettingsRepository";

// الترقيم التسلسلي لفواتير التشغيل المعياري (YY-NNNN) — يُحفظ على الجهاز
const KEY = "future_invoice_seq";

/** تنسيق تسلسلي رقمي 4 خانات */
export const formatSerial = (n: number) => String(n).padStart(4, "0");

/** تنسيق تسلسلي معياري للسنة والترقيم YY-NNNN */
export const formatInvoiceSerial = (n: number, year = new Date().getFullYear()) => {
  const yy = String(year).slice(-2);
  return `${yy}-${String(n).padStart(4, "0")}`;
};

export function peekNextSerial(year = new Date().getFullYear()): string {
  if (typeof window === "undefined") return formatInvoiceSerial(1, year);
  const yy = String(year).slice(-2);
  const key = `${KEY}_${yy}`;
  const cur = parseInt(getStoredSync(key, getStoredSync(KEY, "0")), 10) || 0;
  return formatInvoiceSerial(cur + 1, year);
}

/** يُثبّت الرقم المستخدم بحيث يبدأ التالي بعده */
export function commitSerial(serial: string, year = new Date().getFullYear()) {
  const yy = String(year).slice(-2);
  const key = `${KEY}_${yy}`;
  const match = /(\d+)$/.exec(serial.trim());
  const n = match ? parseInt(match[1], 10) : parseInt(serial.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return;
  const cur = parseInt(getStoredSync(key, "0"), 10) || 0;
  if (n > cur) {
    const val = String(n);
    setMemoryCacheString(key, val);
    setMemoryCacheString(KEY, val);
    if (Capacitor.isNativePlatform()) {
      setSequence(key, val).catch(() => {});
      setSequence(KEY, val).catch(() => {});
    }
  }
}
