// إدارة كلمة مرور التطبيق محليًا (مع كلمة افتراضية 0906 عند التثبيت الجديد فقط)
// نخزّن hash بطيء ومملّح (PBKDF2-HMAC-SHA256) مع تحديد عدد المحاولات وتأخير تصاعدي.

import { Capacitor } from "@capacitor/core";
import { getDb } from "./database";
import {
  getStoredSync,
  isStorageReady,
  removeStoredItem,
  setStoredItem,
} from "./sqliteStorage";

const STORAGE_KEY = "future_calc_app_password_hash";
const LOCKOUT_STORAGE_KEY = "future_calc_pin_lockout_v1";
const DEFAULT_PASSWORD = "0906";
const PASSWORD_LENGTH = 4;
const PBKDF2_ITERATIONS = 120_000;
const MIN_PBKDF2_ITERATIONS = 100_000;
const MAX_PBKDF2_ITERATIONS = 1_000_000;
const MAX_LOCKOUT_MS = 15 * 60 * 1000;
const HASH_PREFIX = "pbkdf2_sha256$";

export interface PinLockoutState {
  failedAttempts: number;
  lockedUntil: number;
  isLocked: boolean;
  remainingMs: number;
}

interface StoredLockoutRecord {
  failedAttempts: number;
  lockedUntil: number;
}

const sha256 = async (text: string): Promise<string> => {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const bytes = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

const fromBase64 = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

/**
 * Slow, salted hash (PBKDF2-HMAC-SHA256).
 * A 4-digit PIN has only 10,000 possibilities, so a single SHA-256 pass is
 * barely above plaintext for anyone with file access; PBKDF2 makes an
 * exhaustive offline search ~120k times more expensive.
 */
const hashPassword = async (
  password: string,
  saltB64?: string,
  iterations: number = PBKDF2_ITERATIONS
): Promise<string> => {
  const salt = saltB64 ? fromBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${HASH_PREFIX}${iterations}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
};

/** Constant-time-ish string compare. */
const safeEquals = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

export const PASSWORD_DIGITS = PASSWORD_LENGTH;

export const isValidPasswordFormat = (pw: string): boolean => {
  return /^\d{4}$/.test(pw);
};

export const hasCustomPassword = (): boolean => {
  return Boolean(getStoredSync(STORAGE_KEY, ""));
};

function computeLockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts >= 10) return 15 * 60 * 1000;
  if (failedAttempts >= 8) return 5 * 60 * 1000;
  if (failedAttempts >= 5) return 30 * 1000;
  return 0;
}

function readLockoutRecord(): StoredLockoutRecord {
  const raw = getStoredSync(LOCKOUT_STORAGE_KEY, "");
  if (!raw) return { failedAttempts: 0, lockedUntil: 0 };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredLockoutRecord> | null;
    const failedAttempts =
      typeof parsed?.failedAttempts === "number" &&
      Number.isFinite(parsed.failedAttempts) &&
      parsed.failedAttempts > 0
        ? Math.trunc(parsed.failedAttempts)
        : 0;
    const lockedUntil =
      typeof parsed?.lockedUntil === "number" &&
      Number.isFinite(parsed.lockedUntil) &&
      parsed.lockedUntil > 0
        ? Math.trunc(parsed.lockedUntil)
        : 0;
    return { failedAttempts, lockedUntil };
  } catch {
    return { failedAttempts: 0, lockedUntil: 0 };
  }
}

export const getPinLockoutState = (now: number = Date.now()): PinLockoutState => {
  const { failedAttempts, lockedUntil } = readLockoutRecord();
  const rawRemaining = lockedUntil > now ? lockedUntil - now : 0;
  // Clamp against future-clock tampering/corruption so the user is never locked out permanently
  const remainingMs = rawRemaining > 0 ? Math.min(rawRemaining, MAX_LOCKOUT_MS) : 0;
  return {
    failedAttempts,
    lockedUntil: remainingMs > 0 ? lockedUntil : 0,
    isLocked: remainingMs > 0,
    remainingMs,
  };
};

export const recordFailedPinAttempt = async (
  now: number = Date.now()
): Promise<PinLockoutState> => {
  const prev = readLockoutRecord();
  const failedAttempts = prev.failedAttempts + 1;
  const durationMs = computeLockoutDurationMs(failedAttempts);
  const lockedUntil = durationMs > 0 ? now + durationMs : 0;
  const record: StoredLockoutRecord = { failedAttempts, lockedUntil };
  try {
    await setStoredItem(LOCKOUT_STORAGE_KEY, JSON.stringify(record));
  } catch (err) {
    console.warn("[PasswordStore] Failed to persist PIN lockout state:", err);
  }
  return getPinLockoutState(now);
};

export const resetPinAttempts = async (): Promise<void> => {
  try {
    await removeStoredItem(LOCKOUT_STORAGE_KEY);
  } catch (err) {
    console.warn("[PasswordStore] Failed to reset PIN lockout state:", err);
  }
};

/**
 * Resolves the stored password hash.
 * Fail-closed on native: if SQLite storage is NOT ready yet, attempt a direct DB
 * lookup for an existing hash, and refuse to fall back to DEFAULT_PASSWORD ("0906").
 */
const getStoredHash = async (): Promise<string | null> => {
  const stored = getStoredSync(STORAGE_KEY, "");
  if (stored) return stored;

  if (Capacitor.isNativePlatform()) {
    try {
      const db = await getDb();
      const res = await db.query("SELECT value FROM settings WHERE key = ?", [STORAGE_KEY]);
      const dbVal = res.values?.[0]?.value;
      if (typeof dbVal === "string" && dbVal.length > 0) {
        return dbVal;
      }
      // If SQLite storage has not finished initializing yet, refuse to assume a fresh install.
      if (!isStorageReady()) {
        return null;
      }
    } catch (err) {
      console.warn("[PasswordStore] Fail-closed: unable to read password hash from native SQLite:", err);
      return null;
    }
  }

  // Genuine first launch with initialized storage and no stored PIN yet
  return await hashPassword(DEFAULT_PASSWORD);
};

export const verifyPassword = async (
  input: string,
  now: number = Date.now()
): Promise<boolean> => {
  if (getPinLockoutState(now).isLocked) {
    return false;
  }

  const stored = await getStoredHash();
  if (!stored) {
    // Fail closed when native storage is not ready; do not unlock with default PIN
    return false;
  }

  let matches = false;
  let needsRehash = false;

  if (stored.startsWith(HASH_PREFIX)) {
    const parts = stored.split("$");
    if (parts.length !== 4) {
      await recordFailedPinAttempt(now);
      return false;
    }
    const iterations = Number.parseInt(parts[1], 10);
    const salt = parts[2];
    const hashPart = parts[3];
    if (
      !Number.isInteger(iterations) ||
      iterations < MIN_PBKDF2_ITERATIONS ||
      iterations > MAX_PBKDF2_ITERATIONS ||
      !salt ||
      !hashPart
    ) {
      await recordFailedPinAttempt(now);
      return false;
    }
    try {
      const candidate = await hashPassword(input, salt, iterations);
      matches = safeEquals(candidate, stored);
      if (matches && iterations < PBKDF2_ITERATIONS) {
        needsRehash = true;
      }
    } catch {
      matches = false;
    }
  } else {
    // Legacy single-pass SHA-256 from earlier builds: verify, then transparently
    // upgrade the stored value so the next launch uses the stronger hash.
    matches = safeEquals(await sha256(input), stored);
    if (matches) needsRehash = true;
  }

  if (matches) {
    await resetPinAttempts();
    if (needsRehash) {
      await setStoredItem(STORAGE_KEY, await hashPassword(input));
    }
    return true;
  }

  await recordFailedPinAttempt(now);
  return false;
};

export const setPassword = async (newPassword: string): Promise<void> => {
  if (!isValidPasswordFormat(newPassword)) {
    throw new Error("كلمة المرور يجب أن تكون 4 أرقام");
  }
  const hash = await hashPassword(newPassword);
  await setStoredItem(STORAGE_KEY, hash);
  await resetPinAttempts();
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string
): Promise<void> => {
  const ok = await verifyPassword(currentPassword);
  if (!ok) throw new Error("كلمة المرور الحالية غير صحيحة");
  if (!isValidPasswordFormat(newPassword)) {
    throw new Error("كلمة المرور الجديدة يجب أن تكون 4 أرقام");
  }
  await setPassword(newPassword);
};
