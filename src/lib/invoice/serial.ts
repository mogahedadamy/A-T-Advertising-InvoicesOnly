import { getStoredSync, setStoredItem } from "@/lib/nativeStorage";

// الترقيم التسلسلي لفواتير التشغيل — يُحفظ على الجهاز
const KEY = "future_invoice_seq";

export const formatSerial = (n: number) => String(n).padStart(4, "0");

export function peekNextSerial(): string {
  if (typeof window === "undefined") return formatSerial(1);
  const cur = parseInt(getStoredSync(KEY, "0"), 10) || 0;
  return formatSerial(cur + 1);
}

/** يُثبّت الرقم المستخدم بحيث يبدأ التالي بعده */
export function commitSerial(serial: string) {
  const n = parseInt(serial.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return;
  const cur = parseInt(getStoredSync(KEY, "0"), 10) || 0;
  if (n > cur) {
    setStoredItem(KEY, String(n)).catch(() => {});
  }
}
