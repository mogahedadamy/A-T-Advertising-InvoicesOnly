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

// Polyfill window.localStorage
const localMock = {
  getItem: (key: string) => storageMap.get(key) ?? null,
  setItem: (key: string, val: string) => { storageMap.set(key, val); },
  removeItem: (key: string) => { storageMap.delete(key); },
  clear: () => { storageMap.clear(); },
};
Object.defineProperty(global, "localStorage", { value: localMock, writable: true });

import { isTourDismissed, setTourDismissed, triggerOpenTour, triggerCloseTour, useAppTour } from "./appTourStore";
import { renderHook, act } from "@testing-library/react";

describe("App Tour Assistant Store", () => {
  beforeEach(() => {
    storageMap.clear();
  });

  it("is not dismissed by default on clean state", () => {
    expect(isTourDismissed()).toBe(false);
  });

  it("sets and persists dismissed state", async () => {
    await setTourDismissed(true);
    expect(isTourDismissed()).toBe(true);
    expect(localStorage.getItem("ta_app_tour_dismissed")).toBe("true");

    await setTourDismissed(false);
    expect(isTourDismissed()).toBe(false);
  });

  it("dispatches triggerOpenTour event with correct step", () => {
    const handler = vi.fn();
    window.addEventListener("ta-open-app-tour", handler);

    triggerOpenTour(2);

    expect(handler).toHaveBeenCalled();
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail?.step).toBe(2);

    window.removeEventListener("ta-open-app-tour", handler);
  });

  it("dispatches triggerCloseTour event", () => {
    const handler = vi.fn();
    window.addEventListener("ta-close-app-tour", handler);

    triggerCloseTour();

    expect(handler).toHaveBeenCalled();
    window.removeEventListener("ta-close-app-tour", handler);
  });

  it("synchronizes openTour across multiple hook instances globally", () => {
    const { result: instanceA } = renderHook(() => useAppTour());
    const { result: instanceB } = renderHook(() => useAppTour());

    expect(instanceA.current.isOpen).toBe(false);
    expect(instanceB.current.isOpen).toBe(false);

    // Calling openTour on instanceA must open instanceB (e.g. banner button opening global dialog)
    act(() => {
      instanceA.current.openTour(3);
    });

    expect(instanceA.current.isOpen).toBe(true);
    expect(instanceA.current.initialStep).toBe(3);
    expect(instanceB.current.isOpen).toBe(true);
    expect(instanceB.current.initialStep).toBe(3);

    // Closing on instanceB must close instanceA
    act(() => {
      instanceB.current.closeTour();
    });

    expect(instanceA.current.isOpen).toBe(false);
    expect(instanceB.current.isOpen).toBe(false);
  });

  it("handles contextual section openTour correctly", () => {
    const { result } = renderHook(() => useAppTour());

    act(() => {
      triggerOpenTour({ sectionId: "billing", mode: "context" });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.initialSectionId).toBe("billing");
    expect(result.current.initialMode).toBe("context");

    act(() => {
      result.current.closeTour();
    });

    expect(result.current.isOpen).toBe(false);
  });
});
