import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
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

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [mounted, setMounted] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // مراقبة صلاحية النسخة التجريبية (7 أيام / 168 ساعة) دون التسبب بإعادة تصيير متكررة
  const { isExpired, isTampered } = useTrialExpiry();

  useEffect(() => {
    setMounted(true);

    // فحص فك القفل مع مهلة أمان (30 دقيقة) لحماية المستخدم من طرده المتكرر عند فتح واتساب أو تطبيقات أخرى
    const sessionUnlocked = sessionStorage.getItem("future_calc_unlocked") === "true";
    const lastUnlockedAt = Number(localStorage.getItem("ta_unlocked_at") || "0");
    const isUnlockActive = Date.now() - lastUnlockedAt < 30 * 60 * 1000;
    if (sessionUnlocked || isUnlockActive) {
      setUnlocked(true);
    }

    const handleLockEvent = () => {
      sessionStorage.removeItem("future_calc_unlocked");
      localStorage.removeItem("ta_unlocked_at");
      setUnlocked(false);
    };

    window.addEventListener("app-lock", handleLockEvent);
    return () => window.removeEventListener("app-lock", handleLockEvent);
  }, []);

  const handleFinishSplash = useCallback(() => {
    setSplashFinished(true);
  }, []);

  const handleUnlock = useCallback(() => {
    sessionStorage.setItem("future_calc_unlocked", "true");
    localStorage.setItem("ta_unlocked_at", String(Date.now()));
    setUnlocked(true);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <CustomInvoicePrintPortal />
        <AppTourAssistant />
        {!mounted ? (
          <div className="flex h-screen w-screen items-center justify-center bg-background text-primary">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !splashFinished ? (
          /* شاشة البداية الملكية تعمل دون انقطاع لكامل مدتها (6 ثوانٍ) لمنع أي انهيار */
          <SplashScreen duration={6000} onFinish={handleFinishSplash} />
        ) : (
          /* لا شاشة بيضاء أبداً: أي خطأ في الواجهة يعرض شرحاً وأزرار استرجاع */
          <AppErrorBoundary>
            <RecoveryDiscoveryGate>
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
          </AppErrorBoundary>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
