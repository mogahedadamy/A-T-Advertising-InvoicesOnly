import React, { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Fingerprint,
  Moon,
  Sun,
  ShieldCheck,
  ShieldOff,
  Loader2,
  HelpCircle,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  isSoundEnabled,
  setSoundEnabled,
  playSuccessSound,
} from "@/lib/soundEffects";
import { useToast } from "@/hooks/use-toast";
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
import { BiometricDiagnosticsDialog } from "@/components/settings/BiometricDiagnosticsDialog";
import { PasswordChangeCard } from "@/components/settings/PasswordChangeCard";

const Settings: React.FC = () => {
  const { theme, toggle } = useTheme();
  const { toast } = useToast();

  // Biometric state
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);

  // Sound effects state
  const [soundEnabled, setSoundState] = useState(() => isSoundEnabled());

  const handleToggleSound = (checked: boolean) => {
    setSoundState(checked);
    setSoundEnabled(checked);
    if (checked) {
      playSuccessSound();
      toast({
        title: "تم تشغيل المؤثرات الصوتية",
        description: "ستسمع نقرات تفاعلية خفيفة وأصوات تأكيد مريحة.",
      });
    } else {
      toast({
        title: "تم كتم المؤثرات الصوتية",
        description: "التطبيق يعمل الآن في الوضع الصامت تماماً.",
      });
    }
  };

  // Diagnostics
  const [diagOpen, setDiagOpen] = useState(false);
  const [diag, setDiag] = useState<BiometricDiagnostics | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const openDiagnostics = async () => {
    setDiagOpen(true);
    setDiagLoading(true);
    try {
      const result = await runBiometricDiagnostics();
      setDiag(result);
    } finally {
      setDiagLoading(false);
    }
  };

  const copyDiagLabel = async () => {
    if (!diag?.settingsLabel) return;
    try {
      await navigator.clipboard.writeText(diag.settingsLabel);
      toast({ title: "تم النسخ", description: diag.settingsLabel });
    } catch {
      toast({ title: "تعذّر النسخ", variant: "destructive" });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const available = await isPlatformAuthenticatorAvailable();
      if (cancelled) return;
      setBioAvailable(available);
      setBioEnabled(isBiometricEnabled());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleBiometric = async (next: boolean) => {
    if (bioBusy) return;
    setBioBusy(true);
    try {
      if (next) {
        const ok = await registerBiometric();
        if (ok) {
          setBioEnabled(true);
          toast({
            title: "تم تفعيل البصمة",
            description: "يمكنك الآن فتح التطبيق بالبصمة في المرة القادمة.",
          });
        } else {
          toast({
            title: "تعذّر التفعيل",
            description: "حاول مرة أخرى أو تأكد من إعدادات البصمة على جهازك.",
            variant: "destructive",
          });
        }
      } else {
        disableBiometric();
        setBioEnabled(false);
        toast({
          title: "تم إلغاء البصمة",
          description: "ستحتاج لكلمة المرور في كل مرة لفتح التطبيق.",
        });
      }
    } catch (err) {
      console.warn("biometric toggle failed", err);
      toast({
        title: "حدث خطأ",
        description: "تعذّر إكمال العملية على هذا الجهاز.",
        variant: "destructive",
      });
    } finally {
      setBioBusy(false);
    }
  };

  return (
    <PageShell>
      <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-5 md:max-w-3xl">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            aria-label="رجوع"
            className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-secondary text-foreground transition-all hover:border-primary/40 hover:text-primary hover:shadow-sm active:scale-95 touch-manipulation"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-black tracking-tight">الإعدادات</h1>
        </div>

        {/* Business Profile Card */}
        <section className="rounded-2xl sm:rounded-3xl border border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 font-black text-sm shrink-0">
              T.A
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-foreground">T.A Advertising Solution</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                المسؤول: طارق عثمان علي • الخرطوم - بورتسودان
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[10.5px] font-mono text-primary font-bold">
                <span>+249 12371 1444</span>
                <span className="text-muted-foreground/40">•</span>
                <span>+249 91296 8886</span>
              </div>
            </div>
          </div>
        </section>

        {/* Group 1: Preferences (Appearance & Sound) */}
        <section className="rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-foreground/80 border-b border-border/60 pb-2 flex items-center gap-2">
            <span>التفضيلات والمظهر</span>
          </h2>

          {/* Theme row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
                {theme === "dark" ? (
                  <Moon className="h-5 w-5 text-primary" />
                ) : (
                  <Sun className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">الوضع الليلي (Obsidian)</p>
                <p className="text-xs text-muted-foreground">
                  التبديل بين النمط الزمردي النهاري والليلي الفاخر
                </p>
              </div>
            </div>
            <Switch
              checked={theme === "dark"}
              onCheckedChange={toggle}
              aria-label="تبديل الوضع الليلي"
            />
          </div>

          <div className="h-px bg-border/40" />

          {/* Sound row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${soundEnabled
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                  }`}
              >
                {soundEnabled ? (
                  <Volume2 className="h-5 w-5" />
                ) : (
                  <VolumeX className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">المؤثرات الصوتية التفاعلية</p>
                <p className="text-xs text-muted-foreground">
                  أصوات ذكية خفيفة عند الحساب، الإضافة، وحفظ الفواتير
                </p>
              </div>
            </div>
            <Switch
              checked={soundEnabled}
              onCheckedChange={handleToggleSound}
              aria-label="تبديل المؤثرات الصوتية"
            />
          </div>
        </section>

        {/* Group 2: Security (Biometric) */}
        <section className="rounded-2xl sm:rounded-3xl border border-border/70 bg-card p-4 sm:p-5 shadow-sm space-y-4">
          <h2 className="text-xs font-black text-foreground/80 border-b border-border/60 pb-2">
            الأمان وقفل الدخول
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl ${bioEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}
              >
                <Fingerprint className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">فتح التطبيق بالبصمة</p>
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
              onCheckedChange={handleToggleBiometric}
              disabled={!bioAvailable || bioBusy}
              aria-label="تفعيل/تعطيل البصمة"
            />
          </div>

          {bioBusy && (
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
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
                className="w-full min-h-[40px] rounded-xl"
                onClick={openDiagnostics}
              >
                <HelpCircle className="h-4 w-4 ml-1.5" />
                تشخيص دعم البصمة
              </Button>
            </div>
          )}
        </section>

        {/* Password Change Component */}
        <PasswordChangeCard />

        <p className="text-center text-xs text-muted-foreground">
          © T.A Advertising Solution
        </p>
      </main>

      {/* Biometric diagnostics dialog */}
      <BiometricDiagnosticsDialog
        open={diagOpen}
        onOpenChange={setDiagOpen}
        diag={diag}
        loading={diagLoading}
        onRefresh={openDiagnostics}
        onCopyLabel={copyDiagLabel}
      />
    </PageShell>
  );
};

export default Settings;
