import React, { useState } from "react";
import { User, Phone, Calendar, Hash, Building2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ProformaMeta, ProformaLine } from "@/lib/proforma/types";
import { ProformaLineEditor } from "./ProformaLineEditor";
import { calculateProformaTotals } from "@/lib/proforma/store";
import { formatNumber } from "@/lib/printCalculator";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import type { AppCurrency } from "@/lib/currency/types";

interface Props {
  meta: ProformaMeta;
  lines: ProformaLine[];
  onMetaChange: (meta: ProformaMeta) => void;
  onLinesChange: (lines: ProformaLine[]) => void;
}

export function ProformaForm({ meta, lines, onMetaChange, onLinesChange }: Props) {
  const totals = calculateProformaTotals(lines);
  // إذا كان كلا الاسمين غير مدخل بعد، تفتح البطاقة تلقائياً؛ وإلا يمكن طيها لتوفير المساحة
  const [isCustomerOpen, setIsCustomerOpen] = useState(!meta.customerName?.trim() && !meta.customerEnName?.trim());

  const updateField = <K extends keyof ProformaMeta>(key: K, value: ProformaMeta[K]) => {
    onMetaChange({ ...meta, [key]: value });
  };

  const customerDisplayName = meta.customerName?.trim() || meta.customerEnName?.trim() || "بيانات العميل والفاتورة";

  return (
    <div className="flex h-full flex-col overflow-hidden bg-card" dir="rtl">
      {/* 1. رأس بيانات العميل والمستند — قابل للطي لتوفير المساحة ومنع التمرير المزعج */}
      <div className="shrink-0 border-b border-border/80 bg-card p-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-primary shrink-0">
              <User className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-foreground truncate">
                  {customerDisplayName}
                </span>
                <span className="text-[10.5px] font-mono font-bold text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded shrink-0">
                  #{meta.serial}
                </span>
              </div>
              {!isCustomerOpen && (
                <div className="text-[10px] text-muted-foreground truncate font-medium">
                  {meta.phone ? `هاتف: ${meta.phone} • ` : ""}
                  {meta.date} • فرع {meta.branch || "امدرمان"}
                </div>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsCustomerOpen(!isCustomerOpen)}
            className="h-7 px-2 text-xs font-bold gap-1 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
          >
            {isCustomerOpen ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                <span>طي البيانات</span>
              </>
            ) : (
              <>
                <Pencil className="h-3 w-3" />
                <span>تعديل</span>
              </>
            )}
          </Button>
        </div>

        {/* الحقول المدمجة عند فتح البطاقة */}
        {isCustomerOpen && (
          <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-border/60 animate-in fade-in duration-150">
            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                اسم العميل بالعربية <span className="text-[9px] font-normal text-muted-foreground/80">(اختياري)</span>
              </label>
              <div className="relative">
                <Input
                  value={meta.customerName}
                  onChange={(e) => updateField("customerName", e.target.value)}
                  placeholder="مثال: مكتبة البيان"
                  className="h-7.5 text-xs pr-7 font-bold"
                />
                <User className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                Customer (بالإنجليزية) <span className="text-[9px] font-normal text-muted-foreground/80">(اختياري)</span>
              </label>
              <Input
                value={meta.customerEnName || ""}
                onChange={(e) => updateField("customerEnName", e.target.value)}
                placeholder="e.g. Al-Bayan Bookshop"
                className="h-7.5 text-xs font-mono text-left font-semibold"
                dir="ltr"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                عناية السيد / الشخص المسؤول (Attn) <span className="text-[9px] font-normal text-muted-foreground/80">(اختياري)</span>
              </label>
              <Input
                value={meta.attn || ""}
                onChange={(e) => updateField("attn", e.target.value)}
                placeholder="مثال: م. طارق عثمان، مدير المشتريات..."
                className="h-7.5 text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                لغة الفاتورة والقالب
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { val: "auto", label: "تلقائي ⚡" },
                    { val: "ar", label: "العربية 🇸🇩" },
                    { val: "en", label: "English 🇬🇧" },
                  ] as const
                ).map((l) => (
                  <button
                    key={l.val}
                    type="button"
                    onClick={() => updateField("language", l.val)}
                    className={`h-7.5 rounded-lg border text-[10.5px] font-black transition-all ${
                      (meta.language || "auto") === l.val
                        ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                        : "border-border/60 hover:bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                عملة الفاتورة
              </label>
              <CurrencySelector
                value={meta.currency || "SDG"}
                onChange={(c) => updateField("currency", c)}
                locale={meta.language === "en" ? "en" : "ar"}
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                رقم الهاتف / واتساب
              </label>
              <div className="relative">
                <Input
                  value={meta.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="09xxxxxxxx"
                  className="h-7.5 text-xs pr-7 font-mono font-semibold"
                />
                <Phone className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                التاريخ
              </label>
              <div className="relative">
                <Input
                  type="date"
                  value={meta.date}
                  onChange={(e) => updateField("date", e.target.value)}
                  className="h-7.5 text-xs pr-7 font-mono"
                />
                <Calendar className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                الرقم التسلسلي
              </label>
              <div className="relative">
                <Input
                  value={meta.serial}
                  onChange={(e) => updateField("serial", e.target.value)}
                  placeholder="0001"
                  className="h-7.5 text-xs pr-7 font-mono font-bold"
                />
                <Hash className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-muted-foreground block mb-0.5">
                الفرع
              </label>
              <div className="relative">
                <Input
                  value={meta.branch || "امدرمان"}
                  onChange={(e) => updateField("branch", e.target.value)}
                  placeholder="امدرمان"
                  className="h-7.5 text-xs pr-7 font-semibold"
                />
                <Building2 className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/60 pointer-events-none" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. منطقة البنود القابلة للتمرير الوحيدة والسلسة بدون شريط تمرير داخلي مكرر */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-2">
        <ProformaLineEditor lines={lines} onChange={onLinesChange} currency={meta.currency || "SDG"} />
      </div>

      {/* 3. بطاقة الإجماليات الثابتة في الأسفل (دائماً ظاهرة أمام المستخدم بدون أي تمرير) */}
      <div className="shrink-0 border-t border-border/80 bg-card p-3 px-4 shadow-lg space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="text-muted-foreground font-bold flex items-center gap-1.5 text-[11px]">
            <span>المساحة: <b className="text-foreground font-mono">{totals.totalArea}</b> م²</span>
            <span className="text-muted-foreground/40">•</span>
            <span>القطع: <b className="text-foreground font-mono">{totals.totalQty}</b></span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-muted-foreground">الإجمالي:</span>
            <span className="font-mono text-base font-black text-primary">
              {formatNumber(totals.totalAmount)}
            </span>
            <span className="text-[10px] font-black font-mono text-foreground uppercase">
              {meta.currency || "SDG"}
            </span>
          </div>
        </div>

        <div className="text-[11px] font-bold text-primary text-center bg-primary/5 rounded-lg py-1 border border-primary/10 truncate px-2">
          {totals.totalInWords}
        </div>
      </div>
    </div>
  );
}
