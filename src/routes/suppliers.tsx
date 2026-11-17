import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/components/suppliers/SuppliersPage";

export const Route = createFileRoute("/suppliers")({
  component: SuppliersPage,
});