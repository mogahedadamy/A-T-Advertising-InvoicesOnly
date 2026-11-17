import React from "react";
import { formatNumber } from "@/lib/printCalculator";
import type { LinkedDocumentSummary } from "@/lib/repositories/ProjectRepository";

export function money(value: number): string {
  return `${formatNumber(Number(value) || 0)} ج.س`;
}

export interface MetricTileProps {
  label: string;
  value: string;
  tone?: "primary" | "good" | "warn" | "neutral";
}

export interface SummaryRowProps {
  label: string;
  value: string;
  tone?: "good" | "warn" | "muted";
  strong?: boolean;
}

export interface DocumentListProps {
  items: LinkedDocumentSummary[];
  emptyLabel: string;
  icon: React.ReactNode;
  onItemClick?: (item: LinkedDocumentSummary) => void;
}
