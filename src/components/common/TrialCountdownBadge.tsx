import React from "react";
import { Clock } from "lucide-react";
import { useTrialGuard } from "@/lib/trialGuard";

export function TrialCountdownBadge() {
  const { hoursLeft, minutesLeft, secondsLeft, isExpired, isEnabled } = useTrialGuard();

  // إذا كانت المهلة معطلة (النسخة دائمة) أو منتهية، لا نعرض العداد
  if (!isEnabled || isExpired) return null;

  return (
    <div
      dir="rtl"
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 select-none"
      title="نسخة تجريبية لحاسبة وفواتير T.A صالحة لمدة 48 ساعة من التثبيت"
    >
      <Clock className="h-3 w-3 shrink-0" />
      <span>
        تجريبية: متبقي{" "}
        {hoursLeft > 0
          ? `${hoursLeft} س و ${minutesLeft} د`
          : `${minutesLeft} د و ${secondsLeft} ث`}
      </span>
    </div>
  );
}

export default TrialCountdownBadge;

