// @ts-nocheck
/**
 * LicenseBanner.tsx — شريط تنبيه هادئ ومدمج يظهر عند اقتراب انتهاء الترخيص
 * يُعرض تحت شريط الأدوات العلوي داخل غلاف الصفحة
 */

import { Bell, RefreshCw, Loader2, X } from "lucide-react";
import { useState } from "react";

interface Props {
  daysRemaining: number;
  onRenew: () => Promise<{ ok: boolean; message: string }>;
  loading: boolean;
}

export default function LicenseBanner({ daysRemaining, onRenew, loading }: Props) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem("future_license_banner_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [sent, setSent] = useState(false);

  if (dismissed) return null;

  const urgency = daysRemaining <= 1 ? "destructive" : daysRemaining <= 3 ? "warning" : "info";

  const bgClass =
    urgency === "destructive"
      ? "bg-destructive/15 border-destructive/30 text-destructive"
      : urgency === "warning"
        ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
        : "bg-primary/10 border-primary/25 text-primary";

  const handleRenew = async () => {
    const res = await onRenew();
    if (res?.ok) setSent(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem("future_license_banner_dismissed", "true");
    } catch {}
  };

  return (
    <div
      className={`w-full shrink-0 border-b px-3 sm:px-4 py-1.5 transition-all ${bgClass}`}
      dir="rtl"
      role="alert"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Bell className="h-4 w-4 shrink-0 animate-bounce" />
          <p className="text-xs font-black truncate leading-tight">
            {sent
              ? "تم إرسال طلب التجديد — ستُجدَّد تلقائياً"
              : daysRemaining === 0
                ? "ينتهي الترخيص اليوم!"
                : `ينتهي الترخيص خلال ${daysRemaining} ${daysRemaining === 1 ? "يوم" : "أيام"}`}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {!sent && (
            <button
              type="button"
              onClick={handleRenew}
              disabled={loading}
              className="flex items-center gap-1 text-[11px] font-black rounded-lg px-2.5 py-1 transition-all bg-background/80 hover:bg-background border border-current shadow-2xs active:scale-95 btn-tactile interactive"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span>تجديد</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="إغلاق التنبيه"
            className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-background/50 active:scale-95 transition-colors interactive"
          >
            <X className="h-3.5 w-3.5 opacity-70 hover:opacity-100" />
          </button>
        </div>
      </div>
    </div>
  );
}
