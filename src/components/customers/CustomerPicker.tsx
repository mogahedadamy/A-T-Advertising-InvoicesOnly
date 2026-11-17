import React from "react";
import { Users } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers, type CustomerRecord } from "@/lib/customersStore";

interface Props {
  value: string | null | undefined;
  onChange: (customerId: string | null, customer?: CustomerRecord | null) => void;
}

/**
 * منتقي العميل لفاتورة المبيعات / العرض المبدئي:
 * يتيح اختيار عميل مسجّل ليتم تعبئة اسمه تلقائياً في خانة الفاتورة،
 * مع بقاء حقل الاسم في الفاتورة حراً للتعديل أو المسح الكامل.
 */
export function CustomerPicker({ value, onChange }: Props) {
  const customers = useCustomers();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-foreground flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" />
          <span>اختيار عميل مسجّل</span>
        </label>
        <span className="text-[10px] font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-secondary/80 border border-border/50">
          اختياري
        </span>
      </div>
      <Select
        value={value ?? "__none__"}
        onValueChange={(next) => {
          if (next === "__none__") {
            onChange(null, null);
            return;
          }
          const matched = customers.find((c) => c.id === next) ?? null;
          onChange(next, matched);
        }}
      >
        <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-foreground text-right border-border">
          <SelectValue placeholder="اختر العميل لتعبئة اسمه تلقائياً" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="__none__">— إدخال يدوي / بدون ربط عميل —</SelectItem>
          {customers.map((customer) => (
            <SelectItem key={customer.id} value={customer.id}>
              <span className="text-xs font-bold text-foreground">{customer.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {customers.length === 0 && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          لا يوجد عملاء مسجلون بعد — يمكنك كتابة اسم العميل مباشرة أدناه أو إضافته من قسم «العملاء».
        </p>
      )}
    </div>
  );
}

export default CustomerPicker;

