import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "الصفحة الرئيسية - T.A Advertising Solution" },
      {
        name: "description",
        content:
          "نظام إدارة وتوثيق الفواتير والعمليات المالية لوكالة T.A Advertising Solution",
      },
      {
        property: "og:title",
        content: "الصفحة الرئيسية - T.A Advertising Solution",
      },
      {
        property: "og:description",
        content:
          "نظام إدارة وتوثيق الفواتير والعمليات المالية لوكالة T.A Advertising Solution",
      },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/dashboard/HomePage"), "HomePage"),
});
