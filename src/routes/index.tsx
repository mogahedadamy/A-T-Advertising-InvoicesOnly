import { createFileRoute } from "@tanstack/react-router";
import Index from "@/components/IndexPage";

/**
 * المسار الرئيسي للتطبيق — يعرض الحاسبة مباشرة ليكون تطبيقاً متخصصاً في الحاسبة وإصدار الفواتير
 */
export const Route = createFileRoute("/")({
  component: Index,
});
