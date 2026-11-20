import React from "react";
import { Building2, FileCheck2, HandCoins } from "lucide-react";
import { LETTER_TEMPLATES } from "@/lib/letters/templates";
import type { LetterTemplateId } from "@/lib/letters/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  selectedId: LetterTemplateId;
  onSelect: (templateId: LetterTemplateId) => void;
}

const TEMPLATE_ICONS: Record<LetterTemplateId, React.ElementType> = {
  introduction: Building2,
  financial_claim: HandCoins,
  authorization: FileCheck2,
};

export function LetterTemplateSelector({ selectedId, onSelect }: Props) {
  return (
    <div className="space-y-1.5" dir="rtl">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-foreground">
          اختر نوع القالب الرسمي الجاهز
        </span>
        <span className="text-[10px] font-bold text-muted-foreground">
          3 قوالب قانونية معتمدة
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {LETTER_TEMPLATES.map((tpl) => {
          const Icon = TEMPLATE_ICONS[tpl.id];
          const active = selectedId === tpl.id;
          return (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                playTapSound();
                onSelect(tpl.id);
              }}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-right transition-all cursor-pointer active:scale-[0.98] ${
                active
                  ? "border-primary bg-primary/10 shadow-2xs ring-1 ring-primary/30"
                  : "border-border/80 bg-card hover:border-primary/40 hover:bg-secondary/40"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  active
                    ? "bg-primary text-white border-primary"
                    : "bg-secondary/60 text-primary border-border/60"
                }`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-foreground leading-tight">
                  {tpl.shortLabel}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                  {tpl.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
