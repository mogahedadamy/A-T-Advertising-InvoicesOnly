import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/expenses")({
  component: lazyRouteComponent(() => import("@/components/expenses/ExpensesPage"), "ExpensesPage"),
});
