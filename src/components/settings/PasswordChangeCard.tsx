import React, { useState } from "react";
import { KeyRound, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  changePassword,
  isValidPasswordFormat,
  PASSWORD_DIGITS,
} from "@/lib/passwordStore";

export const PasswordChangeCard: React.FC = () => {
  const { toast } = useToast();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");

    if (!isValidPasswordFormat(currentPw)) {
      setPwError(`كلمة المرور الحالية يجب أن تكون ${PASSWORD_DIGITS} أرقام`);
      return;
    }
    if (!isValidPasswordFormat(newPw)) {
      setPwError(`كلمة المرور الجديدة يجب أن تكون ${PASSWORD_DIGITS} أرقام`);
      return;
    }
    if (newPw !== confirmPw) {
      setPwError("تأكيد كلمة المرور غير مطابق");
      return;
    }
    if (newPw === currentPw) {
      setPwError("كلمة المرور الجديدة يجب أن تختلف عن الحالية");
      return;
    }

    setPwBusy(true);
    try {
      await changePassword(currentPw, newPw);
      toast({
        title: "تم تغيير كلمة المرور",
        description: "ستُستخدم كلمة المرور الجديدة في المرة القادمة.",
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "تعذّر تغيير كلمة المرور";
      setPwError(msg);
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-border bg-card p-4 shadow-elegant">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <KeyRound className="h-4.5 w-4.5" />
        </span>
        <h2 className="text-sm font-black text-foreground">تغيير كلمة المرور</h2>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleChangePassword}>
        <PinField
          label="كلمة المرور الحالية"
          value={currentPw}
          onChange={setCurrentPw}
        />
        <PinField
          label="كلمة المرور الجديدة"
          value={newPw}
          onChange={setNewPw}
        />
        <PinField
          label="تأكيد كلمة المرور الجديدة"
          value={confirmPw}
          onChange={setConfirmPw}
        />

        {pwError && (
          <p className="flex items-center gap-1.5 text-xs font-bold text-destructive">
            <X className="h-4 w-4" />
            {pwError}
          </p>
        )}

        {newPw &&
          confirmPw &&
          newPw === confirmPw &&
          isValidPasswordFormat(newPw) && (
            <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <Check className="h-3.5 w-3.5" />
              كلمتا المرور متطابقتان
            </p>
          )}

        <Button
          type="submit"
          className="mt-1 min-h-[44px] w-full rounded-xl bg-gradient-primary text-sm font-black text-primary-foreground shadow-key-primary transition-all hover:brightness-110 active:scale-[0.98] touch-manipulation"
          disabled={pwBusy || !currentPw || !newPw || !confirmPw}
        >
          {pwBusy && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
          حفظ كلمة المرور الجديدة
        </Button>
      </form>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        كلمة المرور مكوّنة من {PASSWORD_DIGITS} أرقام وتُحفظ مشفّرة على جهازك فقط.
      </p>
    </section>
  );
};

interface PinFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

const PinField = ({ label, value, onChange }: PinFieldProps) => {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold text-foreground">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PASSWORD_DIGITS}
        value={value}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, "").slice(0, PASSWORD_DIGITS))
        }
        placeholder={"•".repeat(PASSWORD_DIGITS)}
        className="h-12 rounded-xl border border-border bg-input px-4 text-center text-lg font-bold tracking-[0.6em] tabular-nums text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 touch-manipulation"
        dir="ltr"
      />
    </label>
  );
};
