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
 * تقييم حالة المهلة التجريبية
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
    // 1. فحص ما إذا كان التطبيق مقفلاً نهائياً من قبل
    const isLocked = await safeGetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED);
    if (isLocked === "true") {
      return {
        isEnabled: true,
        isExpired: true,
        remainingMs: 0,
        hoursLeft: 0,
        minutesLeft: 0,
        secondsLeft: 0,
        installedAt: 0,
        isTampered: false,
        isReady: true,
      };
    }

    // 2. فحص تاريخ أول تشغيل
    const installedAtStr = await safeGetStorage(STORAGE_KEYS.INSTALLED_AT);
    let installedAt = installedAtStr ? parseInt(installedAtStr, 10) : 0;

    if (!installedAt || isNaN(installedAt) || installedAt <= 0) {
      installedAt = now;
      await safeSetStorage(STORAGE_KEYS.INSTALLED_AT, String(installedAt));
      await safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(now));
    }

    // 3. فحص التلاعب بساعة الهاتف (High-Water Mark)
    const hwmStr = await safeGetStorage(STORAGE_KEYS.HIGH_WATER_MARK);
    const hwm = hwmStr ? parseInt(hwmStr, 10) : installedAt;

    // إذا أعيدت ساعة الجهاز لأكثر من 5 دقائق للخلف يُعتبر تلاعباً
    if (now < hwm - 5 * 60 * 1000) {
      await safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true");
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

    // تحديث أعلى نقطة زمنية
    const updatedHwm = Math.max(hwm, now);
    await safeSetStorage(STORAGE_KEYS.HIGH_WATER_MARK, String(updatedHwm));

    // 4. احتساب الوقت المتبقي
    const elapsed = now - installedAt;
    const remainingMs = Math.max(0, DURATION_MS - elapsed);
    const isExpired = remainingMs <= 0;

    if (isExpired) {
      await safeSetStorage(STORAGE_KEYS.PERMANENTLY_LOCKED, "true");
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
    // في حال حدوث أي خطأ غير متوقع، لا نجعل التطبيق ينهار
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
 * خطاف تفاعلي لمراقبة حالة الـ 48 ساعة في واجهات React
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

