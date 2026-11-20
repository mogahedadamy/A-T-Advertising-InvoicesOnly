import React from "react";
import {
  Home,
  Receipt,
  Users,
  ClipboardList,
  Settings as SettingsIcon,
} from "lucide-react";
import { Link, useMatchRoute } from "@tanstack/react-router";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  /** تطابق هذه المسارات أيضاً كـ active */
  also?: string[];
}

/**
 * شريط التنقل السفلي الرئيسي لوكالة T.A Advertising Solution:
 * 5 أقسام رئيسية متناسقة ومريحة للمستخدم:
 * 1. الرئيسية (الوصول السريع والوحدات الشاملة)
 * 2. الفواتير (إصدار فواتير المبيعات والمشتريات وعروض الأسعار A4)
 * 3. العملاء (دليل العملاء وكشوف حساباتهم)
 * 4. الأرشيف (سجل الفواتير الموحد والطباعة والتصدير)
 * 5. الإعدادات (الأمان والبصمة والنسخ الاحتياطي)
 * 
 * ملاحظة: تم إبقاء "التقارير" حصرياً داخل شبكة الصفحة الرئيسية كأيقونة رئيسية منعاً للاكتظاظ
 */
const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "الرئيسية",
    icon: Home,
  },
  {
    to: "/billing",
    label: "الفواتير",
    icon: Receipt,
  },
  {
    to: "/customers",
    label: "العملاء",
    icon: Users,
  },
  {
    to: "/orders",
    label: "الأرشيف",
    icon: ClipboardList,
  },
  {
    to: "/settings",
    label: "الإعدادات",
    icon: SettingsIcon,
  },
];

function NavButton({ item }: { item: NavItem }) {
  const matchRoute = useMatchRoute();
  const isActive =
    Boolean(matchRoute({ to: item.to })) ||
    (item.also?.some((p) => Boolean(matchRoute({ to: p }))) ?? false);

  return (
    <Link
      to={item.to}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={[
        "relative flex flex-1 min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 min-h-[52px]",
        "interactive btn-tactile transition-all duration-150 touch-manipulation select-none active:scale-[0.94]",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {/* مؤشر القمة النشط الراقي */}
      {isActive && (
        <span
          className="absolute -top-[1px] inset-x-3 sm:inset-x-4 h-[2.5px] rounded-full bg-primary shadow-[0_1px_6px_rgba(22,128,99,0.6)]"
          aria-hidden="true"
        />
      )}

      {/* خلفية الكبسولة النشطة */}
      {isActive && (
        <span
          className="absolute inset-x-1 inset-y-1 rounded-xl bg-primary/10 border border-primary/20 transition-opacity duration-150 ease-out"
          aria-hidden="true"
        />
      )}

      {/* حاوية الأيقونة */}
      <span
        className={[
          "relative z-10 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center transition-transform duration-150",
          isActive ? "scale-105 text-primary" : "scale-100 text-muted-foreground",
        ].join(" ")}
      >
        <item.icon
          className={[
            "h-5 w-5 sm:h-[22px] sm:w-[22px] transition-all duration-150",
            isActive ? "stroke-[2.4px]" : "stroke-2",
          ].join(" ")}
        />
      </span>

      {/* التسمية التوضيحية */}
      <span
        className={[
          "relative z-10 text-[10.5px] sm:text-[11.5px] tracking-tight leading-none whitespace-nowrap transition-colors",
          isActive ? "font-black text-primary" : "font-semibold text-muted-foreground/90",
        ].join(" ")}
      >
        {item.label}
      </span>
    </Link>
  );
}

/** شريط التنقل السفلي المتطور — 5 أقسام رئيسية متناسقة تضمن تجربة مستخدم رحبة وسلسة */
export function BottomNav() {
  return (
    <nav
      aria-label="التنقل الرئيسي للتطبيق"
      dir="rtl"
      className={[
        "shrink-0 z-20 md:hidden relative",
        "border-t border-border/70 bg-card/98 dark:bg-[#071914]/98 backdrop-blur-xl",
        "pb-[max(0.6rem,env(safe-area-inset-bottom,0px))]",
        "pl-[max(0.5rem,env(safe-area-inset-left,0px))]",
        "pr-[max(0.5rem,env(safe-area-inset-right,0px))]",
        "shadow-[0_-4px_20px_rgba(0,0,0,0.06)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.45)]",
      ].join(" ")}
    >
      <div className="mx-auto flex max-w-md items-center justify-between px-1.5 pt-1.5 pb-1 gap-1">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}
