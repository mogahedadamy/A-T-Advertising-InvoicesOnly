import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export interface CustomersRouteSearch {
  id?: string;
}

export const Route = createFileRoute("/customers")({
  validateSearch: (search: Record<string, unknown>): CustomersRouteSearch => ({
    id: typeof search.id === "string" && search.id.trim() ? search.id : undefined,
  }),
  component: lazyRouteComponent(() => import("@/components/customers/CustomersPage"), "CustomersPage"),
});
