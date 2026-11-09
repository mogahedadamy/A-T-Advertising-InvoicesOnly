import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Calculator,
  ClipboardList,
  Receipt,
  Layers,
  Settings as SettingsIcon,
  ChevronLeft,
  X,
  Sun,
  Moon,
  Lock,
  BarChart3,
  ShieldCheck,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useInvoices } from "@/lib/invoicesStore";
import { useCustomInvoices } from "@/lib/billing/store";
import { useTheme } from "@/hooks/useTheme";
import { playTapSound } from "@/lib/soundEffects";

interface NavItem {
  to: string;
  label: string;
  subtitle: string;
  icon: React.ElementType;
  gradient: string;
  badge?: string | number | undefined;
}

// بيانات المطور والإصدار
export const APP_VERSION_INFO = {
  version: "v1.2.4-INVOICE",
  edition: "نسخة الفواتير والحاسبة",
  developer: "من تطوير مجاهد ادم - 2027",
  copyright: "جميع الحقوق محفوظة © 2027",
};

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  const { theme, toggle } = useTheme();

  const isDark = theme === "dark";
  const calcInvoices = useInvoices();
  const customInvoices = useCustomInvoices();

  const totalInvoicesCount =
    (calcInvoices || []).length + (customInvoices || []).length;

  // اختصارات أدوات النسخة الحالية فقط (حاسبة وفواتير معتمدة)
  const NAV_ITEMS: NavItem[] = [
    {
      to: "/calculator",
      label: "حاسبة المقاسات والتسعير",
      subtitle: "حساب تكلفة ومقاسات الرولات واستخراج الفواتير",
      icon: Calculator,
      gradient: "from-[#0D4A39] to-[#168063] shadow-[#0D4A39]/30",
    },
    {
      to: "/billing",
      label: "إصدار الفواتير والمطالبات",
      subtitle: "فواتير مبيعات، مشتريات، وعروض أسعار A5",
      icon: Receipt,
      gradient: "from-[#168063] to-[#22A07E] shadow-[#168063]/30",
    },
    {
      to: "/orders",
      label: "سجل وأرشيف الفواتير",
      subtitle: "متابعة الفواتير المحفوظة والطباعة وإعادة التصدير",
      icon: ClipboardList,
      gradient: "from-[#0C251E] to-[#1B4D40] shadow-black/20",
      badge: totalInvoicesCount > 0 ? `${totalInvoicesCount}` : undefined,
    },
    {
      to: "/reports",
      label: "التقارير ومؤشرات أداء الفواتير",
      subtitle: "مراقبة الإيرادات، التحصيلات، وسرعة إنجاز الفواتير",
      icon: BarChart3,
      gradient: "from-[#0F766E] to-[#0D9488] shadow-teal-500/20",
    },
    {
      to: "/materials",
      label: "دليل الخامات والأسعار",
      subtitle: "أبعاد الرولات والأسعار المعتمدة للمتر المربع",
      icon: Layers,
      gradient: "from-[#1A453A] to-[#2D7362] shadow-[#1A453A]/30",
    },
    {
      to: "/settings",
      label: "الإعدادات وقفل الأمان",
      subtitle: "أمان النظام، البصمة، وتخصيص المظهر",
      icon: SettingsIcon,
      gradient: "from-[#071914] to-[#0D4A39] shadow-black/30",
    },
  ];

  const handleClose = () => {
    playTapSound();
    if (isMobile) {
      setOpenMobile(false);
    } else {
      setOpen(false);
    }
  };

  const handleNavClick = () => {
    playTapSound();
    if (isMobile) {
      setOpenMobile(false);
    } else if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setOpen(false);
    }
  };

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l border-border/80 bg-background/98 backdrop-blur-2xl">
      {/* 1. رأس القائمة: الشعار والعنوان وزر الإغلاق */}
      <SidebarHeader className="border-b border-border/60 px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3.5 bg-gradient-to-b from-card/90 to-card/40 backdrop-blur-md" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/calculator"
              onClick={handleNavClick}
              className="flex items-center justify-center shrink-0 transition-transform active:scale-95"
            >
              <img
                key={isDark ? "sidebar-dark-logo" : "sidebar-light-logo"}
                src={isDark ? "/ta-logo-white.png" : "/ta-logo.png"}
                alt="A-T-Advertising"
                className="h-10 w-auto max-w-[110px] object-contain drop-shadow-xs"
                onError={(e) => {
                  if ((e.currentTarget as HTMLImageElement).src.includes("white")) {
                    (e.currentTarget as HTMLImageElement).src = "/ta-logo.png";
                  }
                }}
              />
            </Link>
            <div className="flex flex-col text-right min-w-0">
              <span className="text-sm font-black tracking-tight text-foreground truncate">
                A-T-Advertising
              </span>
              <span className="text-[10.5px] font-bold text-muted-foreground truncate">
                نظام الحاسبة وإدارة الفواتير
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق القائمة"
            className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/70 text-muted-foreground hover:bg-card hover:text-foreground active:scale-90 transition-all shadow-2xs cursor-pointer touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </SidebarHeader>

      {/* 2. المحتوى: اختصارات أدوات النسخة الحالية فقط */}
      <SidebarContent className="px-4 py-3.5 space-y-2 overflow-y-auto flex-1 overscroll-contain select-none" dir="rtl">
        <div className="space-y-2">
          {NAV_ITEMS.map(({ to, label, subtitle, icon: Icon, gradient, badge }) => {
            const active = !!matchRoute({ to, fuzzy: to !== "/" });
            return (
              <Link
                key={to}
                to={to}
                onClick={handleNavClick}
                className={`group flex items-center justify-between gap-3 rounded-2xl p-3 transition-all border touch-manipulation ${
                  active
                    ? "bg-primary/10 border-primary/50 shadow-xs shadow-primary/10 ring-1 ring-primary/30"
                    : "bg-card/70 border-border/70 hover:bg-card hover:border-primary/40 active:scale-[0.98]"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${gradient} text-white shadow-xs transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  <div className="flex flex-col text-right min-w-0">
                    <span
                      className={`truncate text-xs font-black tracking-tight ${
                        active ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="truncate text-[10px] font-medium text-muted-foreground mt-0.5">
                      {subtitle}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {badge && (
                    <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-black">
                      {badge}
                    </span>
                  )}
                  <ChevronLeft
                    className={`h-4 w-4 transition-transform group-hover:-translate-x-0.5 ${
                      active ? "text-primary font-bold" : "text-muted-foreground/60"
                    }`}
                  />
                </div>
              </Link>
            );
          })}
        </div>

        {/* الإجراءات السريعة (المظهر والقفل) */}
        <div className="pt-3 border-t border-border/60">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                toggle();
              }}
              className="flex h-9.5 items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/60 px-2 text-[11px] font-bold text-foreground hover:bg-card active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>الوضع النهاري</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-primary" />
                  <span>الوضع الليلي</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                playTapSound();
                setOpenMobile(false);
                window.dispatchEvent(new Event("app-lock"));
              }}
              className="flex h-9.5 items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/60 px-2 text-[11px] font-bold text-foreground hover:bg-card hover:text-primary active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
            >
              <Lock className="h-4 w-4" />
              <span>قفل التطبيق</span>
            </button>
          </div>
        </div>
      </SidebarContent>

      {/* 3. التذييل: المطور وتفاصيله فقط */}
      <SidebarFooter className="border-t border-border/60 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] bg-card/80 backdrop-blur-md shrink-0" dir="rtl">
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-1.5 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-black text-foreground">
              {APP_VERSION_INFO.developer}
            </span>
          </div>
          <p className="text-[10px] font-semibold text-muted-foreground">
            {APP_VERSION_INFO.copyright} • {APP_VERSION_INFO.version}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
