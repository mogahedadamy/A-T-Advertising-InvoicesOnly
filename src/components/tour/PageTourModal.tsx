import React, { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  X,
  BookOpen,
  LayoutGrid,
  CheckCircle2,
  Lightbulb,
  ExternalLink,
  ArrowUpLeft,
} from "lucide-react";
import type { PageTourGuide } from "./types";
import { ALL_PAGE_GUIDES_LIST } from "./guides";

interface PageTourModalProps {
  guide: PageTourGuide;
  isOpen: boolean;
  onClose: () => void;
  onSelectGuide?: (guide: PageTourGuide) => void;
}

export function PageTourModal({
  guide,
  isOpen,
  onClose,
  onSelectGuide,
}: PageTourModalProps) {
  const [tab, setTab] = useState<"current" | "directory">("current");
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setTab("current");
    }
  }, [isOpen, guide.id]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const GuideIcon = guide.icon;

  const handleAction = (route?: string) => {
    if (route) {
      onClose();
      void navigate({ to: route });
    } else {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-2.5 sm:p-4 bg-black/70 backdrop-blur-md animate-fade-in select-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.75rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(0.75rem, env(safe-area-inset-right, 0px))",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] flex flex-col rounded-3xl border border-border/80 bg-card shadow-2xl animate-scale-up overflow-hidden">
        {/* ترويسة النافذة */}
        <div className="border-b border-border/70 px-4 sm:px-5 py-3 bg-muted/20 shrink-0 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-primary/15 text-primary border border-primary/25 shrink-0">
                <BookOpen className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h2 className="text-xs sm:text-sm font-black text-foreground truncate">
                    دليل استخدام: {guide.pageTitle}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.2 text-[9.5px] font-black text-primary">
                    {guide.badge}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium truncate">
                  تعليمات مبسطة وتوضيح مباشر لكيفية إنجاز عملك في هذه الصفحة
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق الدليل"
              className="grid h-8 w-8 place-items-center rounded-xl bg-secondary/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* تبويبات التبديل */}
          <div className="flex items-center justify-between gap-1.5 p-1 rounded-2xl bg-secondary/50 border border-border/50 text-xs">
            <button
              type="button"
              onClick={() => setTab("current")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                tab === "current"
                  ? "bg-card text-primary shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GuideIcon className="h-3.5 w-3.5" />
              <span>دليل هذه الصفحة</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("directory")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                tab === "directory"
                  ? "bg-card text-primary shadow-xs border border-border/60"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>أدلة باقي الصفحات ({ALL_PAGE_GUIDES_LIST.length})</span>
            </button>
          </div>
        </div>

        {/* جسم النافذة */}
        {tab === "current" ? (
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-4 flex-1">
            {/* ملخص الصفحة */}
            <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-primary/[0.05] p-3.5 shadow-2xs">
              <span
                className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${guide.gradient} ${guide.iconColor} shadow-md shadow-black/10`}
              >
                <GuideIcon className="h-6 w-6 stroke-[2.2]" />
              </span>
              <div className="space-y-1 min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-black text-foreground">
                  {guide.pageTitle}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground font-medium leading-relaxed">
                  {guide.summary}
                </p>
              </div>
            </div>

            {/* خطوات العمل */}
            <div className="space-y-2 rounded-2xl border border-border/60 bg-card p-3.5 shadow-2xs">
              <h4 className="text-xs font-black text-foreground flex items-center gap-1.5 mb-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>كيف تستخدم هذه الصفحة؟ (خطوات سريعة)</span>
              </h4>

              <div className="space-y-2">
                {guide.steps.map((st, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl border border-border/50 bg-secondary/20"
                  >
                    <span className="grid h-5.5 w-5.5 place-items-center rounded-lg bg-primary/15 text-primary shrink-0 font-mono text-[10.5px] font-black mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="text-xs font-black text-foreground">
                        {st.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                        {st.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* نصائح عملية */}
            {guide.tips.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-500/15 p-3 text-right">
                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 text-xs font-black">
                  <Lightbulb className="h-4 w-4 text-amber-500" />
                  <span>نصيحة تهمك:</span>
                </div>
                <ul className="space-y-1.5 pr-2">
                  {guide.tips.map((tp, idx) => (
                    <li
                      key={idx}
                      className="text-[11px] text-amber-900/90 dark:text-amber-200/90 leading-relaxed font-medium list-disc list-inside"
                    >
                      {tp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* زر الإجراء */}
            {guide.actionLabel && (
              <button
                type="button"
                onClick={() => handleAction(guide.actionRoute)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary text-white hover:bg-primary/90 p-3 text-xs font-black shadow-xs shadow-primary/20 transition-all cursor-pointer active:scale-[0.98]"
              >
                <span>{guide.actionLabel}</span>
                <ArrowUpLeft className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          /* فهرس باقي الأدلة */
          <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain space-y-2 flex-1">
            <p className="text-[11px] text-muted-foreground font-medium text-center pb-1">
              اختر أي صفحة لاستعراض دليلها أو الانتقال إليها:
            </p>
            {ALL_PAGE_GUIDES_LIST.map((g) => {
              const Icon = g.icon;
              const isCurrent = g.id === guide.id;
              return (
                <div
                  key={g.id}
                  className={`flex items-center justify-between gap-2.5 p-3 rounded-2xl border transition-all ${
                    isCurrent
                      ? "border-primary/50 bg-primary/[0.04]"
                      : "border-border/70 bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${g.gradient} ${g.iconColor}`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-foreground truncate">
                        {g.pageTitle}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {g.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onSelectGuide?.(g)}
                      className="inline-flex items-center gap-1 rounded-lg bg-secondary/80 border border-border/70 px-2.5 py-1 text-[10.5px] font-bold text-foreground hover:text-primary transition-all cursor-pointer"
                    >
                      <span>عرض الدليل</span>
                    </button>
                    {g.actionRoute && (
                      <button
                        type="button"
                        onClick={() => handleAction(g.actionRoute)}
                        className="inline-flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/25 px-2 py-1 text-[10.5px] font-black text-primary hover:bg-primary hover:text-white transition-all cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

