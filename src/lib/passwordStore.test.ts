import { describe, it, expect, beforeEach, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  native: false,
  storageReady: true,
  store: new Map<string, string>(),
  dbRows: new Map<string, string>(),
  dbThrows: false,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockState.native,
  },
}));

vi.mock("./database", () => ({
  getDb: async () => {
    if (mockState.dbThrows) throw new Error("DB_NOT_OPEN");
    return {
      query: async (_sql: string, params?: unknown[]) => {
        const key = String(params?.[0] ?? "");
        const val = mockState.dbRows.get(key);
        return { values: val !== undefined ? [{ value: val }] : [] };
      },
    };
  },
}));

vi.mock("./sqliteStorage", () => ({
  isStorageReady: () => mockState.storageReady,
  getStoredSync: (key: string, defaultValue = "") => mockState.store.get(key) ?? defaultValue,
  setStoredItem: async (key: string, value: string) => {
    mockState.store.set(key, value);
  },
  removeStoredItem: async (key: string) => {
    mockState.store.delete(key);
  },
}));

import {
  verifyPassword,
  setPassword,
  changePassword,
  getPinLockoutState,
  recordFailedPinAttempt,
  resetPinAttempts,
} from "./passwordStore";

const PASSWORD_STORAGE_KEY = "future_calc_app_password_hash";

async function makePbkdf2Hash(password: string, iterations: number): Promise<string> {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const toB64 = (bytes: Uint8Array) => {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  };
  return `pbkdf2_sha256$${iterations}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

describe("passwordStore — PBKDF2 hardening, iteration parsing, rate limiting & fail-closed (SEC-07, SEC-09, SEC-13)", () => {
  beforeEach(() => {
    mockState.native = false;
    mockState.storageReady = true;
    mockState.store.clear();
    mockState.dbRows.clear();
    mockState.dbThrows = false;
  });

  it("hashes with PBKDF2-SHA256, verifies, and changes password cleanly", async () => {
    await setPassword("4821");
    const stored = mockState.store.get(PASSWORD_STORAGE_KEY) || "";
    expect(stored.startsWith("pbkdf2_sha256$120000$")).toBe(true);

    expect(await verifyPassword("4821")).toBe(true);
    expect(await verifyPassword("1111")).toBe(false);

    await changePassword("4821", "9357");
    expect(await verifyPassword("4821")).toBe(false);
    expect(await verifyPassword("9357")).toBe(true);
  });

  it("honors stored PBKDF2 iteration count in 100k..1M and transparently upgrades hashes below 120k", async () => {
    const validLowerIterHash = await makePbkdf2Hash("7744", 100_000);
    mockState.store.set(PASSWORD_STORAGE_KEY, validLowerIterHash);

    expect(await verifyPassword("7744")).toBe(true);

    // Must transparently re-hash to 120,000 iterations
    const upgraded = mockState.store.get(PASSWORD_STORAGE_KEY) || "";
    expect(upgraded.startsWith("pbkdf2_sha256$120000$")).toBe(true);
    expect(await verifyPassword("7744")).toBe(true);
  });

  it("rejects tampered PBKDF2 hashes with out-of-range iteration counts (< 100k or > 1M)", async () => {
    const tooLow = await makePbkdf2Hash("1234", 10);
    mockState.store.set(PASSWORD_STORAGE_KEY, tooLow);
    expect(await verifyPassword("1234")).toBe(false);

    await resetPinAttempts();
    mockState.store.set(PASSWORD_STORAGE_KEY, "pbkdf2_sha256$9999999$AAAA$BBBB");
    expect(await verifyPassword("1234")).toBe(false);
  });

  it("enforces persistent exponential backoff (5->30s, 8->5m, 10+->15m) and blocks valid PIN while locked", async () => {
    await setPassword("5588");
    let now = 1_700_000_000_000;

    // 4 wrong attempts: not locked yet
    for (let i = 0; i < 4; i++) {
      expect(await verifyPassword("0000", now)).toBe(false);
    }
    expect(getPinLockoutState(now).failedAttempts).toBe(4);
    expect(getPinLockoutState(now).isLocked).toBe(false);

    // 5th wrong attempt -> 30s lockout
    expect(await verifyPassword("0000", now)).toBe(false);
    const lock5 = getPinLockoutState(now);
    expect(lock5.failedAttempts).toBe(5);
    expect(lock5.isLocked).toBe(true);
    expect(lock5.remainingMs).toBe(30_000);

    // Even the CORRECT PIN is rejected during active lockout
    expect(await verifyPassword("5588", now + 10_000)).toBe(false);

    // Advance past 30s -> 6th, 7th, 8th wrong attempts -> 5m lockout
    now += 31_000;
    expect(getPinLockoutState(now).isLocked).toBe(false);
    await recordFailedPinAttempt(now); // 6
    await recordFailedPinAttempt(now); // 7
    const lock8 = await recordFailedPinAttempt(now); // 8
    expect(lock8.failedAttempts).toBe(8);
    expect(lock8.isLocked).toBe(true);
    expect(lock8.remainingMs).toBe(5 * 60 * 1000);

    // Advance past 5m -> 9th, 10th wrong attempts -> 15m lockout
    now += 5 * 60 * 1000 + 1_000;
    await recordFailedPinAttempt(now); // 9
    const lock10 = await recordFailedPinAttempt(now); // 10
    expect(lock10.failedAttempts).toBe(10);
    expect(lock10.isLocked).toBe(true);
    expect(lock10.remainingMs).toBe(15 * 60 * 1000);

    // After 15m, valid PIN unlocks and resets attempt counter
    now += 15 * 60 * 1000 + 1_000;
    expect(await verifyPassword("5588", now)).toBe(true);
    expect(getPinLockoutState(now).failedAttempts).toBe(0);
    expect(getPinLockoutState(now).isLocked).toBe(false);
  });

  it("fails closed on native when SQLite storage is not ready instead of falling back to default 0906 (SEC-07)", async () => {
    mockState.native = true;
    mockState.storageReady = false;

    // Even default PIN 0906 must be rejected when native storage is not ready yet
    expect(await verifyPassword("0906")).toBe(false);

    // Also fail closed when DB throws
    mockState.storageReady = true;
    mockState.dbThrows = true;
    expect(await verifyPassword("0906")).toBe(false);

    // Once native storage IS ready and DB cleanly confirms no custom PIN exists, first-install default works
    mockState.dbThrows = false;
    expect(await verifyPassword("0906")).toBe(true);
  });
});
