import { useState, useEffect, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { getStoredSync, setStoredItem } from "./sqliteStorage";

const STORAGE_KEY_NAME = "future_print_user_name";
const STORAGE_KEY_ONBOARDED = "future_print_onboarded";
const EVENT_NAME = "future-user-profile-updated";

/**
 * دالة ذكية لاستخراج الحرفين الأوليين من الاسم العربي أو الإنجليزي
 * مثال: "مجاهد آدم" -> "م.آ"
 * مثال: "مجاهد" -> "مج"
 * مثال: "Ahmed Ali" -> "AA"
 */
export function getAvatarInitials(name: string): string {
  const trimmed = (name || "").trim();
  if (!trimmed) return "T.A"; // T.A Advertising كقيمة افتراضية

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words[0] && words[1]) {
    const firstChar = words[0].charAt(0);
    const secondChar = words[1].charAt(0);
    // إذا كانت أحرف عربية نضيف نقطة أو مسافة لجمال التنسيق
    return `${firstChar}.${secondChar}`;
  }

  // كلمة واحدة: نأخذ أول حرفين
  return trimmed.slice(0, 2);
}

/** قراءة الاسم الحالي بشكل متزامن */
export function getStoredUserName(): string {
  return getStoredSync(STORAGE_KEY_NAME, "");
}

/** التحقق هل اكتملت التهيئة الأولى */
export function isUserOnboarded(): boolean {
  if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
    try {
      const lsFlag = localStorage.getItem(STORAGE_KEY_ONBOARDED);
      if (lsFlag === "true") return true;
      const lsName = localStorage.getItem(STORAGE_KEY_NAME);
      if (lsName && lsName.trim().length > 0) return true;
    } catch {}
  }
  const flag = getStoredSync(STORAGE_KEY_ONBOARDED, "");
  if (flag === "true") return true;
  // إذا كان هناك اسم مخزن مسبقاً فهو مهيأ
  return Boolean(getStoredUserName());
}

/** حفظ بيانات المستخدم بشكل فوري غير معطل */
export async function saveUserProfile(name: string): Promise<void> {
  const cleanName = (name || "").trim();

  // على المتصفح فقط نحدّث localStorage؛ على أندرويد يُعتمد SQLite وحده منعاً لعودة بيانات قديمة بعد الاستعادة
  if (!Capacitor.isNativePlatform() && typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY_NAME, cleanName);
      localStorage.setItem(STORAGE_KEY_ONBOARDED, "true");
    } catch {}
  }

  // الحفظ المتسلسل في SQLite وتفضيلات أندرويد لمنع تصادم المعاملات على الاتصال الوحيد
  try {
    await setStoredItem(STORAGE_KEY_NAME, cleanName);
    await setStoredItem(STORAGE_KEY_ONBOARDED, "true");
  } catch (err) {
    console.warn("[UserProfile] SQLite persistence warning:", err);
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { name: cleanName } }));
    window.dispatchEvent(new Event("storage"));
  }
}

/** Hook تفاعلي لاستهلاك وإدارة الملف الشخصي */
export function useUserProfile() {
  const [userName, setUserName] = useState<string>(() => getStoredUserName());
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => isUserOnboarded());

  useEffect(() => {
    const handleUpdate = () => {
      setUserName(getStoredUserName());
      setIsOnboarded(isUserOnboarded());
    };

    if (typeof window !== "undefined") {
      window.addEventListener(EVENT_NAME, handleUpdate);
      window.addEventListener("storage", handleUpdate);
      window.addEventListener("native-storage-ready", handleUpdate);
      return () => {
        window.removeEventListener(EVENT_NAME, handleUpdate);
        window.removeEventListener("storage", handleUpdate);
        window.removeEventListener("native-storage-ready", handleUpdate);
      };
    }
    return undefined;
  }, []);

  const saveName = useCallback(async (name: string) => {
    const clean = (name || "").trim();
    setUserName(clean);
    setIsOnboarded(true);
    await saveUserProfile(clean);
  }, []);

  const initials = getAvatarInitials(userName);

  return {
    userName,
    initials,
    isOnboarded,
    saveName,
  };
}
