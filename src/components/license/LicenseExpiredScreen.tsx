// @ts-nocheck
/**
 * LicenseExpiredScreen.tsx — شاشة انتهاء الترخيص
 *
 * تُعرض عند حالة expired.
 * العميل مطمئن: بياناته محفوظة بالكامل، ويمكنه طلب التجديد.
 */

import { CalendarX, RefreshCw, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
const futureLogo = futureLogoAsset.url;

interface Props {
  customerName: string | null;
  onRenew: () => Promise<{ ok: boolean; message: string }>;
  onRefresh: () => Promise<void>;
  loading: boolean;
  isPendingRenewal: boolean;
}

export default function LicenseExpiredScreen({
  customerName,
  onRenew,
  onRefresh,
  loading,
}: Props) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-orange-500/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      {/* Decorative glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-orange-400 via-amber-500 to-primary" />

          <div className="p-7">
            {/* Logo + Icon */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="rounded-2xl bg-white p-2 shadow-sm border border-border/60 mb-4">
                <img src={futureLogo} alt="Future Print" className="h-12 w-auto object-contain" />
              </div>

              <div className="h-16 w-16 rounded-full bg-orange-500/10 ring-2 ring-orange-500/30 flex items-center justify-center mb-4">
                <CalendarX className="h-8 w-8 text-orange-500" />
              </div>

              <h1 className="text-xl font-black tracking-tight text-foreground">
                انتهت صلاحية الترخيص
              </h1>
              {customerName && (
                <p className="text-base font-semibold text-primary mt-1">{customerName}</p>
              )}
            </div>

            {/* Reassurance box */}
            <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground mb-1">بياناتك محفوظة بالكامل</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    جميع فواتيرك وطلباتك وأسعارك موجودة على جهازك ولم يُمس منها شيء.
                    يمكنك مراجعتها وتصديرها في أي وقت.
                  </p>
                </div>
              </div>
            </div>

            {/* What you can still do */}
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 mb-5">
              <p className="text-xs font-bold text-foreground mb-2">ما يمكنك فعله الآن:</p>
              <div className="space-y-1.5">
                {[
                  "مراجعة الفواتير والطلبات السابقة",
                  "تصدير نسخة احتياطية من بياناتك",
                  "طباعة الفواتير القديمة",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Renew button */}
            <Button
              onClick={onRenew}
              disabled={loading}
              className="w-full h-12 font-bold text-base mb-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  جاري الإرسال…
                </>
              ) : (
                <>
                  <RefreshCw className="h-5 w-5 ml-2" />
                  طلب التجديد
                </>
              )}
            </Button>

            {/* Refresh to check if renewed externally */}
            <button
              onClick={onRefresh}
              disabled={loading}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 font-medium"
            >
              فحص الحالة
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          © T.A Advertising Solution
        </p>
      </div>
    </div>
  );
}
