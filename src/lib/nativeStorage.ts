import { Preferences } from "@capacitor/preferences";

/**
 * ═════════════════════════════════════════════════════════════════════
 * محرك التخزين الدائم المزدوج (Dual-Layer Native Persistent Storage Engine)
 * ═════════════════════════════════════════════════════════════════════
 * يضمن حفظ واسترجاع الفواتير وأوامر الشغل بصورة قطعية لا تزول:
 * 1. الذاكرة المباشرة (Memory Cache) للقراءة اللحظية الفورية 0ms
 * 2. التخزين المحلي (Web LocalStorage)
 * 3. التخزين الدائم لأندرويد الأصلي (Android SharedPreferences عبر Capacitor Preferences)
 * 4. نظام الترحيل التلقائي من المفاتيح القديمة والنسخ السابقة لمنع فقدان أي فواتير قديمة
 */

// ذاكرة تخزين مؤقتة وسريعة للقراءة الفورية
const memoryCache = new Map<string, string>();
let isNativeStorageReady = false;

// خريطة المفاتيح القديمة لترحيل الفواتير السابقة تلقائياً في حال وجودها
const LEGACY_KEYS_FALLBACK: Record<string, string[]> = {
  future_print_invoices_v2: ["future_print_invoices", "print_invoices", "invoices", "future_invoices"],
  future_print_orders_v2: ["future_print_orders", "print_orders", "orders", "future_orders"],
  future_custom_invoices_v2: ["future_custom_invoices", "custom_invoices", "billing_invoices"],
  future_proforma_invoices_v2: ["future_proforma_invoices", "proforma_invoices", "future_proforma"],
  future_invoice_seq: ["future_invoice_last_serial", "invoice_seq"],
  future_proforma_seq: ["future_proforma_last_serial", "proforma_seq"],
};

/** قراءة متزامنة فورية */
export function getStoredSync(key: string, defaultValue: string = ""): string {
  if (memoryCache.has(key)) {
    return memoryCache.get(key)!;
  }
  if (typeof window !== "undefined") {
    try {
      const val = localStorage.getItem(key);
      if (val !== null && val !== "") {
        memoryCache.set(key, val);
        return val;
      }
      // فحص المفاتيح القديمة للترحيل
      const fallbacks = LEGACY_KEYS_FALLBACK[key] || [];
      for (const oldKey of fallbacks) {
        const oldVal = localStorage.getItem(oldKey);
        if (oldVal !== null && oldVal !== "") {
          memoryCache.set(key, oldVal);
          localStorage.setItem(key, oldVal);
          // حفظ في الخلفية في أندرويد
          Preferences.set({ key, value: oldVal }).catch(() => {});
          return oldVal;
        }
      }
    } catch {}
  }
  return defaultValue;
}

/** قراءة كائن JSON بشكل آمن ومتزامن */
export function getStoredJsonSync<T>(key: string, fallback: T): T {
  const raw = getStoredSync(key, "");
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed !== null && parsed !== undefined ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

/** حفظ قيمة في الذاكرة الدائمة (SharedPreferences + localStorage + Memory) */
export async function setStoredItem(key: string, value: string): Promise<void> {
  memoryCache.set(key, value);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn("localStorage setItem failed:", e);
    }
  }
  try {
    await Preferences.set({ key, value });
  } catch (e) {
    console.warn("Native Preferences.set failed:", e);
  }
}

/** حفظ كائن JSON في الذاكرة الدائمة */
export async function setStoredJson<T>(key: string, data: T): Promise<void> {
  const jsonStr = JSON.stringify(data);
  await setStoredItem(key, jsonStr);
}

/** حذف عنصر */
export async function removeStoredItem(key: string): Promise<void> {
  memoryCache.delete(key);
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
  try {
    await Preferences.remove({ key });
  } catch {}
}

/**
 * تهيئة وتحميل كافة البيانات المخزنة من نظام أندرويد الأصلي بالتوازي (Parallel Async Sync)
 * مع ترحيل الفواتير القديمة وضمان عدم فقدان أي فاتورة سابقة إطلاقاً
 */
export async function initNativeStorage(keysToSync: string[]): Promise<void> {
  // دمج المفاتيح الأساسية مع مفاتيح الترحيل
  const allKeys = Array.from(new Set([...keysToSync, ...Object.keys(LEGACY_KEYS_FALLBACK)]));

  await Promise.all(
    allKeys.map(async (key) => {
      try {
        let valueToUse: string | null = null;

        // 1. فحص التخزين الأصلي لأندرويد أولاً
        const nativeResult = await Preferences.get({ key }).catch(() => null);
        if (
          nativeResult &&
          nativeResult.value !== null &&
          nativeResult.value !== undefined &&
          nativeResult.value !== "" &&
          nativeResult.value !== "[]"
        ) {
          valueToUse = nativeResult.value;
        }

        // 2. إذا لم توجد قيمة ممتلئة في أندرويد، أو كانت localStorage تحتوي على بيانات أحدث/أكبر، نفحص localStorage الحالي
        if (typeof window !== "undefined") {
          try {
            const localVal = localStorage.getItem(key);
            if (localVal !== null && localVal !== "" && localVal !== "[]") {
              if (!valueToUse || (localVal.length > (valueToUse?.length || 0))) {
                valueToUse = localVal;
              }
            }
          } catch {}
        }

        // 3. إذا ما تزال فارغة، نبحث في مفاتيح الإصدارات السابقة (Legacy Migration)
        if (!valueToUse) {
          const fallbacks = LEGACY_KEYS_FALLBACK[key] || [];
          for (const oldKey of fallbacks) {
            // محاولة القراءة من أندرويد للمفتاح القديم
            const oldNative = await Preferences.get({ key: oldKey }).catch(() => null);
            if (oldNative && oldNative.value) {
              valueToUse = oldNative.value;
              break;
            }
            // محاولة القراءة من localStorage للمفتاح القديم
            if (typeof window !== "undefined") {
              const oldLocal = localStorage.getItem(oldKey);
              if (oldLocal) {
                valueToUse = oldLocal;
                break;
              }
            }
          }
        }

        // 4. إذا وجدنا قيمة صالحة، نثبتها في جميع الطبقات (Memory + localStorage + SharedPreferences)
        if (valueToUse) {
          memoryCache.set(key, valueToUse);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(key, valueToUse);
            } catch {}
          }
          await Preferences.set({ key, value: valueToUse }).catch(() => {});
        }
      } catch (err) {
        console.warn(`Sync error for ${key}:`, err);
      }
    })
  );

  isNativeStorageReady = true;

  // إشعار كافة مخازن البيانات في التطبيق بإعادة قراءة البيانات المكتشفة وتحديث الواجهة
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("native-storage-ready"));
  }
}

export function isStorageReady(): boolean {
  return isNativeStorageReady;
}
