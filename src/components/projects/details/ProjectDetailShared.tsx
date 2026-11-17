import React from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LinkedDocumentSummary } from "@/lib/repositories/ProjectRepository";
import { money } from "./detailsTypes";

export function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "primary" | "good" | "warn" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3 space-y-1 shadow-2xs",
        tone === "primary" && "border-primary/30 bg-primary/[0.06]",
        tone === "good" && "border-emerald-500/30 bg-emerald-500/[0.05]",
        tone === "warn" && "border-amber-500/30 bg-amber-500/[0.05]",
        tone === "neutral" && "border-border/70 bg-card"
      )}
    >
      <p className="text-[10.5px] font-bold text-muted-foreground truncate">{label}</p>
      <p
        className={cn(
          "text-xs sm:text-sm font-black tabular-nums",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "primary" && "text-primary",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 space-y-1.5 shadow-2xs">
      <p className="flex items-center gap-1.5 text-xs font-black text-foreground">
        <Mail className="h-3.5 w-3.5 text-primary" />
        <span>{title}</span>
      </p>
      {children}
    </div>
  );
}

export function SummaryRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn" | "muted";
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "font-black text-foreground text-sm" : "font-bold text-foreground",
          tone === "good" && "text-emerald-600 dark:text-emerald-400",
          tone === "warn" && "text-amber-600 dark:text-amber-400",
          tone === "muted" && "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DocumentList({
  items,
  emptyLabel,
  icon,
  onItemClick,
}: {
  items: LinkedDocumentSummary[];
  emptyLabel: string;
  icon: React.ReactNode;
  onItemClick?: (item: LinkedDocumentSummary) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-5 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/70 bg-card divide-y divide-border/50 overflow-hidden shadow-2xs">
      {items.map((item) => {
        const content = (
          <>
            <div className="flex min-w-0 items-center gap-2.5 text-right">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-secondary/70 border border-border/60">
                {icon}
              </span>
              <div className="min-w-0 space-y-0.5">
                <p className="font-mono text-xs font-black text-foreground truncate">
                  <bdi dir="ltr">{item.reference || "—"}</bdi>
                </p>
                <p className="text-[10.5px] font-bold text-muted-foreground">
                  {item.label}
                  {item.status ? ` · ${item.status}` : ""} · <bdi dir="ltr">{item.date || "—"}</bdi>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs sm:text-sm font-black tabular-nums text-foreground">
                {money(item.total)}
              </span>
              {onItemClick && <ChevronLeft className="h-4 w-4 text-muted-foreground" />}
            </div>
          </>
        );
        return onItemClick ? (
          <button
            key={item.id}
            type="button"
            onClick={() => onItemClick(item)}
            className="flex w-full items-center justify-between gap-2 p-3 text-right transition-colors hover:bg-muted/40 active:bg-muted/60 cursor-pointer"
          >
            {content}
          </button>
        ) : (
          <div key={item.id} className="flex items-center justify-between gap-2 p-3 text-right">
            {content}
          </div>
        );
      })}
    </div>
  );
}
