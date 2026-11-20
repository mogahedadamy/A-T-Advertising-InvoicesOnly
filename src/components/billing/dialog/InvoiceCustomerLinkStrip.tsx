import React from "react";
import { ArchiveRestore, ExternalLink, Link2, Lock, Phone, UserCheck, UserPlus, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  CUSTOMER_TYPE_CONFIG,
  PRIMARY_CUSTOMER_TYPES,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";
import { playTapSound } from "@/lib/soundEffects";

interface InvoiceCustomerLinkStripProps {
  partyName: string;
  linkedCustomer: CustomerRecord | null;
  exactActiveMatch: CustomerRecord | null;
  exactArchivedMatch: CustomerRecord | null;
  isCustomerLocked?: boolean;
  saveAsNewCustomer: boolean;
  setSaveAsNewCustomer: (v: boolean) => void;
  phone: string;
  setPhone: (v: string) => void;
  newCustomerType: CustomerType;
  setNewCustomerType: (t: CustomerType) => void;
  onLinkCustomer: (customer: CustomerRecord) => void;
  onUnlinkCustomer: () => void;
  onRestoreAndLink: (customer: CustomerRecord) => Promise<void> | void;
  onOpenCustomerProfile?: (customerId: string) => void;
}

export function InvoiceCustomerLinkStrip({
  partyName,
  linkedCustomer,
  exactActiveMatch,
  exactArchivedMatch,
  isCustomerLocked = false,
  saveAsNewCustomer,
  setSaveAsNewCustomer,
  phone,
  setPhone,
  newCustomerType,
  setNewCustomerType,
  onLinkCustomer,
  onUnlinkCustomer,
  onRestoreAndLink,
  onOpenCustomerProfile,
}: InvoiceCustomerLinkStripProps) {
  if (linkedCustomer) {
    const cfg = CUSTOMER_TYPE_CONFIG[linkedCustomer.type] || CUSTOMER_TYPE_CONFIG.client;
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="font-black text-foreground truncate">
            مرتبط بملف العميل: {linkedCustomer.name}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[9.5px] font-bold border ${cfg.bg} ${cfg.color}`}>
            {cfg.label}
          </span>
          {linkedCustomer.phone && (
            <span className="font-mono text-[10.5px] text-muted-foreground" dir="ltr">
              {linkedCustomer.phone}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenCustomerProfile && (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                onOpenCustomerProfile(linkedCustomer.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-card px-2 py-1 text-[10.5px] font-black text-primary hover:bg-primary/10 transition cursor-pointer"
            >
              <ExternalLink className="h-3 w-3" />
              <span>عرض الملف</span>
            </button>
          )}
          {isCustomerLocked ? (
            <span
              className="inline-flex items-center gap-1 rounded-lg bg-muted/60 px-2 py-1 text-[10px] font-bold text-muted-foreground"
              title="العميل مقفل لأن الفاتورة مرتبطة بسدادات نشطة"
            >
              <Lock className="h-3 w-3" />
              <span>مقفل بالسداد</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                playTapSound();
                onUnlinkCustomer();
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10.5px] font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
              title="إلغاء الربط بملف العميل"
            >
              <X className="h-3 w-3" />
              <span>فك الربط</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (exactActiveMatch) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C5A059]/40 bg-[#C5A059]/10 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Link2 className="h-3.5 w-3.5 text-[#C5A059] shrink-0" />
          <span className="font-bold text-foreground truncate">
            العميل «{exactActiveMatch.name}» مسجّل بالفعل في دليل العملاء
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            onLinkCustomer(exactActiveMatch);
          }}
          className="h-7 px-3 rounded-lg bg-[#0D4A39] text-white text-[10.5px] font-black hover:bg-[#0a3a2d] transition cursor-pointer shrink-0 active:scale-[0.97]"
        >
          ربط بملفه
        </button>
      </div>
    );
  }

  if (exactArchivedMatch) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/80 bg-secondary/40 px-3 py-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <ArchiveRestore className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="font-bold text-foreground truncate">
            العميل «{exactArchivedMatch.name}» موجود في الأرشيف
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            playTapSound();
            void onRestoreAndLink(exactArchivedMatch);
          }}
          className="h-7 px-3 rounded-lg border border-primary/40 bg-primary/10 text-primary text-[10.5px] font-black hover:bg-primary hover:text-white transition cursor-pointer shrink-0"
        >
          استعادة وربط
        </button>
      </div>
    );
  }

  const trimmedName = partyName.trim();
  if (trimmedName.length < 2) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 transition-colors space-y-2.5 ${
        saveAsNewCustomer
          ? "border-primary/35 bg-primary/5"
          : "border-border/70 bg-secondary/30"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <UserPlus
            className={`h-4 w-4 mt-0.5 shrink-0 ${
              saveAsNewCustomer ? "text-primary" : "text-muted-foreground"
            }`}
          />
          <div className="min-w-0">
            <p className="text-[11px] font-black text-foreground truncate">
              حفظ «{trimmedName}» في دليل العملاء تلقائياً عند إصدار الفاتورة
            </p>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">
              {saveAsNewCustomer
                ? "سيُنشأ ملف عميل جديد وتُربط به الفاتورة تلقائياً في خطوة واحدة"
                : "عميل عابر — لن يُضاف إلى قائمة العملاء"}
            </p>
          </div>
        </div>

        <Switch
          dir="ltr"
          checked={saveAsNewCustomer}
          onCheckedChange={(checked) => {
            playTapSound();
            setSaveAsNewCustomer(checked);
          }}
          aria-label="حفظ كعميل جديد في دليل العملاء تلقائياً"
        />
      </div>

      {saveAsNewCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-primary/15">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-foreground flex items-center gap-1">
              <Phone className="h-3 w-3 text-primary" />
              <span>رقم الهاتف / واتساب (اختياري)</span>
            </label>
            <Input
              type="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XXXXXXXX"
              className="h-9 text-xs rounded-xl bg-background font-mono font-bold text-left"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-foreground block">
              تصنيف العميل
            </label>
            <select
              aria-label="تصنيف العميل الجديد"
              value={newCustomerType}
              onChange={(e) => setNewCustomerType(e.target.value as CustomerType)}
              className="h-9 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {PRIMARY_CUSTOMER_TYPES.map((k) => (
                <option key={k} value={k}>
                  {CUSTOMER_TYPE_CONFIG[k].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
