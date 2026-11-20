import React from "react";
import { Edit3, FileText, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getLetterTemplate } from "@/lib/letters/templates";
import type { OfficialLetter } from "@/lib/letters/types";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  letters: OfficialLetter[];
  onOpenEdit: (letter: OfficialLetter) => void;
  onPrint: (letter: OfficialLetter) => void;
  onDelete: (id: string) => void;
}

export function LetterArchiveList({ letters, onOpenEdit, onPrint, onDelete }: Props) {
  if (letters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-border/80 bg-card/60">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary mb-3">
          <FileText className="h-6 w-6" />
        </span>
        <p className="text-sm font-black text-foreground">لا توجد خطابات محفوظة بعد</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          أي خطاب تصدره أو تحفظه سيظهر هنا لتتمكن من إعادة طباعته أو تعديله لاحقاً بنقرة واحدة.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" dir="rtl">
      {letters.map((item) => {
        const tpl = getLetterTemplate(item.templateId);
        return (
          <div
            key={item.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-2xl border border-border/80 bg-card p-3 shadow-2xs hover:border-primary/40 transition-colors"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  dir="ltr"
                  className="font-mono text-[10.5px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md"
                >
                  {item.reference}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                  {tpl.shortLabel}
                </span>
                <span className="font-mono text-[10.5px] text-muted-foreground" dir="ltr">
                  {item.date}
                </span>
              </div>
              <div className="text-xs sm:text-sm font-black text-foreground truncate">
                {item.recipientName || item.recipientHonorific}
              </div>
              <p className="text-[11px] font-medium text-muted-foreground truncate">
                {item.subject}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  onOpenEdit(item);
                }}
                className="h-8 px-2.5 rounded-lg text-[11px] font-black gap-1 cursor-pointer"
              >
                <Edit3 className="h-3.5 w-3.5 text-primary" />
                <span>فتح وتعديل</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  playTapSound();
                  onPrint(item);
                }}
                className="h-8 px-2.5 rounded-lg text-[11px] font-black gap-1 cursor-pointer"
                title="طباعة الخطاب"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">طباعة</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  playTapSound();
                  onDelete(item.id);
                }}
                aria-label="حذف الخطاب"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
