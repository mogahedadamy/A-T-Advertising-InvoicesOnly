import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Printer,
  FileText,
  User,
  Phone,
  Calendar,
  Flame,
  CheckCircle2,
  Clock,
  Layers,
  MapPin,
  X,
} from "lucide-react";
import { formatNumber, materialLabel } from "@/lib/printCalculator";
import {
  STATUS_CONFIG,
  type PrintOrder,
  type OrderStatus,
} from "@/lib/ordersStore";

import { useEffect } from "react";
import { registerBackHandler } from "@/lib/backButtonHandler";

interface Props {
  order: PrintOrder | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (orderId: string, status: OrderStatus) => void;
}

export function OrderDetailsDialog({
  order,
  open,
  onClose,
  onStatusChange,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const unregister = registerBackHandler(() => {
      onClose();
      return true;
    });
    return unregister;
  }, [open, onClose]);

  if (!order) return null;

  const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.new;
  const isUrgent = order.priority === "urgent";

  const handlePrintTicket = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        dir="rtl"
        className="max-w-xl max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] flex flex-col p-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl text-right"
      >
        {/* الترويسة مع مساحة أمان لزر الإغلاق */}
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 pl-14 py-3.5 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-base font-black text-foreground">
              أمر شغل #{order.orderNumber}
            </span>
            {isUrgent && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 border border-destructive/20 px-2 py-0.5 text-[10px] font-black text-destructive">
                <Flame className="h-3 w-3" />
                مستعجل
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={order.status}
              onChange={(e) => onStatusChange(order.id, e.target.value as OrderStatus)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-bold text-foreground outline-none focus:border-primary"
            >
              <option value="new">طلب جديد</option>
              <option value="design">تحت التصميم</option>
              <option value="ready_to_print">جاهز للطباعة</option>
              <option value="printing">قيد الطباعة</option>
              <option value="finishing">تشطيب وقص</option>
              <option value="delivered">تم التسليم</option>
              <option value="cancelled">ملغي</option>
            </select>
          </div>
        </div>

        {/* محتوى التفاصيل */}
        <div className="p-4 sm:p-5 space-y-4 flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* بيانات العميل والفرع */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-secondary/30 p-3.5 text-xs">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3 text-primary" />
                اسم العميل
              </span>
              <p className="font-black text-foreground text-sm">{order.customerName}</p>
              <p className="font-mono text-muted-foreground text-xs">{order.customerPhone}</p>
            </div>

            <div className="space-y-1 text-right">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-primary" />
                الفرع وتاريخ الإنشاء
              </span>
              <p className="font-bold text-foreground">فرع {order.branch || "بورتسودان"}</p>
              <p className="text-[10px] text-muted-foreground font-mono">
                {new Date(order.createdAt).toLocaleString("ar", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
          </div>

          {/* جدول المقاسات والبنود */}
          <div>
            <h4 className="text-xs font-black text-foreground mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              <span>المقاسات والخامات المحددة ({order.items.length})</span>
            </h4>

            <div className="rounded-xl border border-border/80 overflow-hidden">
              <table className="w-full text-right text-xs">
                <thead className="bg-secondary/60 text-[10px] font-bold text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 pr-3">م</th>
                    <th className="py-2">البيان</th>
                    <th className="py-2">الخامة</th>
                    <th className="py-2">المقاس (سم)</th>
                    <th className="py-2">الرول</th>
                    <th className="py-2">الكمية</th>
                    <th className="py-2 pl-3 text-left">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {order.items.map((it, idx) => (
                    <tr key={it.id || idx} className="hover:bg-muted/30">
                      <td className="py-2.5 pr-3 font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="py-2.5 font-bold text-foreground">{it.description || "—"}</td>
                      <td className="py-2.5 text-primary font-bold">{materialLabel(it.material)}</td>
                      <td className="py-2.5 font-mono">{it.width} × {it.height}</td>
                      <td className="py-2.5 text-[11px] text-muted-foreground">{it.rollUsed}</td>
                      <td className="py-2.5 font-mono">{it.qty}</td>
                      <td className="py-2.5 pl-3 text-left font-mono font-bold text-foreground">
                        {formatNumber(it.total)} ج.س
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ملخص الحساب المالي */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3.5 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold text-muted-foreground">إجمالي المساحة</span>
              <p className="font-mono font-black text-foreground text-sm">
                {order.totalArea.toFixed(2)} م²
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-muted-foreground">حالة السداد</span>
              <p className="font-bold text-emerald-600 dark:text-emerald-400">
                {order.paidAmount >= order.totalCost ? "مسدد بالكامل" : "متبقي آجل"}
              </p>
            </div>

            <div className="text-left">
              <span className="text-[10px] font-bold text-muted-foreground">المبلغ المستحق</span>
              <p className="font-mono font-black text-primary text-base">
                {formatNumber(order.totalCost)} ج.س
              </p>
            </div>
          </div>

          {order.invoiceSerial && (
            <div className="flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-xs">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                رقم الفاتورة المرتبطة بهذا الطلب:
              </span>
              <span className="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                #{order.invoiceSerial}
              </span>
            </div>
          )}

          {order.notes && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
              <span className="font-bold">ملاحظات التشغيل: </span>
              <span>{order.notes}</span>
            </div>
          )}
        </div>

        {/* أزرار الإجراءات السفلية */}
        <div className="flex items-center justify-between border-t border-border bg-secondary/30 p-4">
          <button
            type="button"
            onClick={handlePrintTicket}
            className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs font-black text-primary hover:bg-primary hover:text-white transition-all active:scale-95 touch-manipulation shadow-xs"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة أمر تشغيل الورشة</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/80 bg-secondary/80 px-5 py-2.5 text-xs font-black text-foreground hover:bg-secondary transition-all active:scale-95 touch-manipulation"
          >
            إغلاق
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
