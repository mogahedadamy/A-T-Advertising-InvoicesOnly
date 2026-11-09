import { X, Phone, Printer, CheckCircle2, ChevronLeft, Clock, Flame, FileText, Layers, Calendar, Tag } from "lucide-react";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import {
  STATUS_CONFIG,
  updateOrderStatus,
  type PrintOrder,
  type OrderStatus,
} from "@/lib/ordersStore";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface OrderQuickViewModalProps {
  order: PrintOrder | null;
  onClose: () => void;
}

const NEXT_STAGE_MAP: Partial<
  Record<OrderStatus, { label: string; nextStatus: OrderStatus; icon: typeof ChevronLeft; color: string }>
> = {
  new: { label: "بدء التصميم", nextStatus: "design", icon: ChevronLeft, color: "bg-purple-600 hover:bg-purple-700 text-white" },
  design: { label: "اعتماد للطباعة", nextStatus: "ready_to_print", icon: ChevronLeft, color: "bg-amber-600 hover:bg-amber-700 text-white" },
  ready_to_print: { label: "إرسال لماكينة الطباعة", nextStatus: "printing", icon: Printer, color: "bg-primary hover:bg-primary-deep text-white" },
  printing: { label: "نقل إلى التشطيب والقص", nextStatus: "finishing", icon: ChevronLeft, color: "bg-indigo-600 hover:bg-indigo-700 text-white" },
  finishing: { label: "تسليم للعميل بالكامل", nextStatus: "delivered", icon: CheckCircle2, color: "bg-emerald-600 hover:bg-emerald-700 text-white" },
};

export function OrderQuickViewModal({ order, onClose }: OrderQuickViewModalProps) {
  if (!order) return null;

  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
  const nextStage = NEXT_STAGE_MAP[order.status];
  const isPaid = order.paidAmount >= order.totalCost;
  const remaining = Math.max(0, order.totalCost - order.paidAmount);
  const isUrgent = order.priority === "urgent";

  const handleAdvance = (next: OrderStatus) => {
    updateOrderStatus(order.id, next);
    const targetLabel = STATUS_CONFIG[next]?.label || next;
    toast.success(`تم تحديث الطلب #${order.orderNumber} إلى: ${targetLabel}`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between border-b border-border/80 bg-secondary/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-lg font-black text-foreground">
              طلب #{order.orderNumber}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-black text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <Flame className="h-3 w-3" />
                مستعجل
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10.5px] font-black ${status.bg} ${status.color} ${status.border}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status.label}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-5 space-y-4">
          {/* Customer & Order Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer Info */}
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">بيانات العميل</span>
              <p className="text-sm font-black text-foreground">{order.customerName}</p>
              {order.customerPhone ? (
                <a
                  href={`tel:${order.customerPhone}`}
                  className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-primary hover:underline"
                  dir="ltr"
                >
                  <Phone className="h-3 w-3" />
                  <span>{order.customerPhone}</span>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">لا يوجد هاتف مسجل</p>
              )}
              <div className="pt-1 flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                <span className="rounded bg-secondary px-1.5 py-0.5">فئة: {order.clientType || "نقدي"}</span>
                <span>·</span>
                <span>فرع {order.branch || "الرئيسي"}</span>
              </div>
            </div>

            {/* Financial Status Summary */}
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-3.5 space-y-1.5">
              <span className="text-[10px] font-bold text-muted-foreground">الحساب والسداد</span>
              <div className="flex items-baseline gap-1 font-mono">
                <span className="text-xl font-black text-foreground">{formatNumber(order.totalCost)}</span>
                <span className="text-xs font-bold text-muted-foreground">ج.س</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                <span className="text-muted-foreground text-[11px]">المدفوع: {formatNumber(order.paidAmount)} ج.س</span>
                {isPaid ? (
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" />
                    مسدد بالكامل
                  </span>
                ) : (
                  <span className="font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                    متبقي: {formatNumber(remaining)} ج.س
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-border/80 overflow-hidden">
            <div className="bg-secondary/50 px-3.5 py-2 flex items-center justify-between border-b border-border/70">
              <span className="text-xs font-black text-foreground">بنود أمر الشغل ({order.items.length})</span>
              <span className="text-[11px] font-mono font-bold text-muted-foreground">
                إجمالي المساحة: {order.totalArea.toFixed(2)} م²
              </span>
            </div>

            <div className="divide-y divide-border/60 text-xs">
              {order.items.map((item, idx) => (
                <div key={item.id || idx} className="p-3.5 space-y-1.5 hover:bg-secondary/20 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-foreground text-[13px]">{item.description || `بند رقم ${idx + 1}`}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                        <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                          {materialLabel(item.material)}
                        </span>
                        <span className="font-mono">
                          المقاس: {item.width} × {item.height} سم
                        </span>
                        <span className="font-bold">
                          العدد: {item.qty} قطعة
                        </span>
                        {item.rollUsed && (
                          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">
                            رول: {item.rollUsed}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-left font-mono shrink-0">
                      <p className="font-black text-foreground">{formatNumber(item.total)} ج.س</p>
                      <p className="text-[10px] text-muted-foreground">{item.area.toFixed(2)} م²</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes if present */}
          {order.notes && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
              <span className="font-bold text-amber-700 dark:text-amber-400 block mb-0.5">ملاحظات التشغيل والورشة:</span>
              <p className="text-foreground/90 font-medium">{order.notes}</p>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5 border-t border-border/80 bg-secondary/20 p-4">
          <Link
            to="/invoices"
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition shadow-xs"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>فتح سجل ايصالات الطباعة</span>
          </Link>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {nextStage ? (
              <button
                onClick={() => handleAdvance(nextStage.nextStatus)}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black transition shadow-sm active:scale-95 ${nextStage.color}`}
              >
                <span>{nextStage.label}</span>
                <nextStage.icon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                تم تسليم الطلب
              </span>
            )}

            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-border bg-secondary/80 px-4 py-2 text-xs font-bold text-foreground hover:bg-secondary transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
