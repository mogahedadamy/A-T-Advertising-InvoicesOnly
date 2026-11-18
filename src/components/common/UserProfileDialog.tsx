import React, { useState, useEffect } from "react";
import {
  User,
  Check,
  X,
  ShieldCheck,
  Building2,
  Receipt,
  FolderKanban,
  Lock,
} from "lucide-react";
import { useUserProfile, getAvatarInitials } from "@/lib/userProfileStore";
import { playTapSound, playSuccessSound } from "@/lib/soundEffects";
import { TA_LOGO_GREEN_BASE64 } from "@/assets/invoiceImagesBase64";

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
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputName(userName);
      setError("");
      setIsDismissed(false);
    }
  }, [isOpen, userName]);

  if (!isOpen || isDismissed) return null;

  const currentInitials = getAvatarInitials(inputName || "T.A");

  const handleSubmit = (e: React.FormEvent) => {
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

    // إغلاق فوري غير معطل مع تشغيل صوت النجاح
    playSuccessSound();
    setIsDismissed(true);
    onClose();

    // حفظ الاسم والإعدادات في الخلفية دون تعطيل واجهة المستخدم
    void saveName(clean);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] px-[max(1rem,env(safe-area-inset-left,0px))] bg-black/75 backdrop-blur-md animate-fade-in"
      dir="rtl"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1rem)] overflow-y-auto overscroll-contain rounded-3xl border border-emerald-500/30 bg-card/98 p-5 sm:p-7 shadow-2xl backdrop-blur-2xl animate-scale-up">
        {/* هالات الإضاءة الزمردية والذهبية الفاخرة */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-[#168063]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#C5A059]/20 blur-3xl"
        />

        {/* زر الإغلاق إذا لم تكن شاشة التهيئة الأولى الإلزامية */}
        {!isFirstLaunch && (
          <button
            type="button"
            onClick={() => {
              playTapSound();
              setIsDismissed(true);
              onClose();
            }}
            aria-label="إغلاق"
            className="absolute top-4 left-4 grid h-8 w-8 place-items-center rounded-xl bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground transition-all active:scale-95 touch-manipulation z-10"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* ترويسة الهوية المؤسسية الفاخرة */}
        <div className="flex flex-col items-center text-center pt-1 pb-3">
          {/* الشعار المعتمد لوكالة T.A */}
          <div className="flex items-center justify-center mb-2">
            <img
              src={TA_LOGO_GREEN_BASE64}
              alt="T.A Advertising Solution"
              className="h-14 sm:h-16 w-auto object-contain select-none drop-shadow-xs"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/25 px-3 py-0.5 text-[10.5px] font-black text-primary mb-2">
            <Building2 className="h-3 w-3" />
            <span>منظومة T.A Advertising Solution المعتمدة</span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight">
            {isFirstLaunch ? "مرحباً بك في حلول T.A الإعلانية 👋" : "تعديل الملف الشخصي"}
          </h2>
          <p className="mt-1 text-xs font-medium text-muted-foreground max-w-sm leading-relaxed">
            {isFirstLaunch
              ? "المنصة الذكية المتكاملة لإدارة وتوثيق الفواتير، المشروعات، والعمليات التجارية المعتمدة."
              : "تحديث اسم المشغل المعتمد ليظهر على ترويسة النظام والفواتير الصادرة."}
          </p>

          {/* معاينة شارة الاسم والأيقونة */}
          <div className="relative mt-3 mb-1">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#168063] to-[#0D4A39] text-white font-black text-lg tracking-wider shadow-md ring-2 ring-primary/30">
              {currentInitials}
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow ring-2 ring-card">
              <Check className="h-3 w-3" />
            </span>
          </div>
        </div>

        {/* بطاقات الميزات الثلاث الفاخرة عند التثبيت لأول مرة */}
        {isFirstLaunch && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 my-3">
            <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-center space-y-1">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary mx-auto">
                <Receipt className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-black text-foreground">فواتير رسمية A4</p>
              <p className="text-[9.5px] text-muted-foreground leading-tight">
                تسعير دقيق وطباعة وتصدير PDF أصلي
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-center space-y-1">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#C5A059]/15 text-[#C5A059] mx-auto">
                <FolderKanban className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-black text-foreground">تحكم بالمشروعات</p>
              <p className="text-[9.5px] text-muted-foreground leading-tight">
                إدارة العملاء والذمم وهوامش الربح
              </p>
            </div>

            <div className="rounded-xl border border-border/70 bg-secondary/30 p-2.5 text-center space-y-1">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
                <Lock className="h-3.5 w-3.5" />
              </div>
              <p className="text-[11px] font-black text-foreground">أمان محلي 100%</p>
              <p className="text-[9.5px] text-muted-foreground leading-tight">
                قاعدة بيانات معزولة دون إنترنت
              </p>
            </div>
          </div>
        )}

        {/* نموذج الإدخال */}
        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div>
            <label
              htmlFor="user-name-input"
              className="block text-xs font-black text-foreground mb-1.5 text-right"
            >
              اسم المسؤول / المشغل المعتمد: <span className="text-primary">*</span>
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
                  "bg-secondary/50 placeholder:text-muted-foreground/60",
                  "focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/20",
                  "transition-all duration-200 text-right pr-11",
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

          {/* شريط المعاينة اللحظية للترحيب */}
          {inputName.trim() && (
            <div className="rounded-xl border border-primary/25 bg-primary/8 p-2.5 text-xs text-muted-foreground flex items-center justify-between">
              <span className="font-semibold text-foreground">معاينة الترحيب:</span>
              <span className="font-black text-primary">
                مرحباً بك يا {inputName.trim()} 👋
              </span>
            </div>
          )}

          {/* زر البدء الأساسي */}
          <div className="pt-1">
            <button
              type="submit"
              className={[
                "w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 px-4",
                "bg-gradient-to-r from-[#168063] via-[#0D4A39] to-[#071914] text-white font-black text-sm sm:text-base",
                "shadow-lg shadow-emerald-950/25 hover:brightness-110 active:scale-[0.98]",
                "transition-all duration-150 cursor-pointer touch-manipulation border border-emerald-400/20",
              ].join(" ")}
            >
              <Check className="h-4 w-4 stroke-[3px]" />
              <span>{isFirstLaunch ? "بدء استخدام النظام المعتمد 🚀" : "حفظ التعديلات"}</span>
            </button>
          </div>

          {/* شارة الأمان والموثوقية */}
          <div className="flex items-center justify-center gap-1.5 text-[10.5px] text-muted-foreground/80 pt-0.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>بياناتك مشفرة ومحفوظة محلياً 100% داخل هذا الجهاز دون اتصال بالإنترنت</span>
          </div>
        </form>
      </div>
    </div>
  );
}
