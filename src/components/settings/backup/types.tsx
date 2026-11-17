import React from "react";
import {
  ShieldCheck,
  ShieldOff,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import {
  BACKUP_KIND_LABELS,
  type BackupFileInfo,
  type ProtectionStatus,
  type RestoreMode,
  type RestoreResult,
  type BackupSettings,
} from "@/lib/backup/types";

export {
  BACKUP_KIND_LABELS,
  type BackupFileInfo,
  type ProtectionStatus,
  type RestoreMode,
  type RestoreResult,
  type BackupSettings,
};

export const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const day = d.getDate();
  const month = AR_MONTHS[d.getMonth()];
  const year = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} — ${hh}:${mm}`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "لم يتم بعد";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "الآن";
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `قبل ${days} يوم`;
  const months = Math.floor(days / 30);
  return `قبل ${months} شهر`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes < 0) return "غير متاح";
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} كيلوبايت`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} جيجابايت`;
}

export const PROTECTION_META: Record<
  ProtectionStatus,
  { label: string; tone: string; icon: React.ReactNode }
> = {
  protected: {
    label: "محمي بالكامل",
    tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
  },
  unproven: {
    label: "بحاجة لتأكيد",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  outdated: {
    label: "فشل آخر نسخ",
    tone: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  stale: {
    label: "متأخر",
    tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  unprotected: {
    label: "غير محمي",
    tone: "bg-destructive/10 text-destructive border-destructive/30",
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
  browser: {
    label: "داخل المتصفح فقط",
    tone: "bg-muted text-muted-foreground border-border",
    icon: <ShieldOff className="h-3.5 w-3.5" />,
  },
};

export const STATUS_LABEL: Record<BackupFileInfo["status"], { label: string; tone: string }> = {
  verified: { label: "سليمة وموثقة", tone: "text-emerald-600 dark:text-emerald-400" },
  corrupt: { label: "تالفة", tone: "text-destructive" },
  incompatible: { label: "غير متوافقة", tone: "text-amber-600 dark:text-amber-400" },
  unreadable: { label: "غير قابلة للقراءة", tone: "text-muted-foreground" },
  encrypted: { label: "مشفّرة بدون مفتاح", tone: "text-amber-600 dark:text-amber-400" },
};
