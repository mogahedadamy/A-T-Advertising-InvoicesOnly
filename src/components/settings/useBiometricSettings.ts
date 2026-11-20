import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  disableBiometric,
} from "@/lib/biometricAuth";
import {
  runBiometricDiagnostics,
  type BiometricDiagnostics,
} from "@/lib/biometricDiagnostics";

export function useBiometricSettings() {
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  const [diagOpen, setDiagOpen] = useState(false);
  const [diag, setDiag] = useState<BiometricDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const available = await isPlatformAuthenticatorAvailable();
        if (cancelled) return;
        setBioAvailable(available);
        setBioEnabled(isBiometricEnabled());
      } catch {
        if (!cancelled) {
          setBioAvailable(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDiagnostics = async () => {
    setDiagOpen(true);
    setDiagLoading(true);
    try {
      const result = await runBiometricDiagnostics();
      setDiag(result);
    } catch (err) {
      console.warn("biometric diagnostics failed", err);
      toast.error("تعذّر تشغيل فحص البصمة على هذا الجهاز");
    } finally {
      setDiagLoading(false);
    }
  };

  const copyDiagLabel = async () => {
    if (!diag?.settingsLabel) return;
    try {
      await navigator.clipboard.writeText(diag.settingsLabel);
      toast.success("تم النسخ", { description: diag.settingsLabel });
    } catch {
      toast.error("تعذّر النسخ");
    }
  };

  const handleToggleBiometric = async (next: boolean) => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (next) {
        const ok = await registerBiometric();
        if (ok) {
          setBioEnabled(true);
          toast.success("تم تفعيل البصمة", {
            description: "يمكنك الآن فتح التطبيق بالبصمة في المرة القادمة.",
          });
        } else {
          toast.error("تعذّر التفعيل", {
            description: "حاول مرة أخرى أو تأكد من إعدادات البصمة على جهازك.",
          });
        }
      } else {
        disableBiometric();
        setBioEnabled(false);
        toast("تم إلغاء البصمة", {
          description: "ستحتاج لكلمة المرور في كل مرة لفتح التطبيق.",
        });
      }
    } catch (err) {
      console.warn("biometric toggle failed", err);
      toast.error("حدث خطأ", {
        description: "تعذّر إكمال العملية على هذا الجهاز.",
      });
    } finally {
      setBioBusy(false);
    }
  };

  return {
    bioAvailable,
    bioEnabled,
    bioBusy,
    handleToggleBiometric,
    diagOpen,
    setDiagOpen,
    diag,
    diagLoading,
    openDiagnostics,
    copyDiagLabel,
  };
}
