import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceType } from "@/lib/billing/types";

interface Props {
  type: CustomInvoiceType;
  partyName: string;
  setPartyName: (v: string) => void;
  partyEnName: string;
  setPartyEnName: (v: string) => void;
  attn: string;
  setAttn: (v: string) => void;
  date: string;
  setDate: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  language: "auto" | "ar" | "en";
  setLanguage: (v: "auto" | "ar" | "en") => void;
}

/**
 * قسم البيانات الأساسية للفاتورة:
 * العميل، عناية المسؤول (Attn)، التاريخ، الرقم، ولغة المستند
 * منسق بنظام RTL حقيقي يمنع تشوه النصوص ثنائية اللغة على الهواتف
 */
export function CustomInvoiceMetaSection({
  type,
  partyName,
  setPartyName,
  partyEnName,
  setPartyEnName,
  attn,
  setAttn,
  date,
  setDate,
  serial,
  setSerial,
  language,
  setLanguage,
}: Props) {
  const isPurchase = type === "purchase";

  return (
    <div
      className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-4 space-y-3.5 shadow-2xs select-text"
      dir="rtl"
    >
      {/* 1. ترويسة القسم مع محدد لغة الفاتورة المنفصل والمتجاوب */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-foreground">
            {isPurchase ? "بيانات المورد / المحل" : "بيانات العميل والمستند"}
          </span>
        </div>

        {/* لغة القالب الذكية */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">
            لغة الفاتورة:
          </span>
          <div className="inline-flex rounded-xl border border-border/80 bg-secondary/60 p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setLanguage("ar")}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                language === "ar"
                  ? "bg-primary text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => setLanguage("auto")}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                language === "auto"
                  ? "bg-primary text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              تلقائي
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                language === "en"
                  ? "bg-primary text-white shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* 2. شبكة الحقول الأساسية */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* اسم العميل / الجهة */}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
            <span>{isPurchase ? "اسم المورد / المحل" : "السادة / اسم الشركة أو العميل"}</span>
            <span className="text-[10px] font-mono text-muted-foreground font-normal" dir="ltr">
              (Client)
            </span>
            <span className="text-rose-500 font-bold">*</span>
          </Label>
          <Input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder={
              isPurchase
                ? "مثال: مؤسسة النور للمواد الإعلانية"
                : "مثال: مستشفى الأمل، شركة الرواد، أو اسم العميل"
            }
            className="h-10 text-xs sm:text-sm rounded-xl font-bold bg-background text-right"
          />
        </div>

        {/* الشخص المعني Attn (اختياري) */}
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between" dir="rtl">
            <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
              <span>عناية السيد / المسؤول</span>
              <span className="text-[10px] font-mono text-muted-foreground font-normal" dir="ltr">
                (Attn)
              </span>
            </Label>
            <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50">
              اختياري
            </span>
          </div>
          <Input
            value={attn}
            onChange={(e) => setAttn(e.target.value)}
            placeholder="مثال: مدير المشتريات، المهندس المشرف، أو الأستاذ فلان"
            className="h-10 text-xs sm:text-sm rounded-xl font-medium bg-background text-right"
          />
        </div>

        {/* الاسم بالإنجليزي (اختياري) */}
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between" dir="rtl">
            <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
              <span>الاسم بالإنجليزية</span>
              <span className="text-[10px] font-mono text-muted-foreground font-normal" dir="ltr">
                (Customer EN)
              </span>
            </Label>
            <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50">
              اختياري
            </span>
          </div>
          <Input
            value={partyEnName}
            onChange={(e) => setPartyEnName(e.target.value)}
            placeholder="e.g. Al-Amal Hospital Co."
            className="h-10 text-xs sm:text-sm rounded-xl font-mono bg-background text-left"
            dir="ltr"
          />
        </div>

        {/* تاريخ الفاتورة */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-foreground block text-right">
            تاريخ الفاتورة
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 text-xs sm:text-sm rounded-xl font-mono font-bold bg-background text-right"
          />
        </div>

        {/* رقم الفاتورة */}
        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-foreground block text-right">
            رقم الفاتورة (Serial)
          </Label>
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="h-10 text-xs sm:text-sm rounded-xl font-mono font-black bg-background text-center"
          />
        </div>
      </div>
    </div>
  );
}
export default CustomInvoiceMetaSection;
