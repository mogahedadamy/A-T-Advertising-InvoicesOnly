import React, { useEffect, useState, useRef, useCallback } from "react";
import { TA_LOGO_WHITE_BASE64 } from "@/assets/invoiceImagesBase64";
import { ShieldCheck } from "lucide-react";

interface SplashScreenProps {
  onFinish: () => void;
  /** Duration in ms before transition starts (default: 6000ms between 5s and 7s) */
  duration?: number;
}

/**
 * شاشة البداية المتحركة الفاخرة (Modern Animated Brand Splash)
 * تجسد الهوية البصرية لـ T.A Advertising Solution
 * مهيأة بمدة 6 ثوانٍ كافية للقراءة والاستيعاب مع إمكانية التخطي بالنقر
 */
export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  duration = 6000,
}) => {
  const [progress, setProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [phase, setPhase] = useState<"enter" | "shine" | "ready">("enter");

  // الحفاظ على مرجع الدالة لمنع إعادة تشغيل المؤقت نهائياً عند أي re-render للأب
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const hasFinishedRef = useRef(false);

  const safeFinish = useCallback(() => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    onFinishRef.current?.();
  }, []);

  useEffect(() => {
    // 1. تسلسل ظهور المراحل الحركية
    const tShine = setTimeout(() => setPhase("shine"), 600);
    const tReady = setTimeout(() => setPhase("ready"), 1800);

    // 2. محاكاة حركة شريط التحميل بسلاسة فائقة خلال المدة المحددة (6 ثوانٍ)
    const startTime = performance.now();
    let animId: number;

    const updateProgress = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, Math.round((elapsed / (duration - 500)) * 100));
      setProgress(pct);

      if (elapsed < duration - 500) {
        animId = requestAnimationFrame(updateProgress);
      } else {
        setProgress(100);
      }
    };

    animId = requestAnimationFrame(updateProgress);

    // 3. بدء تلاشي الشاشة بنعومة قبل النهاية بـ 400ms
    const tFade = setTimeout(() => {
      setIsFadingOut(true);
    }, duration - 400);

    // 4. إنهاء الشاشة وتسليم الواجهة بأمان لمرة واحدة فقط
    const tEnd = setTimeout(() => {
      safeFinish();
    }, duration);

    return () => {
      clearTimeout(tShine);
      clearTimeout(tReady);
      clearTimeout(tFade);
      clearTimeout(tEnd);
      cancelAnimationFrame(animId);
    };
  }, [duration, safeFinish]);

  // إمكانية النقر للتخطي الفوري إذا لم يرغب المستخدم في الانتظار
  const handleSkip = () => {
    if (hasFinishedRef.current) return;
    setIsFadingOut(true);
    setTimeout(safeFinish, 180);
  };

  return (
    <div
      onClick={handleSkip}
      dir="rtl"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden bg-[#071914] px-6 py-10 transition-all duration-350 ease-out select-none cursor-pointer ${
        isFadingOut
          ? "opacity-0 scale-105 pointer-events-none filter blur-sm"
          : "opacity-100 scale-100"
      }`}
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(1.5rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1.5rem, env(safe-area-inset-right, 0px))",
      }}
    >
      {/* ── 1. خلفية هالة الزمرد والأوبسيديان الملكية ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-[#168063]/20 blur-[100px]" />
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-[#0D4A39]/35 blur-[80px]" />
        <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#C5A059]/10 blur-[90px]" />
      </div>

      {/* ── 2. رأس الشاشة (النسخة الرسمية) ── */}
      <div className="relative z-10 flex items-center gap-1.5 rounded-full border border-[#0D4A39]/60 bg-[#0C251E]/70 px-4 py-1.5 backdrop-blur-md transition-all duration-700">
        <ShieldCheck className="h-4 w-4 text-[#C5A059]" />
        <span className="text-[11px] font-semibold tracking-wider text-[#C2D1CE]">
          منظومة A-T-Advertising • الحاسبة والفواتير (تجريبية 48 ساعة)
        </span>
      </div>

      {/* ── 3. كتلة الشعار الملكي الأوسط مع الحركة الرصينة ── */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center my-auto">
        {/* إطار الشعار */}
        <div
          className={`relative transition-all duration-700 ease-out transform ${
            phase === "enter"
              ? "opacity-0 scale-90 translate-y-3 blur-sm"
              : "opacity-100 scale-100 translate-y-0 blur-0"
          }`}
        >
          <div className="relative px-4 py-2">
            <img
              src={TA_LOGO_WHITE_BASE64}
              alt="T.A Advertising Solution"
              className="h-28 sm:h-36 w-auto max-w-[280px] sm:max-w-[340px] object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.65)]"
            />
          </div>
        </div>

        {/* الكبسولة النصية المعرفة بالهوية والموقع */}
        <div
          className={`mt-5 flex flex-col items-center gap-2 transition-all duration-700 delay-150 ${
            phase === "enter"
              ? "opacity-0 translate-y-3"
              : "opacity-100 translate-y-0"
          }`}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#0D4A39] bg-[#0C251E]/80 px-4 py-1.5 shadow-md backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[#168063]" />
            <span className="text-xs font-bold text-white tracking-wide">
              حلول إعلانية وطباعية متكاملة
            </span>
          </div>
          <span className="text-[11px] font-medium text-[#C2D1CE]/70 tracking-widest">
            الخرطوم &nbsp;•&nbsp; بورتسودان
          </span>
        </div>
      </div>

      {/* ── 4. أسفل الشاشة: مؤشر التقدم والتذييل ── */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-3">
        {/* شريط التحميل */}
        <div className="h-1 w-full overflow-hidden rounded-full bg-[#0C251E] border border-[#0D4A39]/40 p-[1px]">
          <div
            className="h-full rounded-full bg-gradient-to-l from-[#C5A059] via-[#168063] to-[#0D4A39] shadow-[0_0_8px_#168063] transition-all duration-150 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* سطر الحقوق والتهيئة */}
        <div className="flex w-full items-center justify-between text-[11px] text-[#C2D1CE]/60">
          <span>جاري تهيئة النظام...</span>
          <span className="font-mono tabular-nums text-[#C5A059] font-bold">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
