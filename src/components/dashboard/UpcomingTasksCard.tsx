import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Calendar, ChevronLeft, Check, Clock, PlusCircle } from "lucide-react";
import { useOrders } from "@/lib/ordersStore";

export function UpcomingTasksCard() {
  const orders = useOrders();
  const [completedIds, setCompletedIds] = useState<Record<string, boolean>>({});

  const tasks = useMemo(() => {
    // Generate real tasks from active orders
    const activeOrders = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
    return activeOrders.map((o) => {
      const isUrgent = o.priority === "urgent";
      const timeStr = o.deliveryDate
        ? new Date(o.deliveryDate).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
        : "اليوم";

      return {
        id: o.id,
        title: `تسليم طلب #${o.orderNumber} (${o.customerName || "عميل"})`,
        time: `${timeStr} - ${o.items[0]?.description || "أمر طباعة"}`,
        shortTime: timeStr,
        dotColor: isUrgent ? "bg-rose-500" : "bg-blue-500",
        completed: !!completedIds[o.id],
      };
    });
  }, [orders, completedIds]);

  const toggleTask = (id: string) => {
    setCompletedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div
      className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-3.5 sm:p-4 shadow-xs min-h-[300px] md:h-[310px]"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/10 text-blue-500">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-black text-foreground">
              المهام والتسليمات
            </h2>
            <p className="text-[10.5px] text-muted-foreground font-medium">
              {tasks.length === 0
                ? "لا توجد مهام معلقة"
                : pendingCount > 0
                ? `${pendingCount} مهام متبقية اليوم`
                : "جميع المهام مكتملة!"}
            </p>
          </div>
        </div>

        <Link
          to="/orders"
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-primary transition"
        >
          <span>جدول الأوامر</span>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Interactive Task List */}
      <div className="space-y-2 py-1 flex-1 flex flex-col justify-center">
        {tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => toggleTask(task.id)}
            className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all cursor-pointer border ${
              task.completed
                ? "bg-secondary/20 border-transparent opacity-60"
                : "bg-secondary/35 border-border/40 hover:bg-secondary/60 hover:border-border"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-0.5">
              {/* Checkbox button */}
              <button
                type="button"
                aria-label={task.completed ? "إلغاء الإكمال" : "إكمال المهمة"}
                className={`grid h-5 w-5 place-items-center rounded-md border text-xs transition-all ${
                  task.completed
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-border/80 bg-card group-hover:border-primary text-transparent"
                }`}
              >
                <Check className="h-3.5 w-3.5 stroke-[3]" />
              </button>

              <span
                className={`truncate text-xs font-bold transition-all ${
                  task.completed
                    ? "line-through text-muted-foreground"
                    : "text-foreground group-hover:text-primary"
                }`}
              >
                {task.title}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10.5px] text-muted-foreground mr-2">
              <Clock className="h-3 w-3 text-muted-foreground/70" />
              <span className="sm:hidden">{task.shortTime}</span>
              <span className="hidden sm:inline">{task.time}</span>
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-xs text-muted-foreground flex flex-col items-center justify-center gap-2">
            <p>لا توجد مهام تسليم معلقة حالياً</p>
            <span className="text-[10px] text-muted-foreground/75">
              تظهر مواعيد تسليم الأوامر والمهام تلقائياً فور إضافة أوامر عمل جديدة
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
