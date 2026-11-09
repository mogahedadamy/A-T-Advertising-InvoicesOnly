import type { ReactNode } from "react";

interface Props {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  emphasize?: boolean;
}

/** بطاقة إحصائية واحدة في اللوحة */
export function StatCard({ label, value, hint, icon, emphasize }: Props) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-elegant transition md:p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground md:text-xs">
        {icon}
        {label}
      </div>
      <p
        className={`mt-1 break-all text-lg font-black leading-tight md:text-xl ${
          emphasize ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
