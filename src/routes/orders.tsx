import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/orders")({
  component: lazyRouteComponent(() => import("@/components/history/MobileHistoryPage"), "MobileHistoryPage"),
});
