import {
  Calculator,
  ClipboardList,
  Receipt,
  Settings as SettingsIcon,
} from "lucide-react";
import { Link, useMatchRoute } from "@tanstack/react-router";
import { playTapSound } from "@/lib/soundEffects";

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  /** تُطابق هذه المسارات أيضاً كـ active */
  also?: string[];
  isFAB?: boolean;
}

/**
 * شريط التنقل السفلي المخصص للإصدار النقي:
 * 1. الحاسبة والتسعير (الميزة الأساسية)
 * 2. الفواتير والمطالبات
 * 3. سجل الفواتير وأوامر الشغل
 * 4. الإعدادات والأمان
 */
const NAV_ITEMS: NavItem[] = [
  {
    to: "/calculator",
    label: "الحاسبة",
    icon: Calculator,
    also: ["/"],
  },
  {
    to: "/billing",
    label: "الفواتير",
    icon: Receipt,
  },
  {
    to: "/orders",
    label: "الأرشيف",
    icon: ClipboardList,
    also: ["/invoices"],
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
      onClick={() => playTapSound()}
      aria-label={item.label}
      aria-current={isActive ? "page" : undefined}
      className={[
        "relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 min-h-[48px] justify-center",
        "interactive btn-tactile transition-all duration-200 touch-manipulation",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {/* Active pill background */}
      {isActive && (
        <span
          className="absolute inset-x-2 inset-y-1 rounded-xl bg-primary/10 border border-primary/20 animate-fade-blur"
          aria-hidden="true"
        />
      )}

      {/* Icon container */}
      <span
        className={[
          "relative z-10 flex h-6 w-6 items-center justify-center transition-transform duration-200",
          isActive ? "scale-110 animate-nav-pop text-primary" : "scale-100",
        ].join(" ")}
      >
        <item.icon
          className={[
            "h-5 w-5 transition-all duration-200",
            isActive ? "stroke-[2.5px]" : "stroke-2",
          ].join(" ")}
        />
      </span>

      {/* Label */}
      <span
        className={[
          "relative z-10 text-[10px] tracking-tight leading-none transition-colors",
          isActive ? "font-black text-primary" : "font-medium text-muted-foreground",
        ].join(" ")}
      >
        {item.label}
      </span>
    </Link>
  );
}

/** شريط التنقل السفلي المتطور — مخصص حصرياً للميزات المعتمدة */
export function BottomNav() {
  return (
    <nav
      aria-label="التنقل الرئيسي للتطبيق"
      dir="rtl"
      className={[
        /* Layout & sizing */
        "shrink-0 z-20 md:hidden",
        /* Glass background */
        "border-t border-border/60 bg-nav-bar/95 backdrop-blur-xl",
        /* Safe area for iOS & Android */
        "pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]",
        "pl-[max(0.5rem,env(safe-area-inset-left,0px))]",
        "pr-[max(0.5rem,env(safe-area-inset-right,0px))]",
        /* Shadow above */
        "shadow-[0_-1px_0_hsl(var(--border)/0.5),0_-8px_24px_-4px_hsl(0_0%_0%/0.06)]",
      ].join(" ")}
    >
      {/* Navigation items row */}
      <div className="mx-auto flex max-w-md items-end justify-around px-2 pt-1 pb-1">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.to} item={item} />
        ))}
      </div>
    </nav>
  );
}
