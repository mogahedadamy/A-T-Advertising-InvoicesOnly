/**
 * trialGuard.ts — محرك حماية ومراقبة صلاحية النسخة التجريبية (48 ساعة)
 * 
 * الميزات:
 * 1. حساب دقيق لـ 48 ساعة من لحظة أول تشغيل
 * 2. كشف محاولات تأخير ساعة الجهاز (Anti-Clock Tampering)
 * 3. حماية تامة لشاشة السبلاش من أي انهيار برمجياً
 * 4. تعطيل فوري وتام للمهلة إذا كانت ENABLE_TRIAL_LOCK = false
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
    } catch {}
  }
  try {
    await Preferences.set({ key, value });
  } catch {}
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

async function initTrialStorage(): Promise<void> {
  if (isStorageInitialized) return;
  const { STORAGE_KEYS } = TRIAL_CONFIG;
  try {
    const lockedStr = await safeGetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED);
    cachedPermanentlyLocked = lockedStr === "true";

    const installedStr = await safeGetStorage(STORAGE_KEYS.INSTALLED_AT);
    let inst = installedStr ? parseInt(installedStr, 10) : 0;
    const now = Date.now();
    if (!inst || isNaN(inst) || inst <= 0) {
      inst = now;
      safeSetStorage(STORAGE_KEYS.INSTALLED_AT, String(inst)).catch(() => {});
      safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(now)).catch(() => {});
    }
    cachedInstalledAt = inst;

    const hwmStr = await safeGetStorage(STORAGE_KEYS.HIGH_WATER_MARK);
    cachedHwm = hwmStr ? parseInt(hwmStr, 10) : inst;
    isStorageInitialized = true;
  } catch (err) {
    cachedInstalledAt = Date.now();
    isStorageInitialized = true;
  }
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
      safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true").catch(() => {});
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
        safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(now)).catch(() => {});
      }
    }

    // 3. احتساب الوقت المتبقي في الذاكرة لحظياً (0ms)
    const elapsed = now - installedAt;
    const remainingMs = Math.max(0, DURATION_MS - elapsed);
    const isExpired = remainingMs <= 0;

    if (isExpired) {
      cachedPermanentlyLocked = true;
      safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true").catch(() => {});
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
    console.warn("Trial evaluation fallback:", err);
    return {
      isEnabled: true,
      isExpired: false,
      remainingMs: DURATION_MS,
      hoursLeft: TRIAL_CONFIG.DURATION_HOURS,
      minutesLeft: 0,
      secondsLeft: 0,
      installedAt: now,
      isTampered: false,
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
    isReady: false,
  });

  useEffect(() => {
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

    checkExpiry();

    // فحص دوري خفيف كل 30 ثانية لتوفير موارد المعالج
    const interval = setInterval(checkExpiry, 30000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkExpiry();
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
 * يتم تحديثه كل 10 ثوانٍ لضمان الدقة مع توفير فائق للأداء والبطارية
 */
export function useTrialGuard(): TrialStatus {
  const [status, setStatus] = useState<TrialStatus>({
    isEnabled: TRIAL_CONFIG.ENABLE_TRIAL_LOCK,
    isExpired: false,
    remainingMs: TRIAL_CONFIG.DURATION_MS,
    hoursLeft: TRIAL_CONFIG.DURATION_HOURS,
    minutesLeft: 0,
    secondsLeft: 0,
    installedAt: Date.now(),
    isTampered: false,
    isReady: false,
  });

  useEffect(() => {
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

    runCheck();

    // تحديث كل ثانية لعرض الساعات والدقائق والثواني بدقة لحظية
    const interval = setInterval(runCheck, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runCheck();
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

