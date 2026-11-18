import React, { useState, useMemo } from "react";
import { Search, UserPlus, X, Check, Building2, Phone, Wallet, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

  const fieldStyle =
    "h-10 w-full rounded-xl border border-border/80 bg-background px-3 text-xs font-bold text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-lg w-[95vw] p-0 rounded-2xl bg-card border-border/80 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <DialogHeader className="p-4 sm:p-5 border-b border-border/60 bg-muted/20 text-right flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle className="text-sm sm:text-base font-black text-foreground">
                سجل العملاء المعتمدين
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground mt-0.5">
                اختر العميل لربط الفاتورة بملفه التجاري والمالي
              </DialogDescription>
            </div>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => {
              playTapSound();
              setIsAddingNew(!isAddingNew);
            }}
            className="h-8 text-xs font-black gap-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white shrink-0 shadow-xs active:scale-[0.97] touch-manipulation cursor-pointer"
          >
            {isAddingNew ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            <span>{isAddingNew ? "قائمة العملاء" : "عميل جديد"}</span>
          </Button>
        </DialogHeader>

        {isAddingNew ? (
          /* نموذج إضافة عميل سريع دون مغادرة الشاشة */
          <form onSubmit={handleQuickAdd} className="p-4 sm:p-5 space-y-3.5 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-foreground flex items-center gap-1">
                <span>اسم العميل / الوكالة أو الشركة</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="مثال: شركة النيل الحديثة"
                className={fieldStyle}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">رقم الهاتف للتواصل والواتساب</label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="09XXXXXXXX"
                  className={fieldStyle}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-foreground">التصنيف التجاري</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as CustomerType)}
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

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingNew(false)}
                className="h-9 text-xs font-bold rounded-xl border-border/80 text-foreground cursor-pointer"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving || !newName.trim()}
                className="h-9 px-5 text-xs font-black rounded-xl bg-primary hover:bg-primary/90 text-white shadow-xs active:scale-[0.97] touch-manipulation cursor-pointer"
              >
                {isSaving ? "جاري الحفظ..." : "حفظ واختيار العميل"}
              </Button>
            </div>
          </form>
        ) : (
          /* قائمة البحث والاختيار */
          <div className="p-4 sm:p-5 flex flex-col flex-1 min-h-0 gap-3">
            {/* حقل البحث */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث بالاسم أو رقم الهاتف..."
                className="h-9.5 w-full rounded-xl border border-border/80 bg-secondary/35 pr-9 pl-8 text-xs font-bold text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary focus:bg-background focus:ring-1 focus:ring-primary"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* تصنيفات سريعة */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[11px]">
              {[
                { key: "all", label: "الكل" },
                { key: "agency", label: "وكالات (أ)" },
                { key: "company", label: "شركات (ب)" },
                { key: "individual", label: "أفراد" },
              ].map((tab) => {
                const active = typeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      playTapSound();
                      setTypeFilter(tab.key);
                    }}
                    className={`px-3 py-1 rounded-full font-bold shrink-0 transition-all cursor-pointer touch-manipulation active:scale-95 ${
                      active
                        ? "bg-primary text-white shadow-2xs"
                        : "bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground border border-border/50"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* قائمة العملاء */}
            <div className="flex-1 overflow-y-auto min-h-[220px] max-h-[360px] space-y-1.5 pr-0.5 divide-y divide-border/30">
              {filteredCustomers.length === 0 ? (
                <div className="py-12 text-center text-xs font-bold text-muted-foreground border border-dashed border-border/70 rounded-2xl">
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
                      className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        isSelected
                          ? "bg-primary/10 border border-primary/30 shadow-2xs"
                          : "hover:bg-secondary/50 border border-transparent"
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

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                          {cust.phone ? (
                            <span className="font-mono font-bold text-primary/80" dir="ltr">
                              {cust.phone}
                            </span>
                          ) : null}
                          {cust.address ? <span className="truncate">{cust.address}</span> : null}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        {cust.balance > 0 ? (
                          <div className="text-[11px] font-mono font-black text-rose-600 dark:text-rose-400 tabular-nums">
                            {formatNumber(cust.balance)} ج.س
                            <span className="text-[9px] block text-rose-600/70 font-normal">مديونية</span>
                          </div>
                        ) : cust.balance < 0 ? (
                          <div className="text-[11px] font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatNumber(Math.abs(cust.balance))} ج.س
                            <span className="text-[9px] block text-emerald-600/70 font-normal">رصيد مقدم</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-bold">متزن (0)</span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-primary text-white shrink-0 shadow-2xs">
                          <Check className="h-3.5 w-3.5" />
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
