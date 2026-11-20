/**
 * trialGuard.ts — محرك حماية ومراقبة صلاحية النسخة التجريبية (7 أيام)
 *
 * الميزات:
 * 1. حساب دقيق لـ 7 أيام (168 ساعة) من لحظة أول تشغيل
 * 2. كشف محاولات تأخير ساعة الجهاز (Anti-Clock Tampering)
 * 3. حماية تامة لشاشة السبلاش من أي انهيار برمجياً
 * 4. تعطيل فوري وتام للمهلة والمؤقتات إذا كانت ENABLE_TRIAL_LOCK = false
 */

import { useState, useEffect } from "react";
import { Preferences } from "@capacitor/preferences";
import { TRIAL_CONFIG } from "./trialConfig";

export interface TrialStatus {
  isEnabled: boolean;
  isExpired: boolean;
  remainingMs: number;
  hoursLeft: number;
  minutesLeft: number;
  secondsLeft: number;
  installedAt: number;
  isTampered: boolean;
  isReady: boolean;
}

/**
 * جلب قيمة من التخزين مع حماية تامة ضد الأخطاء
 */
async function safeGetStorage(key: string): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    if (value) return value;
  } catch {
    // تجاهل أخطاء كاباسيتور
  }

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * حفظ قيمة في التخزين مع حماية تامة ضد الأخطاء
 */
async function safeSetStorage(key: string, value: string): Promise<void> {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore localStorage write errors
    }
  }
  try {
    await Preferences.set({ key, value });
  } catch {
    // ignore Preferences write errors
  }

  // إرساء متوازي في قاعدة بيانات SQLite كطبقة حماية ثالثة
  try {
    const { getDb } = await import("@/lib/database");
    const db = await getDb();
    await db.run("INSERT OR REPLACE INTO settings(key, value) VALUES(?,?)", [key, value]);
  } catch {
    // ignore SQLite fallback errors on web
  }
}

/**
 * متغيرات الذاكرة الفورية (In-Memory Cache) لمنع أي استعلام متكرر لـ IPC Capacitor Bridge
 * وتحقيق سرعة استجابة لحظية 0ms
 */
let cachedPermanentlyLocked: boolean | null = null;
let cachedInstalledAt: number | null = null;
let cachedHwm: number = 0;
let lastHwmPersistTime = 0;
let isStorageInitialized = false;

export function resetTrialCacheForTests(): void {
  cachedPermanentlyLocked = null;
  cachedInstalledAt = null;
  cachedHwm = 0;
  lastHwmPersistTime = 0;
  isStorageInitialized = false;
}

async function initTrialStorage(): Promise<void> {
  if (isStorageInitialized) return;
  const { STORAGE_KEYS } = TRIAL_CONFIG;
  const now = Date.now();

  const lockedStr = await safeGetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED);
  let locked = lockedStr === "true";

  const installedStr = await safeGetStorage(STORAGE_KEYS.INSTALLED_AT);
  let inst = installedStr ? parseInt(installedStr, 10) : 0;
  if (!Number.isFinite(inst) || inst <= 0) inst = 0;

  const hwmStr = await safeGetStorage(STORAGE_KEYS.HIGH_WATER_MARK);
  let hwm = hwmStr ? parseInt(hwmStr, 10) : 0;
  if (!Number.isFinite(hwm) || hwm <= 0) hwm = 0;

  // Read-before-write reconciliation: read SQLite BEFORE ever initializing a fresh timestamp
  // so clearing Preferences/localStorage cannot overwrite an earlier SQLite trial record.
  try {
    const { getDb } = await import("@/lib/database");
    const db = await getDb();
    const res = await db.query(
      "SELECT key, value FROM settings WHERE key IN (?, ?, ?)",
      [STORAGE_KEYS.INSTALLED_AT, STORAGE_KEYS.HIGH_WATER_MARK, STORAGE_KEYS.PERMANENTLY_LOCKED]
    );
    for (const row of res.values || []) {
      if (row?.key === STORAGE_KEYS.INSTALLED_AT) {
        const dbInst = parseInt(String(row.value), 10);
        if (Number.isFinite(dbInst) && dbInst > 0 && (inst === 0 || dbInst < inst)) {
          inst = dbInst;
        }
      }
      if (row?.key === STORAGE_KEYS.HIGH_WATER_MARK) {
        const dbHwm = parseInt(String(row.value), 10);
        if (Number.isFinite(dbHwm) && dbHwm > hwm) {
          hwm = dbHwm;
        }
      }
      if (row?.key === STORAGE_KEYS.PERMANENTLY_LOCKED && String(row.value) === "true") {
        locked = true;
      }
    }
  } catch (err) {
    console.warn("[TrialGuard] SQLite reconciliation skipped:", err);
  }

  // Only persist a brand-new install timestamp after verifying neither Preferences nor SQLite had one
  if (inst <= 0) {
    inst = now;
    if (hwm <= 0) hwm = now;
    void safeSetStorage(STORAGE_KEYS.INSTALLED_AT, String(inst));
    void safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(hwm));
  } else {
    if (hwm <= 0) hwm = inst;
  }

  cachedPermanentlyLocked = locked;
  cachedInstalledAt = inst;
  cachedHwm = hwm;
  isStorageInitialized = true;
}

/**
 * تقييم حالة المهلة التجريبية بسرعة فائقة 0ms من الذاكرة
 */
export async function evaluateTrialStatus(): Promise<TrialStatus> {
  // إذا كانت ميزة المهلة معطلة في الإعدادات: التطبيق دائم ومفتوح بالكامل
  if (!TRIAL_CONFIG.ENABLE_TRIAL_LOCK) {
    return {
      isEnabled: false,
      isExpired: false,
      remainingMs: Infinity,
      hoursLeft: 999,
      minutesLeft: 0,
      secondsLeft: 0,
      installedAt: Date.now(),
      isTampered: false,
      isReady: true,
    };
  }

  const { STORAGE_KEYS, DURATION_MS } = TRIAL_CONFIG;
  const now = Date.now();

  try {
    if (!isStorageInitialized) {
      await initTrialStorage();
    }

    // 1. فحص ما إذا كان التطبيق مقفلاً نهائياً
    if (cachedPermanentlyLocked) {
      return {
        isEnabled: true,
        isExpired: true,
        remainingMs: 0,
        hoursLeft: 0,
        minutesLeft: 0,
        secondsLeft: 0,
        installedAt: cachedInstalledAt || 0,
        isTampered: false,
        isReady: true,
      };
    }

    const installedAt = cachedInstalledAt || now;

    // 2. فحص التلاعب بساعة الهاتف (High-Water Mark)
    if (now < cachedHwm - 5 * 60 * 1000) {
      cachedPermanentlyLocked = true;
      void safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true");
      return {
        isEnabled: true,
        isExpired: true,
        remainingMs: 0,
        hoursLeft: 0,
        minutesLeft: 0,
        secondsLeft: 0,
        installedAt,
        isTampered: true,
        isReady: true,
      };
    }

    // تحديث أعلى نقطة زمنية كل دقيقة على الأقل في الخلفية دون تعطيل واجهة المستخدم
    if (now > cachedHwm) {
      cachedHwm = now;
      if (now - lastHwmPersistTime > 60 * 1000) {
        lastHwmPersistTime = now;
        void safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(now));
      }
    }

    // 3. احتساب الوقت المتبقي في الذاكرة لحظياً (0ms)
    const elapsed = now - installedAt;
    const remainingMs = Math.max(0, DURATION_MS - elapsed);
    const isExpired = remainingMs <= 0;

    if (isExpired) {
      cachedPermanentlyLocked = true;
      void safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true");
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const hoursLeft = Math.floor(totalSeconds / 3600);
    const minutesLeft = Math.floor((totalSeconds % 3600) / 60);
    const secondsLeft = totalSeconds % 60;

    return {
      isEnabled: true,
      isExpired,
      remainingMs,
      hoursLeft,
      minutesLeft,
      secondsLeft,
      installedAt,
      isTampered: false,
      isReady: true,
    };
  } catch (err) {
    // Fail-closed: never grant a fresh trial window if evaluation fails while trial lock is enabled
    console.warn("Trial evaluation failed (failing closed):", err);
    return {
      isEnabled: true,
      isExpired: true,
      remainingMs: 0,
      hoursLeft: 0,
      minutesLeft: 0,
      secondsLeft: 0,
      installedAt: cachedInstalledAt || 0,
      isTampered: true,
      isReady: true,
    };
  }
}

/**
 * خطاف تفاعلي لفحص انتهاء الصلاحية فقط (بدون إعادة تصيير كل ثانية)
 * مثالي لـ RootComponent لمنع أي وميض أو إعادة تشغيل لشاشة البداية
 */
export function useTrialExpiry(): {
  isEnabled: boolean;
  isExpired: boolean;
  isTampered: boolean;
  isReady: boolean;
} {
  const [expiry, setExpiry] = useState({
    isEnabled: TRIAL_CONFIG.ENABLE_TRIAL_LOCK,
    isExpired: false,
    isTampered: false,
    isReady: !TRIAL_CONFIG.ENABLE_TRIAL_LOCK,
  });

  useEffect(() => {
    if (!TRIAL_CONFIG.ENABLE_TRIAL_LOCK) return;
    let isMounted = true;

    const checkExpiry = async () => {
      try {
        const res = await evaluateTrialStatus();
        if (isMounted) {
          setExpiry((prev) => {
            if (
              prev.isExpired !== res.isExpired ||
              prev.isTampered !== res.isTampered ||
              prev.isReady !== res.isReady ||
              prev.isEnabled !== res.isEnabled
            ) {
              return {
                isEnabled: res.isEnabled,
                isExpired: res.isExpired,
                isTampered: res.isTampered,
                isReady: res.isReady,
              };
            }
            return prev;
          });
        }
      } catch (e) {
        console.warn("Trial expiry check error:", e);
      }
    };

    void checkExpiry();

    // فحص دوري خفيف كل 30 ثانية لتوفير موارد المعالج
    const interval = setInterval(() => void checkExpiry(), 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkExpiry();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return expiry;
}

/**
 * خطاف تفاعلي لمراقبة عداد الوقت المتبقي (يُستخدم داخل شارات وعناصر العداد فقط)
 */
export function useTrialGuard(): TrialStatus {
  const [status, setStatus] = useState<TrialStatus>(() => ({
    isEnabled: TRIAL_CONFIG.ENABLE_TRIAL_LOCK,
    isExpired: false,
    remainingMs: TRIAL_CONFIG.ENABLE_TRIAL_LOCK ? TRIAL_CONFIG.DURATION_MS : Infinity,
    hoursLeft: TRIAL_CONFIG.ENABLE_TRIAL_LOCK ? TRIAL_CONFIG.DURATION_HOURS : 999,
    minutesLeft: 0,
    secondsLeft: 0,
    installedAt: Date.now(),
    isTampered: false,
    isReady: !TRIAL_CONFIG.ENABLE_TRIAL_LOCK,
  }));

  useEffect(() => {
    if (!TRIAL_CONFIG.ENABLE_TRIAL_LOCK) return;
    let isMounted = true;

    const runCheck = async () => {
      try {
        const res = await evaluateTrialStatus();
        if (isMounted) {
          setStatus(res);
        }
      } catch (e) {
        console.warn("Failed to evaluate trial:", e);
      }
    };

    void runCheck();

    // تحديث كل ثانية لعرض الساعات والدقائق والثواني بدقة لحظية
    const interval = setInterval(() => void runCheck(), 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runCheck();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return status;
}
