/**
 * licenseStore.ts — محرك الترخيص المحلي الكامل
 *
 * المسؤوليات:
 * - توليد معرف التثبيت الفريد (Installation Fingerprint)
 * - التحقق من التوقيع الرقمي Ed25519
 * - مراقبة تراجع ساعة الجهاز (Clock Tampering)
 * - إدارة دورة حياة الترخيص (الحالات والانتقالات)
 * - مزامنة الترخيص من الخادم بشكل فرصي
 *
 * مفتاح التخزين: future_print_license_v1 (معزول كلياً عن بيانات الأعمال)
 */

import { getStoredSync, setStoredItem, getStoredJsonSync, setStoredJson, removeStoredItem } from "./sqliteStorage";
import { verifyLicenseSignature } from "./licenseCrypto";

// ─── ثوابت ───────────────────────────────────────────────────────────────────
export const LICENSE_STORAGE_KEY = "future_print_license_v1";
const INSTALL_ID_KEY = "future_print_install_id";
const HWM_KEY = "future_print_time_hwm"; // High-Water Mark للوقت
const TAMPER_TOLERANCE_MS = 2 * 60 * 60 * 1000; // ساعتان

// عنوان خادم الترخيص (يعمل بدون VPN عبر Cloudflare Pages)
export const LICENSE_SERVER_URL = "https://futureprintlicense.pages.dev";

// ─── أنواع البيانات ───────────────────────────────────────────────────────────

/** حالات دورة حياة الترخيص */
export type LicenseStatus =
  | "not_activated"
  | "pending_approval"
  | "active"
  | "expired"
  | "renewal_required"
  | "revoked"
  | "clock_tampered"
  | "checking";

/** حمولة الترخيص الموقعة (Signed Payload) */
export interface LicensePayload {
  licenseId: string;
  customerName: string;
  installationId: string;
  issuedAt: number; // Unix timestamp
  expiresAt: number; // Unix timestamp
  version: number;
  features: string[];
}

/** كائن الترخيص الكامل كما يُخزن محلياً */
export interface StoredLicense {
  payload: LicensePayload;
  signature: string; // Base64-encoded Ed25519 signature
  fetchedAt: number; // متى تم التنزيل
}

/** حالة الترخيص الكاملة المستخدمة في الواجهة */
export interface LicenseState {
  status: LicenseStatus;
  license: StoredLicense | null;
  installationId: string;
  daysRemaining: number | null;
  customerName: string | null;
  errorMessage: string | null;
  lastCheckedAt: number | null;
}

// ─── معرف التثبيت ─────────────────────────────────────────────────────────────

/**
 * يولد أو يسترجع معرف التثبيت الفريد للجهاز.
 * مرة واحدة فقط لكل تثبيت، ومستقل عن IMEI أو Android ID.
 */
export function getOrCreateInstallationId(): string {
  const existing = getStoredSync(INSTALL_ID_KEY, "");
  if (existing) return existing;

  // توليد UUID v4 بدون مكتبات خارجية
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const uuid = `inst_${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

  // حفظ متزامن وفي SQLite
  setStoredItem(INSTALL_ID_KEY, uuid).catch(() => {});
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(INSTALL_ID_KEY, uuid);
    } catch {}
  }

  return uuid;
}

// ─── مراقبة تراجع الوقت ──────────────────────────────────────────────────────

/**
 * يحدث علامة الوقت القصوى (High-Water Mark).
 * يعيد true إذا كان الوقت سليماً، false إذا كان هناك تراجع مشبوه.
 */
export function checkAndUpdateTimeAudit(): boolean {
  const now = Date.now();
  const hwmStr = getStoredSync(HWM_KEY, "0");
  const hwm = parseInt(hwmStr, 10) || 0;

  if (hwm > 0 && now < hwm - TAMPER_TOLERANCE_MS) {
    // الوقت تراجع بأكثر من ساعتين — احتمال تلاعب
    console.warn(`[LicenseStore] Clock tampering detected: now=${now} hwm=${hwm} diff=${hwm - now}ms`);
    return false;
  }

  // حدّث العلامة إذا تقدم الوقت
  if (now > hwm) {
    setStoredItem(HWM_KEY, String(now)).catch(() => {});
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(HWM_KEY, String(now));
      } catch {}
    }
  }

  return true;
}

// ─── قراءة وكتابة الترخيص ────────────────────────────────────────────────────

export function loadStoredLicense(): StoredLicense | null {
  return getStoredJsonSync<StoredLicense | null>(LICENSE_STORAGE_KEY, null);
}

export async function saveStoredLicense(lic: StoredLicense): Promise<void> {
  await setStoredJson(LICENSE_STORAGE_KEY, lic);
}

export async function clearLicense(): Promise<void> {
  await removeStoredItem(LICENSE_STORAGE_KEY);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(LICENSE_STORAGE_KEY);
    } catch {}
  }
}

// ─── التحقق المحلي من الترخيص ────────────────────────────────────────────────

/**
 * يحسب الحالة الفعلية للترخيص المخزن محلياً.
 * يعمل 100% دون اتصال بالإنترنت.
 */
export async function evaluateLicenseStatus(installId: string): Promise<LicenseState> {
  // 1. فحص تراجع الوقت
  const timeOk = checkAndUpdateTimeAudit();
  if (!timeOk) {
    return buildState("clock_tampered", null, installId, {
      errorMessage: "توقيت الجهاز غير مضبوط، يرجى ضبط الساعة أو الاتصال بالإنترنت",
    });
  }

  // 2. قراءة الترخيص المخزن
  const stored = loadStoredLicense();

  if (!stored) {
    // فحص ما إذا كان طلب معلق
    const pendingStr = getStoredSync("future_print_license_pending", "");
    if (pendingStr === "true") {
      return buildState("pending_approval", null, installId, {});
    }
    return buildState("not_activated", null, installId, {});
  }

  // 3. مطابقة معرف الجهاز
  if (stored.payload.installationId !== installId) {
    console.warn("[LicenseStore] Installation ID mismatch — license belongs to another device");
    return buildState("not_activated", stored, installId, {
      errorMessage: "هذا الترخيص مرتبط بجهاز آخر — يرجى طلب ترخيص جديد لهذا الجهاز",
    });
  }

  // 4. التحقق من التوقيع الرقمي
  const signatureOk = await verifyLicenseSignature(stored.payload, stored.signature);
  if (!signatureOk) {
    console.warn("[LicenseStore] Invalid license signature — tampered or forged");
    return buildState("revoked", stored, installId, {
      errorMessage: "توقيع الترخيص غير صالح — يرجى التواصل مع الإدارة",
    });
  }

  // 5. فحص حالة الإلغاء
  if ((stored.payload.features || []).includes("REVOKED")) {
    return buildState("revoked", stored, installId, {
      errorMessage: "تم إلغاء هذا الترخيص — يرجى التواصل مع إدارة T.A للدعاية والإعلان",
    });
  }

  // 6. فحص الصلاحية الزمنية
  const nowSec = Math.floor(Date.now() / 1000);
  const daysRemaining = Math.ceil((stored.payload.expiresAt - nowSec) / 86400);

  if (nowSec > stored.payload.expiresAt) {
    // فحص ما إذا كان طلب تجديد معلق
    const renewalPending = getStoredSync("future_print_renewal_pending", "");
    if (renewalPending === "true") {
      return buildState("renewal_required", stored, installId, { daysRemaining: 0 });
    }
    return buildState("expired", stored, installId, {
      daysRemaining: 0,
      errorMessage: "انتهت صلاحية الترخيص — يرجى طلب التجديد",
    });
  }

  // ✅ الترخيص نشط وسليم
  return buildState("active", stored, installId, { daysRemaining });
}

// ─── أداة بناء الحالة ─────────────────────────────────────────────────────────

function buildState(
  status: LicenseStatus,
  stored: StoredLicense | null,
  installId: string,
  opts: {
    daysRemaining?: number | null;
    errorMessage?: string | null;
  }
): LicenseState {
  return {
    status,
    license: stored,
    installationId: installId,
    daysRemaining: opts.daysRemaining ?? null,
    customerName: stored?.payload?.customerName ?? null,
    errorMessage: opts.errorMessage ?? null,
    lastCheckedAt: Date.now(),
  };
}

// ─── المزامنة مع الخادم ───────────────────────────────────────────────────────

/**
 * يرسل طلب تفعيل جديد للخادم.
 */
export async function requestActivation(
  customerName: string,
  installId: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/license/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName, installationId: installId }),
    });
    const data = (await res.json()) as { message?: string };
    if (res.ok) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("future_print_license_pending", "true");
        localStorage.setItem("future_print_customer_name_pending", customerName);
      }
      return { ok: true, message: data.message || "تم إرسال طلب التفعيل بنجاح" };
    }
    return { ok: false, message: data.message || "فشل إرسال الطلب" };
  } catch {
    return { ok: false, message: "تعذر الاتصال بالخادم — تحقق من اتصال الإنترنت" };
  }
}

/**
 * يفحص حالة الطلب المعلق ويحاول تنزيل الترخيص إن تمت الموافقة.
 */
export async function syncLicenseFromServer(installId: string): Promise<{
  changed: boolean;
  newState?: LicenseState;
}> {
  try {
    const res = await fetch(
      `${LICENSE_SERVER_URL}/api/license/status?installationId=${encodeURIComponent(installId)}`
    );
    if (!res.ok) return { changed: false };

    const data = (await res.json()) as { status?: string; license?: StoredLicense };

    if (data.status === "approved" && data.license) {
      await saveStoredLicense(data.license);
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("future_print_license_pending");
        localStorage.removeItem("future_print_renewal_pending");
      }
      const newState = await evaluateLicenseStatus(installId);
      return { changed: true, newState };
    }

    return { changed: false };
  } catch {
    return { changed: false };
  }
}

/**
 * يرسل طلب تجديد الترخيص المنتهي.
 */
export async function requestRenewal(installId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${LICENSE_SERVER_URL}/api/license/renew`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installationId: installId }),
    });
    const data = (await res.json()) as { message?: string };
    if (res.ok) {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("future_print_renewal_pending", "true");
      }
      return { ok: true, message: data.message || "تم إرسال طلب التجديد بنجاح" };
    }
    return { ok: false, message: data.message || "فشل إرسال طلب التجديد" };
  } catch {
    return { ok: false, message: "تعذر الاتصال بالخادم" };
  }
}

// ─── Hook التفاعلي ────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

export function useLicense() {
  const [installId] = useState(() => getOrCreateInstallationId());
  const [state, setState] = useState<LicenseState>({
    status: "checking",
    license: null,
    installationId: installId,
    daysRemaining: null,
    customerName: null,
    errorMessage: null,
    lastCheckedAt: null,
  });
  const [loading, setLoading] = useState(false);

  const evaluate = useCallback(async () => {
    const s = await evaluateLicenseStatus(installId);
    setState(s);
    return s;
  }, [installId]);

  useEffect(() => {
    evaluate();
  }, [evaluate]);

  // محاولة مزامنة فرصية مع الخادم في الخلفية
  useEffect(() => {
    const trySync = async () => {
      const result = await syncLicenseFromServer(installId);
      if (result.changed && result.newState) {
        setState(result.newState);
      }
    };
    const timer = setTimeout(trySync, 3000);
    return () => clearTimeout(timer);
  }, [installId]);

  const activate = useCallback(
    async (customerName: string) => {
      setLoading(true);
      const result = await requestActivation(customerName, installId);
      if (result.ok) {
        setState((s) => ({ ...s, status: "pending_approval", customerName }));
      }
      setLoading(false);
      return result;
    },
    [installId]
  );

  const renew = useCallback(async () => {
    setLoading(true);
    const result = await requestRenewal(installId);
    if (result.ok) {
      setState((s) => ({ ...s, status: "renewal_required" }));
    }
    setLoading(false);
    return result;
  }, [installId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const synced = await syncLicenseFromServer(installId);
    if (synced.changed && synced.newState) {
      setState(synced.newState);
    } else {
      await evaluate();
    }
    setLoading(false);
  }, [installId, evaluate]);

  return { state, loading, activate, renew, refresh, installId };
}
