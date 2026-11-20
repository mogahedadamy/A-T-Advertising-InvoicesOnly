import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات - T.A Advertising Solution" },
      { name: "description", content: "إعدادات T.A Advertising Solution: كلمة المرور، البصمة، والمظهر" },
      { property: "og:title", content: "الإعدادات - T.A Advertising Solution" },
      { property: "og:description", content: "إعدادات T.A Advertising Solution: كلمة المرور، البصمة، والمظهر" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: lazyRouteComponent(() => import("@/components/SettingsPage")),
});
