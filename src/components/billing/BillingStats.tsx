import React from "react";
import { FileText, TrendingUp, ShoppingBag, Receipt, Sparkles } from "lucide-react";
import type { CustomInvoice } from "@/lib/billing/types";
import { formatAccountingNumber } from "./StandardInvoiceDocument";

interface Props {
  invoices?: CustomInvoice[];
  stats?: {
    totalCount: number;
    totalAmount: number;
    salesCount: number;
    salesAmount: number;
    purchaseCount: number;
    purchaseAmount: number;
    calculatorCount: number;
    calculatorAmount: number;
    proformaCount: number;
  };
}

export function BillingStats({ invoices, stats }: Props) {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const totalCount = stats ? stats.totalCount : safeInvoices.length;
  const proformaCount = stats
    ? stats.proformaCount
    : safeInvoices.filter((i) => i?.meta?.type === "proforma").length;
  const salesCount = stats
    ? stats.salesCount + stats.calculatorCount
    : safeInvoices.filter((i) => i?.meta?.type === "sales").length;
  const purchaseCount = stats
    ? stats.purchaseCount
    : safeInvoices.filter((i) => i?.meta?.type === "purchase").length;

  const totalAmount = stats
    ? stats.totalAmount
    : safeInvoices.reduce((acc, i) => acc + (Number(i?.totalAmount) || 0), 0);
  const salesAmount = stats
    ? stats.salesAmount + stats.calculatorAmount
    : safeInvoices
        .filter((i) => i?.meta?.type === "sales")
        .reduce((acc, i) => acc + (Number(i?.totalAmount) || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4" dir="rtl">
      {/* 1. إجمالي الفواتير */}
      <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-3 sm:p-4 shadow-sm flex items-center justify-between">
        <div className="min-w-0 pr-1">
          <p className="text-[11px] sm:text-xs font-bold text-muted-foreground truncate">إجمالي الفواتير</p>
          <p className="text-base sm:text-xl md:text-2xl font-black text-foreground mt-0.5 sm:mt-1 truncate">
            {totalCount}{" "}
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">مستند</span>
          </p>
        </div>
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center justify-center shrink-0">
          <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      {/* 2. إجمالي المبيعات */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm p-3 sm:p-4 shadow-sm flex items-center justify-between">
        <div className="min-w-0 pr-1">
          <p className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 truncate">إجمالي المبيعات</p>
          <p className="text-base sm:text-xl md:text-2xl font-black font-mono text-emerald-700 dark:text-emerald-300 mt-0.5 sm:mt-1 truncate">
            {formatAccountingNumber(salesAmount)}{" "}
            <span className="text-[10px] sm:text-xs font-sans font-bold text-muted-foreground">ج.س</span>
          </p>
        </div>
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      {/* 3. عروض الأسعار المبدئية */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm p-3 sm:p-4 shadow-sm flex items-center justify-between">
        <div className="min-w-0 pr-1">
          <p className="text-[11px] sm:text-xs font-bold text-amber-600 dark:text-amber-400 truncate">فواتير مبدئية</p>
          <p className="text-base sm:text-xl md:text-2xl font-black text-amber-700 dark:text-amber-300 mt-0.5 sm:mt-1 truncate">
            {proformaCount}{" "}
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">عرض</span>
          </p>
        </div>
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>

      {/* 4. فواتير المشتريات */}
      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 backdrop-blur-sm p-3 sm:p-4 shadow-sm flex items-center justify-between">
        <div className="min-w-0 pr-1">
          <p className="text-[11px] sm:text-xs font-bold text-purple-600 dark:text-purple-400 truncate">فواتير مشتريات</p>
          <p className="text-base sm:text-xl md:text-2xl font-black text-purple-700 dark:text-purple-300 mt-0.5 sm:mt-1 truncate">
            {purchaseCount}{" "}
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground">فاتورة</span>
          </p>
        </div>
        <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-purple-500/20 text-purple-500 border border-purple-500/30 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
      </div>
    </div>
  );
}
