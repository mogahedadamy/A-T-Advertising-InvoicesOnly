import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DraftDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
  onAdd: () => void;
  className?: string;
}

export const DraftDescriptionField = forwardRef<HTMLInputElement, DraftDescriptionFieldProps>(
  ({ value, onChange, onAdd, className }, ref) => {
    const innerRef = useRef<HTMLInputElement>(null);
    useImperativeHandle(ref, () => innerRef.current as HTMLInputElement);

    // Keep DOM input value synchronized when external value changes (e.g. reset on add or clear)
    useEffect(() => {
      if (innerRef.current && innerRef.current.value !== value) {
        innerRef.current.value = value;
      }
    }, [value]);

    const handleClear = () => {
      if (innerRef.current) {
        innerRef.current.value = "";
        innerRef.current.focus();
      }
      onChange("");
    };

    return (
      <div className={cn("mt-2 flex items-center gap-2", className)} dir="rtl">
        <label
          htmlFor="draft-item-description"
          className="shrink-0 text-[11px] font-bold text-muted-foreground select-none"
        >
          البيان
        </label>
        <div className="relative flex-1 min-w-0">
          <input
            id="draft-item-description"
            ref={innerRef}
            type="text"
            defaultValue={value}
            onInput={(e) => {
              onChange((e.target as HTMLInputElement).value);
            }}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAdd();
              }
            }}
            placeholder="بيان هذا المقاس (مثال: واجهة، يافطة، ستيكر...)"
            enterKeyHint="done"
            dir="auto"
            className="h-10 w-full rounded-lg border border-border bg-input px-3 pe-8 text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {Boolean(value) && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="مسح البيان"
              className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground active:scale-90 transition-all cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }
);

DraftDescriptionField.displayName = "DraftDescriptionField";