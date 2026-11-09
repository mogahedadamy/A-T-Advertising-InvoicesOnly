import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Search,
  Flame,
  CheckCircle2,
  Clock,
  Printer,
  ChevronLeft,
  X,
  FileText,
  Eye,
  Phone,
  Filter,
} from "lucide-react";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import {
  useOrders,
  updateOrderStatus,
  STATUS_CONFIG,
  type OrderStatus,
  type PrintOrder,
} from "@/lib/ordersStore";
import { toast } from "sonner";
import { OrderQuickViewModal } from "./OrderQuickViewModal";

const NEXT_ACTION_CONFIG: Partial<
  Record<OrderStatus, { label: string; nextStatus: OrderStatus; icon: typeof ChevronLeft; btnClass: string }>
> = {
  new: {
    label: "بدء التصميم",
    nextStatus: "design",
    icon: ChevronLeft,
    btnClass: "border-purple-500/40 text-purple-600 dark:text-purple-400 hover:bg-purple-600 hover:text-white",
  },
  design: {
    label: "اعتماد للطباعة",
    nextStatus: "ready_to_print",
    icon: ChevronLeft,
    btnClass: "border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-600 hover:text-white",
  },
  ready_to_print: {
    label: "إرسال للماكينة",
    nextStatus: "printing",
    icon: Printer,
    btnClass: "border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground",
  },
  printing: {
    label: "نقل للتشطيب",
    nextStatus: "finishing",
    icon: ChevronLeft,
    btnClass: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white",
  },
  finishing: {
    label: "تسليم للعميل",
    nextStatus: "delivered",
    icon: CheckCircle2,
    btnClass: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white",
  },
};

const FILTER_TABS: { key: string; label: string }[] = [
  { key: "all", label: "كل الأوامر" },
  { key: "printing", label: "قيد الطباعة" },
  { key: "ready_to_print", label: "جاهز للطباعة" },
  { key: "finishing", label: "تشطيب وقص" },
  { key: "delivered", label: "تم التسليم" },
];

export function RecentOrders() {
  const orders = useOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "pending">("all");
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);

  // حساب أعداد الحالات للشريط التفاعلي
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      counts[o.status] = (counts[o.status] || 0) + 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = (search || "").trim().toLowerCase();
      const matchSearch =
        !q ||
        o.orderNumber.includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.items.some((it) => it.description.toLowerCase().includes(q));

      const matchStatus = statusFilter === "all" || o.status === statusFilter;

      const isPaid = o.paidAmount >= o.totalCost;
      const matchPayment =
        paymentFilter === "all" ||
        (paymentFilter === "paid" && isPaid) ||
        (paymentFilter === "pending" && !isPaid);

      return matchSearch && matchStatus && matchPayment;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const handleNextStatus = (order: PrintOrder, nextStatus: OrderStatus) => {
    updateOrderStatus(order.id, nextStatus);
    const target = STATUS_CONFIG[nextStatus]?.label || nextStatus;
    toast.success(`تم تحويل الطلب #${order.orderNumber} إلى: ${target}`);
  };

  return (
    <>
      <section
        aria-label="أحدث أوامر الشغل"
        className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm md:p-5"
        dir="rtl"
      >
        {/* 1. رأس الجدول وأدوات التصفية والبحث المتقدم */}
        <div className="flex flex-col gap-3.5 pb-4 border-b border-border/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black text-foreground md:text-lg">
                أحدث أوامر الشغل
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-black text-primary">
                {filteredOrders.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* تصفية السداد السريعة */}
              <div className="hidden sm:flex items-center gap-1 rounded-xl border border-border/70 bg-secondary/50 p-0.5 text-[11px] font-bold">
                <button
                  onClick={() => setPaymentFilter("all")}
                  className={`rounded-lg px-2 py-0.5 transition ${paymentFilter === "all" ? "bg-card text-foreground shadow-xs font-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  الكل
                </button>
                <button
                  onClick={() => setPaymentFilter("pending")}
                  className={`rounded-lg px-2 py-0.5 transition ${paymentFilter === "pending" ? "bg-card text-rose-600 dark:text-rose-400 shadow-xs font-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  آجل ومتبقي
                </button>
                <button
                  onClick={() => setPaymentFilter("paid")}
                  className={`rounded-lg px-2 py-0.5 transition ${paymentFilter === "paid" ? "bg-card text-emerald-600 dark:text-emerald-400 shadow-xs font-black" : "text-muted-foreground hover:text-foreground"}`}
                >
                  مسدد
                </button>
              </div>

              <Link
                to="/orders"
                className="inline-flex items-center gap-1 text-xs font-black text-primary hover:text-primary-deep transition"
              >
                <span>عرض كل الطلبات</span>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Search & Tabs */}
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث برقم الطلب، اسم العميل، الهاتف، البيان..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-secondary/40 pr-9 pl-8 text-xs font-bold text-foreground placeholder:text-muted-foreground/60 outline-none transition focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary shadow-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filter Tabs With Live Badges */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {FILTER_TABS.map((tab) => {
                const active = statusFilter === tab.key;
                const count = statusCounts[tab.key] ?? 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-sm scale-102"
                        : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 font-mono text-[9.5px] ${
                        active
                          ? "bg-white/20 text-white"
                          : "bg-muted text-foreground/80"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. جدول أوامر الشغل على الشاشات المتوسطة والكبيرة */}
        <div className="mt-2 hidden md:block overflow-x-auto">
          {filteredOrders.length === 0 ? (
            <div className="py-14 text-center space-y-1.5">
              <p className="text-sm font-black text-foreground">لا توجد أوامر شغل تطابق معايير البحث</p>
              <p className="text-xs text-muted-foreground">جرب البحث بكلمة أخرى أو تغيير تصفية الحالات</p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border/70 text-[11px] font-black text-muted-foreground">
                  <th className="py-3 pr-2.5">رقم الطلب</th>
                  <th className="py-3 px-3">العميل</th>
                  <th className="py-3 px-3">البيان والمقاس</th>
                  <th className="py-3 px-3">الخامة والمساحة</th>
                  <th className="py-3 px-3">المبلغ والسداد</th>
                  <th className="py-3 px-3">حالة التنفيذ</th>
                  <th className="py-3 pl-2.5 text-center">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredOrders.map((order) => {
                  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
                  const nextAction = NEXT_ACTION_CONFIG[order.status];
                  const isUrgent = order.priority === "urgent";
                  const isPaid = order.paidAmount >= order.totalCost;
                  const remaining = Math.max(0, order.totalCost - order.paidAmount);
                  const firstItem = order.items[0];

                  return (
                    <tr
                      key={order.id}
                      className="group transition-colors hover:bg-secondary/30"
                    >
                      {/* رقم الطلب */}
                      <td className="py-3.5 pr-2.5 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="font-black text-foreground hover:text-primary transition text-sm flex items-center gap-1"
                            title="معاينة تفاصيل أمر الشغل"
                          >
                            <span>#{order.orderNumber}</span>
                          </button>
                          {isUrgent && (
                            <span
                              title="طلب مستعجل"
                              className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[9px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            >
                              <Flame className="h-2.5 w-2.5" />
                              مستعجل
                            </span>
                          )}
                        </div>
                      </td>

                      {/* العميل */}
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-foreground truncate max-w-[140px]">
                          {order.customerName}
                        </p>
                        {order.customerPhone && (
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="text-[10px] text-muted-foreground hover:text-primary font-mono inline-flex items-center gap-1"
                            dir="ltr"
                          >
                            <Phone className="h-2.5 w-2.5 opacity-70" />
                            <span>{order.customerPhone}</span>
                          </a>
                        )}
                      </td>

                      {/* البيان والمقاس */}
                      <td className="py-3.5 px-3">
                        <p className="font-bold text-foreground truncate max-w-[160px]">
                          {firstItem?.description || "بند طباعة"}
                        </p>
                        <p className="text-[10.5px] font-mono text-muted-foreground">
                          {firstItem ? `${firstItem.width} × ${firstItem.height} سم` : "—"}
                          {firstItem && firstItem.qty > 1 && ` (${firstItem.qty} قطع)`}
                        </p>
                      </td>

                      {/* الخامة والمساحة */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-block rounded-md bg-secondary/80 px-2 py-0.5 text-[10.5px] font-bold text-foreground">
                            {materialLabel(firstItem?.material || "flex")}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-foreground">
                            {order.totalArea.toFixed(1)} م²
                          </span>
                        </div>
                      </td>

                      {/* المبلغ والسداد */}
                      <td className="py-3.5 px-3 font-mono">
                        <div className="font-black text-foreground text-sm">
                          {formatNumber(order.totalCost)}{" "}
                          <span className="text-[9px] font-normal text-muted-foreground">ج.س</span>
                        </div>
                        <div>
                          {isPaid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              مسدد بالكامل
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              متبقي {formatNumber(remaining)} ج.س
                            </span>
                          )}
                        </div>
                      </td>

                      {/* حالة التنفيذ */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black ${status.bg} ${status.color} ${status.border}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                          {status.label}
                        </span>
                      </td>

                      {/* الإجراء المباشر والمعاينة */}
                      <td className="py-3.5 pl-2.5 text-center">
                        <div className="inline-flex items-center gap-1.5">
                          {nextAction ? (
                            <button
                              onClick={() => handleNextStatus(order, nextAction.nextStatus)}
                              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border bg-card px-3 py-1.5 text-xs font-black transition shadow-xs active:scale-95 ${nextAction.btnClass}`}
                            >
                              <span>{nextAction.label}</span>
                              <nextAction.icon className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-4 w-4" />
                              مكتمل
                            </span>
                          )}

                          <button
                            onClick={() => setSelectedOrder(order)}
                            title="معاينة تفاصيل أمر الشغل"
                            className="grid h-8 w-8 place-items-center rounded-xl border border-border/80 bg-secondary/50 text-muted-foreground hover:bg-card hover:text-primary transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 3. بطاقات الهاتف الذكي (Mobile Cards) */}
        <div className="mt-3 space-y-2.5 md:hidden">
          {filteredOrders.length === 0 ? (
            <div className="py-8 text-center text-xs font-bold text-muted-foreground">
              لا توجد أوامر شغل تطابق البحث
            </div>
          ) : (
            filteredOrders.map((order) => {
              const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
              const nextAction = NEXT_ACTION_CONFIG[order.status];
              const isUrgent = order.priority === "urgent";
              const isPaid = order.paidAmount >= order.totalCost;
              const remaining = Math.max(0, order.totalCost - order.paidAmount);
              const firstItem = order.items[0];

              return (
                <div
                  key={order.id}
                  className="rounded-2xl border border-border bg-card p-3.5 space-y-2.5 shadow-xs"
                >
                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="font-mono font-black text-foreground text-sm hover:text-primary"
                      >
                        #{order.orderNumber}
                      </button>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[9px] font-black text-rose-600 border border-rose-500/20">
                          <Flame className="h-2.5 w-2.5" />
                          مستعجل
                        </span>
                      )}
                    </div>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-black ${status.bg} ${status.color} ${status.border}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-start justify-between text-xs">
                    <div>
                      <p className="font-bold text-foreground">{order.customerName}</p>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">
                        {firstItem?.description || "طلب طباعة"} · {materialLabel(firstItem?.material || "flex")} ({order.totalArea.toFixed(1)} م²)
                      </p>
                    </div>
                    <div className="text-left font-mono">
                      <p className="font-black text-foreground text-sm">
                        {formatNumber(order.totalCost)} ج.س
                      </p>
                      <p className={`text-[10px] font-bold ${isPaid ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isPaid ? "مسدد بالكامل" : `متبقي ${formatNumber(remaining)}`}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                    {nextAction && (
                      <button
                        onClick={() => handleNextStatus(order, nextAction.nextStatus)}
                        className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border bg-card py-2 text-xs font-black transition active:scale-95 ${nextAction.btnClass}`}
                      >
                        <span>{nextAction.label}</span>
                        <nextAction.icon className="h-3.5 w-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-secondary text-foreground hover:bg-card"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* نافذة المعاينة السريعة للطلب دون مغادرة الصفحة */}
      <OrderQuickViewModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}
