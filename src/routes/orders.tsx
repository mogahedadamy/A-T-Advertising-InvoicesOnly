import { createFileRoute } from "@tanstack/react-router";
import { MobileHistoryPage } from "@/components/history/MobileHistoryPage";

export const Route = createFileRoute("/orders")({
  component: MobileHistoryPage,
});
