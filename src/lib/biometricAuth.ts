// مساعدات البصمة — تدعم بيئتين:
// 1) تطبيق Capacitor الأصلي (Android/iOS) عبر إضافة BiometricAuth
// 2) المتصفح/PWA عبر WebAuthn (Platform Authenticator)

import { Capacitor } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryType,
} from "@aparajita/capacitor-biometric-auth";
import { getStoredSync, removeStoredItem, setStoredItem } from "./sqliteStorage";

const STORAGE_KEY = "future_calc_biometric_cred";
const NATIVE_FLAG = "future_calc_biometric_native_enabled";

interface StoredCredential {
  id: string;
  createdAt: number;
}

// ---------- أدوات base64url للويب ----------
const bufToB64Url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.byteLength; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const b64UrlToBuf = (b64url: string): ArrayBuffer => {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes.buffer;
};

const randomBytes = (len: number): ArrayBuffer => {
  const arr = new Uint8Array(new ArrayBuffer(len));
  crypto.getRandomValues(arr);
  return arr.buffer;
};

// ---------- اكتشاف البيئة ----------
export const isNativeApp = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

// ---------- WebAuthn (متصفح) ----------
const isWebAuthnSupported = (): boolean =>
  typeof window !== "undefined" &&
  typeof window.PublicKeyCredential !== "undefined" &&
  !!navigator.credentials;

const isWebAuthnPlatformAvailable = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
};

// ---------- Native (Capacitor) ----------
const isNativeBiometryAvailable = async (): Promise<boolean> => {
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable && info.biometryType !== BiometryType.none;
  } catch (err) {
    console.warn("checkBiometry failed", err);
    return false;
  }
};

// ---------- API عامة موحّدة ----------

export const isBiometricSupported = (): boolean =>
  isNativeApp() || isWebAuthnSupported();

export const isPlatformAuthenticatorAvailable = async (): Promise<boolean> => {
  if (isNativeApp()) return await isNativeBiometryAvailable();
  return await isWebAuthnPlatformAvailable();
};

export const getStoredCredential = (): StoredCredential | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCredential> | null;
    if (!parsed || typeof parsed.id !== "string" || typeof parsed.createdAt !== "number") {
      return null;
    }
    return { id: parsed.id, createdAt: parsed.createdAt };
  } catch {
    return null;
  }
};

export const isBiometricEnabled = (): boolean => {
  if (isNativeApp()) {
    return getStoredSync(NATIVE_FLAG, "") === "1";
  }
  return !!getStoredCredential();
};

export const disableBiometric = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(NATIVE_FLAG);
  } catch {
    // ignore storage removal errors in restricted webviews
  }
  removeStoredItem(NATIVE_FLAG).catch(() => {});
};

// تسجيل البصمة (بعد التحقق بكلمة المرور)
export const registerBiometric = async (): Promise<boolean> => {
  // --- Native: نطلب تحقّقاً واحداً بالبصمة فقط ثم نحفظ حالة التفعيل ---
  if (isNativeApp()) {
    const available = await isNativeBiometryAvailable();
    if (!available) throw new Error("البصمة غير مدعومة على هذا الجهاز");
    try {
      await BiometricAuth.authenticate({
        reason: "تأكيد تفعيل فتح التطبيق بالبصمة",
        cancelTitle: "إلغاء",
        allowDeviceCredential: false,
        iosFallbackTitle: "استخدم كلمة مرور التطبيق",
        androidTitle: "تفعيل البصمة",
        androidSubtitle: "T.A Advertising Solution",
        androidConfirmationRequired: false,
      });
      await setStoredItem(NATIVE_FLAG, "1");
      return true;
    } catch (err) {
      console.warn("native biometric register failed", err);
      return false;
    }
  }

  // --- Web: WebAuthn ---
  if (!isWebAuthnSupported()) throw new Error("البصمة غير مدعومة على هذا الجهاز");

  const userId = randomBytes(16);
  const challenge = randomBytes(32);

  const publicKey: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: { name: "T.A Advertising Solution", id: window.location.hostname },
    user: {
      id: userId,
      name: "ta-user",
      displayName: "مستخدم الآلة الحاسبة",
    },
    pubKeyCredParams: [
      { type: "public-key", alg: -7 },
      { type: "public-key", alg: -257 },
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",
      userVerification: "required",
      residentKey: "preferred",
    },
    timeout: 60000,
    attestation: "none",
  };

  const credential = (await navigator.credentials.create({
    publicKey,
  })) as PublicKeyCredential | null;
  if (!credential) return false;

  const stored: StoredCredential = {
    id: bufToB64Url(credential.rawId),
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  return true;
};

// التحقق بالبصمة عند فتح التطبيق
export const verifyBiometric = async (): Promise<boolean> => {
  // --- Native: allowDeviceCredential = false لتطابق سياسة التسجيل وعدم قبول سحب الشاشة ---
  if (isNativeApp()) {
    if (!isBiometricEnabled()) return false;
    try {
      await BiometricAuth.authenticate({
        reason: "افتح التطبيق باستخدام البصمة",
        cancelTitle: "إلغاء",
        allowDeviceCredential: false,
        iosFallbackTitle: "استخدم كلمة مرور التطبيق",
        androidTitle: "فتح التطبيق",
        androidSubtitle: "T.A Advertising Solution",
        androidConfirmationRequired: false,
      });
      return true;
    } catch (err) {
      console.warn("native biometric verify failed", err);
      return false;
    }
  }

  // --- Web ---
  const stored = getStoredCredential();
  if (!stored) return false;
  if (!isWebAuthnSupported()) return false;

  const challenge = randomBytes(32);
  const publicKey: PublicKeyCredentialRequestOptions = {
    challenge,
    timeout: 60000,
    rpId: window.location.hostname,
    userVerification: "required",
    allowCredentials: [
      {
        id: b64UrlToBuf(stored.id),
        type: "public-key",
        transports: ["internal"],
      },
    ],
  };

  const assertion = (await navigator.credentials.get({
    publicKey,
  })) as PublicKeyCredential | null;
  return !!assertion;
};
