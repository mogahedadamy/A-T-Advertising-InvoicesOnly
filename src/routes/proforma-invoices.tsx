import { createFileRoute } from "@tanstack/react-router";
import { ProformaInvoicesPage } from "@/components/proforma/ProformaInvoicesPage";

export const Route = createFileRoute("/proforma-invoices")({
  head: () => ({
    meta: [
      { title: "الفواتير المبدئية وعروض الأسعار - T.A Advertising Solution" },
      { name: "description", content: "إصدار وإدارة عروض الأسعار والفواتير المبدئية للعملاء والتعديل عليها" },
      { property: "og:title", content: "الفواتير المبدئية - T.A Advertising Solution" },
      { property: "og:description", content: "إصدار وإدارة عروض الأسعار والفواتير المبدئية للعملاء والتعديل عليها" },
    ],
  }),
  component: ProformaInvoicesPage,
});
