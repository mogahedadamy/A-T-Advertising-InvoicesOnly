import React from "react";
import {
  PhoneCall,
  Plus,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
} from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound } from "@/lib/soundEffects";

export type LiveBalancesMap = Record<
  string,
  { outstanding: number; invoiced: number; collected: number; overdueCount: number }
>;

interface CustomersDirectoryViewProps {
  totalMatchedCount: number;
  visibleCustomers: CustomerRecord[];
  liveBalances: LiveBalancesMap;
  onOpenProfile: (customer: CustomerRecord) => void;
  onCreateInvoice: (customer: CustomerRecord) => void;
  onEditCustomer: (customer: CustomerRecord) => void;
  onDeleteCustomer: (customer: CustomerRecord) => void;
}

export function CustomersDirectoryTable({
  totalMatchedCount,
  visibleCustomers,
  liveBalances,
  onOpenProfile,
  onCreateInvoice,
  onEditCustomer,
  onDeleteCustomer,
}: CustomersDirectoryViewProps) {
  return (
    <div className="hidden md:block rounded-2xl border border-border/70 overflow-hidden bg-card shadow-2xs">
      <div className="overflow-x-auto max-h-[640px] overscroll-contain">
        {totalMatchedCount === 0 ? (
          <div className="py-14 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl m-4">
            لا يوجد عملاء يطابقون معايير البحث
          </div>
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="sticky top-0 bg-muted/95 backdrop-blur-xs text-muted-foreground text-[11px] border-b border-border/70 z-10 shadow-xs">
              <tr>
                <th className="py-3 pr-3.5 font-black">العميل</th>
                <th className="py-3 px-3 font-bold">الهاتف</th>
                <th className="py-3 px-3 font-bold">التصنيف</th>
                <th className="py-3 px-3 font-bold">العنوان</th>
                <th className="py-3 px-3 font-mono font-black">إجمالي الفواتير</th>
                <th className="py-3 px-3 font-mono font-black">الرصيد / المستحق</th>
                <th className="py-3 pl-3.5 font-bold text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {visibleCustomers.map((c) => {
                const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;
                const live = liveBalances[c.id];
                const totalInvoiced = live ? live.invoiced : c.totalSpent || 0;
                const outstanding = live ? live.outstanding : (c.balance > 0 ? c.balance : 0);
                const hasOverdue = live && live.overdueCount > 0;

                return (
                  <tr
                    key={c.id}
                    className="hover:bg-muted/20 transition-colors cursor-pointer group"
                    onClick={() => onOpenProfile(c)}
                  >
                    <td className="py-3 pr-3.5 font-bold text-foreground">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-foreground group-hover:text-primary transition-colors">
                          {c.name}
                        </span>
                        {hasOverdue && (
                          <span className="rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20 px-2 py-0.2 text-[9px] font-black">
                            متأخرات
                          </span>
                        )}
                        {c.isArchived && (
                          <span className="rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.2 text-[9px] font-bold">
                            مؤرشف
                          </span>
                        )}
                      </div>
                      {c.notes && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-xs font-normal mt-0.5">
                          {c.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-primary hover:underline"
                          dir="ltr"
                        >
                          <PhoneCall className="h-3 w-3 text-primary/70" />
                          <span>{c.phone}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black border ${cfg.bg} ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">
                      {c.address || "—"}
                    </td>
                    <td className="py-3 px-3 font-mono font-black text-foreground tabular-nums">
                      {formatNumber(totalInvoiced)}{" "}
                      <span className="text-[10px] text-muted-foreground font-normal">ج.س</span>
                    </td>
                    <td className="py-3 px-3 font-mono font-black tabular-nums">
                      {outstanding > 0.009 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-black">
                          {formatNumber(outstanding)} ج.س عليه
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-xs">
                          متزن (0)
                        </span>
                      )}
                    </td>
                    <td className="py-3 pl-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1.5 justify-center">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onOpenProfile(c)}
                          title="عرض الملف المالي والتجاري للعميل"
                          className="h-8 px-3 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white border border-primary/20 text-xs font-black transition-all active:scale-95 cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>الملف المالي</span>
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onCreateInvoice(c)}
                          title="إصدار فاتورة جديدة لهذا العميل"
                          className="h-8 px-2.5 rounded-xl border-border/80 text-foreground hover:bg-secondary text-xs font-bold transition-all active:scale-95 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>فاتورة</span>
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            playTapSound();
                            onEditCustomer(c);
                          }}
                          title="تعديل البيانات"
                          className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeleteCustomer(c)}
                          title="حذف"
                          className="h-8 w-8 p-0 rounded-xl text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function CustomersMobileCards({
  totalMatchedCount,
  visibleCustomers,
  liveBalances,
  onOpenProfile,
  onCreateInvoice,
  onEditCustomer,
  onDeleteCustomer,
}: CustomersDirectoryViewProps) {
  return (
    <div className="space-y-2.5 md:hidden pt-1">
      {totalMatchedCount === 0 ? (
        <div className="py-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl">
          لا يوجد عملاء يطابقون معايير البحث
        </div>
      ) : (
        visibleCustomers.map((c) => {
          const cfg = CUSTOMER_TYPE_CONFIG[c.type] || CUSTOMER_TYPE_CONFIG.individual;
          const live = liveBalances[c.id];
          const totalInvoiced = live ? live.invoiced : c.totalSpent || 0;
          const outstanding = live ? live.outstanding : (c.balance > 0 ? c.balance : 0);

          return (
            <div
              key={c.id}
              onClick={() => onOpenProfile(c)}
              className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-3 shadow-2xs cursor-pointer active:scale-[0.99] transition-all"
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
                <div>
                  <p className="font-black text-foreground text-sm tracking-tight">{c.name}</p>
                  {c.phone && (
                    <a
                      href={`tel:${c.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-mono font-bold mt-1"
                      dir="ltr"
                    >
                      <PhoneCall className="h-3 w-3" />
                      <span>{c.phone}</span>
                    </a>
                  )}
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9.5px] font-black border ${cfg.bg} ${cfg.color} shrink-0`}
                >
                  {cfg.label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-2">
                  <span className="text-[10px] text-muted-foreground font-bold block">إجمالي الفواتير</span>
                  <p className="font-mono font-bold text-foreground tabular-nums mt-0.5">
                    {formatNumber(totalInvoiced)} ج.س
                  </p>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-2">
                  <span className="text-[10px] text-muted-foreground font-bold block">الرصيد / المستحق</span>
                  <p className="font-mono font-black tabular-nums mt-0.5">
                    {outstanding > 0.009 ? (
                      <span className="text-rose-600 dark:text-rose-400">
                        {formatNumber(outstanding)} ج.س عليه
                      </span>
                    ) : (
                      <span className="text-emerald-600">متزن (0)</span>
                    )}
                  </p>
                </div>
              </div>

              <div
                className="pt-2.5 border-t border-border/50 flex items-center justify-between gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  onClick={() => onOpenProfile(c)}
                  className="flex-1 h-9 rounded-xl bg-primary hover:bg-primary/90 text-white font-black text-xs gap-1.5 shadow-xs active:scale-[0.97] touch-manipulation cursor-pointer"
                >
                  <FileText className="h-4 w-4" />
                  <span>فتح الملف المالي</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onCreateInvoice(c)}
                  className="h-9 w-9 p-0 rounded-xl border-border/80 text-foreground hover:bg-secondary active:scale-90 cursor-pointer"
                  title="إصدار فاتورة"
                >
                  <Plus className="h-4 w-4 text-primary" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    playTapSound();
                    onEditCustomer(c);
                  }}
                  className="h-9 w-9 p-0 rounded-xl border-border/80 text-foreground hover:bg-secondary active:scale-90 cursor-pointer"
                  title="تعديل البيانات"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDeleteCustomer(c)}
                  className="h-9 w-9 p-0 rounded-xl border-border/80 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 active:scale-90 cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
