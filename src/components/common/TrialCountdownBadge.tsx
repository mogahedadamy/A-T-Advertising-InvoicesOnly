import React from "react";
import { Clock } from "lucide-react";
import { useTrialGuard } from "@/lib/trialGuard";

/**
 * عداد زمني مصغر من ثلاث خانات (ساعات : دقائق : ثواني) أعلى شريط التطبيق
 * مصمم بخاصية tabular-nums لمنع أي اهتزاز بصري أثناء تغير الثواني
 */
export function HeaderTrialCountdown() {
  const { hoursLeft, minutesLeft, secondsLeft, isExpired, isEnabled } = useTrialGuard();

  // إذا كانت المهلة معطلة (النسخة دائمة) أو منتهية، لا نعرض العداد
  if (!isEnabled || isExpired) return null;

  const hh = String(hoursLeft).padStart(2, "0");
  const mm = String(minutesLeft).padStart(2, "0");
  const ss = String(secondsLeft).padStart(2, "0");

  return (
    <div
      dir="rtl"
      className="flex items-center gap-1 sm:gap-1.5 rounded-xl sm:rounded-2xl border border-amber-500/35 bg-amber-500/10 dark:bg-amber-500/15 px-2 sm:px-2.5 py-1 text-[10px] sm:text-xs font-bold text-amber-700 dark:text-amber-400 select-none shadow-2xs transition-all font-mono tabular-nums"
      title={`نسخة تجريبية صالحة لمدة 48 ساعة • متبقي: ${hoursLeft} ساعة و ${minutesLeft} دقيقة و ${secondsLeft} ثانية`}
    >
      <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-500 shrink-0 animate-pulse" />
      <span className="tracking-tight font-black inline-flex items-center gap-0.5">
        <span className="hidden xs:inline text-[9.5px] font-sans font-medium text-amber-700/80 dark:text-amber-400/80 ml-0.5">
          متبقي
        </span>
        <span className="text-amber-900 dark:text-amber-200">{hh}</span>
        <span className="text-amber-500/70 text-[9px] font-sans">س</span>
        <span className="text-amber-500/60">:</span>
        <span className="text-amber-900 dark:text-amber-200">{mm}</span>
        <span className="text-amber-500/70 text-[9px] font-sans">د</span>
        <span className="text-amber-500/60">:</span>
        <span className="text-amber-900 dark:text-amber-200">{ss}</span>
        <span className="text-amber-500/70 text-[9px] font-sans">ث</span>
      </span>
    </div>
  );
}

/**
 * شارة عامة لحالة المهلة بثلاث خانات
 */
export function TrialCountdownBadge() {
  const { hoursLeft, minutesLeft, secondsLeft, isExpired, isEnabled } = useTrialGuard();

  if (!isEnabled || isExpired) return null;

  const hh = String(hoursLeft).padStart(2, "0");
  const mm = String(minutesLeft).padStart(2, "0");
  const ss = String(secondsLeft).padStart(2, "0");

  return (
    <div
      dir="rtl"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 select-none font-mono tabular-nums"
      title="نسخة تجريبية لـ A-T-Advertising صالحة لمدة 48 ساعة من التثبيت"
    >
      <Clock className="h-3 w-3 shrink-0 text-amber-500 animate-pulse" />
      <span>
        تجريبية: {hh}س : {mm}د : {ss}ث
      </span>
    </div>
  );
}

export default HeaderTrialCountdown;
