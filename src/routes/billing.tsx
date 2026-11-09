import { createFileRoute } from "@tanstack/react-router";
import { BillingPage } from "@/components/billing/BillingPage";

export const Route = createFileRoute("/billing")({
  head: () => ({
    meta: [
      { title: "قسم الفواتير - T.A Advertising Solution" },
      { name: "description", content: "إصدار وإدارة فواتير المبيعات، المشتريات، والفواتير المبدئية بنموذج T.A الرسمي" },
      { property: "og:title", content: "قسم الفواتير - T.A Advertising Solution" },
      { property: "og:description", content: "إصدار وإدارة فواتير المبيعات، المشتريات، والفواتير المبدئية بنموذج T.A الرسمي" },
    ],
  }),
  component: BillingPage,
});
