import React from "react";
import { FileText, TrendingUp, ShoppingBag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceType, CustomInvoice } from "@/lib/billing/types";
import { formatAccountingNumber } from "./StandardInvoiceDocument";
import { useProformaInvoices } from "@/lib/proforma/store";

interface Props {
  invoices: CustomInvoice[];
  onCreateClick: (type: CustomInvoiceType) => void;
}

export function BillingCards({ invoices, onCreateClick }: Props) {
  const officialProformas = useProformaInvoices();
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const proformaInvoices = safeInvoices.filter((i) => i?.meta?.type === "proforma");
  const salesInvoices = safeInvoices.filter((i) => i?.meta?.type === "sales");
  const purchaseInvoices = safeInvoices.filter((i) => i?.meta?.type === "purchase");

  const sumOfficialProforma = (officialProformas || []).reduce(
    (acc, i) => acc + (Number(i?.totalAmount) || 0),
    0
  );
  const sumProforma =
    proformaInvoices.reduce((acc, i) => acc + (Number(i?.totalAmount) || 0), 0) +
    sumOfficialProforma;
  const sumSales = salesInvoices.reduce((acc, i) => acc + (Number(i?.totalAmount) || 0), 0);
  const sumPurchase = purchaseInvoices.reduce(
    (acc, i) => acc + (Number(i?.totalAmount) || 0),
    0
  );

  const CARDS: Array<{
    type: CustomInvoiceType;
    title: string;
    actionLabel: string;
    count: number;
    totalAmount: number;
    icon: typeof FileText;
    borderGlow: string;
    iconBg: string;
    buttonClass: string;
    badgeClass: string;
  }> = [
    {
      type: "sales",
      title: "فواتير مبيعات",
      actionLabel: "+ إصدار فاتورة بيع",
      count: salesInvoices.length,
      totalAmount: sumSales,
      icon: TrendingUp,
      borderGlow: "border-primary/30 hover:border-primary/60 hover:shadow-primary/10",
      iconBg: "bg-primary/15 text-primary border border-primary/25",
      buttonClass: "bg-primary hover:bg-primary/90 text-white shadow-xs shadow-primary/30",
      badgeClass: "bg-primary/10 text-primary border-primary/20",
    },
    {
      type: "proforma",
      title: "فواتير مبدئية A4",
      actionLabel: "+ إصدار عرض مبدئي",
      count: proformaInvoices.length + (officialProformas || []).length,
      totalAmount: sumProforma,
      icon: FileText,
      borderGlow: "border-[#C5A059]/30 hover:border-[#C5A059]/60 hover:shadow-[#C5A059]/10",
      iconBg: "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/25",
      buttonClass: "bg-[#C5A059] hover:bg-[#A9843C] text-white shadow-xs shadow-[#C5A059]/30",
      badgeClass: "bg-[#C5A059]/10 text-[#C5A059] border-[#C5A059]/20",
    },
    {
      type: "purchase",
      title: "فواتير مشتريات",
      actionLabel: "+ إصدار مشتريات",
      count: purchaseInvoices.length,
      totalAmount: sumPurchase,
      icon: ShoppingBag,
      borderGlow: "border-slate-500/30 hover:border-slate-500/60 hover:shadow-slate-500/10",
      iconBg: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
      buttonClass: "bg-slate-700 hover:bg-slate-800 text-white shadow-xs shadow-slate-700/30",
      badgeClass: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3.5" dir="rtl">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.type}
            className={`group relative rounded-2xl border bg-card/90 backdrop-blur-md p-3 sm:p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${card.borderGlow} flex flex-col justify-between gap-2.5`}
          >
            {/* الجزء العلوي: الأيقونة، العنوان، والعدد */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${card.iconBg}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-foreground tracking-tight truncate">
                    {card.title}
                  </h3>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="font-mono font-black text-sm sm:text-base text-foreground tabular-nums">
                      {formatAccountingNumber(card.totalAmount)}
                    </span>
                    <span className="text-[10px] font-sans font-bold text-muted-foreground">ج.س</span>
                  </div>
                </div>
              </div>

              {/* بادج عدد الفواتير */}
              <span
                className={`text-[10.5px] font-mono font-black px-2 py-0.5 rounded-full border shrink-0 tabular-nums ${card.badgeClass}`}
              >
                {card.count} فاتورة
              </span>
            </div>

            {/* الزر السريع المدمج */}
            <Button
              type="button"
              onClick={() => onCreateClick(card.type)}
              className={`w-full h-8.5 rounded-xl font-black text-xs gap-1.5 transition-all active:scale-[0.98] ${card.buttonClass}`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{card.actionLabel}</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
