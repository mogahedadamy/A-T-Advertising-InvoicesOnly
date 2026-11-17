import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/dashboard/HomePage";

/**
 * الصفحة الرئيسية للتطبيق — وكالة T.A Advertising Solution
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الصفحة الرئيسية - T.A Advertising Solution" },
      {
        name: "description",
        content:
          "نظام إدارة وتوثيق الفواتير، المشاريع، والعمليات المالية لوكالة T.A Advertising Solution",
      },
      {
        property: "og:title",
        content: "الصفحة الرئيسية - T.A Advertising Solution",
      },
      {
        property: "og:description",
        content:
          "نظام إدارة وتوثيق الفواتير، المشاريع، والعمليات المالية لوكالة T.A Advertising Solution",
      },
    ],
  }),
  component: HomePage,
});
