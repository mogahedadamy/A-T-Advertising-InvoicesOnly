import { createFileRoute } from "@tanstack/react-router";
import { CustomersPage } from "@/components/customers/CustomersPage";

export const Route = createFileRoute("/customers")({
  head: () => ({
    meta: [
      { title: "سجل العملاء والحسابات - T.A Advertising Solution" },
      { name: "description", content: "دليل وكالات الدعاية والشركات وإدارة أرصدة الحسابات ومتابعة السحوبات" },
    ],
  }),
  component: CustomersPage,
});
