// @ts-nocheck
/**
 * LicenseGateway.tsx — بوابة الترخيص الرئيسية
 *
 * يُعرض هذا المكون بعد فتح قفل PIN مباشرة.
 * يفحص حالة الترخيص ويوجّه المستخدم للشاشة المناسبة:
 * - checking: شاشة انتظار
 * - not_activated: شاشة طلب التفعيل
 * - pending_approval: شاشة انتظار الموافقة
 * - active: يعرض المحتوى الرئيسي (children)
 * - expired: شاشة انتهاء المدة مع طلب التجديد
 * - renewal_required: شاشة طلب التجديد معلق
 * - revoked: شاشة الإلغاء
 * - clock_tampered: شاشة خطأ الساعة
 */

import { type ReactNode, useState } from "react";
import { useLicense } from "@/lib/licenseStore";
import LicenseActivationScreen from "./LicenseActivationScreen";
import LicensePendingScreen from "./LicensePendingScreen";
import LicenseExpiredScreen from "./LicenseExpiredScreen";
import LicenseRevokedScreen from "./LicenseRevokedScreen";
import LicenseClockScreen from "./LicenseClockScreen";
import LicenseCheckingScreen from "./LicenseCheckingScreen";
import LicenseBanner from "./LicenseBanner";

interface LicenseGatewayProps {
  children: ReactNode;
}

export default function LicenseGateway({ children }: LicenseGatewayProps) {
  const { state, loading, activate, renew, refresh } = useLicense();

  switch (state.status) {
    case "checking":
      return <LicenseCheckingScreen />;

    case "not_activated":
      return (
        <LicenseActivationScreen
          installationId={state.installationId}
          onActivate={activate}
          loading={loading}
          errorMessage={state.errorMessage}
        />
      );

    case "pending_approval":
      return (
        <LicensePendingScreen
          customerName={state.customerName}
          installationId={state.installationId}
          onRefresh={refresh}
          loading={loading}
          isPendingRenewal={false}
        />
      );

    case "active":
      return <>{children}</>;

    case "expired":
      return (
        <LicenseExpiredScreen
          customerName={state.customerName}
          onRenew={renew}
          onRefresh={refresh}
          loading={loading}
          isPendingRenewal={false}
        />
      );

    case "renewal_required":
      return (
        <LicensePendingScreen
          customerName={state.customerName}
          installationId={state.installationId}
          onRefresh={refresh}
          loading={loading}
          isPendingRenewal={true}
        />
      );

    case "revoked":
      return (
        <LicenseRevokedScreen
          errorMessage={state.errorMessage}
          installationId={state.installationId}
        />
      );

    case "clock_tampered":
      return (
        <LicenseClockScreen
          onRefresh={refresh}
          loading={loading}
        />
      );

    default:
      return <LicenseCheckingScreen />;
  }
}
