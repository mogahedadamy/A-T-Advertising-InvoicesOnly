import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * تحويل مسار دليل الخامات القديم تلقائياً إلى المسار الرئيسي لمركز الفواتير
 */
export const Route = createFileRoute("/materials")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
