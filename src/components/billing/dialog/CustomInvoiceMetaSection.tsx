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
    <div className="rounded-2xl border border-border/70 bg-card/90 p-3 sm:p-4 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <span className="text-xs font-black text-foreground">
          {isPurchase ? "بيانات المورد / المحل" : "بيانات العميل والمستند"}
        </span>

        {/* لغة القالب الذكية */}
        <div className="flex items-center gap-1 text-[11px]">
          <span className="text-muted-foreground font-bold">لغة الطباعة:</span>
          <div className="flex rounded-lg border border-border bg-secondary/50 p-0.5">
            <button
              type="button"
              onClick={() => setLanguage("ar")}
              className={`px-2 py-0.5 rounded text-[10px] font-black transition ${
                language === "ar"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onClick={() => setLanguage("auto")}
              className={`px-2 py-0.5 rounded text-[10px] font-black transition ${
                language === "auto"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              تلقائي
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-2 py-0.5 rounded text-[10px] font-black transition ${
                language === "en"
                  ? "bg-primary text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* اسم العميل / الجهة */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] font-black text-foreground">
            {isPurchase ? "اسم المورد / المحل *" : "السادة / اسم الشركة أو الجهة (Client) *"}
          </Label>
          <Input
            value={partyName}
            onChange={(e) => setPartyName(e.target.value)}
            placeholder={isPurchase ? "مثال: مؤسسة النور للمواد الإعلانية" : "مثال: مستشفى الأمل، شركة الرواد، أو اسم العميل"}
            className="h-9 text-xs rounded-xl font-bold"
          />
        </div>

        {/* الشخص المعني Attn (اختياري) */}
        <div className="space-y-1 sm:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-black text-foreground">
              عناية السيد / المسؤول (Attn)
            </Label>
            <span className="text-[9.5px] font-bold text-muted-foreground">اختياري</span>
          </div>
          <Input
            value={attn}
            onChange={(e) => setAttn(e.target.value)}
            placeholder="مثال: مدير المشتريات، المهندس المشرف، أو الأستاذ فلان"
            className="h-9 text-xs rounded-xl font-medium"
          />
        </div>

        {/* الاسم بالإنجليزي (اختياري) */}
        <div className="space-y-1 sm:col-span-2">
          <Label className="text-[11px] font-black text-foreground">
            الاسم بالإنجليزية (Customer EN)
          </Label>
          <Input
            value={partyEnName}
            onChange={(e) => setPartyEnName(e.target.value)}
            placeholder="e.g. Al-Amal Hospital Co."
            className="h-9 text-xs rounded-xl font-mono"
            dir="ltr"
          />
        </div>

        {/* تاريخ الفاتورة */}
        <div className="space-y-1">
          <Label className="text-[11px] font-black text-foreground">التاريخ</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 text-xs rounded-xl font-mono font-bold"
          />
        </div>

        {/* رقم الفاتورة */}
        <div className="space-y-1">
          <Label className="text-[11px] font-black text-foreground">رقم الفاتورة</Label>
          <Input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            className="h-9 text-xs rounded-xl font-mono font-black"
          />
        </div>
      </div>
    </div>
  );
}

