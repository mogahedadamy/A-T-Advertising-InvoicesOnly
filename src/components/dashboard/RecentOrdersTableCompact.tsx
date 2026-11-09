import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, ChevronLeft, ArrowUpRight, PlusCircle } from "lucide-react";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import { useOrders, STATUS_CONFIG, type PrintOrder } from "@/lib/ordersStore";
import { OrderQuickViewModal } from "./OrderQuickViewModal";

type FilterType = "all" | "in_progress" | "completed" | "new";

export function RecentOrdersTableCompact() {
  const [selectedOrder, setSelectedOrder] = useState<PrintOrder | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const orders = useOrders();

  const rows = useMemo(() => {
    return orders.map((o, index) => {
      const isDelivered = o.status === "delivered";
      const isNew = o.status === "new";
      const statusLabel = STATUS_CONFIG[o.status]?.label || "جديد";
      const statusClass = isDelivered
        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        : isNew
        ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30"
        : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30";

      const words = (o.customerName || "عميل").trim().split(" ");
      const initials = words.length >= 2 ? `${words[0]?.[0] || ""} ${words[1]?.[0] || ""}` : (words[0]?.[0] || "ع");

      return {
        id: o.id,
        index: index + 1,
        orderNumber: `#${o.orderNumber}`,
        customerName: o.customerName || "عميل بدون اسم",
        jobType: o.items[0]?.description || (o.items[0]?.material ? materialLabel(o.items[0].material) : "") || "أمر طباعة",
        date: o.createdAt ? new Date(o.createdAt).toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "short" }) : "اليوم",
        status: o.status,
        statusLabel,
        statusClass,
        total: o.totalCost || o.paidAmount || 0,
        initials,
        rawOrder: o,
      };
    });
  }, [orders]);

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    if (activeFilter === "completed") return rows.filter((r) => r.status === "delivered");
    if (activeFilter === "new") return rows.filter((r) => r.status === "new");
    return rows.filter((r) => r.status !== "delivered" && r.status !== "cancelled" && r.status !== "new");
  }, [rows, activeFilter]);

  return (
    <>
      <div
        className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs min-h-[300px] md:h-[310px]"
        dir="rtl"
      >
        {/* Header with Title and Filter Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-black text-foreground">
                أحدث طلبات التشغيل
              </h2>
            </div>

            <Link
              to="/orders"
              className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition sm:hidden"
            >
              <span>الكل</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeFilter === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              الكل ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("in_progress")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeFilter === "in_progress"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              قيد التنفيذ
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("completed")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeFilter === "completed"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              مكتمل
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("new")}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                activeFilter === "new"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
              }`}
            >
              جديد
            </button>

            <Link
              to="/orders"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition mr-2"
            >
              <span>سجل الأوامر</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 1. Mobile Feed (Card view) for screens < md */}
        <div className="block md:hidden divide-y divide-border/40 overflow-y-auto max-h-[230px] scrollbar-none pt-1">
          {filteredRows.map((row) => (
            <div
              key={row.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedOrder(row.rawOrder)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedOrder(row.rawOrder);
                }
              }}
              className="py-2.5 px-1 flex flex-col gap-1.5 hover:bg-secondary/30 active:bg-secondary/50 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary text-[10px] font-black shrink-0">
                    {row.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-black text-primary">
                        {row.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-foreground truncate">
                        {row.customerName}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${row.statusClass}`}
                >
                  {row.statusLabel}
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-muted-foreground pr-9">
                <div className="flex items-center gap-2 min-w-0 truncate">
                  <span className="truncate">{row.jobType}</span>
                  <span>·</span>
                  <span className="font-mono text-[10px]">{row.date}</span>
                </div>
                <div className="font-mono font-bold text-foreground shrink-0 flex items-center gap-1">
                  <span>{formatNumber(row.total)}</span>
                  <span className="text-[9.5px] font-normal text-muted-foreground">ج.س</span>
                  <ArrowUpRight className="h-3 w-3 text-muted-foreground/60" />
                </div>
              </div>
            </div>
          ))}

          {filteredRows.length === 0 && (
            <div className="text-center py-8 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
              <p>لا توجد طلبات تشغيل مسجلة حالياً</p>
              <Link
                to="/calculator"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>إصدار أمر شغل جديد</span>
              </Link>
            </div>
          )}
        </div>

        {/* 2. Desktop Table view for md: and up */}
        <div className="hidden md:block overflow-x-auto scrollbar-none h-[220px]">
          {filteredRows.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-muted-foreground gap-2">
              <p>لا توجد طلبات تشغيل مسجلة بعد في النظام</p>
              <Link
                to="/calculator"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>إنشاء أول أمر شغل من الحاسبة</span>
              </Link>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-border/60 text-[10.5px] font-bold text-muted-foreground">
                  <th className="py-2.5 pr-2 font-mono">#</th>
                  <th className="py-2.5 px-2">رقم الطلب</th>
                  <th className="py-2.5 px-2">اسم العميل</th>
                  <th className="py-2.5 px-2">نوع الطلب</th>
                  <th className="py-2.5 px-2">تاريخ الطلب</th>
                  <th className="py-2.5 px-2 text-center">الحالة</th>
                  <th className="py-2.5 pl-2 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-medium">
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-secondary/40 transition-colors cursor-pointer group"
                    onClick={() => setSelectedOrder(row.rawOrder)}
                  >
                    <td className="py-2.5 pr-2 font-mono text-[10.5px] text-muted-foreground">
                      {row.index}
                    </td>
                    <td className="py-2.5 px-2 font-mono font-bold text-primary group-hover:underline">
                      {row.orderNumber}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-foreground truncate max-w-[150px]">
                      <div className="flex items-center gap-1.5">
                        <span className="grid h-5 w-5 place-items-center rounded-md bg-secondary text-[9px] font-black shrink-0">
                          {row.initials}
                        </span>
                        <span className="truncate">{row.customerName}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground truncate max-w-[120px]">
                      {row.jobType}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-[10.5px] text-muted-foreground">
                      {row.date}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${row.statusClass}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-left font-mono font-bold text-foreground">
                      {formatNumber(row.total)}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">ج.س</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <OrderQuickViewModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </>
  );
}
