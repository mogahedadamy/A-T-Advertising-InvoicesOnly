import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { getSetting, setSetting } from "@/lib/repositories/SettingsRepository";
import { getStoredSync, setMemoryCacheString } from "@/lib/sqliteStorage";

export const DEFAULT_COMPANY_EMAIL = "t.a.advertising@gmail.com";
export const DEFAULT_COMPANY_PHONE = "+249 12371 1444  -  +249 91296 8886";
export const DEFAULT_COMPANY_ADDRESS_AR = "السودان، الخرطوم - بورتسودان";
export const DEFAULT_COMPANY_ADDRESS_EN = "Sudan, Khartoum - Portsudan";

const EMAIL_KEY = "company_email";
const PHONE_KEY = "company_phone";
const ADDRESS_AR_KEY = "company_address_ar";
const ADDRESS_EN_KEY = "company_address_en";

function safeGet(key: string, fallback: string): string {
  if (Capacitor.isNativePlatform()) {
    return getStoredSync(key, "") || fallback;
  }
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage.getItem(key) || fallback;
    }
  } catch {}
  return fallback;
}

function safeSet(key: string, value: string): void {
  if (Capacitor.isNativePlatform()) {
    setMemoryCacheString(key, value);
    return;
  }
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.setItem === "function") {
      localStorage.setItem(key, value);
    }
  } catch {}
}

let cachedEmail = safeGet(EMAIL_KEY, DEFAULT_COMPANY_EMAIL);
let cachedPhone = safeGet(PHONE_KEY, DEFAULT_COMPANY_PHONE);
let cachedAddressAr = safeGet(ADDRESS_AR_KEY, DEFAULT_COMPANY_ADDRESS_AR);
let cachedAddressEn = safeGet(ADDRESS_EN_KEY, DEFAULT_COMPANY_ADDRESS_EN);

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

function syncFromMemoryCache(): void {
  const nextEmail = safeGet(EMAIL_KEY, DEFAULT_COMPANY_EMAIL);
  const nextPhone = safeGet(PHONE_KEY, DEFAULT_COMPANY_PHONE);
  const nextAddrAr = safeGet(ADDRESS_AR_KEY, DEFAULT_COMPANY_ADDRESS_AR);
  const nextAddrEn = safeGet(ADDRESS_EN_KEY, DEFAULT_COMPANY_ADDRESS_EN);
  let changed = false;
  if (nextEmail !== cachedEmail) {
    cachedEmail = nextEmail;
    changed = true;
  }
  if (nextPhone !== cachedPhone) {
    cachedPhone = nextPhone;
    changed = true;
  }
  if (nextAddrAr !== cachedAddressAr) {
    cachedAddressAr = nextAddrAr;
    changed = true;
  }
  if (nextAddrEn !== cachedAddressEn) {
    cachedAddressEn = nextAddrEn;
    changed = true;
  }
  if (changed) notifyListeners();
}

async function hydrateFromDatabase(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    syncFromMemoryCache();
    return;
  }
  try {
    const dbEmail = await getSetting(EMAIL_KEY, DEFAULT_COMPANY_EMAIL);
    const dbPhone = await getSetting(PHONE_KEY, DEFAULT_COMPANY_PHONE);
    const dbAddrAr = await getSetting(ADDRESS_AR_KEY, DEFAULT_COMPANY_ADDRESS_AR);
    const dbAddrEn = await getSetting(ADDRESS_EN_KEY, DEFAULT_COMPANY_ADDRESS_EN);
    let changed = false;
    const resolvedEmail = dbEmail || DEFAULT_COMPANY_EMAIL;
    const resolvedPhone = dbPhone || DEFAULT_COMPANY_PHONE;
    const resolvedAddrAr = dbAddrAr || DEFAULT_COMPANY_ADDRESS_AR;
    const resolvedAddrEn = dbAddrEn || DEFAULT_COMPANY_ADDRESS_EN;
    if (resolvedEmail !== cachedEmail) {
      cachedEmail = resolvedEmail;
      changed = true;
    }
    if (resolvedPhone !== cachedPhone) {
      cachedPhone = resolvedPhone;
      changed = true;
    }
    if (resolvedAddrAr !== cachedAddressAr) {
      cachedAddressAr = resolvedAddrAr;
      changed = true;
    }
    if (resolvedAddrEn !== cachedAddressEn) {
      cachedAddressEn = resolvedAddrEn;
      changed = true;
    }
    if (changed) notifyListeners();
  } catch (err) {
    console.warn("[CompanyProfile] Failed to hydrate from SQLite:", err);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("native-storage-ready", () => {
    syncFromMemoryCache();
    void hydrateFromDatabase();
  });
}

export function getCompanyEmail(): string {
  return cachedEmail;
}

export function getCompanyPhone(): string {
  return cachedPhone;
}

export function getCompanyAddress(isRtl: boolean): string {
  return isRtl ? cachedAddressAr : cachedAddressEn;
}

export async function updateCompanyProfile(updates: {
  email?: string;
  phone?: string;
  addressAr?: string;
  addressEn?: string;
}): Promise<void> {
  const isNative = Capacitor.isNativePlatform();
  if (updates.email !== undefined) {
    cachedEmail = updates.email.trim() || DEFAULT_COMPANY_EMAIL;
    safeSet(EMAIL_KEY, cachedEmail);
    if (isNative) {
      try {
        await setSetting(EMAIL_KEY, cachedEmail);
      } catch (err) {
        console.error("[CompanyProfile] Failed to persist company_email:", err);
      }
    }
  }
  if (updates.phone !== undefined) {
    cachedPhone = updates.phone.trim() || DEFAULT_COMPANY_PHONE;
    safeSet(PHONE_KEY, cachedPhone);
    if (isNative) {
      try {
        await setSetting(PHONE_KEY, cachedPhone);
      } catch (err) {
        console.error("[CompanyProfile] Failed to persist company_phone:", err);
      }
    }
  }
  if (updates.addressAr !== undefined) {
    cachedAddressAr = updates.addressAr.trim() || DEFAULT_COMPANY_ADDRESS_AR;
    safeSet(ADDRESS_AR_KEY, cachedAddressAr);
    if (isNative) {
      try {
        await setSetting(ADDRESS_AR_KEY, cachedAddressAr);
      } catch (err) {
        console.error("[CompanyProfile] Failed to persist company_address_ar:", err);
      }
    }
  }
  if (updates.addressEn !== undefined) {
    cachedAddressEn = updates.addressEn.trim() || DEFAULT_COMPANY_ADDRESS_EN;
    safeSet(ADDRESS_EN_KEY, cachedAddressEn);
    if (isNative) {
      try {
        await setSetting(ADDRESS_EN_KEY, cachedAddressEn);
      } catch (err) {
        console.error("[CompanyProfile] Failed to persist company_address_en:", err);
      }
    }
  }
  notifyListeners();
}

export function useCompanyProfile() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    listeners.add(handler);

    const handleStorageReady = () => {
      syncFromMemoryCache();
      void hydrateFromDatabase();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("native-storage-ready", handleStorageReady);
    }

    void hydrateFromDatabase();

    return () => {
      listeners.delete(handler);
      if (typeof window !== "undefined") {
        window.removeEventListener("native-storage-ready", handleStorageReady);
      }
    };
  }, []);

  return {
    email: cachedEmail,
    phone: cachedPhone,
    addressAr: cachedAddressAr,
    addressEn: cachedAddressEn,
    updateCompanyProfile,
  };
}
