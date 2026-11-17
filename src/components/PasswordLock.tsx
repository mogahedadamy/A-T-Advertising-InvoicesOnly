import { useEffect, useRef, useState } from "react";
import { Lock, Moon, Sun, Fingerprint, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import {
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  verifyBiometric,
  disableBiometric,
} from "@/lib/biometricAuth";
import { verifyPassword, PASSWORD_DIGITS } from "@/lib/passwordStore";
import { playTapSound, playSuccessSound, playErrorSound } from "@/lib/soundEffects";

const LENGTH = PASSWORD_DIGITS;
const BIOMETRIC_PROMPT_DISMISSED = "future_calc_biometric_prompt_dismissed";

interface PasswordLockProps {
  onUnlock: () => void;
}

type View = "password" | "enroll-prompt" | "enrolling";

const PasswordLock = ({ onUnlock }: PasswordLockProps) => {
  const { theme, toggle } = useTheme();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [view, setView] = useState<View>("password");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioError, setBioError] = useState<string>("");
  const [bioLoading, setBioLoading] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const autoTriedRef = useRef(false);

  // فحص دعم البصمة + المحاولة التلقائية إن كانت مفعّلة
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const enrolled = isBiometricEnabled();
      const available = await isPlatformAuthenticatorAvailable();
      if (cancelled) return;
      setBioAvailable(available);
      setBioEnrolled(enrolled);

      if (enrolled && available && !autoTriedRef.current) {
        autoTriedRef.current = true;
        await tryBiometric();
      } else {
        inputs.current[0]?.focus();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tryBiometric = async () => {
    setBioError("");
    setBioLoading(true);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        playSuccessSound();
        onUnlock();
      } else {
        playErrorSound();
        setBioError("تعذّر التحقق بالبصمة، استخدم كلمة المرور");
        setTimeout(() => inputs.current[0]?.focus(), 100);
      }
    } catch (err) {
      console.warn("Biometric verify failed", err);
      playErrorSound();
      setBioError("تعذّر التحقق بالبصمة، استخدم كلمة المرور");
      setTimeout(() => inputs.current[0]?.focus(), 100);
    } finally {
      setBioLoading(false);
    }
  };

  const trySubmit = async (vals: string[]) => {
    const code = vals.join("");
    if (code.length < LENGTH) return;
    const ok = await verifyPassword(code);
    if (ok) {
      playSuccessSound();
      // إن كانت البصمة متاحة وغير مفعّلة وقفز المستخدم لم يرفض الاقتراح، اعرضه
      const dismissed = localStorage.getItem(BIOMETRIC_PROMPT_DISMISSED) === "1";
      if (bioAvailable && !bioEnrolled && !dismissed) {
        setView("enroll-prompt");
      } else {
        onUnlock();
      }
    } else {
      playErrorSound();
      setError(true);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setTimeout(() => {
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
      }, 600);
    }
  };

  const handleEnroll = async () => {
    setBioError("");
    setView("enrolling");
    try {
      const ok = await registerBiometric();
      if (ok) {
        playSuccessSound();
        setBioEnrolled(true);
        onUnlock();
      } else {
        playErrorSound();
        setBioError("لم يتم التفعيل، يمكنك المتابعة بكلمة المرور");
        setView("enroll-prompt");
      }
    } catch (err) {
      console.warn("Biometric register failed", err);
      playErrorSound();
      setBioError("تعذّر تفعيل البصمة على هذا الجهاز");
      setView("enroll-prompt");
    }
  };

  const skipEnroll = (remember: boolean) => {
    playTapSound();
    if (remember) localStorage.setItem(BIOMETRIC_PROMPT_DISMISSED, "1");
    onUnlock();
  };

  const handleChange = (i: number, v: string) => {
    const ch = v.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = ch;
    setDigits(next);
    setError(false);
    if (ch) {
      playTapSound();
    }
    if (ch && i < LENGTH - 1) {
      inputs.current[i + 1]?.focus();
    }
    if (next.every((d) => d !== "")) {
      trySubmit(next);
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") trySubmit(digits);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    const focusIdx = Math.min(text.length, LENGTH - 1);
    inputs.current[focusIdx]?.focus();
    if (text.length === LENGTH) trySubmit(next);
  };

  return (
    <div className="min-h-screen h-[100dvh] w-full bg-gradient-soft flex flex-col items-center justify-center p-4 sm:p-6 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] relative overflow-y-auto" dir="rtl">
      {/* decorative brand glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <button
        onClick={toggle}
        aria-label="تبديل الوضع"
        className="absolute top-[max(1rem,env(safe-area-inset-top,0px))] left-[max(1rem,env(safe-area-inset-left,0px))] z-10 h-10 w-10 rounded-full border border-border bg-card/80 backdrop-blur hover:bg-muted flex items-center justify-center transition-all hover:shadow-md active:scale-95"
      >
        {theme === "dark" ? <Sun className="h-5 w-5 text-accent" /> : <Moon className="h-5 w-5 text-primary" />}
      </button>

      {view === "password" && (
        <div className={`relative w-full max-w-sm bg-card border border-border/70 rounded-2xl shadow-elegant overflow-hidden ${shake ? "animate-shake" : ""}`}>
          <div className="h-1.5 bg-gradient-brand" />
          <div className="p-7">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-3 flex items-center justify-center">
                <div className="rounded-2xl bg-white p-2 shadow-sm border border-border/60">
                  <img
                    src={theme === "dark" ? "/ta-logo-white.png" : "/ta-logo.png"}
                    alt="T.A Advertising Solution"
                    className="h-16 w-auto object-contain"
                  />
                </div>
              </div>
              <div className="h-11 w-11 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-3">
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-xl font-black tracking-tight text-foreground">التطبيق مقفل</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {bioEnrolled ? "استخدم البصمة أو كلمة المرور" : "أدخل كلمة المرور للمتابعة"}
              </p>
            </div>

            <div className="flex justify-center gap-2 mb-3" dir="ltr">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onPaste={handlePaste}
                  onFocus={(e) => e.currentTarget.select()}
                  className={`h-14 w-12 text-center text-2xl font-black rounded-xl border-2 bg-background text-foreground tabular-nums transition-all focus:outline-none focus:ring-4 focus:ring-primary/20 ${
                    error
                      ? "border-destructive"
                      : d
                        ? "border-primary shadow-sm"
                        : "border-input hover:border-primary/40"
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-sm font-semibold text-destructive mt-2">
                كلمة المرور غير صحيحة
              </p>
            )}

            {bioError && !error && (
              <p className="text-center text-xs text-muted-foreground mt-2">{bioError}</p>
            )}

            <Button
              type="button"
              onClick={() => trySubmit(digits)}
              className="w-full mt-5 h-11 font-bold"
              disabled={digits.some((d) => !d)}
            >
              فتح التطبيق
            </Button>

            {bioEnrolled && bioAvailable && (
              <button
                type="button"
                onClick={tryBiometric}
                disabled={bioLoading}
                className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-background hover:bg-muted hover:border-primary/40 text-foreground transition-all disabled:opacity-60 active:scale-[0.99]"
              >
                <Fingerprint className="h-5 w-5 text-primary" />
                <span className="text-sm font-bold">
                  {bioLoading ? "جاري التحقق…" : "فتح بالبصمة"}
                </span>
              </button>
            )}

            {bioEnrolled && (
              <button
                type="button"
                onClick={() => {
                  disableBiometric();
                  setBioEnrolled(false);
                }}
                className="mt-3 w-full text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                إلغاء تفعيل البصمة
              </button>
            )}
          </div>
        </div>
      )}

      {view === "enroll-prompt" && (
        <div className="relative w-full max-w-sm bg-card border border-border/70 rounded-2xl shadow-elegant overflow-hidden">
          <div className="h-1.5 bg-gradient-brand" />
          <div className="p-7">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="h-16 w-16 rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-3">
                <Fingerprint className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-foreground">تفعيل فتح التطبيق بالبصمة</h2>
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                لتسريع فتح التطبيق في المرات القادمة، يمكنك استخدام البصمة بدلاً من كتابة كلمة المرور.
              </p>
            </div>

            <div className="bg-muted/50 border border-border/50 rounded-xl p-3 mb-5 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                يتم استخدام بصمة جهازك فقط، ولا تُرسل أي بيانات. يمكنك إلغاء التفعيل في أي وقت.
              </p>
            </div>

            {bioError && (
              <p className="text-center text-sm text-destructive mb-3">{bioError}</p>
            )}

            <Button type="button" onClick={handleEnroll} className="w-full h-11 font-bold">
              <Fingerprint className="h-4 w-4" />
              تفعيل البصمة
            </Button>

            <button
              type="button"
              onClick={() => skipEnroll(false)}
              className="mt-3 w-full text-sm font-semibold text-foreground hover:text-primary transition-colors py-2"
            >
              ليس الآن
            </button>
            <button
              type="button"
              onClick={() => skipEnroll(true)}
              className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              لا تسأل مرة أخرى
            </button>
          </div>
        </div>
      )}

      {view === "enrolling" && (
        <div className="relative w-full max-w-sm bg-card border border-border/70 rounded-2xl shadow-elegant overflow-hidden">
          <div className="h-1.5 bg-gradient-brand" />
          <div className="p-8 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center mb-4 animate-pulse">
              <Fingerprint className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-black text-foreground">جاري تفعيل البصمة…</h2>
            <p className="text-sm text-muted-foreground mt-2">
              اتبع التعليمات على جهازك لإكمال التحقق
            </p>
          </div>
        </div>
      )}

      <p className="relative text-xs font-medium text-muted-foreground mt-6">© T.A Advertising Solution</p>
    </div>
  );
};

export default PasswordLock;
