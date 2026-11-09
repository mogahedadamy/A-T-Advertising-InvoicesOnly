// @ts-nocheck
// إدارة كلمة مرور التطبيق محليًا (مع كلمة افتراضية 0906)
// نخزّن hash بسيط (SHA-256) في localStorage لتجنّب حفظها كنص صريح.

import { getStoredSync, setStoredItem } from "./nativeStorage";

const STORAGE_KEY = "future_calc_app_password_hash";
const DEFAULT_PASSWORD = "0906";
const PASSWORD_LENGTH = 4;

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

export const PASSWORD_DIGITS = PASSWORD_LENGTH;

export const isValidPasswordFormat = (pw: string): boolean => {
  return /^\d{4}$/.test(pw);
};

const getStoredHash = async (): Promise<string> => {
  const stored = getStoredSync(STORAGE_KEY, "");
  if (stored) return stored;
  // كلمة المرور الافتراضية أول مرة
  return await sha256(DEFAULT_PASSWORD);
};

export const verifyPassword = async (input: string): Promise<boolean> => {
  const inputHash = await sha256(input);
  const storedHash = await getStoredHash();
  return inputHash === storedHash;
};

export const setPassword = async (newPassword: string): Promise<void> => {
  if (!isValidPasswordFormat(newPassword)) {
    throw new Error("كلمة المرور يجب أن تكون 4 أرقام");
  }
  const hash = await sha256(newPassword);
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
