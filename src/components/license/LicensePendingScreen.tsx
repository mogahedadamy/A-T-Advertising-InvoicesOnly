// @ts-nocheck
/**
 * LicensePendingScreen.tsx — شاشة الانتظار
 *
 * تُعرض عند حالتين:
 * - pending_approval: طلب التفعيل الأول معلق
 * - renewal_required: طلب التجديد معلق
 */

import { Clock, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
const futureLogo = futureLogoAsset.url;

interface Props {
  customerName: string | null;
  installationId: string;
  onRefresh: () => Promise<void>;
  loading: boolean;
  isPendingRenewal: boolean;
}

export default function LicensePendingScreen({
  customerName,
  installationId,
  onRefresh,
  loading,
  isPendingRenewal,
}: Props) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-amber-500/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      {/* Decorative glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-orange-400" />

          <div className="p-7 text-center">
            {/* Logo */}
            <div className="flex justify-center mb-5">
              <div className="rounded-2xl bg-white p-2 shadow-sm border border-border/60">
                <img src={futureLogo} alt="Future Print" className="h-12 w-auto object-contain" />
              </div>
            </div>

            {/* Animated clock icon */}
            <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 ring-2 ring-amber-500/30 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
            </div>

            <h1 className="text-xl font-black tracking-tight text-foreground mb-2">
              {isPendingRenewal ? "طلب التجديد قيد المراجعة" : "طلبك قيد المراجعة"}
            </h1>

            {customerName && (
              <p className="text-base font-semibold text-primary mb-1">{customerName}</p>
            )}

            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {isPendingRenewal
                ? "تم إرسال طلب التجديد لإدارة T.A Advertising Solution. بمجرد الموافقة، ستعود جميع الميزات تلقائياً."
                : "يراجع فريق T.A Advertising Solution طلبك وسيتم الرد في أقرب وقت. يمكنك إعادة الفحص للتحقق من الحالة."}
            </p>

            {/* Steps */}
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 mb-6 text-right">
              <div className="space-y-2">
                {[
                  { done: true, text: "تم إرسال الطلب بنجاح" },
                  { done: false, text: "مراجعة الطلب من قبل الإدارة" },
                  { done: false, text: "تفعيل الترخيص ومزامنته" },
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 ${
                        step.done
                          ? "bg-emerald-500/20 ring-1 ring-emerald-500/40"
                          : "bg-muted ring-1 ring-border"
                      }`}
                    >
                      {step.done ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <span className="text-xs text-muted-foreground font-bold">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-sm ${step.done ? "text-foreground font-semibold" : "text-muted-foreground"}`}
                    >
                      {step.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Button
              onClick={onRefresh}
              disabled={loading}
              variant="outline"
              className="w-full h-11 font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الفحص…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  فحص الحالة
                </>
              )}
            </Button>

            {/* Device ID */}
            <div className="mt-4">
              <p className="text-xs text-muted-foreground break-all">
                معرف الجهاز:{" "}
                <span className="font-mono text-primary/70">{installationId}</span>
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
