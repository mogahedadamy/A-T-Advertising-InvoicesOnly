import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PasswordLock from "@/components/PasswordLock";
import SplashScreen from "@/components/common/SplashScreen";
import { useTrialGuard } from "@/lib/trialGuard";
import { TrialExpiredScreen } from "@/components/common/TrialExpiredScreen";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" dir="rtl">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-black text-foreground">404</h1>
        <h2 className="mt-2 text-lg font-bold text-foreground">الصفحة غير موجودة</h2>
        <div className="mt-4">
          <Link
            to="/calculator"
            className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm"
          >
            العودة للحاسبة
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

  // مراقبة صلاحية النسخة التجريبية (48 ساعة) مع حماية ضد الانهيار
  const trialStatus = useTrialGuard();

  useEffect(() => {
    setMounted(true);
    const splashDone = sessionStorage.getItem("ta_splash_finished") === "true";
    if (splashDone) {
      setSplashFinished(true);
    }

    const isUnlocked = sessionStorage.getItem("future_calc_unlocked") === "true";
    if (isUnlocked) {
      setUnlocked(true);
    }

    const handleLockEvent = () => {
      sessionStorage.removeItem("future_calc_unlocked");
      setUnlocked(false);
    };

    window.addEventListener("app-lock", handleLockEvent);
    return () => window.removeEventListener("app-lock", handleLockEvent);
  }, []);

  const handleFinishSplash = () => {
    sessionStorage.setItem("ta_splash_finished", "true");
    setSplashFinished(true);
  };

  const handleUnlock = () => {
    sessionStorage.setItem("future_calc_unlocked", "true");
    setUnlocked(true);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {!mounted ? (
          <div className="flex h-screen w-screen items-center justify-center bg-background text-primary">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !splashFinished ? (
          /* شاشة البداية الملكية تعمل دون انقطاع لكامل مدتها (6 ثوانٍ) لمنع أي انهيار */
          <SplashScreen duration={6000} onFinish={handleFinishSplash} />
        ) : trialStatus.isExpired ? (
          /* شاشة الإيقاف النهائي بمجرد انقضاء الـ 48 ساعة */
          <TrialExpiredScreen isTampered={trialStatus.isTampered} />
        ) : !unlocked ? (
          <PasswordLock onUnlock={handleUnlock} />
        ) : (
          <Outlet />
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
}
