import React, { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  index: number;
  value: string;
  onChange: (value: string) => void;
}

export function OrderDescriptionField({ index, value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== (value || "")) {
      inputRef.current.value = value || "";
    }
  }, [value]);

  return (
    <div className="mt-1.5 flex items-center gap-2" dir="rtl">
      <label htmlFor={`order-desc-${index}`} className="text-[11px] font-bold text-muted-foreground shrink-0 select-none">
        البيان
      </label>
      <input
        id={`order-desc-${index}`}
        ref={inputRef}
        type="text"
        defaultValue={value}
        onChange={(e) => onChange(e.target.value)}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        aria-label={`البيان للمقاس ${index + 1}`}
        dir="auto"
        className="h-9 min-w-0 flex-1 rounded-md border border-input bg-input px-3 py-1 text-sm font-bold text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}