import { useState, useEffect, useCallback } from "react";
import { getStoredSync, setStoredItem } from "./sqliteStorage";

const TOUR_STORAGE_KEY = "ta_app_tour_dismissed";
const OPEN_TOUR_EVENT = "ta-open-app-tour";
const CLOSE_TOUR_EVENT = "ta-close-app-tour";
const TOUR_STATUS_EVENT = "ta-app-tour-status-changed";

/** فحص هل تم إخفاء أو تخطي الجولة التعريفية مسبقاً */
export function isTourDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const val = getStoredSync(TOUR_STORAGE_KEY, "");
  if (val) return val === "true";
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** تسجيل إخفاء أو إكمال الجولة التعريفية حتى لا تزعج المستخدم مستقبلاً */
export async function setTourDismissed(dismissed: boolean = true): Promise<void> {
  const strVal = dismissed ? "true" : "false";
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_STORAGE_KEY, strVal);
    }
  } catch {}
  await setStoredItem(TOUR_STORAGE_KEY, strVal);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(TOUR_STATUS_EVENT, { detail: { dismissed } }));
  }
}

export interface OpenTourOptions {
  step?: number;
  sectionId?: string;
  mode?: "context" | "step" | "all";
}

/** فتح الجولة التعريفية والمساعد الذكي من أي مكان في التطبيق بنقرة واحدة */
export function triggerOpenTour(target: number | string | OpenTourOptions = 0): void {
  if (typeof window === "undefined") return;
  let detail: OpenTourOptions = {};
  if (typeof target === "number") {
    detail = { step: target, mode: "step" };
  } else if (typeof target === "string") {
    detail = { sectionId: target, mode: "context" };
  } else if (typeof target === "object" && target !== null) {
    detail = target;
  }
  window.dispatchEvent(new CustomEvent(OPEN_TOUR_EVENT, { detail }));
}

/** إغلاق الجولة التعريفية من أي مكان في التطبيق */
export function triggerCloseTour(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CLOSE_TOUR_EVENT));
  }
}

/** خطاف تفاعلي لإدارة الجولة التعليمية والمساعد الإرشادي عبر كامل التطبيق */
export function useAppTour() {
  const [isOpen, setIsOpen] = useState(false);
  const [initialStep, setInitialStep] = useState(0);
  const [initialSectionId, setInitialSectionId] = useState<string | null>(null);
  const [initialMode, setInitialMode] = useState<"context" | "step" | "all">("context");
  const [isDismissed, setIsDismissed] = useState<boolean>(() => isTourDismissed());

  useEffect(() => {
    const handleOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenTourOptions>)?.detail;
      setInitialStep(typeof detail?.step === "number" ? detail.step : 0);
      setInitialSectionId(typeof detail?.sectionId === "string" ? detail.sectionId : null);
      setInitialMode(detail?.mode || (typeof detail?.sectionId === "string" ? "context" : typeof detail?.step === "number" ? "step" : "context"));
      setIsOpen(true);
    };

    const handleClose = () => {
      setIsOpen(false);
    };

    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setIsDismissed(detail?.dismissed ?? isTourDismissed());
    };

    window.addEventListener(OPEN_TOUR_EVENT, handleOpen);
    window.addEventListener(CLOSE_TOUR_EVENT, handleClose);
    window.addEventListener(TOUR_STATUS_EVENT, handleStatus);
    return () => {
      window.removeEventListener(OPEN_TOUR_EVENT, handleOpen);
      window.removeEventListener(CLOSE_TOUR_EVENT, handleClose);
      window.removeEventListener(TOUR_STATUS_EVENT, handleStatus);
    };
  }, []);

  const openTour = useCallback((target: number | string | OpenTourOptions = 0) => {
    triggerOpenTour(target);
  }, []);

  const closeTour = useCallback(() => {
    triggerCloseTour();
  }, []);

  const dismiss = useCallback(async () => {
    setIsDismissed(true);
    await setTourDismissed(true);
  }, []);

  return {
    isOpen,
    initialStep,
    initialSectionId,
    initialMode,
    openTour,
    closeTour,
    isDismissed,
    dismissTour: dismiss,
  };
}

