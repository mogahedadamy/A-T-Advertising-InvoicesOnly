import { useEffect, useRef, type RefObject } from "react";
import { X, AlertCircle } from "lucide-react";
import type { useOrders } from "@/lib/ordersStore";

interface NotificationPanelProps {
  urgentOrders: ReturnType<typeof useOrders>;
  onClose: () => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export function NotificationPanel({ urgentOrders, onClose, triggerRef }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, triggerRef]);

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
      <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-foreground">
            تنبيهات الفواتير والأعمال
          </span>
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-black",
              urgentOrders.length > 0
                ? "bg-destructive/10 text-destructive"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
            ].join(" ")}
          >
            {urgentOrders.length > 0 ? `${urgentOrders.length} عاجل` : "كل شيء بخير ✓"}
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
                  <p className="text-xs font-black text-foreground">طلب #{o.orderNumber}</p>
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
              كل الأعمال والفواتير تسير بنظام ✓
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
