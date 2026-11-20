import { Link, useMatchRoute, useLocation } from "@tanstack/react-router";
import {
  ChevronLeft,
  X,
  Sun,
  Moon,
  Lock,
  ShieldCheck,
  BookOpen,
} from "lucide-react";
import { triggerOpenTour } from "@/lib/appTourStore";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { useInvoices } from "@/lib/invoicesStore";
import { useCustomInvoices } from "@/lib/billing/store";
import { useProformaInvoices } from "@/lib/proforma/store";
import { useTheme } from "@/hooks/useTheme";
import { APP_VERSION } from "@/lib/appVersion";
import { SidebarTrialCountdown } from "@/components/common/TrialCountdownBadge";
import { SIDEBAR_NAV_ITEMS, getTourSectionFromPath } from "./navConfig";

export const APP_VERSION_INFO = {
  version: `v${APP_VERSION}`,
  edition: "النظام الشامل لإدارة وإصدار الفواتير",
  developer: "من تطوير MA Smart Solutions",
  copyright: "جميع الحقوق محفوظة © 2026-2027",
};

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const location = useLocation();
  const pathname = location.pathname;
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  const { theme, toggle } = useTheme();

  const isDark = theme === "dark";
  const calcInvoices = useInvoices();
  const customInvoices = useCustomInvoices();
  const proformaInvoices = useProformaInvoices();

  const totalInvoicesCount =
    (calcInvoices || []).length +
    (customInvoices || []).length +
    (proformaInvoices || []).length;

  const handleClose = () => {
    if (isMobile) setOpenMobile(false);
    else setOpen(false);
  };

  const handleNavClick = () => {
    if (isMobile) setOpenMobile(false);
    else if (typeof window !== "undefined" && window.innerWidth < 1024) setOpen(false);
  };

  return (
    <Sidebar side="right" collapsible="offcanvas" className="border-l border-border/80 bg-background/98">
      <SidebarHeader
        className="border-b border-border/60 px-4 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-3.5 bg-gradient-to-b from-card/90 to-card/40"
        dir="rtl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              onClick={handleNavClick}
              className="flex items-center justify-center shrink-0 transition-transform active:scale-95"
            >
              <img
                key={isDark ? "sidebar-dark-logo" : "sidebar-light-logo"}
                src={isDark ? "/ta-logo-white.png" : "/ta-logo.png"}
                alt="T.A Advertising Solution"
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
                T.A Advertising Solution
              </span>
              <span className="text-[10.5px] font-bold text-muted-foreground truncate">
                نظام إدارة وإصدار الفواتير
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

      <SidebarContent
        className="px-4 py-3.5 space-y-2 overflow-y-auto flex-1 overscroll-contain select-none"
        dir="rtl"
      >
        <SidebarTrialCountdown />

        <div className="space-y-2">
          {SIDEBAR_NAV_ITEMS.map(({ to, label, subtitle, icon: Icon, gradient, showInvoiceBadge }) => {
            const active = !!matchRoute({ to, fuzzy: to !== "/" });
            const badge = showInvoiceBadge && totalInvoicesCount > 0 ? `${totalInvoicesCount}` : undefined;
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

        <div className="pt-3 border-t border-border/60">
          <button
            type="button"
            onClick={() => {
              handleClose();
              const section = getTourSectionFromPath(pathname);
              triggerOpenTour({ sectionId: section.id, mode: "context" });
            }}
            className="w-full flex h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 px-3 text-xs font-black active:scale-[0.98] transition-all shadow-2xs cursor-pointer touch-manipulation mb-2"
          >
            <BookOpen className="h-4 w-4" />
            <span>دليل الاستخدام والجولة التعليمية</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={toggle}
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

      <SidebarFooter
        className="border-t border-border/60 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] bg-card/95 shrink-0"
        dir="rtl"
      >
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
