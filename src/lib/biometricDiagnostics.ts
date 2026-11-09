// تشخيص أسباب عدم توفر البصمة + اقتراح روابط إعدادات النظام عند الإمكان

import {
  isBiometricSupported,
  isPlatformAuthenticatorAvailable,
  isNativeApp,
} from "./biometricAuth";

export type Platform =
  | "ios"
  | "android"
  | "macos"
  | "windows"
  | "linux"
  | "unknown";

export interface BiometricDiagnostics {
  platform: Platform;
  isSecureContext: boolean;
  hasWebAuthn: boolean;
  hasPlatformAuthenticator: boolean;
  isStandalonePWA: boolean;
  reasons: string[]; // الأسباب المحتملة لعدم العمل
  fixes: string[]; // خطوات الإصلاح المقترحة
  settingsUrl: string | null; // رابط إعدادات النظام (إن أمكن)
  settingsLabel: string | null;
}

export const detectPlatform = (): Platform => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  // iPadOS الحديث يبلغ عن نفسه كـ Mac
  if (/macintosh/.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/android/.test(ua)) return "android";
  if (/mac os x|macintosh/.test(ua)) return "macos";
  if (/windows/.test(ua)) return "windows";
  if (/linux/.test(ua)) return "linux";
  return "unknown";
};

const isStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  // iOS Safari
  // @ts-expect-error vendor-specific
  if (window.navigator.standalone) return true;
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
};

const settingsForPlatform = (
  platform: Platform,
): { url: string | null; label: string | null } => {
  switch (platform) {
    case "ios":
      return {
        // روابط إعدادات iOS غير مدعومة من المتصفح، نعرض إرشاداً نصياً فقط
        url: null,
        label: "الإعدادات › Face ID و Touch ID",
      };
    case "android":
      return {
        url: null,
        label: "الإعدادات › الأمان › البصمة",
      };
    case "macos":
      return {
        url: null,
        label: "إعدادات النظام › Touch ID وكلمة السر",
      };
    case "windows":
      return {
        // رابط إعدادات Windows Hello
        url: "ms-settings:signinoptions",
        label: "الإعدادات › الحسابات › خيارات تسجيل الدخول (Windows Hello)",
      };
    default:
      return { url: null, label: null };
  }
};

export const runBiometricDiagnostics = async (): Promise<BiometricDiagnostics> => {
  const platform = detectPlatform();
  const native = isNativeApp();
  // داخل تطبيق Capacitor الأصلي: السياق دائماً موثوق ولا نعتمد على WebAuthn
  const isSecureContext = native
    ? true
    : typeof window !== "undefined"
      ? window.isSecureContext === true
      : false;
  const hasWebAuthn = native ? true : isBiometricSupported();
  const hasPlatformAuthenticator = hasWebAuthn
    ? await isPlatformAuthenticatorAvailable()
    : false;
  const isStandalonePWA = isStandalone();

  const reasons: string[] = [];
  const fixes: string[] = [];

  if (!isSecureContext) {
    reasons.push("الموقع لا يعمل عبر HTTPS (سياق غير آمن).");
    fixes.push("افتح التطبيق عبر رابط HTTPS أو من النطاق المنشور.");
  }

  if (!hasWebAuthn) {
    reasons.push("المتصفح الحالي لا يدعم WebAuthn.");
    fixes.push(
      "استخدم متصفحاً حديثاً مثل Safari (iOS) أو Chrome/Edge (Android/Windows).",
    );
  }

  if (hasWebAuthn && !hasPlatformAuthenticator) {
    reasons.push(
      "لا يوجد مستشعر بصمة/وجه مُفعَّل على الجهاز أو لم يُسمح للمتصفح باستخدامه.",
    );
    if (platform === "ios") {
      fixes.push(
        "فعّل Face ID / Touch ID من إعدادات iOS، وتأكد من السماح للمتصفح باستخدامها.",
      );
    } else if (platform === "android") {
      fixes.push(
        "أضف بصمة/قفل شاشة من إعدادات الأندرويد، وفعّل قفل الشاشة الآمن.",
      );
    } else if (platform === "windows") {
      fixes.push(
        "فعّل Windows Hello (بصمة/وجه/PIN) من خيارات تسجيل الدخول.",
      );
    } else if (platform === "macos") {
      fixes.push(
        "فعّل Touch ID من إعدادات النظام، وتأكد أن المتصفح مسموح له باستخدامه.",
      );
    } else {
      fixes.push("تأكد من توفر مستشعر بصمة/وجه مُفعَّل على الجهاز.");
    }
  }

  if (!native && platform === "ios" && !isStandalonePWA) {
    reasons.push(
      "على iOS تعمل البصمة بشكل أفضل عند تشغيل التطبيق من الشاشة الرئيسية (PWA).",
    );
    fixes.push(
      "في Safari: اضغط زر المشاركة › إضافة إلى الشاشة الرئيسية، ثم افتح التطبيق منها.",
    );
  }

  if (native && !hasPlatformAuthenticator) {
    fixes.push(
      "تأكد من تسجيل بصمة واحدة على الأقل في إعدادات النظام، وأن قفل الشاشة مفعّل.",
    );
  }

  const { url, label } = settingsForPlatform(platform);

  return {
    platform,
    isSecureContext,
    hasWebAuthn,
    hasPlatformAuthenticator,
    isStandalonePWA,
    reasons,
    fixes,
    settingsUrl: url,
    settingsLabel: label,
  };
};
