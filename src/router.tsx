import { createRouter, createHashHistory, Link, type ErrorComponentProps } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultRouteError({ error, reset }: ErrorComponentProps) {
  return (
    <div dir="rtl" className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md space-y-4 rounded-3xl border border-destructive/30 bg-card p-5 shadow-elegant text-center">
        <h1 className="text-base font-black text-foreground">تعذر عرض هذه الصفحة</h1>
        <p className="text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "حدث خطأ غير متوقع أثناء تحميل المسار."}
        </p>
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <Link
            to="/"
            className="inline-flex h-9 items-center justify-center rounded-xl border border-border bg-card px-4 text-xs font-black text-foreground"
          >
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

const hashHistory = createHashHistory();

export const router = createRouter({
  routeTree,
  history: hashHistory,
  scrollRestoration: true,
  defaultPreload: "intent",
  defaultPreloadStaleTime: 30000,
  defaultErrorComponent: DefaultRouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
