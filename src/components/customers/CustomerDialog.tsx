import { useState, useEffect } from "react";
import { X, UserPlus, Building, Phone, MapPin, FileText, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";
import { AppCurrency } from "@/lib/currency/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<CustomerRecord, "id" | "createdAt" | "totalOrders" | "totalSpent">) => void;
  initialData?: CustomerRecord | null;
}

const SUPPORTED_CURRENCIES: { code: AppCurrency; label: string }[] = [
  { code: "SDG", label: "جنيه سوداني (SDG)" },
  { code: "USD", label: "دولار أمريكي (USD)" },
  { code: "SAR", label: "ريال سعودي (SAR)" },
  { code: "EGP", label: "جنيه مصري (EGP)" },
];

export function CustomerDialog({ open, onClose, onSave, initialData }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<CustomerType>("agency");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  // Opening balance fields
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingCurrency, setOpeningCurrency] = useState<AppCurrency>("SDG");
  const [openingType, setOpeningType] = useState<"debit" | "credit">("debit");
  const [openingDate, setOpeningDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openingNotes, setOpeningNotes] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setPhone(initialData.phone || "");
      setType(initialData.type || "agency");
      setAddress(initialData.address || "");
      setNotes(initialData.notes || "");
      setOpeningBalance(String(initialData.openingBalance ?? (initialData.balance ? Math.abs(initialData.balance) : 0)));
      setOpeningCurrency((initialData.openingBalanceCurrency as AppCurrency) || "SDG");
      setOpeningType(initialData.openingBalanceType || (initialData.balance < 0 ? "credit" : "debit"));
      setOpeningDate(initialData.openingBalanceDate || initialData.createdAt?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setOpeningNotes(initialData.openingBalanceNotes || "");
    } else {
      setName("");
      setPhone("");
      setType("agency");
      setAddress("");
      setNotes("");
      setOpeningBalance("0");
      setOpeningCurrency("SDG");
      setOpeningType("debit");
      setOpeningDate(new Date().toISOString().slice(0, 10));
      setOpeningNotes("");
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const opBalNum = parseFloat(openingBalance) || 0;
    const computedLegacyBalance = opBalNum > 0 ? (openingType === "debit" ? opBalNum : -opBalNum) : 0;

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      type,
      address: address.trim(),
      balance: computedLegacyBalance,
      notes: notes.trim() || undefined,
      openingBalance: opBalNum,
      openingBalanceCurrency: openingCurrency,
      openingBalanceType: openingType,
      openingBalanceDate: opBalNum > 0 ? openingDate : undefined,
      openingBalanceNotes: opBalNum > 0 ? openingNotes.trim() || undefined : undefined,
      isArchived: initialData?.isArchived ?? false,
    });
    onClose();
  };

  const fieldStyle =
    "h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div
      role="dialog"
      aria-modal="true"
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))] px-[max(1rem,env(safe-area-inset-left,0px))] animate-in fade-in"
    >
      <div className="w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl space-y-3.5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">
                {initialData ? "تعديل ملف وبيانات العميل" : "إضافة عميل جديد"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                سجل بيانات التواصل، التصنيف التجاري، والرصيد الافتتاحي الموثق
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* الاسم والتصنيف */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground">اسم العميل / الوكالة أو الشركة *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: وكالة الأفق للدعاية والإعلان"
              className={fieldStyle}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">رقم الهاتف للتواصل والواتساب</label>
              <input
                type="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XXXXXXXX"
                className={fieldStyle}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">تصنيف العميل</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomerType)}
                className={fieldStyle}
              >
                {Object.entries(CUSTOMER_TYPE_CONFIG).map(([k, cfg]) => (
                  <option key={k} value={k}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground">العنوان / المنطقة أو المدينة</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="مثال: الخرطوم - بورتسودان - السوق العربي"
              className={fieldStyle}
            />
          </div>

          {/* قسم الرصيد الافتتاحي المطور والموثق كحركة مالية */}
          <div className="rounded-xl border border-border/80 bg-secondary/30 p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5">
              <Wallet className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-black text-foreground">الرصيد الافتتاحي (حركة مالية موثقة)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">قيمة الرصيد</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0"
                  className={fieldStyle}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">العملة</label>
                <select
                  value={openingCurrency}
                  onChange={(e) => setOpeningCurrency(e.target.value as AppCurrency)}
                  className={fieldStyle}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">طبيعة الرصيد</label>
                <select
                  value={openingType}
                  onChange={(e) => setOpeningType(e.target.value as "debit" | "credit")}
                  className={fieldStyle}
                >
                  <option value="debit">مدين (مستحق على العميل)</option>
                  <option value="credit">دائن (رصيد مقدم للعميل)</option>
                </select>
              </div>
            </div>

            {parseFloat(openingBalance) > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border/40">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">تاريخ الرصيد الافتتاحي</label>
                  <input
                    type="date"
                    value={openingDate}
                    onChange={(e) => setOpeningDate(e.target.value)}
                    className={fieldStyle}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">بيان / سبب الرصيد الافتتاحي</label>
                  <input
                    type="text"
                    value={openingNotes}
                    onChange={(e) => setOpeningNotes(e.target.value)}
                    placeholder="مثال: رصيد مرحل من الدفاتر السابقة"
                    className={fieldStyle}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground">ملاحظات وشروط خاصة بالعميل</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: خصم وكالة 10%، سداد أسبوعي..."
              className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border/60">
            <Button
              type="submit"
              className="h-9 bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-deep cursor-pointer"
            >
              {initialData ? "تحديث بيانات العميل" : "حفظ العميل"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold cursor-pointer"
            >
              إلغاء
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
