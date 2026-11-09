import { useState } from "react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import {
  Calculator,
  ClipboardList,
  Receipt,
  FileSpreadsheet,
  Layers,
  Settings as SettingsIcon,
  ChevronLeft,
  X,
  Sun,
  Moon,
  Lock,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Database,
  User,
  Users,
  BarChart3,
} from "lucide-react";
import { useUserProfile } from "@/lib/userProfileStore";
import { UserProfileDialog } from "@/components/common/UserProfileDialog";
import { TrialCountdownBadge } from "@/components/common/TrialCountdownBadge";
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
import { useCustomers } from "@/lib/customersStore";
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

// رقم إصدار نسخة الحاسبة والفواتير الحصرية (صلاحية 48 ساعة)
export const APP_VERSION_INFO = {
  version: "v1.0.0-INVOICE",
  build: "Build 2026.11 (48h)",
  edition: "نسخة الفواتير والحاسبة المعتمدة (48 ساعة)",
  developer: "من تطوير مجاهد ادم - 2027",
  copyright: "كل الحقوق محفوظة 2027",
};

export function AppSidebar() {
  const matchRoute = useMatchRoute();
  const { setOpenMobile, setOpen, isMobile } = useSidebar();
  const { theme, toggle } = useTheme();
  const { userName } = useUserProfile();
  const [showProfileEdit, setShowProfileEdit] = useState(false);

  const isDark = theme === "dark";
  const calcInvoices = useInvoices();
  const customInvoices = useCustomInvoices();
  const proformaInvoices = useProformaInvoices();
  const customers = useCustomers();

  const totalInvoicesCount =
    (calcInvoices || []).length +
    (customInvoices || []).length +
    (proformaInvoices || []).length;
  const totalCustomersCount = (customers || []).length;

  // القائمة الجانبية الحصرية لنسخة الحاسبة وإدارة الفواتير
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
      to: "/proforma-invoices",
      label: "الفواتير المبدئية وعروض الأسعار",
      subtitle: "نموذج Pro. Invoice المعتمد وشروط 70/30",
      icon: FileSpreadsheet,
      gradient: "from-[#C5A059] to-[#9E7B35] shadow-[#C5A059]/30",
    },
    {
      to: "/orders",
      label: "سجل وأرشيف الفواتير",
      subtitle: "متابعة الفواتير المحفوظة والطباعة وإعادة التصدير",
      icon: ClipboardList,
      gradient: "from-[#0C251E] to-[#1B4D40] shadow-black/20",
      badge: totalInvoicesCount > 0 ? `${totalInvoicesCount} فاتورة` : undefined,
    },
    {
      to: "/customers",
      label: "دليل العملاء والحسابات",
      subtitle: "إدارة وكالات الدعاية، المديونيات، وسحوبات العملاء",
      icon: Users,
      gradient: "from-[#6B21A8] to-[#9333EA] shadow-purple-500/20",
      badge: totalCustomersCount > 0 ? `${totalCustomersCount} عميل` : undefined,
    },
    {
      to: "/reports",
      label: "التقارير والمؤشرات المالية",
      subtitle: "مؤشرات المبيعات، التحصيلات، واستهلاك الخامات",
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
      {/* 1. Header: Branded Future Logo + Title + Close Button with safe top insets */}
      <SidebarHeader className="border-b border-border/60 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3.5 bg-gradient-to-b from-card/90 to-card/40 backdrop-blur-md" dir="rtl">
        <div className="flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/calculator"
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
                نظام حسابات وطباعة الفواتير
              </span>
            </div>
          </div>

          {/* Close Drawer Button */}
          <button
            type="button"
            onClick={handleClose}
            aria-label="إغلاق القائمة"
            className="flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-secondary/70 text-muted-foreground hover:bg-card hover:text-foreground active:scale-90 transition-all shadow-2xs cursor-pointer touch-manipulation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* System Status Pill */}
        <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/50 border border-border/60 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[10.5px] font-bold text-foreground">نظام الحسابات جاهز</span>
          </div>
          <span className="text-[10px] font-bold text-primary font-mono bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
            {APP_VERSION_INFO.version}
          </span>
        </div>

        {/* مؤشر العد التنازلي للنسخة التجريبية (48 ساعة) */}
        <div className="mt-2">
          <TrialCountdownBadge />
        </div>

        {/* User Identity Card */}
        <div className="mt-2 flex items-center justify-between rounded-xl bg-secondary/40 border border-border/60 px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="flex flex-col text-right min-w-0">
              <span className="text-[9px] text-muted-foreground font-bold">المستخدم الحالي</span>
              <span className="text-xs font-black text-foreground truncate">{userName || "المسؤول"}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setShowProfileEdit(true);
            }}
            className="text-[10px] font-bold text-primary hover:underline cursor-pointer shrink-0"
          >
            تعديل
          </button>
        </div>
      </SidebarHeader>

      {/* 2. Content: Focused Cards only for Calculator, Invoices, and Orders */}
      <SidebarContent className="px-4 py-3.5 space-y-3.5 overflow-y-auto flex-1 overscroll-contain select-none" dir="rtl">
        {/* Quick Summary Pill Bar */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-2.5 shadow-2xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
              <Receipt className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-right min-w-0">
              <span className="text-[9.5px] text-muted-foreground font-bold truncate">إجمالي الفواتير</span>
              <span className="text-xs font-black text-foreground">{totalInvoicesCount} فاتورة</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-2xl border border-border/70 bg-card/60 p-2.5 shadow-2xs">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold shrink-0 border border-purple-500/20">
              <Users className="h-4 w-4" />
            </div>
            <div className="flex flex-col text-right min-w-0">
              <span className="text-[9.5px] text-muted-foreground font-bold truncate">دليل العملاء</span>
              <span className="text-xs font-black text-foreground">{totalCustomersCount} عميل</span>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="flex items-center justify-between px-1 pt-1">
          <span className="text-[11px] font-black text-foreground/80">أقسام التطبيق المعتمدة</span>
          <span className="text-[9.5px] font-bold text-muted-foreground">المس للانتقال المباشر</span>
        </div>

        {/* Navigation Touch Cards */}
        <div className="space-y-2.5">
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
                  {/* Colorful Gradient Icon Box */}
                  <div
                    className={`flex h-9.5 w-9.5 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${gradient} text-white shadow-xs transition-transform group-hover:scale-105`}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>

                  {/* Title & Description */}
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

                {/* Left indicators (Chevron + Badge) */}
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

        {/* Quick Utility Bar inside Drawer */}
        <div className="pt-2.5 border-t border-border/60">
          <span className="text-[10px] font-black text-muted-foreground block mb-2 px-1">
            إجراءات سريعة
          </span>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => {
                playTapSound();
                toggle();
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/60 px-2 text-[11px] font-bold text-foreground hover:bg-card active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
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
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border/70 bg-secondary/60 px-2 text-[11px] font-bold text-foreground hover:bg-card hover:text-primary active:scale-95 transition-all shadow-2xs cursor-pointer touch-manipulation"
            >
              <Lock className="h-4 w-4" />
              <span>قفل التطبيق</span>
            </button>
          </div>
        </div>
      </SidebarContent>

      {/* 3. Footer: Version & Credits */}
      <SidebarFooter className="border-t border-border/60 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] bg-card/80 backdrop-blur-md shrink-0" dir="rtl">
        <div className="rounded-2xl border border-border/70 bg-card p-3 shadow-2xs space-y-2 text-center">
          {/* App Version Tag */}
          <div className="flex items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-mono font-black text-primary">
              <ShieldCheck className="h-3 w-3" />
              {APP_VERSION_INFO.version} • {APP_VERSION_INFO.edition}
            </span>
          </div>

          {/* Developer Credit & Copyright */}
          <div className="space-y-0.5">
            <p className="text-xs font-black text-foreground">
              {APP_VERSION_INFO.developer}
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground">
              {APP_VERSION_INFO.copyright}
            </p>
          </div>

          {/* Database indicator */}
          <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-border/50 text-[9.5px] text-muted-foreground/80">
            <Database className="h-3 w-3 text-emerald-500" />
            <span>قاعدة بيانات الفواتير مشفرة محلياً</span>
          </div>
        </div>
      </SidebarFooter>

      {/* نافذة تعديل بيانات الحساب */}
      <UserProfileDialog
        isOpen={showProfileEdit}
        onClose={() => setShowProfileEdit(false)}
        isFirstLaunch={false}
      />
    </Sidebar>
  );
}
