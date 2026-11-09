import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * شاشة تحميل هيكلية (Skeleton Loader) فائقة الخفة والسرعة
 * تمنح المستخدم استجابة لحظية عند التنقل بين صفحات التطبيق بدون أي تأخير أو لاق
 */
export function PageSkeletonLoader() {
  return (
    <div
      dir="rtl"
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col space-y-4 px-3 py-3 md:px-6 md:py-4 select-none animate-in fade-in duration-100"
    >
      {/* 1. هيكل شريط الترويسة والترحيب */}
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/60 p-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-3 w-24 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>

      {/* 2. هيكل بطاقات المؤشرات السريعة (4 أعمدة) */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-border/60 bg-card/60 p-3.5 space-y-2 shadow-2xs"
          >
            <Skeleton className="h-3 w-16 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
        ))}
      </div>

      {/* 3. هيكل مساحة العمل الرئيسية والجدول */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 flex-1 min-h-[320px]">
        <div className="md:col-span-5 rounded-3xl border border-border/60 bg-card/60 p-4 space-y-3">
          <Skeleton className="h-5 w-36 rounded-md" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl mt-4" />
        </div>

        <div className="md:col-span-7 rounded-3xl border border-border/60 bg-card/60 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-14 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageSkeletonLoader;

