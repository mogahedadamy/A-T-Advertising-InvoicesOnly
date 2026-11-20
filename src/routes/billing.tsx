import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "قسم الفواتير - T.A Advertising Solution" },
      { name: "description", content: "إصدار وإدارة فواتير المبيعات، المشتريات، والفواتير المبدئية بنموذج T.A الرسمي" },
      { property: "og:title", content: "قسم الفواتير - T.A Advertising Solution" },
      { property: "og:description", content: "إصدار وإدارة فواتير المبيعات، المشتريات، والفواتير المبدئية بنموذج T.A الرسمي" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/billing/BillingPage"), "BillingPage"),
});
