import React, { useState } from "react";
import { Calendar, Check, FileText, PenTool, QrCode, Stamp, User, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CustomerPickerModal } from "@/components/customers/CustomerPickerModal";
import { LetterTemplateSelector } from "./LetterTemplateSelector";
import { RECIPIENT_HONORIFIC_OPTIONS } from "@/lib/letters/templates";
import type { LetterTemplateId, OfficialLetter } from "@/lib/letters/types";
import { getLocalIsoDate } from "@/lib/dateUtils";
import { playTapSound } from "@/lib/soundEffects";

interface Props {
  letter: OfficialLetter;
  onChange: (patch: Partial<OfficialLetter>) => void;
  onTemplateChange: (templateId: LetterTemplateId) => void;
}

export function LetterEditorForm({ letter, onChange, onTemplateChange }: Props) {
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  return (
    <div className="space-y-3.5" dir="rtl">
      {/* 1. اختيار القالب القانوني */}
      <LetterTemplateSelector
        selectedId={letter.templateId}
        onSelect={onTemplateChange}
      />

      {/* 2. بيانات الجهة أو الشخص الموجَّه إليه الخطاب */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
          <div className="flex items-center gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-black">
              1
            </span>
            <span className="text-xs sm:text-sm font-black text-foreground">
              الجهة أو الشخص الموجَّه إليه الخطاب
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              playTapSound();
              setCustomerPickerOpen(true);
            }}
            className="h-8 px-2.5 rounded-lg border-primary/40 bg-primary/10 hover:bg-primary hover:text-white text-primary text-[11px] font-black gap-1.5 cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            <span>اختيار من العملاء</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">صيغة المخاطبة</Label>
            <select
              aria-label="صيغة المخاطبة"
              value={letter.recipientHonorific}
              onChange={(e) => onChange({ recipientHonorific: e.target.value })}
              className="h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {RECIPIENT_HONORIFIC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <Label className="text-[11px] font-black text-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary" />
              <span>اسم الجهة / الشركة أو الشخص</span>
              {letter.recipientHonorific !== "إلى من يهمه الأمر" && (
                <span className="text-rose-500">*</span>
              )}
            </Label>
            <Input
              value={letter.recipientName}
              onChange={(e) => onChange({ recipientName: e.target.value })}
              placeholder="مثال: شركة زادنا للمواد الغذائية"
              className="h-10 text-xs sm:text-sm rounded-xl font-bold bg-background text-right"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">
              عناية / الصفة الوظيفية (اختياري)
            </Label>
            <Input
              value={letter.recipientTitle || ""}
              onChange={(e) => onChange({ recipientTitle: e.target.value })}
              placeholder="مثال: عناية السيد / مدير المشتريات والعقود"
              className="h-9.5 text-xs rounded-xl font-bold bg-background text-right"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-black text-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-primary" />
                  <span>التاريخ</span>
                </Label>
                <button
                  type="button"
                  onClick={() => onChange({ date: getLocalIsoDate() })}
                  className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                >
                  اليوم
                </button>
              </div>
              <Input
                type="date"
                value={letter.date}
                onChange={(e) => onChange({ date: e.target.value })}
                className="h-9.5 text-xs rounded-xl font-mono font-bold bg-background"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px] font-black text-foreground">الرقم الإشاري</Label>
              <Input
                dir="ltr"
                value={letter.reference}
                onChange={(e) => onChange({ reference: e.target.value })}
                className="h-9.5 text-xs rounded-xl font-mono font-black bg-background text-center text-primary"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. عنوان الخطاب ومربع الموضوع والمتن القانوني */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-black">
            2
          </span>
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs sm:text-sm font-black text-foreground">
            عنوان الخطاب، الموضوع، ونص الرسالة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">عنوان الخطاب (في الترويسة)</Label>
            <Input
              value={letter.letterTitle}
              onChange={(e) => onChange({ letterTitle: e.target.value })}
              placeholder="مثال: خطاب مطالبة مالية رسمية"
              className="h-10 text-xs sm:text-sm rounded-xl font-bold bg-background text-right"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">
              موضوع الخطاب (داخل المربع الأوسط) <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={letter.subject}
              onChange={(e) => onChange({ subject: e.target.value })}
              placeholder="اكتب موضوع الخطاب باختصار ووضوح..."
              className="h-10 text-xs sm:text-sm rounded-xl font-bold bg-background text-right"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-[11px] font-black text-foreground">
              متن الخطاب الرسمي <span className="text-rose-500">*</span>
            </Label>
            <span className="text-[10px] font-medium text-muted-foreground">
              عدّل التفاصيل بين الأقواس [ ] فقط أو اكتب نصك الخاص
            </span>
          </div>
          <textarea
            rows={7}
            value={letter.body}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder="اكتب فقرات الخطاب الرسمي..."
            className="w-full rounded-xl border border-border/80 bg-background p-3 text-xs sm:text-[13px] font-medium leading-relaxed text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y text-right"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[11px] font-black text-foreground">عبارة الختام الرسمية</Label>
          <Input
            value={letter.closingPhrase}
            onChange={(e) => onChange({ closingPhrase: e.target.value })}
            className="h-9.5 text-xs rounded-xl font-bold bg-background text-right"
          />
        </div>
      </div>

      {/* 4. بيانات الموقّع والختم الرسمي في أسفل الخطاب */}
      <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex items-center gap-1.5 border-b border-border/50 pb-2">
          <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-black">
            3
          </span>
          <span className="text-xs sm:text-sm font-black text-foreground">
            الاعتماد، التوقيع، والختم الرسمي
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">اسم الموقّع</Label>
            <Input
              value={letter.signatoryName}
              onChange={(e) => onChange({ signatoryName: e.target.value })}
              className="h-9.5 text-xs rounded-xl font-bold bg-background text-right"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-black text-foreground">الصفة / المنصب</Label>
            <Input
              value={letter.signatoryTitle}
              onChange={(e) => onChange({ signatoryTitle: e.target.value })}
              className="h-9.5 text-xs rounded-xl font-bold bg-background text-right"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            {
              key: "includeSignature" as const,
              label: "التوقيع المعتمد",
              icon: PenTool,
              active: letter.includeSignature,
            },
            {
              key: "includeStamp" as const,
              label: "الختم الرسمي",
              icon: Stamp,
              active: letter.includeStamp,
            },
            {
              key: "includeQr" as const,
              label: "رمز التوثيق QR",
              icon: QrCode,
              active: letter.includeQr,
            },
          ].map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  playTapSound();
                  onChange({ [opt.key]: !opt.active });
                }}
                className={`inline-flex items-center gap-1.5 h-8.5 px-3 rounded-xl border text-[11px] font-black transition cursor-pointer ${
                  opt.active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/70 bg-secondary/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
                {opt.active && <Check className="h-3 w-3" />}
              </button>
            );
          })}
        </div>
      </div>

      <CustomerPickerModal
        open={customerPickerOpen}
        onOpenChange={setCustomerPickerOpen}
        initialQuery={letter.recipientName}
        onSelect={(customer) => {
          onChange({
            recipientName: customer.name,
            recipientHonorific:
              customer.type === "company" || customer.type === "institution"
                ? "السادة /"
                : "السيد /",
          });
        }}
      />
    </div>
  );
}
