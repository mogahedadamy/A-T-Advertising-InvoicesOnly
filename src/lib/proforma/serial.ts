import { Capacitor } from "@capacitor/core";
import { getStoredSync, setMemoryCacheString } from "@/lib/sqliteStorage";
import { setSequence } from "@/lib/repositories/SettingsRepository";

// الترقيم التسلسلي للفواتير المبدئية — يُحفظ على الجهاز
const KEY = "future_proforma_seq";

export const formatProformaSerial = (n: number) => String(n).padStart(4, "0");

export function peekNextProformaSerial(): string {
  if (typeof window === "undefined") return formatProformaSerial(1);
  const cur = parseInt(getStoredSync(KEY, "0"), 10) || 0;
  return formatProformaSerial(cur + 1);
}

export function commitProformaSerial(serial: string) {
  const n = parseInt(serial.replace(/\D/g, ""), 10);
  if (!Number.isFinite(n)) return;
  const cur = parseInt(getStoredSync(KEY, "0"), 10) || 0;
  if (n > cur) {
    const val = String(n);
    setMemoryCacheString(KEY, val);
    if (Capacitor.isNativePlatform()) {
      setSequence(KEY, val).catch(() => {});
    }
  }
}
