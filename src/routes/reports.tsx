import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/reports/ReportsPage";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "التقارير والمؤشرات المالية - T.A Advertising Solution" },
      { name: "description", content: "مؤشرات الأداء المالي، استهلاك الخامات، المبيعات والتحصيلات" },
    ],
  }),
  component: ReportsPage,
});
