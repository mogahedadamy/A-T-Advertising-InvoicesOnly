import React from "react";
import { Link } from "@tanstack/react-router";
import { Receipt, PlusCircle } from "lucide-react";

/**
 * شاشة الحالة الفارغة عند عدم وجود فواتير مطابقة لمعايير البحث
 */
export const InvoicesEmptyState: React.FC = () => {
  return (
    <div className="col-span-full py-12 text-center space-y-2">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
        <Receipt className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold text-foreground">لا توجد فواتير أو سجلات مطابقة</p>
      <p className="text-[11px] text-muted-foreground">
        يمكنك إنشاء فاتورة جديدة من قسم الفواتير أو حفظ تسعير من الحاسبة
      </p>
      <div className="pt-2 flex justify-center gap-2">
        <Link
          to="/billing"
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-xs touch-manipulation"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>فتح قسم الفواتير</span>
        </Link>
        <Link
          to="/calculator"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-xs hover:bg-muted touch-manipulation"
        >
          <span>فتح الحاسبة</span>
        </Link>
      </div>
    </div>
  );
};
