import { useState, useEffect } from "react";
import { X, UserPlus, Building, Phone, MapPin, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<CustomerRecord, "id" | "createdAt" | "totalOrders" | "totalSpent">) => void;
  initialData?: CustomerRecord | null;
}

export function CustomerDialog({ open, onClose, onSave, initialData }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<CustomerType>("agency");
  const [address, setAddress] = useState("");
  const [balance, setBalance] = useState("0");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setPhone(initialData.phone);
      setType(initialData.type);
      setAddress(initialData.address);
      setBalance(String(initialData.balance));
      setNotes(initialData.notes || "");
    } else {
      setName("");
      setPhone("");
      setType("agency");
      setAddress("");
      setBalance("0");
      setNotes("");
    }
  }, [initialData, open]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      phone: phone.trim(),
      type,
      address: address.trim(),
      balance: parseFloat(balance) || 0,
      notes: notes.trim() || undefined,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground">
                {initialData ? "تعديل بيانات العميل" : "إضافة عميل جديد"}
              </h2>
              <p className="text-[10px] text-muted-foreground">
                سجل بيانات التواصل ونوع العميل لتسهيل الفوترة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground">اسم العميل / الوكالة *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: وكالة الأفق للدعاية والإعلان"
              className={fieldStyle}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">رقم الهاتف</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">العنوان / المنطقة</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="مثال: الخرطوم - شارع الستين"
                className={fieldStyle}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">الرصيد الافتتاحي (مديونية ج.س)</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0"
                className={fieldStyle}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-muted-foreground">ملاحظات وشروط خاصة</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: خصم 10% على الفليكس، سداد أسبوعي..."
              className="w-full rounded-xl border border-border bg-background p-2.5 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="h-9 px-4 text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              className="h-9 bg-primary px-5 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary-deep"
            >
              {initialData ? "تحديث البيانات" : "حفظ العميل"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
