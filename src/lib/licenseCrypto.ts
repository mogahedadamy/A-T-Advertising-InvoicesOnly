/**
 * licenseCrypto.ts — محرك التحقق من التوقيع الرقمي Ed25519
 *
 * - المفتاح العام مدمج في التطبيق (آمن للتوزيع)
 * - المفتاح الخاص موجود فقط في Cloudflare Secrets
 * - يستخدم Web Crypto API المدمجة في المتصفح/WebView
 */

import type { LicensePayload } from "./licenseStore";

// ─── المفتاح العام Ed25519 ────────────────────────────────────────────────────
// تم توليد هذا المفتاح بواسطة: node cloudflare-worker/generate-keys.mjs
// المفتاح الخاص المقابل محفوظ في Cloudflare Secrets فقط (ED25519_PRIVATE_KEY)
const PUBLIC_KEY_B64 = "MCowBQYDK2VwAyEAW8MNu4ssXFFc1dJhrzYwG9S2mMvYwuyeTu68lq66FMU=";

// علم وضع التطوير: يتجاوز التحقق الكريبتوغرافي فقط في بيئة الاختبار
const DEV_MODE = typeof process !== "undefined"
  ? (process.env?.NODE_ENV === "development" || process.env?.VITE_LICENSE_DEV === "true")
  : (typeof window !== "undefined" && (window as Window & { __DEV_LICENSE__?: boolean }).__DEV_LICENSE__ === true);

// ─── تحويل Base64 ─────────────────────────────────────────────────────────────

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── استيراد المفتاح العام ────────────────────────────────────────────────────

let cachedPublicKey: CryptoKey | null = null;

async function getPublicKey(): Promise<CryptoKey | null> {
  if (cachedPublicKey) return cachedPublicKey;

  try {
    const keyBytes = base64ToBytes(PUBLIC_KEY_B64);
    const keyBuffer = keyBytes.buffer.slice(
      keyBytes.byteOffset,
      keyBytes.byteOffset + keyBytes.byteLength
    ) as ArrayBuffer;

    cachedPublicKey = await crypto.subtle.importKey(
      "spki",
      keyBuffer,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    return cachedPublicKey;
  } catch (err) {
    console.warn("[LicenseCrypto] Failed to import public key:", err);
    return null;
  }
}

// ─── التحقق من التوقيع ────────────────────────────────────────────────────────

/**
 * يتحقق من صحة توقيع حمولة الترخيص باستخدام Ed25519.
 * @param payload  حمولة الترخيص الواضحة
 * @param signatureB64  التوقيع بصيغة Base64
 * @returns true إذا كان التوقيع صحيحاً وغير مزوّر
 */
export async function verifyLicenseSignature(
  payload: LicensePayload,
  signatureB64: string
): Promise<boolean> {
  // في وضع التطوير نتجاوز التحقق لتسهيل الاختبار
  if (DEV_MODE) {
    console.warn("[LicenseCrypto] DEV MODE: skipping signature verification");
    return true;
  }

  try {
    const publicKey = await getPublicKey();
    if (!publicKey) {
      console.error("[LicenseCrypto] Public key not available");
      return false;
    }

    // ترميز الحمولة بنفس الترتيب الذي يستخدمه الخادم
    const message = canonicalizePayload(payload);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = base64ToBytes(signatureB64);
    const sigBuffer = signatureBytes.buffer.slice(
      signatureBytes.byteOffset,
      signatureBytes.byteOffset + signatureBytes.byteLength
    ) as ArrayBuffer;

    const isValid = await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      sigBuffer,
      messageBytes
    );

    return isValid;
  } catch (err) {
    console.error("[LicenseCrypto] Verification error:", err);
    return false;
  }
}

/**
 * ينتج نصاً حتمياً من الحمولة لضمان تطابق ترتيب الحقول مع الخادم.
 * MUST match the server-side canonicalization exactly.
 */
function canonicalizePayload(payload: LicensePayload): string {
  return JSON.stringify({
    licenseId: payload.licenseId,
    customerName: payload.customerName,
    installationId: payload.installationId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
    version: payload.version,
    features: payload.features,
  });
}

// ─── وضع تطوير فقط ────────────────────────────────────────────────────────────
// دالة مساعدة للاختبار — لا تُستخدم في الإنتاج

/**
 * يُنشئ ترخيصاً وهمياً للاختبار المحلي فقط.
 * يتجاوز التوقيع الفعلي لأن DEV_MODE=true.
 */
export function createDevLicense(
  customerName: string,
  installationId: string,
  daysValid: number = 30
): import("./licenseStore").StoredLicense {
  const now = Math.floor(Date.now() / 1000);
  return {
    payload: {
      licenseId: `dev_${Date.now()}`,
      customerName,
      installationId,
      issuedAt: now,
      expiresAt: now + daysValid * 86400,
      version: 1,
      features: ["FULL_ACCESS"],
    },
    signature: "DEV_SIGNATURE_PLACEHOLDER",
    fetchedAt: Date.now(),
  };
}
