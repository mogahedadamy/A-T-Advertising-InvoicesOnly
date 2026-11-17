import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Settings2,
  Lock,
  RefreshCw,
  Archive,
  Clock,
  Check,
} from "lucide-react";
import { playTapSound, playSuccessSound } from "@/lib/soundEffects";
import type { BackupSettings } from "./types";

interface BackupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: BackupSettings;
  encryptionAvailable: boolean;
  onSave: (updated: Partial<BackupSettings>) => Promise<void>;
}

export function BackupSettingsDialog({
  open,
  onOpenChange,
  settings,
  encryptionAvailable,
  onSave,
}: BackupSettingsDialogProps) {
  const [autoDaily, setAutoDaily] = useState(settings.autoDaily);
  const [afterTransaction, setAfterTransaction] = useState(
    settings.afterTransaction
  );
  const [encryptionEnabled, setEncryptionEnabled] = useState(
    settings.encryptionEnabled
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setAutoDaily(settings.autoDaily);
      setAfterTransaction(settings.afterTransaction);
      setEncryptionEnabled(settings.encryptionEnabled);
    }
  }, [open, settings]);

  const handleSave = async () => {
    setSaving(true);
    playTapSound();
    try {
      await onSave({
        autoDaily,
        afterTransaction,
        encryptionEnabled,
      });
      playSuccessSound();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-md p-5 rounded-3xl border border-primary/20 bg-card shadow-2xl"
      >
        <DialogHeader className="text-right space-y-1 pb-2 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Settings2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black text-foreground">
                إعدادات النسخ التلقائي والتشفير
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تخصيص مواعيد النسخ الاحتياطي ومستوى أمان البيانات
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-3 space-y-4">
          {/* Daily auto-backup */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <RefreshCw className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground">
                  نسخ احتياطي يومي مجدول
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  أخذ نسخة تلقائياً كل 24 ساعة في الخلفية
                </p>
              </div>
            </div>
            <Switch checked={autoDaily} onCheckedChange={setAutoDaily} />
          </div>

          {/* After transaction */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Archive className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground">
                  نسخ فوري بعد كل معاملة
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  حفظ نسخة تلقائية بعد كل فاتورة أو سند يصدر
                </p>
              </div>
            </div>
            <Switch
              checked={afterTransaction}
              onCheckedChange={setAfterTransaction}
            />
          </div>

          {/* Encryption */}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-border/70 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
                <Lock className="h-4.5 w-4.5" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground">
                  تشفير النسخ (AES-256)
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {encryptionAvailable
                    ? "حماية النسخ بمفتاح معزول في مخزن المفاتيح"
                    : "غير مدعوم على هذا الجهاز"}
                </p>
              </div>
            </div>
            <Switch
              checked={encryptionEnabled}
              onCheckedChange={setEncryptionEnabled}
              disabled={!encryptionAvailable}
            />
          </div>

          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 space-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <Clock className="h-4 w-4" />
              <span>سياسة الاحتفاظ الذكية:</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              يحتفظ النظام تلقائياً بآخر {settings.retention?.daily ?? 7} نسخ يومية، و
              {settings.retention?.weekly ?? 4} أسبوعية، و{settings.retention?.monthly ?? 12} شهرية، مع عدم حذف أي نسخة يدوية مطلقاً.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t border-border/50">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 h-11 rounded-2xl text-xs font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-11 rounded-2xl text-xs font-black bg-primary text-primary-foreground shadow-sm active:scale-95 touch-manipulation"
          >
            <Check className="h-4 w-4 ml-1.5" />
            <span>حفظ الإعدادات</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
