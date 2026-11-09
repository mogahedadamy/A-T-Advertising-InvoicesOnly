import { useState, useEffect, type CSSProperties, type ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { BottomNav } from "./BottomNav";
import { useUserProfile } from "@/lib/userProfileStore";
import { UserProfileDialog } from "@/components/common/UserProfileDialog";
import { useKeyboardAvoidance } from "@/components/common/SafeAreaLayout";

const safeAreaStyle: CSSProperties = {
  paddingLeft: "env(safe-area-inset-left, 0px)",
  paddingRight: "env(safe-area-inset-right, 0px)",
};

/**
 * غلاف الصفحة: الهيكل العام للنظام — الشريط الجانبي (يمين على الحاسوب ودرج على الهاتف)
 * + شريط الأدوات + المحتوى + شريط التنقل السفلي للهاتف. الصفحات تركّب محتواها فقط داخله.
 */
export function PageShell({ children }: { children: ReactNode }) {
  const { isOnboarded } = useUserProfile();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // سحب الحقول المدخلة تلقائياً في حال فتح لوحة المفاتيح
  useKeyboardAvoidance();

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
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-full min-w-0 flex-1 flex-col overflow-hidden bg-background font-display text-foreground touch-pan-y"
        style={safeAreaStyle}
      >
        <AppHeader />
        <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col relative">
          {children}
        </div>
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
