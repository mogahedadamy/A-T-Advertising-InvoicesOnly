import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Fingerprint, Lock, Moon, ShieldCheck, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import {
  isBiometricEnabled,
  isPlatformAuthenticatorAvailable,
  registerBiometric,
  verifyBiometric,
} from "@/lib/biometricAuth";
import {
  getPinLockoutState,
  resetPinAttempts,
  verifyPassword,
  PASSWORD_DIGITS,
} from "@/lib/passwordStore";
import { playTapSound, playSuccessSound, playErrorSound } from "@/lib/soundEffects";

const LENGTH = PASSWORD_DIGITS;
const BIOMETRIC_PROMPT_DISMISSED = "future_calc_biometric_prompt_dismissed";
const KEYPAD_NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

function formatLockoutCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
  return `${secs} ثانية`;
}

interface PasswordLockProps {
  onUnlock: () => void;
}

type View = "password" | "enroll-prompt" | "enrolling";

/**
 * شاشة القفل فائقة السرعة (0ms استجابة لمسية):
 * - لوحة أرقام مدمجة تعمل بحدث onPointerDown الفوري بدون تأخير لوحة مفاتيح أندرويد (IME)
 * - بدون مرشحات blur-3xl أو backdrop-blur الثقيلة على معالج الرسوميات
 * - دعم كامل للوحة المفاتيح الفيزيائية واللصق + البصمة البيومترية
 */
const PasswordLock = ({ onUnlock }: PasswordLockProps) => {
  const { theme, toggle } = useTheme();
  const [pin, setPin] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);
  const [view, setView] = useState<View>("password");
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioError, setBioError] = useState<string>("");
  const [bioLoading, setBioLoading] = useState(false);
  const [lockoutRemainingSec, setLockoutRemainingSec] = useState<number>(() =>
    Math.ceil(getPinLockoutState().remainingMs / 1000)
  );

  const pinRef = useRef("");
  const verifyingRef = useRef(false);
  const autoTriedRef = useRef(false);
  const timeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const scheduleTimeout = useCallback((fn: () => void, delayMs: number) => {
    const id = setTimeout(() => {
      timeoutsRef.current.delete(id);
      fn();
    }, delayMs);
    timeoutsRef.current.add(id);
  }, []);

  useEffect(() => {
    const activeTimeouts = timeoutsRef.current;
    return () => {
      activeTimeouts.forEach((id) => clearTimeout(id));
      activeTimeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (lockoutRemainingSec <= 0) return;
    const interval = setInterval(() => {
      const nextSec = Math.ceil(getPinLockoutState().remainingMs / 1000);
      setLockoutRemainingSec(nextSec);
      if (nextSec <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutRemainingSec]);

  const tryBiometric = useCallback(async () => {
    setBioError("");
    setBioLoading(true);
    try {
      const ok = await verifyBiometric();
      if (ok) {
        await resetPinAttempts();
        setLockoutRemainingSec(0);
        playSuccessSound();
        onUnlock();
      } else {
        playErrorSound();
        setBioError("تعذّر التحقق بالبصمة، استخدم رمز المرور");
      }
    } catch {
      playErrorSound();
      setBioError("تعذّر التحقق بالبصمة، استخدم رمز المرور");
    } finally {
      setBioLoading(false);
    }
  }, [onUnlock]);

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
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tryBiometric]);

  const submitPin = useCallback(
    async (code: string) => {
      if (verifyingRef.current || code.length < LENGTH) return;
      const lockState = getPinLockoutState();
      if (lockState.isLocked) {
        setLockoutRemainingSec(Math.ceil(lockState.remainingMs / 1000));
        setError(true);
        return;
      }

      verifyingRef.current = true;
      setVerifying(true);

      // إتاحة إطار رسم فوري (0ms) لإظهار النقطة الرابعة قبل تشغيل PBKDF2
      await new Promise<void>((resolve) => setTimeout(resolve, 16));

      try {
        const ok = await verifyPassword(code);
        if (ok) {
          setLockoutRemainingSec(0);
          playSuccessSound();
          const dismissed = localStorage.getItem(BIOMETRIC_PROMPT_DISMISSED) === "1";
          if (bioAvailable && !bioEnrolled && !dismissed) {
            setView("enroll-prompt");
          } else {
            onUnlock();
          }
        } else {
          playErrorSound();
          const updatedLock = getPinLockoutState();
          if (updatedLock.isLocked) {
            setLockoutRemainingSec(Math.ceil(updatedLock.remainingMs / 1000));
          }
          setError(true);
          setShake(true);
          scheduleTimeout(() => setShake(false), 420);
          scheduleTimeout(() => {
            pinRef.current = "";
            setPin("");
          }, 420);
        }
      } finally {
        verifyingRef.current = false;
        setVerifying(false);
      }
    },
    [bioAvailable, bioEnrolled, onUnlock, scheduleTimeout]
  );

  const appendDigit = useCallback(
    (digit: string) => {
      if (lockoutRemainingSec > 0 || verifyingRef.current) return;
      if (pinRef.current.length >= LENGTH) return;

      const nextPin = pinRef.current + digit;
      pinRef.current = nextPin;
      setPin(nextPin);
      setError(false);

      // تشغيل الصوت بشكل غير معطل بعد إطار اللمس
      setTimeout(() => playTapSound(), 0);

      if (nextPin.length === LENGTH) {
        void submitPin(nextPin);
      }
    },
    [lockoutRemainingSec, submitPin]
  );

  const handleBackspace = useCallback(() => {
    if (lockoutRemainingSec > 0 || verifyingRef.current) return;
    if (!pinRef.current.length) return;
    const nextPin = pinRef.current.slice(0, -1);
    pinRef.current = nextPin;
    setPin(nextPin);
    setError(false);
    setTimeout(() => playTapSound(), 0);
  }, [lockoutRemainingSec]);

  // دعم لوحة المفاتيح الفيزيائية (للحاسوب أو الكيبورد الخارجي)
  useEffect(() => {
    if (view !== "password") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === "Enter" && pinRef.current.length === LENGTH) {
        e.preventDefault();
        void submitPin(pinRef.current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [view, appendDigit, handleBackspace, submitPin]);

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
        setBioError("لم يتم التفعيل، يمكنك المتابعة برمز المرور");
        setView("enroll-prompt");
      }
    } catch {
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

  const isDisabled = lockoutRemainingSec > 0 || verifying;

  return (
    <div
      className="min-h-screen h-[100dvh] w-full bg-background flex flex-col items-center justify-center px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] relative overflow-y-auto select-none"
      dir="rtl"
    >
      <button
        type="button"
        onClick={toggle}
        aria-label="تبديل الوضع"
        className="absolute top-[max(0.85rem,env(safe-area-inset-top,0px))] left-[max(0.85rem,env(safe-area-inset-left,0px))] z-10 h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center active:scale-95 touch-manipulation"
      >
        {theme === "dark" ? <Sun className="h-5 w-5 text-accent" /> : <Moon className="h-5 w-5 text-primary" />}
      </button>

      {view === "password" && (
        <div
          className={`relative w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden ${
            shake ? "animate-shake" : ""
          }`}
        >
          <div className="h-1.5 bg-primary" />
          <div className="px-5 py-5 sm:p-6">
            {/* الترويسة والشعار */}
            <div className="flex flex-col items-center text-center mb-4">
              <div className="rounded-xl bg-white dark:bg-[#0C251E] px-3 py-1.5 border border-border/60 mb-2.5">
                <img
                  src={theme === "dark" ? "/ta-logo-white.png" : "/ta-logo.png"}
                  alt="T.A Advertising Solution"
                  className="h-12 w-auto object-contain"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-primary" />
                <h1 className="text-lg font-black tracking-tight text-foreground">التطبيق مقفل</h1>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {verifying
                  ? "جاري التحقق..."
                  : bioEnrolled
                    ? "أدخل رمز المرور أو استخدم البصمة"
                    : "أدخل رمز المرور المكوّن من 4 أرقام"}
              </p>
            </div>

            {/* مؤشرات الخانات الأربع (تحديث لحظي 0ms بدون تركيز IME) */}
            <div className="flex justify-center gap-3 mb-4" dir="ltr" aria-label="رمز المرور">
              {Array.from({ length: LENGTH }).map((_, i) => {
                const filled = i < pin.length;
                return (
                  <div
                    key={i}
                    className={`h-12 w-12 rounded-xl border-2 flex items-center justify-center ${
                      error
                        ? "border-destructive bg-destructive/5"
                        : filled
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 rounded-full ${
                        filled ? (error ? "bg-destructive" : "bg-primary") : "bg-transparent"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* رسائل الحالة والأخطاء */}
            <div className="min-h-[20px] mb-3 text-center">
              {lockoutRemainingSec > 0 ? (
                <p className="text-xs font-bold text-destructive" role="alert">
                  محاولات خاطئة متكررة — انتظر {formatLockoutCountdown(lockoutRemainingSec)}
                </p>
              ) : error ? (
                <p className="text-xs font-bold text-destructive">رمز المرور غير صحيح</p>
              ) : bioError ? (
                <p className="text-xs font-medium text-muted-foreground">{bioError}</p>
              ) : null}
            </div>

            {/* لوحة الأرقام اللمسية السريعة (onPointerDown الفوري = استجابة 0ms) */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[270px] mx-auto" dir="ltr">
              {KEYPAD_NUMBERS.map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isDisabled}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    appendDigit(num);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      appendDigit(num);
                    }
                  }}
                  className="h-13 rounded-xl border border-border/80 bg-secondary/40 text-xl font-black font-mono text-foreground active:bg-primary active:text-white active:scale-95 touch-manipulation select-none disabled:opacity-50 cursor-pointer"
                >
                  {num}
                </button>
              ))}

              {/* زر البصمة أو مسح الكل */}
              {bioEnrolled && bioAvailable ? (
                <button
                  type="button"
                  disabled={bioLoading || verifying}
                  aria-label="فتح بالبصمة"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    void tryBiometric();
                  }}
                  className="h-13 rounded-xl border border-primary/35 bg-primary/10 text-primary flex items-center justify-center active:bg-primary active:text-white active:scale-95 touch-manipulation cursor-pointer disabled:opacity-50"
                >
                  <Fingerprint className="h-6 w-6" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isDisabled || pin.length === 0}
                  aria-label="مسح الرمز"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    pinRef.current = "";
                    setPin("");
                    setError(false);
                  }}
                  className="h-13 rounded-xl border border-border/60 bg-background text-xs font-black text-muted-foreground active:bg-secondary active:scale-95 touch-manipulation cursor-pointer disabled:opacity-40"
                >
                  مسح
                </button>
              )}

              {/* الرقم صفر */}
              <button
                type="button"
                disabled={isDisabled}
                onPointerDown={(e) => {
                  e.preventDefault();
                  appendDigit("0");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    appendDigit("0");
                  }
                }}
                className="h-13 rounded-xl border border-border/80 bg-secondary/40 text-xl font-black font-mono text-foreground active:bg-primary active:text-white active:scale-95 touch-manipulation select-none disabled:opacity-50 cursor-pointer"
              >
                0
              </button>

              {/* زر الحذف */}
              <button
                type="button"
                disabled={isDisabled || pin.length === 0}
                aria-label="حذف رقم"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handleBackspace();
                }}
                className="h-13 rounded-xl border border-border/60 bg-background text-foreground flex items-center justify-center active:bg-destructive/15 active:text-destructive active:scale-95 touch-manipulation cursor-pointer disabled:opacity-40"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "enroll-prompt" && (
        <div className="relative w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="p-6">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="h-14 w-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                <Fingerprint className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-black tracking-tight text-foreground">تفعيل فتح التطبيق بالبصمة</h2>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                لتسريع فتح التطبيق في المرات القادمة، يمكنك استخدام البصمة بدلاً من كتابة رمز المرور.
              </p>
            </div>

            <div className="bg-muted/50 border border-border/50 rounded-xl p-3 mb-4 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                يتم استخدام بصمة جهازك فقط، ولا تُرسل أي بيانات.
              </p>
            </div>

            {bioError && <p className="text-center text-xs text-destructive mb-3">{bioError}</p>}

            <Button type="button" onClick={handleEnroll} className="w-full h-11 font-bold">
              <Fingerprint className="h-4 w-4" />
              تفعيل البصمة
            </Button>

            <button
              type="button"
              onClick={() => skipEnroll(false)}
              className="mt-3 w-full text-sm font-semibold text-foreground hover:text-primary py-2 cursor-pointer"
            >
              ليس الآن
            </button>
            <button
              type="button"
              onClick={() => skipEnroll(true)}
              className="mt-1 w-full text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              لا تسأل مرة أخرى
            </button>
          </div>
        </div>
      )}

      {view === "enrolling" && (
        <div className="relative w-full max-w-sm bg-card border border-border/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="p-8 text-center">
            <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Fingerprint className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-lg font-black text-foreground">جاري تفعيل البصمة…</h2>
            <p className="text-xs text-muted-foreground mt-2">
              اتبع التعليمات على جهازك لإكمال التحقق
            </p>
          </div>
        </div>
      )}

      <p className="relative text-[11px] font-medium text-muted-foreground mt-4">© T.A Advertising Solution</p>
    </div>
  );
};

export default PasswordLock;
