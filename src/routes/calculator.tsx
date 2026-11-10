import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * تحويل مسار الحاسبة القديم تلقائياً إلى المسار الرئيسي لمركز الفواتير
 */
export const Route = createFileRoute("/calculator")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
