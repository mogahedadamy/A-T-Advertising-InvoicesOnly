import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/proforma-invoices")({
  beforeLoad: () => {
    throw redirect({ to: "/billing" });
  },
  component: () => null,
});
