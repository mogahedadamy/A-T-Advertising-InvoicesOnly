import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { triggerBack } from "./lib/backButtonHandler";
import { initSQLiteStorage } from "./lib/sqliteStorage";
import { ensureScheduledBackups } from "./lib/backup/autoBackup";
import { runPreUpdateBackupIfNeeded } from "./lib/backup/restoreService";
import { toast } from "sonner";
import "./styles.css";

// تهيئة قاعدة بيانات SQLite وترحيل أي بيانات سابقة قبل عرض التطبيق
const storageInitPromise = initSQLiteStorage().catch((err) => {
  console.warn("SQLite storage init warning:", err);
});

/**
 * نسخة احتياطية قبل أي ترقية لقاعدة البيانات + إعادة تثبيت الجدولة اليومية.
 * تعمل بعد نجاح تهيئة قاعدة البيانات وقبل أن يلمس المستخدم أي بيانات.
 */
storageInitPromise.then(async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await runPreUpdateBackupIfNeeded(true);
    await ensureScheduledBackups();
  } catch (err) {
    console.warn("Backup startup tasks warning:", err);
  }
});

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

    toast.error("يرجى فتح أو تحديد الفاتورة قبل طلب الطباعة");
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
  const renderApp = () => {
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
    );
  };

  // انتظار تهيئة SQLite (بحد أقصى 1.5 ثانية لضمان سرعة الإقلاع)
  Promise.race([
    storageInitPromise,
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ]).finally(renderApp);
}
