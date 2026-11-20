import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/customers")({
  component: lazyRouteComponent(() => import("@/components/customers/CustomersPage"), "CustomersPage"),
});
