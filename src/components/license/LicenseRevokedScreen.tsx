// @ts-nocheck
/**
 * LicenseRevokedScreen.tsx — شاشة الترخيص الملغي
 */
import { ShieldX } from "lucide-react";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
const futureLogo = futureLogoAsset.url;

interface Props {
  errorMessage: string | null;
  installationId: string;
}

export default function LicenseRevokedScreen({ errorMessage, installationId }: Props) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-destructive/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      <div className="relative w-full max-w-sm">
        <div className="bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-destructive via-red-500 to-rose-500" />
          <div className="p-7 text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-2xl bg-white p-2 shadow-sm border border-border/60">
                <img src={futureLogo} alt="Future Print" className="h-12 w-auto object-contain" />
              </div>
            </div>
            <div className="h-16 w-16 mx-auto rounded-full bg-destructive/10 ring-2 ring-destructive/30 flex items-center justify-center mb-4">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-black text-foreground mb-2">تم إلغاء الترخيص</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              {errorMessage || "تم إلغاء هذا الترخيص من قبل الإدارة."}
            </p>
            <div className="bg-muted/40 border border-border/50 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                يرجى التواصل مع إدارة T.A Advertising Solution لمعرفة السبب أو طلب ترخيص جديد.
              </p>
              <p className="text-xs text-muted-foreground mt-2 font-mono break-all text-primary/60">
                {installationId}
              </p>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-5">
          © T.A Advertising Solution
        </p>
      </div>
    </div>
  );
}
