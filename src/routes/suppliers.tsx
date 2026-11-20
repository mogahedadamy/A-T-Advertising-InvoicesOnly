import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/suppliers")({
  component: lazyRouteComponent(() => import("@/components/suppliers/SuppliersPage"), "SuppliersPage"),
});
