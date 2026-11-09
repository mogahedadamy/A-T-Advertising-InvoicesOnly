import { Link } from "@tanstack/react-router";
import {
  PlusCircle,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  Receipt,
  Zap,
} from "lucide-react";
import { useOrders } from "@/lib/ordersStore";
import { useInvoices } from "@/lib/invoicesStore";
import { playTapSound } from "@/lib/soundEffects";

interface PillConfig {
  to:          string;
  label:       string;
  sub:         string;
  icon:        React.ElementType;
  badge?:      string;
  badgeStyle:  string;
  cardStyle:   string;
  iconStyle:   string;
  glowVar:     string; /* CSS variable for glow shadow */
}

function ActionPill({ pill }: { pill: PillConfig }) {
  const { to, label, sub, icon: Icon, badge, badgeStyle, cardStyle, iconStyle, glowVar } = pill;

  return (
    <Link
      to={to}
      onClick={() => playTapSound()}
      className={[
        /* Layout */
        "group relative flex flex-col justify-between",
        "rounded-2xl border p-3 sm:p-3.5 overflow-hidden",
        /* Animation */
        "btn-tactile interactive",
        "transition-all duration-200",
        "hover:-translate-y-0.5 active:translate-y-0",
        /* Glow on hover */
        `hover:[box-shadow:${glowVar}]`,
        /* Card-specific colors */
        cardStyle,
      ].join(" ")}
    >
      {/* Subtle inner shine overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background:
            "linear-gradient(135deg, hsl(0 0% 100% / 0.04) 0%, transparent 60%)",
        }}
      />

      {/* Top row: icon + badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span
          className={[
            "grid h-10 w-10 place-items-center rounded-xl shrink-0",
            "transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3",
            iconStyle,
          ].join(" ")}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>

        {badge && (
          <span
            className={[
              "rounded-full border px-2 py-0.5 text-[9.5px] font-bold leading-none",
              badgeStyle,
            ].join(" ")}
          >
            {badge}
          </span>
        )}
      </div>

      {/* Bottom row: label + arrow */}
      <div className="flex items-end justify-between gap-1 min-w-0">
        <div className="min-w-0">
          <p className="text-xs sm:text-[13px] font-black text-foreground leading-tight truncate group-hover:text-white transition-colors duration-200">
            {label}
          </p>
          <p className="text-[10px] sm:text-[11px] font-medium text-muted-foreground mt-0.5 truncate group-hover:text-white/70 transition-colors duration-200">
            {sub}
          </p>
        </div>
        <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:-translate-x-1 group-hover:text-white hidden sm:block" />
      </div>
    </Link>
  );
}

export function ActionPillsBar() {
  const orders   = useOrders();
  const invoices = useInvoices();

  const activeCount   = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled").length;
  const invoicesCount = invoices.length;

  const PILLS: PillConfig[] = [
    {
      to:         "/calculator",
      label:      "أمر شغل جديد",
      sub:        "حساب المقاسات والرولات",
      icon:       PlusCircle,
      badge:      "حاسبة فورية ⚡",
      badgeStyle: "border-purple-500/30 bg-purple-500/15 text-purple-300",
      cardStyle:  "border-purple-500/25 bg-gradient-to-br from-purple-950/50 via-card to-card hover:from-purple-800/60 hover:border-purple-400/50",
      iconStyle:  "bg-purple-500/15 text-purple-400 group-hover:bg-purple-400 group-hover:text-white",
      glowVar:    "var(--shadow-glow-primary)",
    },
    {
      to:         "/billing",
      label:      "قسم الفواتير",
      sub:        "مبدئية، مبيعات ومشتريات",
      icon:       Receipt,
      badge:      invoicesCount > 0 ? `${invoicesCount} فاتورة` : "سجل الفواتير",
      badgeStyle: "border-blue-500/30 bg-blue-500/15 text-blue-300 font-mono",
      cardStyle:  "border-blue-500/25 bg-gradient-to-br from-blue-950/50 via-card to-card hover:from-blue-800/60 hover:border-blue-400/50",
      iconStyle:  "bg-blue-500/15 text-blue-400 group-hover:bg-blue-400 group-hover:text-white",
      glowVar:    "0 0 0 1px hsl(220 80% 60% / 0.2), 0 8px 24px -4px hsl(220 80% 60% / 0.35)",
    },
    {
      to:         "/proforma-invoices",
      label:      "الفواتير المبدئية",
      sub:        "عروض الأسعار والرولات",
      icon:       FileSpreadsheet,
      badge:      "A4 رسمية ✨",
      badgeStyle: "border-amber-500/30 bg-amber-500/15 text-amber-300",
      cardStyle:  "border-amber-500/25 bg-gradient-to-br from-amber-950/50 via-card to-card hover:from-amber-800/60 hover:border-amber-400/50",
      iconStyle:  "bg-amber-500/15 text-amber-400 group-hover:bg-amber-400 group-hover:text-white",
      glowVar:    "var(--shadow-glow-orange)",
    },
    {
      to:         "/invoices",
      label:      "إيصالات الطباعة",
      sub:        "أوامر معتمدة واستلام الورشة",
      icon:       FileText,
      badge:      activeCount > 0 ? `${activeCount} جارية` : "أوامر التشغيل",
      badgeStyle: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-mono",
      cardStyle:  "border-emerald-500/25 bg-gradient-to-br from-emerald-950/50 via-card to-card hover:from-emerald-800/60 hover:border-emerald-400/50",
      iconStyle:  "bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-400 group-hover:text-white",
      glowVar:    "0 0 0 1px hsl(160 60% 45% / 0.2), 0 8px 24px -4px hsl(160 60% 45% / 0.35)",
    },
  ];

  return (
    <section
      aria-label="الإجراءات التشغيلية المباشرة"
      className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3"
      dir="rtl"
    >
      {PILLS.map((pill, i) => (
        <div
          key={pill.to}
          className="animate-slide-up"
          style={{ animationDelay: `${i * 60 + 80}ms` }}
        >
          <ActionPill pill={pill} />
        </div>
      ))}
    </section>
  );
}
