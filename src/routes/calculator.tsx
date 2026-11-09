import { createFileRoute } from "@tanstack/react-router";
import Index from "@/components/IndexPage";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "الحاسبة - T.A Advertising Solution" },
      { name: "description", content: "حاسبة الطباعة الاحترافية: حساب المقاسات والأسعار وإصدار الفواتير" },
      { property: "og:title", content: "الحاسبة - T.A Advertising Solution" },
      { property: "og:description", content: "حاسبة الطباعة الاحترافية: حساب المقاسات والأسعار وإصدار الفواتير" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});
