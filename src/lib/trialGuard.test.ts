import { describe, it, expect, beforeEach, vi } from "vitest";

const storageMap = new Map<string, string>();

vi.mock("@capacitor/preferences", () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: storageMap.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => {
      storageMap.set(key, value);
    },
    remove: async ({ key }: { key: string }) => {
      storageMap.delete(key);
    },
    clear: async () => {
      storageMap.clear();
    },
  },
}));

import { TRIAL_CONFIG } from "./trialConfig";
import { evaluateTrialStatus } from "./trialGuard";

describe("Trial Guard (7-Day Trial Engine)", () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it("has exactly 7 days (168 hours) duration configured", () => {
    expect(TRIAL_CONFIG.DURATION_HOURS).toBe(168);
    expect(TRIAL_CONFIG.DURATION_MS).toBe(7 * 24 * 60 * 60 * 1000);
    expect(TRIAL_CONFIG.STORAGE_KEYS.INSTALLED_AT).toBe("ta_invoicing_7d_installed_at");
    expect(TRIAL_CONFIG.STORAGE_KEYS.HIGH_WATER_MARK).toBe("ta_invoicing_7d_hwm");
    expect(TRIAL_CONFIG.STORAGE_KEYS.PERMANENTLY_LOCKED).toBe("ta_invoicing_7d_permanently_locked");
  });

  it("evaluates app in permanent lifetime mode when trial lock is disabled", async () => {
    const status = await evaluateTrialStatus();
    expect(status.isEnabled).toBe(false);
    expect(status.isExpired).toBe(false);
    expect(status.remainingMs).toBe(Infinity);
    expect(status.isTampered).toBe(false);
    expect(status.isReady).toBe(true);
  });
});
