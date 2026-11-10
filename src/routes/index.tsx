import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/billing/BillingPage";

/**
 * المسار الرئيسي للتطبيق — يعرض مركز إصدار الفواتير الرسمي مباشرة
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "مركز إصدار الفواتير - T.A Advertising Solution" },
      {
        name: "description",
        content:
          "النظام الشامل لإدارة وإصدار فواتير المبيعات، المشتريات، والفواتير المبدئية",
      },
      {
        property: "og:title",
        content: "مركز إصدار الفواتير - T.A Advertising Solution",
      },
      {
        property: "og:description",
        content:
          "النظام الشامل لإدارة وإصدار فواتير المبيعات، المشتريات، والفواتير المبدئية",
      },
    ],
  }),
  component: BillingPage,
});
