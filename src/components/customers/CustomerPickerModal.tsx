import React, { useState, useMemo } from "react";
import { Search, UserPlus, X, Check, Building, PhoneCall, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useCustomers,
  addCustomer,
  CUSTOMER_TYPE_CONFIG,
  type CustomerRecord,
  type CustomerType,
} from "@/lib/customersStore";
import { formatNumber } from "@/lib/printCalculator";
import { playTapSound, playSuccessSound } from "@/lib/soundEffects";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCustomerId?: string | null;
  onSelect: (customer: CustomerRecord) => void;
}

export function CustomerPickerModal({
  open,
  onOpenChange,
  selectedCustomerId,
  onSelect,
}: Props) {
  const customers = useCustomers();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Inline Quick Add state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState<CustomerType>("agency");
  const [isSaving, setIsSaving] = useState(false);

  const activeCustomers = useMemo(() => {
    return customers.filter((c) => !c.isArchived);
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeCustomers.filter((c) => {
      const matchSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q));
      const matchType = typeFilter === "all" || c.type === typeFilter;
      return matchSearch && matchType;
    });
  }, [activeCustomers, search, typeFilter]);

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const created = await addCustomer({
        name: newName.trim(),
        phone: newPhone.trim(),
        type: newType,
        address: "",
        balance: 0,
      });
      playSuccessSound();
      toast.success(`تمت إضافة العميل "${created.name}" واختياره للفاتورة`);
      setIsAddingNew(false);
      setNewName("");
      setNewPhone("");
      onSelect(created);
      onOpenChange(false);
    } catch (err) {
      toast.error("تعذر إضافة العميل الجديد");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-lg w-[95vw] p-4 sm:p-5 rounded-2xl bg-card border-border shadow-2xl max-h-[85vh] flex flex-col gap-3"
      >
        <DialogHeader className="border-b border-border/50 pb-2.5 text-right flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-sm sm:text-base font-black text-foreground">
              سجل العملاء المعتمدين
            </DialogTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              اختر العميل لربط الفاتورة بملفه التجاري والمالي
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              playTapSound();
              setIsAddingNew(!isAddingNew);
            }}
            className="h-8 text-xs font-black gap-1 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-2xs"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>{isAddingNew ? "الرجوع للقائمة" : "+ عميل جديد"}</span>
          </Button>
        </DialogHeader>

        {isAddingNew ? (
          /* نموذج إضافة عميل سريع دون مغادرة الشاشة */
          <form onSubmit={handleQuickAdd} className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-muted-foreground">اسم العميل / الوكالة أو الشركة *</label>
              <input
                type="text"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: شركة النيل الحديثة"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">رقم الهاتف</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="09XXXXXXXX"
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">التصنيف</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CustomerType)}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {Object.entries(CUSTOMER_TYPE_CONFIG).map(([k, cfg]) => (
                    <option key={k} value={k}>
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingNew(false)}
                className="h-8 text-xs font-bold rounded-xl"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !newName.trim()}
                className="h-8 text-xs font-black rounded-xl bg-primary text-white"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ واختيار العميل"}
              </Button>
            </div>
          </form>
        ) : (
          /* قائمة البحث والاختيار */
          <div className="flex flex-col flex-1 min-h-0 gap-2.5">
            {/* حقل البحث */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                className="h-9 w-full rounded-xl border border-border/80 bg-secondary/50 pr-9 pl-8 text-xs font-bold text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* تصنيفات سريعة */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {[
                { key: "all", label: "الكل" },
                { key: "agency", label: "وكالات (أ)" },
                { key: "company", label: "شركات (ب)" },
                { key: "individual", label: "أفراد" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition cursor-pointer ${
                    typeFilter === tab.key
                      ? "bg-primary text-white"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* قائمة العملاء */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] space-y-1.5 pr-0.5 divide-y divide-border/30">
              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground border border-dashed border-border/70 rounded-xl">
                  {search ? "لا توجد نتائج مطابقة لبحثك" : "لا يوجد عملاء مسجلون حالياً"}
                </div>
              ) : (
                filteredCustomers.map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  const cfg = CUSTOMER_TYPE_CONFIG[cust.type] || CUSTOMER_TYPE_CONFIG.individual;

                  return (
                    <div
                      key={cust.id}
                      onClick={() => {
                        playTapSound();
                        onSelect(cust);
                        onOpenChange(false);
                      }}
                      className={`p-2.5 rounded-xl cursor-pointer transition flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-secondary/60 border border-transparent"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-black text-xs text-foreground truncate">
                            {cust.name}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.2 text-[9px] font-bold border ${cfg.bg} ${cfg.color} border-current/20 shrink-0`}
                          >
                            {cfg.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          {cust.phone && (
                            <span className="font-mono font-bold" dir="ltr">
                              {cust.phone}
                            </span>
                          )}
                          {cust.address && <span className="truncate">{cust.address}</span>}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        {cust.balance > 0 ? (
                          <div className="text-[10.5px] font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatNumber(cust.balance)} ج.س
                            <span className="text-[9px] block text-rose-600/70 font-normal">مديونية</span>
                          </div>
                        ) : cust.balance < 0 ? (
                          <div className="text-[10.5px] font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatNumber(Math.abs(cust.balance))} ج.س
                            <span className="text-[9px] block text-emerald-600/70 font-normal">رصيد مقدم</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground font-medium">متزن</span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-primary text-white shrink-0">
                          <Check className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
