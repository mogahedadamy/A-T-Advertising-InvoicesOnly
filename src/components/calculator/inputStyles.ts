import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * دمج أسماء فئات Tailwind بأمان
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * استخراج أصناف حدود الإدخال الموحدة بحسب حالة الخطأ
 * تلغي تكرار كود التنسيق (DRY) وتضمن اتساق التصميم
 */
export function getInputValidationClass(hasError?: boolean, extraClasses?: string): string {
  return cn(
    "rounded-xl border bg-input text-foreground outline-none transition-colors focus:ring-2 touch-manipulation",
    hasError
      ? "border-destructive focus:border-destructive focus:ring-destructive/30"
      : "border-border focus:border-primary focus:ring-primary/20",
    extraClasses
  );
}
