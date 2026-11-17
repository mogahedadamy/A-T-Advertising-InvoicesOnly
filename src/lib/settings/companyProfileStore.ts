import { useState, useEffect } from "react";
import { getSetting, setSetting } from "@/lib/repositories/SettingsRepository";

export const DEFAULT_COMPANY_EMAIL = "t.a.advertising@gmail.com";
export const DEFAULT_COMPANY_PHONE = "+249 12371 1444  -  +249 91296 8886";
export const DEFAULT_COMPANY_ADDRESS_AR = "السودان، الخرطوم - بورتسودان";
export const DEFAULT_COMPANY_ADDRESS_EN = "Sudan, Khartoum - Portsudan";

const EMAIL_KEY = "company_email";
const PHONE_KEY = "company_phone";
const ADDRESS_AR_KEY = "company_address_ar";
const ADDRESS_EN_KEY = "company_address_en";

function safeGet(key: string, fallback: string): string {
  try {
    if (typeof localStorage !== "undefined" && typeof localStorage.getItem === "function") {
      return localStorage.getItem(key) || fallback;
    }
  } catch {}
  return fallback;
}

function safeSet(key: string, value: string): void {
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
  if (updates.email !== undefined) {
    cachedEmail = updates.email.trim() || DEFAULT_COMPANY_EMAIL;
    safeSet(EMAIL_KEY, cachedEmail);
    try {
      await setSetting(EMAIL_KEY, cachedEmail);
    } catch {}
  }
  if (updates.phone !== undefined) {
    cachedPhone = updates.phone.trim() || DEFAULT_COMPANY_PHONE;
    safeSet(PHONE_KEY, cachedPhone);
    try {
      await setSetting(PHONE_KEY, cachedPhone);
    } catch {}
  }
  if (updates.addressAr !== undefined) {
    cachedAddressAr = updates.addressAr.trim() || DEFAULT_COMPANY_ADDRESS_AR;
    safeSet(ADDRESS_AR_KEY, cachedAddressAr);
    try {
      await setSetting(ADDRESS_AR_KEY, cachedAddressAr);
    } catch {}
  }
  if (updates.addressEn !== undefined) {
    cachedAddressEn = updates.addressEn.trim() || DEFAULT_COMPANY_ADDRESS_EN;
    safeSet(ADDRESS_EN_KEY, cachedAddressEn);
    try {
      await setSetting(ADDRESS_EN_KEY, cachedAddressEn);
    } catch {}
  }
  notifyListeners();
}

export function useCompanyProfile() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    listeners.add(handler);

    (async () => {
      try {
        const dbEmail = await getSetting(EMAIL_KEY, DEFAULT_COMPANY_EMAIL);
        const dbPhone = await getSetting(PHONE_KEY, DEFAULT_COMPANY_PHONE);
        const dbAddrAr = await getSetting(ADDRESS_AR_KEY, DEFAULT_COMPANY_ADDRESS_AR);
        const dbAddrEn = await getSetting(ADDRESS_EN_KEY, DEFAULT_COMPANY_ADDRESS_EN);
        let changed = false;
        if (dbEmail && dbEmail !== cachedEmail) {
          cachedEmail = dbEmail;
          changed = true;
        }
        if (dbPhone && dbPhone !== cachedPhone) {
          cachedPhone = dbPhone;
          changed = true;
        }
        if (dbAddrAr && dbAddrAr !== cachedAddressAr) {
          cachedAddressAr = dbAddrAr;
          changed = true;
        }
        if (dbAddrEn && dbAddrEn !== cachedAddressEn) {
          cachedAddressEn = dbAddrEn;
          changed = true;
        }
        if (changed) notifyListeners();
      } catch {}
    })();

    return () => {
      listeners.delete(handler);
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
