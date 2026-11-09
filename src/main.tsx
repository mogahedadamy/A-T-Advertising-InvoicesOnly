import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { triggerBack } from "./lib/backButtonHandler";
import { initNativeStorage } from "./lib/nativeStorage";
import { toast } from "sonner";
import "./styles.css";

// تحميل واستعادة كافة البيانات المخزنة من نظام أندرويد الأصلي فور تشغيل التطبيق
initNativeStorage([
  "future_print_orders_v2",
  "future_print_invoices_v2",
  "future_custom_invoices_v2",
  "future_proforma_invoices_v2",
  "future_print_customers_v2",
  "future_calculator_order_session",
  "future_invoice_seq",
  "future_proforma_seq",
  "future_calc_app_password_hash",
  "future_print_sound_enabled",
]).catch(console.warn);

// ربط أمر الطباعة العام بجسر أندرويد الأصلي مع منع ظهور صفحة بيضاء
if (typeof window !== "undefined" && (window as any).AndroidPrint) {
  window.print = function () {
    const targetElement =
      document.querySelector<HTMLElement>(".invoice-print-root") ||
      document.querySelector<HTMLElement>("#custom-invoice-print-portal") ||
      document.querySelector<HTMLElement>(".custom-invoice-print-root") ||
      document.querySelector<HTMLElement>(".proforma-print-root") ||
      document.querySelector<HTMLElement>(".invoice-paper") ||
      document.querySelector<HTMLElement>(".standard-invoice-sheet") ||
      document.querySelector<HTMLElement>(".proforma-sheet");

    const isA5 =
      targetElement?.classList.contains("invoice-paper") ||
      targetElement?.querySelector(".invoice-paper") !== null ||
      (Boolean(document.title) && (document.title.includes("طلب") || document.title.includes("تشغيل")));
    const pageSize: "a4" | "a5" = isA5 ? "a5" : "a4";

    if (targetElement && typeof (window as any).AndroidPrint.printHtml === "function") {
      import("./lib/pdfExport").then(({ buildStandaloneInvoiceHtml }) => {
        const html = buildStandaloneInvoiceHtml(targetElement, document.title || "فاتورة-TA", pageSize);
        (window as any).AndroidPrint.printHtml(html, document.title || "فاتورة-TA", pageSize.toUpperCase());
      });
      return;
    }

    (window as any).AndroidPrint.print(document.title || "فاتورة-TA");
  };
}

// Native Android optimizations & hardware back button handling
if (Capacitor.isNativePlatform()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#0D4A39" }).catch(() => {});

  let lastBackPressTime = 0;

  CapApp.addListener("backButton", () => {
    // 1. Check custom registered handlers (modals, dialogs, drawers)
    if (triggerBack()) {
      return;
    }

    // 2. Check DOM for any open dialog or drawer close button
    const closeBtn = document.querySelector(
      '[role="dialog"] button[aria-label="إغلاق"], [role="dialog"] button[aria-label="Close"], [data-state="open"] button[aria-label="Close"], [data-state="open"] button[data-dialog-close]'
    ) as HTMLElement | null;
    if (closeBtn) {
      closeBtn.click();
      return;
    }

    // 3. If currently on a sub-route, return hierarchically to home dashboard (/)
    const hash = window.location.hash;
    if (hash && hash !== "#/" && hash !== "") {
      router.navigate({ to: "/" });
      return;
    }

    // 4. Double tap back button to exit on home screen
    const now = Date.now();
    if (now - lastBackPressTime < 2000) {
      CapApp.exitApp();
    } else {
      lastBackPressTime = now;
      toast("اضغط مرة أخرى للخروج من التطبيق", { duration: 1500 });
    }
  });
}

const rootEl = document.getElementById("root");
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}
