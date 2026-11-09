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
      <main className="mx-auto max-w-7xl p-3 md:p-6 space-y-4">
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
