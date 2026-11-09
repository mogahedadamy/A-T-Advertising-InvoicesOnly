import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/components/invoices/InvoicesPage";

export const Route = createFileRoute("/invoices")({
  component: InvoicesPage,
});
