import React, { useEffect } from "react";
import { Lock, AlertOctagon, PhoneCall, ShieldAlert, MapPin, Building2, Calculator, Receipt } from "lucide-react";
import { registerBackHandler } from "@/lib/backButtonHandler";

export function TrialExpiredScreen({ isTampered = false }: { isTampered?: boolean }) {
  // منع زر الرجوع في هاتف أندرويد من الخروج أو الالتفاف على القفل
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      return true; // منع الإغلاق
    });
    return unregister;
  }, []);

  return (
    <div
      dir="rtl"
      role="alertdialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between overflow-y-auto bg-[#061410] px-4 py-8 text-white select-none"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(1.5rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      {/* ── 1. هالة الإغلاق التام الخلفية ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-1/4 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-rose-600/10 blur-[100px]" />
        <div className="absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-[#0D4A39]/30 blur-[90px]" />
      </div>

      {/* ── 2. رأس الشاشة والشعار ── */}
      <div className="relative z-10 flex flex-col items-center gap-2">
        <img
          src="/ta-logo-white.png"
          alt="T.A Advertising Solution"
          className="h-16 w-auto max-w-[200px] object-contain opacity-90 drop-shadow-md"
        />
        <div className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-[11px] font-bold text-rose-300">
          <AlertOctagon className="h-3.5 w-3.5" />
          <span>نسخة إدارة الفواتير والمشاريع (7 أيام)</span>
        </div>
      </div>

      {/* ── 3. كتلة رسالة انتهاء الصلاحية المركزية ── */}
      <div className="relative z-10 mx-auto my-auto max-w-md w-full rounded-3xl border border-rose-500/30 bg-[#0B2019]/95 p-6 sm:p-7 shadow-2xl backdrop-blur-xl text-center space-y-4">
        {/* أيقونة القفل الكبير */}
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 shadow-lg">
          <Lock className="h-8 w-8" />
        </div>

        {/* العنوان الرئيسي الصريح */}
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            انتهت الفترة التجريبية
          </h1>
          <p className="text-xs sm:text-sm text-rose-200/80 font-bold">
            {isTampered
              ? "تم إيقاف تشغيل التطبيق بسبب تراجع في ساعة النظام."
              : "عذراً، انتهت صلاحية استخدام النسخة التجريبية (7 أيام) من تاريخ التثبيت."}
          </p>
        </div>

        {/* النص التفصيلي */}
        <div className="rounded-2xl border border-border/40 bg-black/30 p-3.5 text-right text-xs leading-relaxed text-[#C2D1CE]/90 space-y-2">
          <p>
            هذه النسخة مخصصة لتقييم <strong>نظام إدارة الوكالة والفواتير</strong> لمدة <strong>7 أيام (168 ساعة)</strong> فقط من لحظة التثبيت الأولى على هذا الجهاز.
          </p>
          <p className="text-[11px] text-muted-foreground border-t border-white/10 pt-2">
            تم قفل ميزات إدارة المشاريع، إصدار فواتير المبيعات، المشتريات، والأرشيف. للحصول على التفعيل الدائم والترخيص الرسمي يرجى التواصل مع الإدارة.
          </p>
        </div>

        {/* كارت التواصل للحصول على النسخة الدائمة */}
        <div className="rounded-2xl border border-primary/30 bg-[#071914] p-4 text-center space-y-2.5">
          <div className="flex items-center justify-center gap-2 text-xs font-black text-[#C5A059]">
            <Building2 className="h-4 w-4" />
            <span>طلب التفعيل والترخيص الدائم</span>
          </div>

          <p className="text-[11px] text-[#C2D1CE]/80">
            لترخيص منظومة الوكالة والفواتير لمؤسستكم وتفعيل النسخة الدائمة:
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <a
              href="tel:0123456789"
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-primary/90 transition-transform active:scale-95"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>اتصال بالإدارة: 0123456789</span>
            </a>
          </div>

          <div className="flex items-center justify-center gap-1.5 pt-1 text-[10px] text-muted-foreground font-semibold">
            <MapPin className="h-3 w-3 text-primary" />
            <span>فروعنا: بورتسودان • الخرطوم</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrialExpiredScreen;

