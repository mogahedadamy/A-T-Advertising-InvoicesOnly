import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  FolderKanban,
  Receipt,
  ReceiptText,
  Settings as SettingsIcon,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

interface SystemModule {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  status: "active" | "new";
  to: string;
  gradient: string;
  iconColor: string;
}

/**
 * وحدات وكالة T.A Advertising Solution الإعلانية:
 * درج أيقونات من 3 أعمدة × 3 أسطر (9 وحدات أساسية) لتجربة تنقل واضحة وسريعة.
 */
const MODULES: SystemModule[] = [
  {
    key: "billing",
    label: "الفواتير",
    description: "إصدار فواتير المبيعات والمشتريات A4",
    icon: Receipt,
    status: "active",
    to: "/billing",
    gradient: "from-[#168063] to-[#22A07E]",
    iconColor: "text-white",
  },
  {
    key: "customers",
    label: "العملاء",
    description: "دليل العملاء وكشوف حساباتهم",
    icon: Users,
    status: "active",
    to: "/customers",
    gradient: "from-cyan-600 to-blue-600",
    iconColor: "text-white",
  },
  {
    key: "projects",
    label: "المشاريع",
    description: "إدارة المشاريع والفواتير والتكاليف",
    icon: FolderKanban,
    status: "active",
    to: "/projects",
    gradient: "from-emerald-600 to-teal-700",
    iconColor: "text-white",
  },
  {
    key: "suppliers",
    label: "الموردون",
    description: "شركاء التنفيذ والمشتريات والذمم",
    icon: Truck,
    status: "active",
    to: "/suppliers",
    gradient: "from-amber-500 to-orange-600",
    iconColor: "text-white",
  },
  {
    key: "finance",
    label: "المالية",
    description: "الخزينة والتحصيل والحسابات",
    icon: Wallet,
    status: "active",
    to: "/finance",
    gradient: "from-emerald-600 to-green-700",
    iconColor: "text-white",
  },
  {
    key: "expenses",
    label: "المصروفات",
    description: "التكاليف المباشرة والتشغيلية",
    icon: ReceiptText,
    status: "active",
    to: "/expenses",
    gradient: "from-rose-500 to-red-600",
    iconColor: "text-white",
  },
  {
    key: "reports",
    label: "التقارير",
    description: "الربحية والتدفق ومؤشرات الأداء",
    icon: BarChart3,
    status: "active",
    to: "/reports",
    gradient: "from-indigo-500 to-violet-600",
    iconColor: "text-white",
  },
  {
    key: "archive",
    label: "الأرشيف",
    description: "السجل الموحد والطباعة والتصدير",
    icon: ClipboardList,
    status: "active",
    to: "/orders",
    gradient: "from-blue-600 to-slate-700",
    iconColor: "text-white",
  },
  {
    key: "settings",
    label: "الإعدادات",
    description: "الأمان والبصمة والنسخ الاحتياطي",
    icon: SettingsIcon,
    status: "active",
    to: "/settings",
    gradient: "from-[#0D4A39] to-[#071914]",
    iconColor: "text-white",
  },
];

/**
 * درج أقسام الوكالة الإعلانية — 3 أيقونات في كل سطر (3×3) مع أيقونة كبيرة ووصف أسفلها
 */
export function ModuleGrid() {
  return (
    <nav
      aria-label="أقسام الوكالة الإعلانية"
      dir="rtl"
      className="grid grid-cols-3 gap-2.5 sm:gap-3.5"
    >
      {MODULES.map((mod) => {
        const Icon = mod.icon;

        return (
          <Link
            key={mod.key}
            to={mod.to}
            className="group relative flex flex-col items-center justify-start rounded-2xl border border-border/70 bg-card/95 dark:bg-card/90 p-3 sm:p-4 text-center shadow-2xs transition-all duration-150 hover:border-primary/45 hover:bg-muted/25 hover:shadow-xs active:scale-[0.96] touch-manipulation min-h-[128px] sm:min-h-[148px]"
          >
            {/* الأيقونة الكبيرة بتدرج لوني مريح وحلقة نقية */}
            <span
              className={`grid h-13 w-13 sm:h-16 sm:w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${mod.gradient} ${mod.iconColor} shadow-sm shadow-black/10 ring-1 ring-white/20 dark:ring-white/10 transition-transform duration-200 group-hover:scale-105 group-hover:-translate-y-0.5`}
            >
              <Icon className="h-6 w-6 sm:h-8 sm:w-8 stroke-[2.2]" />
            </span>

            {/* اسم القسم */}
            <span className="mt-2.5 text-xs sm:text-[13.5px] font-black text-foreground group-hover:text-primary transition-colors leading-tight">
              {mod.label}
            </span>

            {/* الوصف الإرشادي أسفل الأيقونة */}
            <span className="mt-1 text-[10px] sm:text-[11px] font-medium text-muted-foreground/85 leading-snug line-clamp-2 px-0.5">
              {mod.description}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default ModuleGrid;
