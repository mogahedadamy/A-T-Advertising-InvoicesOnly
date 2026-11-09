import React from "react";
import { Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playTapSound } from "@/lib/soundEffects";

interface InvoiceDialogTabsProps {
  tab: "edit" | "preview";
  setTab: (tab: "edit" | "preview") => void;
}

/**
 * شريط التبديل السريع بين تعديل البيانات ومعاينة الورقة على الهواتف
 * مصمم لتسهيل اللمس دون تشتيت شاشة الموبايل
 */
export const InvoiceDialogTabs: React.FC<InvoiceDialogTabsProps> = ({
  tab,
  setTab,
}) => {
  return (
    <div className="mx-3 my-2 grid shrink-0 grid-cols-2 rounded-xl bg-secondary p-1 md:hidden">
      <Button
        variant="ghost"
        aria-pressed={tab === "edit"}
        onClick={() => {
          playTapSound();
          setTab("edit");
        }}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition touch-manipulation ${
          tab === "edit"
            ? "bg-card text-primary shadow-xs font-black"
            : "text-muted-foreground"
        }`}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span>البيانات</span>
      </Button>

      <Button
        variant="ghost"
        aria-pressed={tab === "preview"}
        onClick={() => {
          playTapSound();
          setTab("preview");
        }}
        className={`flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition touch-manipulation ${
          tab === "preview"
            ? "bg-card text-primary shadow-xs font-black"
            : "text-muted-foreground"
        }`}
      >
        <Eye className="h-3.5 w-3.5" />
        <span>المعاينة A5</span>
      </Button>
    </div>
  );
};
