import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/finance")({
  component: lazyRouteComponent(() => import("@/components/finance/FinancePage"), "FinancePage"),
});
