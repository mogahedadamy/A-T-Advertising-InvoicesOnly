import { Link } from "@tanstack/react-router";
import {
  Calculator,
  FileText,
  FileSpreadsheet,
  Users,
  BarChart3,
  ChevronLeft,
  Sparkles,
} from "lucide-react";

interface ActionItem {
  key: string;
  to: string;
  label: string;
  description: string;
  icon: typeof Calculator;
  color: string;
  bg: string;
  badge?: string;
  badgeClass?: string;
}

const ACTIONS: ActionItem[] = [
  {
    key: "new-calc",
    to: "/calculator",
    label: "حاسبة أمر شغل جديد",
    description: "حساب الرولات والمقاسات بالصافي",
    icon: Calculator,
    color: "text-primary",
    bg: "bg-primary/10",
    badge: "الرئيسي",
    badgeClass: "bg-primary/15 text-primary",
  },
  {
    key: "proforma",
    to: "/proforma-invoices",
    label: "سجل الفواتير المبدئية",
    description: "فواتير وعروض أسعار للعملاء قابلة للتعديل",
    icon: FileSpreadsheet,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    badge: "جديد ✨",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    key: "invoice",
    to: "/invoices",
    label: "سجل ايصالات الطباعة",
    description: "طباعة واعتماد أوامر التشغيل وإيصالات الورشة",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "customers",
    to: "/customers",
    label: "سجل العملاء والمديونيات",
    description: "حسابات الوكالات والتحصيل الآجل",
    icon: Users,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    key: "reports",
    to: "/reports",
    label: "التقارير اليومية والمالية",
    description: "متابعة المبيعات ومخزون الخامات",
    icon: BarChart3,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
];

export function QuickActions() {
  return (
    <section aria-label="إجراءات تشغيل سريعة" className="space-y-2" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-black text-muted-foreground tracking-wide">
          مسارات العمل السريعة
        </h3>
        <span className="text-[10.5px] text-muted-foreground font-medium">
          وصول فوري للعمليات اليومية الأكثر استخداماً
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {ACTIONS.map(({ key, to, label, description, icon: Icon, color, bg, badge, badgeClass }) => (
          <Link
            key={key}
            to={to}
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-3.5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-secondary/30 hover:shadow-md active:scale-[0.98]"
          >
            <div>
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg} ${color} transition-transform group-hover:scale-105`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </span>

                {badge ? (
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${badgeClass}`}>
                    {badge}
                  </span>
                ) : (
                  <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
                )}
              </div>

              <div className="mt-2.5 min-w-0">
                <p className="truncate text-xs font-black text-foreground group-hover:text-primary transition-colors">
                  {label}
                </p>
                <p className="line-clamp-1 text-[10.5px] text-muted-foreground mt-0.5">
                  {description}
                </p>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/50 text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">
              <span>انتقال سريع</span>
              <ChevronLeft className="h-3 w-3" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
