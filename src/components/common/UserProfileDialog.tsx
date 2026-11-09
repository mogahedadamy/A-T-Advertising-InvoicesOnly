import React, { useState, useEffect } from "react";
import { User, Sparkles, Check, X, ShieldCheck } from "lucide-react";
import { useUserProfile, getAvatarInitials } from "@/lib/userProfileStore";
import { playTapSound } from "@/lib/soundEffects";

interface UserProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isFirstLaunch?: boolean;
}

export function UserProfileDialog({
  isOpen,
  onClose,
  isFirstLaunch = false,
}: UserProfileDialogProps) {
  const { userName, saveName } = useUserProfile();
  const [inputName, setInputName] = useState(userName);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputName(userName);
      setError("");
    }
  }, [isOpen, userName]);

  if (!isOpen) return null;

  const currentInitials = getAvatarInitials(inputName || "مستخدم جديد");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = (inputName || "").trim();
    if (!clean) {
      setError("يرجى إدخال اسمك الكريم للمتابعة");
      return;
    }
    if (clean.length < 2) {
      setError("الاسم قصير جداً، يرجى كتابة اسم صحيح");
      return;
    }

    setIsSubmitting(true);
    playTapSound();
    try {
      await saveName(clean);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] px-[max(1rem,env(safe-area-inset-left,0px))] bg-black/60 backdrop-blur-md animate-fade-in"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-border/70 bg-card/95 p-5 sm:p-6 shadow-2xl backdrop-blur-xl animate-scale-up">
        {/* Glow decoration */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-brand-gold/15 blur-3xl"
        />

        {/* Close button if not forced first launch */}
        {!isFirstLaunch && (
          <button
            type="button"
            onClick={() => {
              playTapSound();
              onClose();
            }}
            aria-label="إغلاق"
            className="absolute top-4 left-4 grid h-8 w-8 place-items-center rounded-xl bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all btn-tactile interactive"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Header content */}
        <div className="flex flex-col items-center text-center pt-2 pb-4">
          {/* Live Avatar Preview */}
          <div className="relative mb-3">
            <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-primary-glow to-primary-deep text-white font-black text-xl tracking-wider shadow-lg ring-4 ring-primary/20 transition-all duration-300">
              {currentInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-2 ring-card">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
          </div>

          <h2 className="text-xl font-black text-foreground tracking-tight">
            {isFirstLaunch ? "مرحباً بك في T.A للحلول الإعلانية! 👋" : "تعديل الملف الشخصي"}
          </h2>
          <p className="mt-1.5 text-xs font-medium text-muted-foreground max-w-xs leading-relaxed">
            {isFirstLaunch
              ? "لتهيئة وتخصيص نظامك، يرجى كتابة اسمك الكريم ليظهر على شاشة الترحيب وأيقونة حسابك."
              : "يمكنك تحديث اسمك ليظهر على شاشات النظام وأيقونة حسابك المخصصة."}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label
              htmlFor="user-name-input"
              className="block text-xs font-black text-foreground mb-1.5 text-right"
            >
              الاسم الشخصي / المشغل:
            </label>
            <div className="relative">
              <input
                id="user-name-input"
                type="text"
                value={inputName}
                onChange={(e) => {
                  setInputName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="مثال: طارق عثمان علي"
                autoFocus
                className={[
                  "w-full rounded-2xl border px-4 py-3 text-sm font-bold text-foreground",
                  "bg-secondary/40 placeholder:text-muted-foreground/50",
                  "focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20",
                  "transition-all duration-200 text-right pr-10",
                  error ? "border-destructive ring-1 ring-destructive/30" : "border-border/80",
                ].join(" ")}
              />
              <User className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            </div>
            {error && (
              <p className="mt-1.5 text-[11px] font-bold text-destructive text-right">
                {error}
              </p>
            )}
          </div>

          {/* Quick preview badge */}
          {inputName.trim() && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
              <span className="font-medium">معاينة الترحيب:</span>
              <span className="font-bold text-primary">
                مرحباً {inputName.trim()} 👋
              </span>
            </div>
          )}

          {/* Submit action */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={[
                "w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4",
                "bg-gradient-to-r from-primary to-primary-deep text-white font-black text-sm",
                "shadow-md hover:shadow-lg hover:brightness-105 active:scale-[0.98]",
                "transition-all duration-200 cursor-pointer disabled:opacity-60",
              ].join(" ")}
            >
              <Check className="h-4 w-4 stroke-[3px]" />
              <span>{isFirstLaunch ? "ابدأ استخدام النظام 🚀" : "حفظ التعديلات"}</span>
            </button>
          </div>

          {/* Local storage note */}
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/70 pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span>يتم حفظ الاسم محلياً وبأمان داخل هذا الجهاز فقط</span>
          </div>
        </form>
      </div>
    </div>
  );
}
