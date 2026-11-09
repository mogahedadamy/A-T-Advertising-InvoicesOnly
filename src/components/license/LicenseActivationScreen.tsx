// @ts-nocheck
/**
 * LicenseActivationScreen.tsx — شاشة طلب التفعيل
 *
 * تُعرض عند أول تشغيل للتطبيق (حالة not_activated).
 * العميل يكتب اسمه أو اسم المطبعة ويضغط «طلب التفعيل».
 */

import { useState } from "react";
import { Printer, Wifi, ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";
const futureLogo = futureLogoAsset.url;

interface Props {
  installationId: string;
  onActivate: (name: string) => Promise<{ ok: boolean; message: string }>;
  loading: boolean;
  errorMessage: string | null;
}

export default function LicenseActivationScreen({
  installationId,
  onActivate,
  loading,
  errorMessage,
}: Props) {
  const [name, setName] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setResult(null);
    const res = await onActivate(name.trim());
    setResult(res);
    setSubmitting(false);
  };

  const isLoading = loading || submitting;
  const sent = result?.ok === true;

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      {/* Decorative glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
          {/* Brand stripe */}
          <div className="h-1.5 bg-gradient-to-r from-primary via-primary/80 to-accent" />

          <div className="p-7">
            {/* Logo */}
            <div className="flex flex-col items-center text-center mb-7">
              <div className="rounded-2xl bg-white p-2 shadow-sm border border-border/60 mb-4">
                <img src={futureLogo} alt="Future Print" className="h-16 w-auto object-contain" />
              </div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-9 w-9 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
              </div>
              <h1 className="text-xl font-black tracking-tight text-foreground">
                تفعيل نظام T.A Advertising
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                أدخل اسمك أو اسم مطبعتك لطلب ترخيص تجريبي مجاني
              </p>
            </div>

            {!sent ? (
              <>
                {/* Input */}
                <div className="mb-4">
                  <label className="block text-sm font-bold text-foreground mb-2">
                    اسم المطبعة أو العميل
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="مثال: مطبعة النيل"
                    className="w-full h-12 rounded-xl border-2 border-input bg-background px-4 text-foreground placeholder:text-muted-foreground/60 text-sm font-medium transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary"
                    disabled={isLoading}
                    autoFocus
                  />
                </div>

                {/* Error */}
                {result?.ok === false && (
                  <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{result.message}</p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={!name.trim() || isLoading}
                  className="w-full h-12 font-bold text-base"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin ml-2" />
                      جاري الإرسال…
                    </>
                  ) : (
                    <>
                      <Wifi className="h-5 w-5 ml-2" />
                      طلب التفعيل
                    </>
                  )}
                </Button>

                {/* Info note */}
                <div className="mt-4 bg-muted/50 border border-border/50 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <Printer className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      سيتم مراجعة طلبك من قبل إدارة T.A Advertising Solution والموافقة عليه خلال وقت قصير.
                      جميع بياناتك محفوظة على جهازك فقط.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              /* Success state */
              <div className="text-center py-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 ring-2 ring-emerald-500/30 flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h2 className="text-lg font-black text-foreground mb-2">تم إرسال الطلب!</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {result?.message}
                  <br />
                  سيتم إشعارك عند الموافقة. يمكنك إغلاق التطبيق وفتحه لاحقاً.
                </p>
                <div className="mt-5 bg-muted/40 border border-border/50 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">
                    معرف جهازك:{" "}
                    <span className="font-mono text-primary/80 break-all">{installationId}</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          © T.A Advertising Solution
        </p>
      </div>
    </div>
  );
}
