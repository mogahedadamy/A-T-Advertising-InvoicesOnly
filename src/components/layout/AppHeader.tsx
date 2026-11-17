import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Moon,
  Sun,
  Bell,
  Lock,
  Calendar,
  X,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/hooks/useTheme";
import { useOrders } from "@/lib/ordersStore";
import { triggerOpenTour } from "@/lib/appTourStore";

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
        "absolute left-0 top-full mt-2 w-[min(20rem,calc(100vw-2.5rem))] z-50",
        "rounded-2xl border border-border/80 bg-card",
        "shadow-float animate-slide-up",
        "overflow-hidden backdrop-blur-md",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">
            تنبيهات المشاريع والأعمال
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
              كل الأعمال والمشاريع تسير بنظام ✓
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
  const location = useLocation();
  const pathname = location.pathname;

  const currentSectionInfo = useMemo(() => {
    if (pathname.startsWith("/billing")) return { id: "billing", label: "الفواتير والمطالبات A4" };
    if (pathname.startsWith("/projects")) return { id: "projects", label: "إدارة المشاريع والعمليات" };
    if (pathname.startsWith("/orders")) return { id: "orders", label: "أرشيف الفواتير والسجل" };
    if (pathname.startsWith("/reports")) return { id: "reports", label: "التقارير والمؤشرات المالية" };
    if (pathname.startsWith("/finance")) return { id: "finance", label: "الخزينة والحسابات والتحصيلات" };
    if (pathname.startsWith("/customers")) return { id: "customers", label: "دليل العملاء والحسابات" };
    if (pathname.startsWith("/suppliers")) return { id: "suppliers", label: "دليل الموردين والالتزامات" };
    if (pathname.startsWith("/expenses")) return { id: "expenses", label: "المصروفات التشغيلية والمباشرة" };
    if (pathname.startsWith("/settings")) return { id: "settings", label: "الأمان والنسخ الاحتياطي" };
    return { id: "home", label: "الصفحة الرئيسية" };
  }, [pathname]);
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
        "pt-[max(0.25rem,env(safe-area-inset-top,0px))]",
        "pl-[max(0.75rem,env(safe-area-inset-left,0px))]",
        "pr-[max(0.75rem,env(safe-area-inset-right,0px))]",
      ].join(" ")}
      dir="rtl"
    >
      <div className="flex h-[58px] sm:h-[66px] md:h-[72px] items-center justify-between px-3 sm:px-5 md:px-7 gap-2">

        {/* ── Right: Sidebar trigger + Agency Day/Night Logo + Date ── */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <SidebarTrigger
            aria-label="القائمة الرئيسية"
            className={[
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl sm:rounded-2xl border border-border/60 btn-tactile interactive",
              "bg-secondary/50 text-foreground",
              "hover:bg-card hover:border-primary/40 hover:text-primary",
              "flex items-center justify-center shadow-2xs",
            ].join(" ")}
          />

          {/* شعار الوكالة الرسمي المتكيف مع الوضع الليلي والنهاري في موضعه الطبيعي المعتمد */}
          <Link
            to="/"
            className="flex items-center group btn-tactile interactive py-0.5 active:scale-[0.96] transition-transform duration-100"
            aria-label="الرئيسية — T.A Advertising Solution"
          >
            <img
              key={isDark ? "dark-logo" : "light-logo"}
              src={isDark ? "/ta-logo-white.png" : "/ta-logo.png"}
              alt="T.A Advertising Solution"
              className={[
                "h-[34px] xs:h-[38px] sm:h-[44px] md:h-[48px] w-auto max-w-[130px] sm:max-w-[170px] object-contain",
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

          {/* Desktop date pill */}
          {today && (
            <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5 text-xs font-bold text-muted-foreground mr-1">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <span>{today}</span>
            </div>
          )}
        </div>

        {/* ── Center: Flexible Space ────────────────────────── */}
        <div className="flex-1" />

        {/* ── Left: Actions ─────────────────────────────────── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 pl-1 sm:pl-2">

          {/* Guide / Tour Button — المساعد التعليمي الذكي للقسم الحالي */}
          <button
            type="button"
            onClick={() => {
              triggerOpenTour({ sectionId: currentSectionInfo.id, mode: "context" });
            }}
            aria-label={`المساعد الذكي: ${currentSectionInfo.label}`}
            title={`المساعد الذكي: ${currentSectionInfo.label}`}
            className={[
              "grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border border-border/60",
              "bg-secondary/50 text-foreground active:scale-[0.94] transition-transform duration-100",
              "hover:bg-card hover:text-primary hover:border-primary/40",
              "btn-tactile interactive shadow-2xs cursor-pointer touch-manipulation",
            ].join(" ")}
          >
            <BookOpen className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-primary" />
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => toggle()}
            aria-label={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
            title={isDark ? "الوضع الفاتح" : "الوضع الليلي"}
            className={[
              "grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border border-border/60",
              "bg-secondary/50 text-foreground active:scale-[0.94] transition-transform duration-100",
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
              window.dispatchEvent(new Event("app-lock"));
            }}
            aria-label="قفل التطبيق"
            title="قفل التطبيق"
            className={[
              "grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border border-border/60",
              "bg-secondary/50 text-foreground active:scale-[0.94] transition-transform duration-100",
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
              onClick={() => setShowNotifications((v) => !v)}
              aria-label={`التنبيهات${hasUrgent ? ` — ${urgentOrders.length} عاجل` : ""}`}
              aria-expanded={showNotifications}
              title="التنبيهات"
              className={[
                "relative grid h-9 w-9 sm:h-10 sm:w-10 place-items-center rounded-xl sm:rounded-2xl border btn-tactile interactive shadow-2xs active:scale-[0.94] transition-transform duration-100",
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
