import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Wrench,
  Sparkles,
  LayoutDashboard,
  Calculator,
  CheckCircle2,
  Activity,
  Eye,
  EyeOff,
  type LucideIcon,
  ShieldCheck,
  Zap,
} from "lucide-react";

export interface UnderDevelopmentViewProps {
  pageTitle: string;
  pageCategory?: string;
  icon?: LucideIcon;
  description?: string;
  expectedFeatures?: string[];
  backgroundStats?: { label: string; value: string | number }[];
  children?: ReactNode;
}

export function UnderDevelopmentView({
  pageTitle,
  pageCategory = "النظام",
  icon: Icon = Wrench,
  description,
  expectedFeatures = [
    "واجهة مستخدم متقدمة ومتجاوبة بالكامل",
    "تكامل لحظي مع محرك الحسابات وقاعدة البيانات",
    "تصدير تقارير وبيانات دقيقة وسريعة",
  ],
  backgroundStats,
  children,
}: UnderDevelopmentViewProps) {
  const [showLivePreview, setShowLivePreview] = useState(false);

  return (
    <main
      className="mx-auto w-full flex-1 overflow-y-auto px-3 py-4 md:px-6 md:py-8 min-w-0"
      dir="rtl"
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* بطاقة الواجهة الرئيسية: قيد التطوير */}
        <section
          aria-label="إشعار قيد التطوير"
          className="relative overflow-hidden rounded-3xl border border-border/80 bg-card/95 p-6 md:p-10 shadow-xl backdrop-blur-xl text-center"
        >
          {/* تأثيرات الإضاءة الخلفية الناعمة */}
          <div className="pointer-events-none absolute -top-24 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/4 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

          {/* شارة الحالة العلوية */}
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-black text-amber-600 dark:text-amber-400 mb-6 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span>قسم {pageCategory} • قيد التطوير والتحديث المستمر</span>
          </div>

          {/* الأيقونة البارزة مع حلقة مضيئة */}
          <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary/20 via-blue-500/15 to-amber-500/15 p-0.5 shadow-lg shadow-primary/10">
            <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-background/90 backdrop-blur-md">
              <Icon className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>

          {/* العنوان الرئيسي المطلوب بالكامل */}
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground tracking-tight mb-3">
            هذه الصفحة قيد التطوير حالياً
          </h1>

          {/* العنوان الفرعي مع اسم الصفحة */}
          <p className="mx-auto max-w-2xl text-sm md:text-base font-medium text-muted-foreground leading-relaxed mb-6">
            {description ||
              `نعمل حالياً على تطوير وتجهيز صفحة "${pageTitle}" بأحدث التقنيات وأفضل تجربة استخدام لتناسب متطلبات العمل اليومية في الوكالة.`}
          </p>

          {/* شارة إشعار بأن الوظائف الخلفية تعمل ولم تتأثر */}
          <div className="mx-auto max-w-xl rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 mb-8 text-right flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs md:text-[13px] leading-relaxed">
              <span className="font-black text-emerald-800 dark:text-emerald-300">
                الخدمات والعمليات الخلفية تعمل بكفاءة وبدون انقطاع:
              </span>
              <p className="text-emerald-700/90 dark:text-emerald-400/90 mt-0.5">
                كافة العمليات الحسابية، تخزين البيانات، والارتباطات بين أقسام النظام تعمل في الخلفية بشكل طبيعي وموثوق.
              </p>
            </div>
          </div>

          {/* مؤشرات وإحصائيات العمليات الخلفية إن وجدت */}
          {backgroundStats && backgroundStats.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mb-8">
              {backgroundStats.map((stat, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border/70 bg-background/70 p-3 text-center"
                >
                  <p className="text-[11px] font-bold text-muted-foreground">{stat.label}</p>
                  <p className="text-lg font-black text-foreground mt-0.5 font-mono">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* قائمة المزايا الجاري بناؤها */}
          <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-muted/30 p-5 mb-8 text-right">
            <h3 className="text-xs font-black text-foreground flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-primary" />
              المزايا والإمكانيات الجاري إعدادها لهذه الصفحة:
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-muted-foreground">
              {expectedFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* أزرار الإجراءات السريعة */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs md:text-sm font-black text-primary-foreground shadow-md transition hover:bg-primary/90 active:scale-95"
            >
              <LayoutDashboard className="h-4 w-4" />
              العودة للوحة التحكم
            </Link>

            <Link
              to="/billing"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-xs md:text-sm font-black text-foreground shadow-xs transition hover:bg-muted active:scale-95"
            >
              <LayoutDashboard className="h-4 w-4 text-primary" />
              فتح قسم الفواتير
            </Link>

            {children && (
              <button
                type="button"
                onClick={() => setShowLivePreview(!showLivePreview)}
                className="inline-flex items-center gap-2 rounded-xl border border-dashed border-border/80 px-4 py-2.5 text-xs md:text-sm font-bold text-muted-foreground transition hover:text-foreground hover:border-primary/50"
              >
                {showLivePreview ? (
                  <>
                    <EyeOff className="h-4 w-4 text-amber-500" />
                    إخفاء الواجهة التجريبية
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 text-blue-500" />
                    معاينة الواجهة التجريبية للمطورين
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        {/* عرض الواجهة التجريبية لمن يريد فحصها أو للمطورين، مع الحفاظ على كل الكود والخلفية */}
        {children && showLivePreview && (
          <div className="space-y-3 animate-in fade-in-50 duration-300">
            <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-2 text-xs font-black text-amber-700 dark:text-amber-400">
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4 animate-pulse" />
                معاينة مباشرة للنسخة التجريبية قيد الإنشاء (جميع الوظائف نشطة)
              </span>
              <button
                type="button"
                onClick={() => setShowLivePreview(false)}
                className="hover:underline font-bold"
              >
                إغلاق المعاينة ✕
              </button>
            </div>
            <div className="rounded-2xl border border-border/80 bg-background overflow-hidden p-2 md:p-4">
              {children}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
