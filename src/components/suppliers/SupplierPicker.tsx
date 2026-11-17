import React, { useEffect, useState } from "react";
import { Truck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllSuppliers, type Supplier } from "@/lib/repositories/SupplierRepository";

interface Props {
  value: string | null | undefined;
  onChange: (supplierId: string | null, supplier?: Supplier | null) => void;
}

/**
 * منتقي المورد لفاتورة الشراء (PRD §7.2).
 * بدون مورد لا يمكن تتبّع الالتزام ولا دفعه، لذلك هو حقل أساسي في فاتورة الشراء.
 */
export function SupplierPicker({ value, onChange }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadSuppliers = async () => {
      try {
        const list = await getAllSuppliers();
        if (!cancelled) setSuppliers(list);
      } catch (err) {
        console.warn("[SupplierPicker] load failed:", err);
      }
    };
    void loadSuppliers();
    window.addEventListener("native-storage-ready", loadSuppliers);
    return () => {
      cancelled = true;
      window.removeEventListener("native-storage-ready", loadSuppliers);
    };
  }, []);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-black text-foreground flex items-center gap-1.5">
        <Truck className="h-3.5 w-3.5 text-primary" />
        <span>المورد المُنفّذ</span>
      </label>
      <Select
        value={value ?? "__none__"}
        onValueChange={(next) => {
          if (next === "__none__") {
            onChange(null, null);
            return;
          }
          const matched = suppliers.find((s) => s.id === next) ?? null;
          onChange(next, matched);
        }}
      >
        <SelectTrigger className="h-10 rounded-xl text-xs font-bold bg-background text-foreground text-right border-border">
          <SelectValue placeholder="اختر المورد" />
        </SelectTrigger>
        <SelectContent dir="rtl">
          <SelectItem value="__none__">— اختر المورد —</SelectItem>
          {suppliers.map((supplier) => (
            <SelectItem key={supplier.id} value={supplier.id}>
              <span className="text-xs font-bold text-foreground">{supplier.name}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suppliers.length === 0 && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          لا يوجد موردون بعد. أضف المورد من قسم «الموردون» ليصبح الالتزام قابلاً للتتبّع والسداد.
        </p>
      )}
    </div>
  );
}

export default SupplierPicker;
