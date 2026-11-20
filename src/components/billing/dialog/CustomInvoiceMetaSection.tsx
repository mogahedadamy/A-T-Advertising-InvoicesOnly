import React, { useEffect, useRef, useState } from "react";
import { X, Calendar, User, Users, Link2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CustomInvoiceType } from "@/lib/billing/types";
import { AppCurrency } from "@/lib/currency/types";
import { CurrencySelector } from "@/components/currency/CurrencySelector";
import { useCustomers, type CustomerRecord } from "@/lib/customersStore";
import { CustomerPickerModal } from "@/components/customers/CustomerPickerModal";
import { CustomInvoiceAdvancedFields } from "./CustomInvoiceAdvancedFields";
import { getLocalIsoDate } from "@/lib/dateUtils";
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
  supplierId?: string | null;
  setSupplierId?: (id: string | null) => void;
  supplierInvoiceNumber?: string;
  setSupplierInvoiceNumber?: (v: string) => void;
}

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
  customerId,
  setCustomerId,
  supplierId,
  setSupplierId,
  supplierInvoiceNumber,
  setSupplierInvoiceNumber,
}: Props) {
  const isPurchase = type === "purchase";
  const customers = useCustomers();
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(attn.trim() || partyEnName.trim() || (isPurchase && (supplierId || supplierInvoiceNumber?.trim())))
  );
  const suggestionsWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showSuggestions) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (suggestionsWrapRef.current && !suggestionsWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showSuggestions]);

  const linkedCustomer = !isPurchase && customerId ? customers.find((c) => c.id === customerId) : null;

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
    setDate(getLocalIsoDate(d));
  };

  const todayStr = getLocalIsoDate();

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

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
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

          <CurrencySelector
            value={currency}
            onChange={setCurrency}
            locale={language === "en" ? "en" : "ar"}
          />
        </div>
      </div>

      {/* 2. اسم العميل / الجهة مع زر العملاء المباشر */}
      <div className="space-y-1.5 relative">
        <div className="flex items-center justify-between">
          <Label className="text-[11px] font-black text-foreground flex items-center gap-1.5 text-right">
            <User className="h-3.5 w-3.5 text-primary" />
            <span>{isPurchase ? "اسم المورد / المحل أو الجهة" : "اسم العميل / الشركة أو الجهة"}</span>
            <span className="text-rose-500 font-bold">*</span>
          </Label>

          {!isPurchase && linkedCustomer && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black animate-in fade-in">
              <Link2 className="h-3 w-3" />
              <span>مرتبط بملف: {linkedCustomer.name}</span>
              <button
                type="button"
                onClick={() => {
                  playTapSound();
                  if (setCustomerId) setCustomerId(null);
                }}
                className="hover:text-rose-500 transition-colors p-0.5"
                title="إلغاء الربط بالعميل (تبقى الفاتورة مستقلة)"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div ref={suggestionsWrapRef} className="relative flex-1">
            <Input
              value={partyName}
              onChange={(e) => {
                const val = e.target.value;
                setPartyName(val);
                setShowSuggestions(true);
                if (customerId && setCustomerId) {
                  const currentLinked = customers.find((c) => c.id === customerId);
                  if (currentLinked && currentLinked.name.trim().toLowerCase() !== val.trim().toLowerCase()) {
                    setCustomerId(null);
                  }
                }
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              placeholder={
                isPurchase
                  ? "اكتب اسم المورد أو المحل التجاري..."
                  : "اكتب اسم العميل أو اضغط على «العملاء» للاختيار..."
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
                  setShowSuggestions(false);
                }}
                aria-label="مسح الاسم"
                className="absolute left-2 top-1/2 -translate-y-1/2 grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
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

          {!isPurchase && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                playTapSound();
                setCustomerPickerOpen(true);
              }}
              className="h-10 px-3.5 rounded-xl border border-primary/40 bg-primary/10 hover:bg-primary hover:text-white text-primary text-xs font-black gap-1.5 shrink-0 active:scale-95 shadow-2xs cursor-pointer transition-all"
              title="اختيار عميل مسجل من السجل"
            >
              <Users className="h-4 w-4" />
              <span>العملاء</span>
            </Button>
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

      {/* 4. قسم الخيارات الإضافية القابل للطي */}
      <CustomInvoiceAdvancedFields
        isPurchase={isPurchase}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced(!showAdvanced)}
        attn={attn}
        setAttn={setAttn}
        partyEnName={partyEnName}
        setPartyEnName={setPartyEnName}
        supplierId={supplierId}
        setSupplierId={setSupplierId}
        supplierInvoiceNumber={supplierInvoiceNumber}
        setSupplierInvoiceNumber={setSupplierInvoiceNumber}
        onSupplierSelectedName={setPartyName}
      />

      {!isPurchase && (
        <CustomerPickerModal
          open={customerPickerOpen}
          onOpenChange={setCustomerPickerOpen}
          selectedCustomerId={customerId}
          onSelect={handleSelectCustomer}
        />
      )}
    </div>
  );
}

export default CustomInvoiceMetaSection;
