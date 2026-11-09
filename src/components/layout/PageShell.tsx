import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useUserProfile } from "@/lib/userProfileStore";
import { UserProfileDialog } from "@/components/common/UserProfileDialog";

const safeAreaStyle: CSSProperties = {
  paddingTop: "env(safe-area-inset-top)",
  paddingLeft: "env(safe-area-inset-left)",
  paddingRight: "env(safe-area-inset-right)",
};

/**
 * غلاف الصفحة: الهيكل العام للنظام — الشريط الجانبي (يمين على الحاسوب ودرج على الهاتف)
 * + شريط الأدوات + المحتوى + شريط التنقل السفلي للهاتف. الصفحات تركّب محتواها فقط داخله.
 */
export function PageShell({ children }: { children: ReactNode }) {
  const { isOnboarded } = useUserProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // فتح نافذة التهيئة الأولية تلقائياً عند التشغيل الأول إذا لم يسبق حفظ الاسم
    if (!isOnboarded) {
      setShowOnboarding(true);
    }
  }, [isOnboarded]);

  return (
    <SidebarProvider defaultOpen={typeof window !== "undefined" ? window.innerWidth >= 1024 : false}>
      <AppSidebar />
      <div
        dir="rtl"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden bg-background font-display text-foreground touch-pan-y"
        style={safeAreaStyle}
      >
        <AppHeader />
        {children}
        <BottomNav />
      </div>

      {/* نافذة التهيئة الأولية عند فتح التطبيق لأول مرة */}
      <UserProfileDialog
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        isFirstLaunch={true}
      />
    </SidebarProvider>
  );
}
