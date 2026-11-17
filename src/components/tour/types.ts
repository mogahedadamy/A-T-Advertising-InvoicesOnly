import type { LucideIcon } from "lucide-react";

/**
 * خطوة إرشادية بسيطة داخل دليل الصفحة
 */
export interface PageTourStep {
  title: string;
  description: string;
}

/**
 * بنية الدليل التعريفي المخصص لكل صفحة في التطبيق
 */
export interface PageTourGuide {
  id: string;
  pageTitle: string;
  badge: string;
  icon: LucideIcon;
  gradient: string;
  iconColor: string;
  summary: string;
  steps: PageTourStep[];
  tips: string[];
  actionLabel?: string;
  actionRoute?: string;
}

