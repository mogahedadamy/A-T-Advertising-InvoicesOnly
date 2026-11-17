import React, { useState } from "react";
import { X, Calendar, User, ChevronDown, ChevronUp, FolderGit2, Building } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { CustomInvoiceType } from "@/lib/billing/types";
import { AppCurrency } from "@/lib/currency/types";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { useCustomers, type CustomerRecord } from "@/lib/customersStore";
import { ProjectPicker } from "@/components/projects/ProjectPicker";
import { SupplierPicker } from "@/components/suppliers/SupplierPicker";
import { playTapSound } from "@/lib/soundEffects";

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
  reference?: string | undefined;
  fallbackSerial?: string | undefined;
  language: "auto" | "ar" | "en";
  setLanguage: (v: "auto" | "ar" | "en") => void;
  currency?: AppCurrency;
  setCurrency: (v: AppCurrency) => void;
  customerId?: string | null;
  setCustomerId?: (id: string | null) => void;
  projectId?: string | null;
  setProjectId?: (id: string | null) => void;
  supplierId?: string | null;
  setSupplierId?: (id: string | null) => void;
  supplierInvoiceNumber?: string;
  setSupplierInvoiceNumber?: (v: string) => void;
}

/**
 * قسم البيانات الأساسية الموحد للفاتورة (الخطوة 1):
 * - إدخال سلس وسريع لاسم العميل والتاريخ والعملة واللغة
 * - إكمال تلقائي فوري ورقاقات سريعة للعملاء المتكررين
 * - تجميع كافة البيانات المتقدمة (المشروع، Attn، الاسم بالإنجليزية) في قسم اختياري قابل للطي
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
  reference,
  fallbackSerial,
  language,
  setLanguage,
  currency = "SDG",
  setCurrency,
  setCustomerId,
  projectId,
  setProjectId,
  supplierId,
  setSupplierId,
  supplierInvoiceNumber,
  setSupplierInvoiceNumber,
}: Props) {
  const isPurchase = type === "purchase";
  const customers = useCustomers();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(attn.trim() || partyEnName.trim() || projectId || (isPurchase && (supplierId || supplierInvoiceNumber?.trim())))
  );

  const searchTrim = partyName.trim().toLowerCase();
  const matchedCustomers =
    searchTrim.length > 0 && !isPurchase
      ? customers
          .filter(
            (c) =>
              c.name.toLowerCase().includes(searchTrim) ||
              (c.phone && c.phone.includes(searchTrim))
          )
          .slice(0, 5)
      : [];

  const quickCustomers = !isPurchase ? customers.slice(0, 4) : [];

  const handleSelectCustomer = (customer: CustomerRecord) => {
    playTapSound();
    setPartyName(customer.name);
    if (setCustomerId) setCustomerId(customer.id);
    setShowSuggestions(false);
  };

  const setRelativeDate = (offsetDays: number) => {
    playTapSound();
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDate(d.toISOString().split("T")[0]);
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div
      className="rounded-2xl border border-border/80 bg-card p-3 sm:p-4 space-y-3.5 shadow-2xs select-text"
      dir="rtl"
    >
      {/* 1. ترويسة القسم الإرشادية مع اللغات والعملات */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/50 pb-2.5">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-md bg-primary/10 text-primary text-[11px] font-black">
              1
            </span>
            <span className="text-xs sm:text-sm font-black text-foreground">
              {isPurchase ? "بيانات المورد والمستند" : "بيانات العميل والمستند"}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            حدد اسم الجهة والعملة وتاريخ الإصدار
          </p>
        </div>

        {/* محدد لغة الفاتورة والعملة */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* محدد لغة القالب */}
          <div className="inline-flex rounded-xl border border-border/80 bg-secondary/60 p-0.5 shadow-2xs">
            {(["ar", "auto", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black transition cursor-pointer ${
                  language === l
                    ? "bg-primary text-white shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l === "ar" ? "عربي" : l === "auto" ? "تلقائي" : "EN"}
              </button>
            ))}
          </div>

          {/* محدد العملة */}
          <CurrencySelector
            value={currency}
            onChange={setCurrency}
            locale={language === "en" ? "en" : "ar"}
          />
        </div>
      </div>

      {/* 2. اسم العميل / الجهة مع البحث التلقائي */}
      <div className="space-y-1.5 relative">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
            <User className="h-3.5 w-3.5 text-primary" />
            <span>{isPurchase ? "اسم المورد / المحل أو الجهة" : "اسم العميل / الشركة أو الجهة"}</span>
            <span className="text-rose-500 font-bold">*</span>
          </Label>

          {quickCustomers.length > 0 && !partyName && (
            <div className="hidden sm:flex items-center gap-1 text-[10.5px] text-muted-foreground">
              <span className="font-bold text-[10px]">اختيار سريع:</span>
              {quickCustomers.map((qc) => (
                <button
                  key={qc.id}
                  type="button"
                  onClick={() => handleSelectCustomer(qc)}
                  className="px-2 py-0.5 rounded-lg bg-secondary/80 hover:bg-primary/10 hover:text-primary text-[10px] font-bold transition cursor-pointer"
                >
                  {qc.name.slice(0, 16)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Input
            value={partyName}
            onChange={(e) => {
              setPartyName(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder={
              isPurchase
                ? "اكتب اسم المورد أو الجهة التجارية..."
                : "اكتب اسم العميل أو الشركة (مثال: شركة السلام، مستشفى الأمل...)"
            }
            className={`h-10 text-xs sm:text-sm rounded-xl font-bold bg-background text-right ${
              partyName ? "pl-8" : ""
            }`}
          />
          {partyName && (
            <button
              type="button"
              onClick={() => {
                setPartyName("");
                if (setCustomerId) setCustomerId(null);
              }}
              aria-label="مسح الاسم"
              className="absolute left-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}

          {showSuggestions && matchedCustomers.length > 0 && (
            <div className="absolute z-30 top-full mt-1 w-full rounded-xl border border-border bg-card shadow-xl overflow-hidden py-1">
              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground bg-muted/40 border-b border-border/50">
                عملاء مطابقون في السجل (اضغط للاختيار الفوري):
              </div>
              {matchedCustomers.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => handleSelectCustomer(cust)}
                  className="w-full text-right px-3 py-2 text-xs font-bold hover:bg-primary/10 hover:text-primary transition flex items-center justify-between cursor-pointer border-b border-border/20 last:border-0"
                >
                  <span>{cust.name}</span>
                  {cust.phone && (
                    <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">
                      {cust.phone}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 3. شبكة التاريخ والمرجع */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
              <Calendar className="h-3 w-3 text-primary" />
              <span>تاريخ الفاتورة</span>
            </Label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRelativeDate(0)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition cursor-pointer ${
                  date === todayStr
                    ? "bg-primary text-white"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => setRelativeDate(-1)}
                className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                أمس
              </button>
            </div>
          </div>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 text-xs sm:text-sm rounded-xl font-mono font-bold bg-background text-right"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-black text-foreground block text-right">
            المرجع الرسمي (Invoice Reference)
          </Label>
          <div
            dir="ltr"
            className={`flex h-10 items-center justify-center rounded-xl border font-mono text-xs sm:text-sm font-black ${
              reference
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-dashed border-border/80 bg-muted/40 text-muted-foreground"
            }`}
          >
            {reference || (fallbackSerial ? `#${fallbackSerial}` : "يُولَّد تلقائياً عند الحفظ")}
          </div>
        </div>
      </div>

      {/* 4. قسم الخيارات الإضافية القابل للطي (المشروع، Attn، الإنجليزية، رقم المورد) */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => {
            playTapSound();
            setShowAdvanced(!showAdvanced);
          }}
          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer py-1"
        >
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>{showAdvanced ? "إخفاء الخيارات الإضافية" : "خيارات إضافية (ربط بمشروع، عناية المسؤول Attn، الاسم بالإنجليزية)"}</span>
        </button>

        {showAdvanced && (
          <div className="space-y-3 pt-2.5 animate-in fade-in duration-150 border-t border-border/40 mt-1">
            {setProjectId && (
              <ProjectPicker
                value={projectId ?? null}
                onChange={setProjectId}
                label="المشروع المرتبط (اختياري)"
                hint="ربط الفاتورة بمشروع معين لربط إيراداتها وحساباتها مع مساحة عمل المشروع."
              />
            )}

            {isPurchase && setSupplierId && (
              <div className="space-y-2">
                <SupplierPicker
                  value={supplierId ?? null}
                  onChange={(nextId, supplier) => {
                    setSupplierId(nextId);
                    if (supplier) setPartyName(supplier.name);
                  }}
                />
                {setSupplierInvoiceNumber && (
                  <div className="space-y-1">
                    <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                      رقم فاتورة المورد الأصلي
                    </Label>
                    <Input
                      value={supplierInvoiceNumber || ""}
                      onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                      placeholder="كما ورد من المورد أو المحل"
                      className="h-9.5 text-xs rounded-xl font-medium bg-background text-right"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                  عناية السيد / المسؤول (Attn)
                </Label>
                <Input
                  value={attn}
                  onChange={(e) => setAttn(e.target.value)}
                  placeholder="مثال: مدير المشتريات، المهندس المشرف..."
                  className="h-9.5 text-xs rounded-xl font-medium bg-background text-right"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10.5px] font-bold text-muted-foreground block text-right">
                  الاسم بالإنجليزية (Customer EN)
                </Label>
                <Input
                  value={partyEnName}
                  onChange={(e) => setPartyEnName(e.target.value)}
                  placeholder="e.g. Al-Amal Co."
                  className="h-9.5 text-xs rounded-xl font-mono bg-background text-left"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CustomInvoiceMetaSection;
