import { Activity } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";

export function SystemStatusFooter() {
  const orders = useOrders();
  const count = orders.length;

  return (
    <footer
      className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground px-1 pb-1"
      dir="rtl"
    >
      {/* Right side (RTL start) */}
      <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-600 dark:text-emerald-400">
        <Activity className="h-3 w-3 animate-pulse" />
        <span>النظام يعمل بشكل طبيعي</span>
      </div>

      {/* Center Branding */}
      <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <span>T.A Advertising Solution</span>
        <span>·</span>
        <span className="font-bold text-primary">Powered by NilePrint ERP</span>
      </div>

      {/* Left side (RTL end) */}
      <div className="flex items-center gap-1.5 font-bold text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <span>إجمالي الطلبات اليوم: {count} {count === 1 ? "طلب" : "طلبات"}</span>
      </div>
    </footer>
  );
}
