// @ts-nocheck
/**
 * LicenseCheckingScreen.tsx — شاشة التحقق الأولي (Splash)
 */
import { Loader2 } from "lucide-react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
const futureLogo = futureLogoAsset.url;

export default function LicenseCheckingScreen() {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent/8 blur-3xl" />
      </div>
      <div className="relative flex flex-col items-center gap-5">
        <div className="rounded-2xl bg-white p-3 shadow-lg border border-border/60">
          <img src={futureLogo} alt="Future Print" className="h-16 w-auto object-contain" />
        </div>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-semibold text-muted-foreground">جاري التحقق من الترخيص…</p>
        </div>
      </div>
      <p className="absolute bottom-8 text-xs text-muted-foreground">
        © T.A Advertising Solution
      </p>
    </div>
  );
}
