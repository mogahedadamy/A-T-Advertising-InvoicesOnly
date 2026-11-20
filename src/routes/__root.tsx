import {
  Outlet,
  Link,
  createRootRoute,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordLock from "@/components/PasswordLock";
import SplashScreen from "@/components/common/SplashScreen";
import { RecoveryDiscoveryGate } from "@/components/settings/RecoveryDiscoveryGate";
import { useTrialExpiry } from "@/lib/trialGuard";
import { TrialExpiredScreen } from "@/components/common/TrialExpiredScreen";
import { CustomInvoicePrintPortal } from "@/components/billing/CustomInvoicePrintButton";
import { AppErrorBoundary } from "@/components/common/AppErrorBoundary";
import { AppTourAssistant } from "@/components/common/AppTourAssistant";
import { PageShell } from "@/components/layout/PageShell";
import { isStorageReady } from "@/lib/sqliteStorage";

const SESSION_UNLOCK_MAX_AGE_MS = 30 * 60 * 1000;
const BACKGROUND_AUTO_LOCK_MS = 2 * 60 * 1000;

function isUnlockTimestampValid(ts: number, now: number = Date.now()): boolean {
  if (!Number.isFinite(ts) || ts <= 0) return false;
  const delta = now - ts;
  return delta >= 0 && delta < SESSION_UNLOCK_MAX_AGE_MS;
}

function clearUnlockSession(): void {
  try {
    sessionStorage.removeItem("future_calc_unlocked");
    localStorage.removeItem("ta_unlocked_at");
  } catch {
    // ignore storage errors
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-black text-foreground">404</h1>
        <h2 className="mt-2 text-lg font-bold text-foreground">الصفحة غير موجودة</h2>
        <div className="mt-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const [mounted, setMounted] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [storageReady, setStorageReady] = useState<boolean>(
    () => !Capacitor.isNativePlatform() || isStorageReady()
  );
  const backgroundedAtRef = useRef<number | null>(null);

  // مراقبة صلاحية النسخة التجريبية (7 أيام / 168 ساعة) دون التسبب بإعادة تصيير متكررة
  const { isExpired, isTampered } = useTrialExpiry();

  const lockApp = useCallback(() => {
    clearUnlockSession();
    setUnlocked(false);
  }, []);

  useEffect(() => {
    if (storageReady) return;
    const onReady = () => setStorageReady(true);
    window.addEventListener("native-storage-ready", onReady);
    if (isStorageReady()) setStorageReady(true);
    return () => window.removeEventListener("native-storage-ready", onReady);
  }, [storageReady]);

  useEffect(() => {
    setMounted(true);

    // فحص فك القفل مع مهلة أمان (30 دقيقة) وفحص delta >= 0 ضد إرجاع الساعة
    const lastUnlockedAt = Number(localStorage.getItem("ta_unlocked_at") || "0");
    if (isUnlockTimestampValid(lastUnlockedAt)) {
      setUnlocked(true);
    } else {
      clearUnlockSession();
      setUnlocked(false);
    }

    const handleResumeCheck = () => {
      const now = Date.now();
      const backgroundedAt = backgroundedAtRef.current;
      backgroundedAtRef.current = null;

      if (backgroundedAt !== null) {
        const awayMs = now - backgroundedAt;
        if (awayMs < 0 || awayMs > BACKGROUND_AUTO_LOCK_MS) {
          lockApp();
          return;
        }
      }

      const storedAt = Number(localStorage.getItem("ta_unlocked_at") || "0");
      if (!isUnlockTimestampValid(storedAt, now)) {
        lockApp();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
      } else if (document.visibilityState === "visible") {
        handleResumeCheck();
      }
    };

    window.addEventListener("app-lock", lockApp);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let appStateHandle: { remove: () => Promise<void> } | null = null;
    let disposed = false;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) {
          if (backgroundedAtRef.current === null) {
            backgroundedAtRef.current = Date.now();
          }
        } else {
          handleResumeCheck();
        }
      }).then((handle) => {
        if (disposed) {
          void handle.remove();
        } else {
          appStateHandle = handle;
        }
      }).catch((err) => {
        console.warn("[Root] Failed to register appStateChange listener:", err);
      });
    }

    return () => {
      disposed = true;
      window.removeEventListener("app-lock", lockApp);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (appStateHandle) {
        void appStateHandle.remove();
      }
    };
  }, [lockApp]);

  const handleFinishSplash = useCallback(() => {
    setSplashFinished(true);
  }, []);

  const handleUnlock = useCallback(() => {
    sessionStorage.setItem("future_calc_unlocked", "true");
    localStorage.setItem("ta_unlocked_at", String(Date.now()));
    backgroundedAtRef.current = null;
    setUnlocked(true);
  }, []);

  return (
    /* تغليف التطبيق بالكامل داخل AppErrorBoundary لضمان عدم ظهور شاشة بيضاء أبداً */
    <AppErrorBoundary>
      <TooltipProvider>
        <Sonner />
        <CustomInvoicePrintPortal />
        <AppTourAssistant />
        {!mounted || !storageReady ? (
          <div className="flex h-screen w-screen items-center justify-center bg-background text-primary">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !splashFinished ? (
          /* شاشة البداية الملكية تعمل دون انقطاع لكامل مدتها (6 ثوانٍ) لمنع أي انهيار */
          <SplashScreen duration={6000} onFinish={handleFinishSplash} />
        ) : (
          <RecoveryDiscoveryGate isAuthenticated={unlocked}>
            {isExpired ? (
              /* شاشة الإيقاف النهائي بمجرد انقضاء الـ 7 أيام */
              <TrialExpiredScreen isTampered={isTampered} />
            ) : !unlocked ? (
              <PasswordLock onUnlock={handleUnlock} />
            ) : (
              <PageShell>
                <Outlet />
              </PageShell>
            )}
          </RecoveryDiscoveryGate>
        )}
      </TooltipProvider>
    </AppErrorBoundary>
  );
}
