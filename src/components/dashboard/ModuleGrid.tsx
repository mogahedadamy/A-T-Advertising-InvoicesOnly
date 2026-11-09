import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calculator,
  ClipboardList,
  FileText,
  FileSpreadsheet,
  Users,
  Printer,
  Layers,
  Settings as SettingsIcon,
} from "lucide-react";
import { playTapSound } from "@/lib/soundEffects";

interface SystemModule {
  key:         string;
  label:       string;
  description: string;
  icon:        LucideIcon;
  status:      "active" | "new" | "soon";
  to?:         string;
  gradient:    string;  /* Tailwind gradient classes for icon bg */
  iconColor:   string;  /* text color for icon */
}

const MODULES: SystemModule[] = [
  {
    key:         "calculator",
    label:       "الحاسبة وطلب جديد",
    description: "حساب المقاسات والرولات والأسعار",
    icon:        Calculator,
    status:      "active",
    to:          "/calculator",
    gradient:    "from-violet-600 to-purple-700",
    iconColor:   "text-white",
  },
  {
    key:         "proforma",
    label:       "الفواتير المبدئية",
    description: "فواتير وعروض أسعار قابلة للطباعة",
    icon:        FileSpreadsheet,
    status:      "new",
    to:          "/proforma-invoices",
    gradient:    "from-amber-500 to-orange-600",
    iconColor:   "text-white",
  },
  {
    key:         "orders",
    label:       "أوامر الشغل",
    description: "قائمة طلبات الوردية ومراحل التنفيذ",
    icon:        ClipboardList,
    status:      "soon",
    to:          "/orders",
    gradient:    "from-blue-500 to-sky-600",
    iconColor:   "text-white",
  },
  {
    key:         "production",
    label:       "الإنتاج والورشة",
    description: "طابور ماكينات الطباعة والتشطيب",
    icon:        Printer,
    status:      "soon",
    to:          "/production",
    gradient:    "from-slate-600 to-zinc-700",
    iconColor:   "text-white",
  },
  {
    key:         "invoices",
    label:       "إيصالات الطباعة",
    description: "إيصالات التشغيل المعتمدة",
    icon:        FileText,
    status:      "active",
    to:          "/invoices",
    gradient:    "from-emerald-500 to-teal-600",
    iconColor:   "text-white",
  },
  {
    key:         "materials",
    label:       "الخامات والأسعار",
    description: "إدارة رولات الفلكس والبنر",
    icon:        Layers,
    status:      "soon",
    to:          "/materials",
    gradient:    "from-rose-500 to-pink-600",
    iconColor:   "text-white",
  },
  {
    key:         "customers",
    label:       "سجل العملاء",
    description: "بيانات العملاء وكشوف الحسابات",
    icon:        Users,
    status:      "soon",
    to:          "/customers",
    gradient:    "from-cyan-500 to-blue-600",
    iconColor:   "text-white",
  },
  {
    key:         "reports",
    label:       "التقارير المالية",
    description: "إحصائيات المبيعات والأرباح",
    icon:        BarChart3,
    status:      "soon",
    to:          "/reports",
    gradient:    "from-indigo-500 to-violet-600",
    iconColor:   "text-white",
  },
  {
    key:         "settings",
    label:       "إعدادات المطبعة",
    description: "بيانات المطبعة والشعار والأمان",
    icon:        SettingsIcon,
    status:      "active",
    to:          "/settings",
    gradient:    "from-primary to-primary-deep",
    iconColor:   "text-white",
  },
];

const STATUS_CONFIG = {
  active: { label: "نشط",    classes: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  new:    { label: "جديد ✨", classes: "bg-amber-500/10  text-amber-600  dark:text-amber-400  border-amber-500/20"  },
  soon:   { label: "قريباً",  classes: "bg-muted          text-muted-foreground               border-border/60"      },
} as const;

interface ModuleCardProps {
  mod:   SystemModule;
  delay: number;
}

function ModuleCard({ mod, delay }: ModuleCardProps) {
  const { key, label, description, icon: Icon, to, status, gradient, iconColor } = mod;
  const isLink = Boolean(to) && status !== "soon";
  const { label: statusLabel, classes: statusClasses } = STATUS_CONFIG[status];

  const content = (
    <>
      {/* Icon + status */}
      <div className="flex items-start justify-between gap-1.5">
        {/* Gradient icon container */}
        <span
          className={[
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
            "bg-gradient-to-br shadow-sm",
            "transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3",
            gradient,
            iconColor,
          ].join(" ")}
        >
          <Icon className="h-5 w-5" />
        </span>

        {/* Status badge */}
        <span
          className={[
            "rounded-full border px-2 py-0.5 text-[9px] font-black leading-none mt-0.5",
            statusClasses,
          ].join(" ")}
        >
          {statusLabel}
        </span>
      </div>

      {/* Labels */}
      <div className="mt-3 min-w-0">
        <p
          className={[
            "truncate text-xs font-black text-foreground leading-snug",
            isLink ? "group-hover:text-primary transition-colors duration-200" : "",
          ].join(" ")}
        >
          {label}
        </p>
        <p className="mt-0.5 line-clamp-2 text-[10.5px] text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </>
  );

  const baseClasses = [
    "animate-slide-up group relative flex flex-col rounded-2xl border p-3.5 text-right",
    "transition-all duration-200",
  ].join(" ");

  if (isLink && to) {
    return (
      <Link
        key={key}
        to={to}
        onClick={() => playTapSound()}
        style={{ animationDelay: `${delay}ms` }}
        className={[
          baseClasses,
          "border-border/60 bg-card",
          "hover:border-primary/30 hover:bg-secondary/40",
          "hover:shadow-card hover:-translate-y-0.5",
          "btn-tactile interactive",
        ].join(" ")}
      >
        {/* Hover border glow inset */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            boxShadow: "inset 0 0 0 1.5px hsl(var(--primary) / 0.25)",
          }}
        />
        {content}
      </Link>
    );
  }

  return (
    <div
      key={key}
      aria-disabled="true"
      style={{ animationDelay: `${delay}ms` }}
      className={[
        baseClasses,
        "border-border/30 bg-secondary/10 opacity-55 cursor-not-allowed",
      ].join(" ")}
    >
      {content}
    </div>
  );
}

export function ModuleGrid() {
  return (
    <section
      aria-label="وحدات نظام المطبعة"
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-card"
      dir="rtl"
    >
      {/* Section header */}
      <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-border/50">
        <div>
          <h2 className="text-sm font-black text-foreground md:text-[15px]">
            وحدات نظام المطبعة
          </h2>
          <p className="text-[10.5px] font-medium text-muted-foreground mt-0.5">
            الوصول المباشر لكافة أقسام النظام
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/15 px-2.5 py-1 text-[10px] font-black text-primary">
          {MODULES.filter((m) => m.status === "active").length} نشط
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-3">
        {MODULES.map((mod, i) => (
          <ModuleCard key={mod.key} mod={mod} delay={i * 40 + 100} />
        ))}
      </div>
    </section>
  );
}
