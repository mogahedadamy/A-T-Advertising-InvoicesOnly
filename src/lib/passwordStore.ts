// @ts-nocheck
// إدارة كلمة مرور التطبيق محليًا (مع كلمة افتراضية 0906)
// نخزّن hash بسيط (SHA-256) في localStorage لتجنّب حفظها كنص صريح.

import { getStoredSync, setStoredItem } from "./sqliteStorage";

const STORAGE_KEY = "future_calc_app_password_hash";
const DEFAULT_PASSWORD = "0906";
const PASSWORD_LENGTH = 4;
const PBKDF2_ITERATIONS = 120000;
const HASH_PREFIX = "pbkdf2_sha256$";

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
const hashPassword = async (password: string, saltB64?: string): Promise<string> => {
  const salt = saltB64 ? fromBase64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return `${HASH_PREFIX}${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(new Uint8Array(bits))}`;
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

const getStoredHash = async (): Promise<string> => {
  const stored = getStoredSync(STORAGE_KEY, "");
  if (stored) return stored;
  // كلمة المرور الافتراضية أول مرة
  return await hashPassword(DEFAULT_PASSWORD);
};

export const verifyPassword = async (input: string): Promise<boolean> => {
  const stored = await getStoredHash();
  if (stored.startsWith(HASH_PREFIX)) {
    const [, , salt] = stored.split("$");
    const candidate = await hashPassword(input, salt);
    return safeEquals(candidate, stored);
  }
  // Legacy single-pass SHA-256 from earlier builds: verify, then transparently
  // upgrade the stored value so the next launch uses the stronger hash.
  const matches = safeEquals(await sha256(input), stored);
  if (matches) await setStoredItem(STORAGE_KEY, await hashPassword(input));
  return matches;
};

export const setPassword = async (newPassword: string): Promise<void> => {
  if (!isValidPasswordFormat(newPassword)) {
    throw new Error("كلمة المرور يجب أن تكون 4 أرقام");
  }
  const hash = await hashPassword(newPassword);
  await setStoredItem(STORAGE_KEY, hash);
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
