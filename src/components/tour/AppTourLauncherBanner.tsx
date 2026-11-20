import React from "react";
import { BookOpen, ChevronLeft, X } from "lucide-react";
import { useAppTour, triggerOpenTour } from "@/lib/appTourStore";

/**
 * شريط ترويجي تعليمي خفيف يظهر في الصفحة الرئيسية
 * يتيح للمستخدم فتح الدليل التعريفي بنقرة، أو إخفائه بضغطة واحدة
 */
export function AppTourLauncherBanner() {
  const { isDismissed, dismissTour } = useAppTour();

  if (isDismissed) return null;

  return (
    <aside
      aria-label="دليل الاستخدام السريع"
      dir="rtl"
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/[0.08] via-card to-card p-3 sm:p-3.5 shadow-2xs animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/25 mt-0.5">
            <BookOpen className="h-4.5 w-4.5" />
          </span>

          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-foreground">
                المساعد الإرشادي ودليل الاستخدام
              </span>
              <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[9px] font-black text-primary">
                موصى به
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
              تعرّف على كيفية إدارة فواتير A4، العملاء، المالية، والنسخ الاحتياطي في دقيقة واحدة مبسطة.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              triggerOpenTour({ sectionId: "home", mode: "context" });
            }}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-black text-white shadow-xs shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>بدء الجولة التفاعلية</span>
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              void dismissTour();
            }}
            aria-label="إخفاء هذا الإشعار"
            title="إخفاء الإشعار وعدم عرضه مجدداً"
            className="grid h-8.5 w-8.5 place-items-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

