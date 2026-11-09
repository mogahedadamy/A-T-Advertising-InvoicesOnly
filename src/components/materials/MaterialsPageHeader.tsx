import React from "react";
import { Link } from "@tanstack/react-router";
import { Calculator } from "lucide-react";

/**
 * ترويسة صفحة دليل الخامات والأسعار مع زر الانتقال السريع للحاسبة
 */
export const MaterialsPageHeader: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-sm md:flex-row md:items-center md:justify-between border-r-4 border-r-primary">
      <div>
        <h1 className="text-lg font-black tracking-tight text-foreground md:text-xl">
          الخامات والأسعار
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          دليل خامات الطباعة الرقمية في المطبعة، عروض الرولات، والأسعار المعتمدة للمتر المربع
        </p>
      </div>

      <Link
        to="/calculator"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-deep transition active:scale-95 touch-manipulation"
      >
        <Calculator className="h-4 w-4" />
        <span>فتح حاسبة المقاسات</span>
      </Link>
    </div>
  );
};
