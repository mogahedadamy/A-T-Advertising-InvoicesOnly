import React from "react";
import {
  Fingerprint,
  ShieldCheck,
  ShieldOff,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface BiometricSettingsCardProps {
  bioAvailable: boolean;
  bioEnabled: boolean;
  bioBusy: boolean;
  onToggleBiometric: (next: boolean) => Promise<void>;
  onOpenDiagnostics: () => void;
}

export function BiometricSettingsCard({
  bioAvailable,
  bioEnabled,
  bioBusy,
  onToggleBiometric,
  onOpenDiagnostics,
}: BiometricSettingsCardProps) {
  return (
    <section className="rounded-2xl sm:rounded-3xl border border-primary/20 bg-card p-4 sm:p-5 shadow-sm space-y-4">
      <h2 className="text-xs font-black text-foreground border-b border-border/60 pb-2">
        فتح التطبيق بالبصمة البيومترية
      </h2>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`grid h-10 w-10 place-items-center rounded-xl ${
              bioEnabled
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              فتح التطبيق بالبصمة
            </p>
            <p className="text-xs text-muted-foreground">
              {bioAvailable
                ? bioEnabled
                  ? "البصمة مفعّلة وجاهزة على هذا الجهاز"
                  : "استخدم بصمة الجهاز بدلاً من كتابة الرمز"
                : "البصمة غير متاحة على هذا الجهاز"}
            </p>
          </div>
        </div>
        <Switch
          checked={bioEnabled}
          onCheckedChange={onToggleBiometric}
          disabled={!bioAvailable || bioBusy}
          aria-label="تفعيل/تعطيل البصمة"
        />
      </div>

      {bioBusy && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          جاري معالجة التحقق البيومتري…
        </p>
      )}

      {bioEnabled && (
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 border border-primary/20 p-3">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            البصمة محمية ومحفوظة على جهازك فقط. يمكنك إلغاء تفعيلها في أي وقت.
          </p>
        </div>
      )}

      {!bioAvailable && (
        <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
          <div className="flex items-start gap-2">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              لا يدعم هذا الجهاز أو المتصفح فتح التطبيق بالبصمة حالياً.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full min-h-[40px] rounded-xl text-xs font-bold"
            onClick={onOpenDiagnostics}
          >
            <HelpCircle className="h-4 w-4 ml-1.5" />
            تشخيص دعم البصمة
          </Button>
        </div>
      )}
    </section>
  );
}
