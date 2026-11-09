import React from "react";
import {
  HelpCircle,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type BiometricDiagnostics } from "@/lib/biometricDiagnostics";

interface BiometricDiagnosticsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diag: BiometricDiagnostics | null;
  loading: boolean;
  onRefresh: () => void;
  onCopyLabel: () => void;
}

export const BiometricDiagnosticsDialog: React.FC<BiometricDiagnosticsDialogProps> = ({
  open,
  onOpenChange,
  diag,
  loading,
  onRefresh,
  onCopyLabel,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-right">
            <HelpCircle className="h-5 w-5 text-primary" />
            لماذا البصمة غير متاحة؟
          </DialogTitle>
          <DialogDescription className="text-right">
            فحص سريع لجهازك ومتصفحك مع خطوات الإصلاح المقترحة.
          </DialogDescription>
        </DialogHeader>

        {loading || !diag ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4 text-right">
            {/* Status checks */}
            <div className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
              <DiagRow label="اتصال آمن (HTTPS)" ok={diag.isSecureContext} />
              <DiagRow label="دعم WebAuthn في المتصفح" ok={diag.hasWebAuthn} />
              <DiagRow
                label="مستشعر بصمة/وجه مُفعَّل"
                ok={diag.hasPlatformAuthenticator}
              />
              {diag.platform === "ios" && (
                <DiagRow
                  label="التطبيق مثبّت على الشاشة الرئيسية"
                  ok={diag.isStandalonePWA}
                />
              )}
            </div>

            {diag.reasons.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  الأسباب المحتملة
                </div>
                <ul className="list-disc space-y-1 pr-5 text-xs leading-relaxed text-foreground/80">
                  {diag.reasons.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {diag.fixes.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  خطوات الإصلاح
                </div>
                <ul className="list-disc space-y-1 pr-5 text-xs leading-relaxed text-foreground/80">
                  {diag.fixes.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {(diag.settingsUrl || diag.settingsLabel) && (
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">
                  إعدادات النظام
                </p>
                {diag.settingsLabel && (
                  <p className="mb-2 text-xs text-foreground/80">
                    {diag.settingsLabel}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {diag.settingsUrl && (
                    <Button asChild size="sm" variant="default">
                      <a
                        href={diag.settingsUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="h-4 w-4" />
                        فتح إعدادات النظام
                      </a>
                    </Button>
                  )}
                  {diag.settingsLabel && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={onCopyLabel}
                    >
                      <Copy className="h-4 w-4" />
                      نسخ المسار
                    </Button>
                  )}
                </div>
                {!diag.settingsUrl && (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    لا يمكن فتح إعدادات النظام مباشرة من المتصفح على هذا الجهاز،
                    اتبع المسار يدوياً.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            إغلاق
          </Button>
          <Button type="button" onClick={onRefresh} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            إعادة الفحص
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface DiagRowProps {
  label: string;
  ok: boolean;
}

const DiagRow = ({ label, ok }: DiagRowProps) => (
  <div className="flex items-center justify-between gap-3">
    <span className="text-foreground/80">{label}</span>
    {ok ? (
      <span className="inline-flex items-center gap-1 text-primary font-bold">
        <Check className="h-3.5 w-3.5" />
        متوفر
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-destructive font-bold">
        <X className="h-3.5 w-3.5" />
        غير متوفر
      </span>
    )}
  </div>
);
