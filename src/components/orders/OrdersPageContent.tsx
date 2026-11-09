import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  PlusCircle,
  X,
  Flame,
  ChevronLeft,
  Eye,
} from "lucide-react";
import {
  useOrders,
  updateOrderStatus,
  STATUS_CONFIG,
  type OrderStatus,
  type PrintOrder,
} from "@/lib/ordersStore";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import { OrderDetailsDialog } from "./OrderDetailsDialog";

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "كل الطلبات" },
  { key: "printing", label: "قيد الطباعة" },
  { key: "ready_to_print", label: "جاهز للطباعة" },
  { key: "design", label: "تحت التصميم" },
  { key: "finishing", label: "تشطيب وقص" },
  { key: "delivered", label: "تم التسليم" },
];

export function OrdersPageContent() {
  const orders = useOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);

  const filtered = useMemo(() => {
    return (orders || []).filter((o) => {
      if (!o) return false;
      const q = (search || "").trim().toLowerCase();
      const matchSearch =
        !q ||
        (o.orderNumber || "").includes(q) ||
        (o.customerName || "").toLowerCase().includes(q) ||
        (o.customerPhone || "").includes(q) ||
        (o.items || []).some((it) => (it?.description || "").toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || o.status === statusFilter;
      const matchUrgent = !urgentOnly || o.priority === "urgent";

      return matchSearch && matchStatus && matchUrgent;
    });
  }, [orders, search, statusFilter, urgentOnly]);

  const counts = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : [];
    return {
      total: safeOrders.length,
      printing: safeOrders.filter((o) => o?.status === "printing").length,
      ready: safeOrders.filter((o) => o?.status === "ready_to_print").length,
      delivered: safeOrders.filter((o) => o?.status === "delivered").length,
      urgent: safeOrders.filter((o) => o?.priority === "urgent" && o?.status !== "delivered").length,
    };
  }, [orders]);

  const handleStatusChange = (orderId: string, status: OrderStatus) => {
    updateOrderStatus(orderId, status);
    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status });
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-3 space-y-3">
      {/* 1. ترويسة وإحصائيات سريعة */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card p-3.5 shadow-xs border-r-4 border-r-primary">
        <div>
          <h2 className="text-base font-black text-foreground">سجل أوامر التشغيل والإنتاج</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            متابعة خط الإنتاج وحالات ماكينات الطباعة والتسليم ({counts.total} أمر تشغيل)
          </p>
        </div>
        <Link
          to="/calculator"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-black text-primary-foreground shadow-md shadow-primary/25 transition-all active:scale-95 touch-manipulation hover:bg-primary/90"
        >
          <PlusCircle className="h-4 w-4" />
          <span>حاسبة جديدة</span>
        </Link>
      </div>

      {/* 2. مؤشرات سريعة */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-muted-foreground">الإجمالي</span>
          <p className="font-mono text-base font-black text-foreground tabular-nums">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-primary">بالماكينة</span>
          <p className="font-mono text-base font-black text-primary tabular-nums">{counts.printing}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-amber-500">جاهز</span>
          <p className="font-mono text-base font-black text-amber-500 tabular-nums">{counts.ready}</p>
        </div>
        <div className="rounded-2xl border border-border/80 bg-card p-2.5 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-500">تم التسليم</span>
          <p className="font-mono text-base font-black text-emerald-500 tabular-nums">{counts.delivered}</p>
        </div>
      </div>

      {/* 3. صندوق الفرز والبحث */}
      <div className="rounded-2xl border border-border bg-card p-3 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث برقم الأمر، اسم العميل، البيان..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10.5 sm:h-11 w-full rounded-xl border border-border/80 bg-secondary/35 pr-10 pl-9 text-xs sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/60 outline-none transition-all duration-150 focus:bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 touch-manipulation"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute left-3 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-lg bg-secondary text-muted-foreground hover:text-foreground touch-manipulation active:scale-90"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setUrgentOnly(!urgentOnly)}
            className={`inline-flex h-10.5 sm:h-11 items-center gap-1.5 rounded-xl border px-3 text-xs font-black transition-all active:scale-95 touch-manipulation ${
              urgentOnly
                ? "border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400 shadow-xs"
                : "border-border/80 bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Flame className="h-4 w-4" />
            <span>مستعجل</span>
          </button>
        </div>

        {/* ألسنة التبويب */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-t border-border/50 pt-2">
          {TABS.map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 touch-manipulation active:scale-95 ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25 font-black ring-1 ring-primary/40"
                    : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* بطاقات الطلبات */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
          {filtered.length === 0 ? (
            <div className="col-span-full py-10 text-center">
              <p className="text-xs font-bold text-muted-foreground">لا توجد أوامر تشغيل مسجلة</p>
              <Link
                to="/calculator"
                className="inline-flex mt-2 items-center gap-1 text-xs font-black text-primary underline"
              >
                افتح الحاسبة لإنشاء أمر تشغيل جديد
              </Link>
            </div>
          ) : (
            filtered.map((order) => {
              const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
              const isUrgent = order.priority === "urgent";

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className="rounded-2xl border border-border/80 bg-card hover:border-primary/40 p-3.5 shadow-2xs space-y-2 cursor-pointer transition-all active:scale-[0.98] touch-manipulation"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs text-foreground">
                        #{order.orderNumber}
                      </span>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 text-[9.5px] font-black text-rose-500">
                          <Flame className="h-3 w-3" />
                          مستعجل
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-black ${status.bg} ${status.color} ${status.border}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {status.label}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-foreground">{order.customerName}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {order.items[0]?.description || "طلب طباعة"}
                      {order.items[0]?.material ? ` · ${materialLabel(order.items[0].material)}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-2 text-xs">
                    <span className="font-mono font-black text-foreground">
                      {formatNumber(order.totalCost)}{" "}
                      <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
                      <span className="text-[10px] text-muted-foreground mr-1">
                        ({order.totalArea.toFixed(1)} م²)
                      </span>
                    </span>

                    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-primary">
                      <span>عرض</span>
                      <ChevronLeft className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* نافذة تفاصيل الطلب */}
      <OrderDetailsDialog
        order={selectedOrder}
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
}
