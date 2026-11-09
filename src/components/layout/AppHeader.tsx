import { useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  Moon,
  Sun,
  Bell,
  Lock,
  Calendar,
  X,
  AlertCircle,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";
import { useOrders } from "@/lib/ordersStore";
import { playTapSound } from "@/lib/soundEffects";
import { HeaderTrialCountdown } from "@/components/common/TrialCountdownBadge";

/* ─── Date formatter ──────────────────────────────────────────── */
const dateFmt = new Intl.DateTimeFormat("ar", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/* ─── Notification Dropdown ───────────────────────────────────── */
interface NotificationPanelProps {
  urgentOrders: ReturnType<typeof useOrders>;
  onClose: () => void;
}

function NotificationPanel({ urgentOrders, onClose }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      dir="rtl"
      role="dialog"
      aria-label="لوحة التنبيهات"
      className={[
        "absolute left-0 top-full mt-2 w-[min(20rem,calc(100vw-1.5rem))] z-50",
        "rounded-2xl border border-border/80 bg-card",
        "shadow-float animate-slide-up",
        "overflow-hidden backdrop-blur-md",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">
            تنبيهات الإنتاج
          </span>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-black",
              urgentOrders.length > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            ].join(" ")}
          >
            {urgentOrders.length > 0
              ? `${urgentOrders.length} عاجل`
              : "كل شيء بخير ✓"}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق التنبيهات"
          className="grid h-7 w-7 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors interactive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        {urgentOrders.length > 0 ? (
          <div className="divide-y divide-border/40">
            {urgentOrders.map((o) => (
              <div
                key={o.id}
                className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <AlertCircle className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-black text-foreground">
                    طلب #{o.orderNumber}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {o.customerName || "عميل غير محدد"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 px-4 text-center">
            <span className="text-2xl">👍</span>
            <p className="text-xs font-bold text-muted-foreground">
              جميع أوامر الشغل تم تسليمها بنجاح
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── AppHeader ───────────────────────────────────────────────── */
export function AppHeader() {
  const { theme, toggle } = useTheme();
  const orders = useOrders();
  const [showNotifications, setShowNotifications] = useState(false);
  const [today, setToday] = useState("");

  useEffect(() => {
    try {
      setToday(dateFmt.format(new Date()));
    } catch {
      // fallback — keep empty
    }
  }, []);

  const urgentOrders = orders.filter(
    (o) => o?.priority === "urgent" && o?.status !== "delivered"
  );

  const isDark = theme === "dark";
  const hasUrgent = urgentOrders.length > 0;

  return (
    <header
      className={[
        "shrink-0 z-20 select-none",
        "border-b border-border/60",
        "bg-nav-bar/95 backdrop-blur-xl",
        "shadow-[0_1px_0_hsl(var(--border)/0.4),0_4px_16px_-4px_hsl(0_0%_0%/0.06)]",
        "pt-[env(safe-area-inset-top,0px)]",
        "pl-[env(safe-area-inset-left,0px)]",
        "pr-[env(safe-area-inset-right,0px)]",
      ].join(" ")}
      dir="rtl"
    >
      <div className="flex h-[58px] sm:h-[66px] md:h-[72px] items-center justify-between px-2.5 sm:px-4 md:px-6 gap-1.5 sm:gap-2">

        {/* ── Right: Sidebar trigger + Top Countdown Timer + date ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <SidebarTrigger
            aria-label="القائمة الرئيسية"
            className={[
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl border border-border/60 btn-tactile interactive",
              "bg-secondary/50 text-foreground",
              "hover:bg-card hover:border-primary/40 hover:text-primary",
              "flex items-center justify-center shadow-2xs",
            ].join(" ")}
          />

          {/* عداد المهلة الصغير أعلى التطبيق بتصميم متناسق وجميل */}
          <HeaderTrialCountdown />

          {/* Desktop date pill */}
          {today && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5 text-xs font-bold text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{today}</span>
            </div>
          )}
        </div>

        {/* ── Center: Logo ──────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-center px-1 sm:px-2">
          <Link
            to="/calculator"
            onClick={() => playTapSound()}
            className="flex items-center justify-center group btn-tactile interactive py-0.5"
            aria-label="الرئيسية — A-T-Advertising"
          >
            <img
              key={isDark ? "dark-logo" : "light-logo"}
              src={isDark ? "/ta-logo-white.png" : "/ta-logo.png"}
              alt="A-T-Advertising"
              className={[
                "h-[38px] xs:h-[42px] sm:h-[48px] md:h-[54px] w-auto max-h-full object-contain",
                "transition-all duration-300",
                "drop-shadow-xs group-hover:scale-[1.03]",
                "group-active:scale-[0.97]",
              ].join(" ")}
              loading="eager"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src.includes("white")) img.src = "/ta-logo.png";
              }}
            />
          </Link>
        </div>

        {/* ── Left: Actions ─────────────────────────────────── */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => { playTapSound(); toggle(); }}
            aria-label={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
            title={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
            className={[
              "grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border border-border/60",
              "bg-secondary/50 text-foreground",
              "hover:bg-card hover:border-primary/30",
              "btn-tactile interactive shadow-2xs",
            ].join(" ")}
          >
            {isDark ? (
              <Sun className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-primary" />
            )}
          </button>

          {/* Lock */}
          <button
            type="button"
            onClick={() => {
              playTapSound();
              window.dispatchEvent(new Event("app-lock"));
            }}
            aria-label="قفل التطبيق"
            title="قفل التطبيق"
            className={[
              "grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border border-border/60",
              "bg-secondary/50 text-foreground",
              "hover:bg-card hover:text-primary hover:border-primary/30",
              "btn-tactile interactive shadow-2xs",
            ].join(" ")}
          >
            <Lock className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              type="button"
              onClick={() => { playTapSound(); setShowNotifications((v) => !v); }}
              aria-label={`التنبيهات${hasUrgent ? ` — ${urgentOrders.length} عاجل` : ""}`}
              aria-expanded={showNotifications}
              title="التنبيهات"
              className={[
                "relative grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border btn-tactile interactive shadow-2xs",
                hasUrgent
                  ? "border-destructive/30 bg-destructive/8 text-destructive"
                  : "border-border/60 bg-secondary/50 text-foreground hover:bg-card hover:border-primary/30",
              ].join(" ")}
            >
              <Bell className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              {hasUrgent && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-black text-white ring-2 ring-background animate-pulse"
                >
                  {urgentOrders.length}
                </span>
              )}
            </button>

            {showNotifications && (
              <NotificationPanel
                urgentOrders={urgentOrders}
                onClose={() => setShowNotifications(false)}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
