import { createFileRoute } from "@tanstack/react-router";
import { MaterialsPage } from "@/components/materials/MaterialsPage";

export const Route = createFileRoute("/materials")({
  head: () => ({
    meta: [
      { title: "الخامات والأسعار - T.A Advertising Solution" },
      { name: "description", content: "دليل خامات الطباعة وعروض الرولات وأسعار المتر المربع" },
      { property: "og:title", content: "الخامات والأسعار - T.A Advertising Solution" },
    ],
  }),
  component: MaterialsPage,
});
