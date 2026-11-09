import React from "react";
import { PageShell } from "@/components/layout/PageShell";
import { MaterialsPageHeader } from "./MaterialsPageHeader";
import { MaterialsRollsInfoBanner } from "./MaterialsRollsInfoBanner";
import { MaterialsGrid } from "./MaterialsGrid";

/**
 * صفحة دليل الخامات وأسعار المتر المربع المعتمدة
 * دليل متكامل وجاهز للعمل مع الحاسبة بدون أي رسائل "قريباً" أو "تحت التطوير"
 */
export function MaterialsPage() {
  return (
    <PageShell>
      <main
        className="mx-auto w-full max-w-7xl flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 md:px-6 md:py-5 min-w-0 touch-pan-y pb-36 md:pb-16 overscroll-contain"
        dir="rtl"
      >
        {/* 1. الترويسة الرئيسية */}
        <MaterialsPageHeader />

        {/* 2. شريط تنبيه معايير الرولات */}
        <MaterialsRollsInfoBanner />

        {/* 3. شبكة بطاقات الخامات المعتمدة */}
        <MaterialsGrid />
      </main>
    </PageShell>
  );
}
