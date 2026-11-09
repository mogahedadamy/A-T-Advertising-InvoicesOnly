import React from "react";
import { MaterialKey, MATERIALS } from "@/lib/printCalculator";
import { FieldKey } from "./types";
import { getInputValidationClass } from "./inputStyles";

interface MaterialPriceQtyInputsProps {
  material: MaterialKey;
  setMaterial: (m: MaterialKey) => void;
  unitPrice: string;
  qty: string;
  priceRef: React.RefObject<HTMLInputElement | null>;
  qtyRef: React.RefObject<HTMLInputElement | null>;
  widthRef: React.RefObject<HTMLInputElement | null>;
  fieldErrors: Partial<Record<FieldKey, string>>;
  onFieldChange: (key: FieldKey, val: string) => void;
  onBlurField: (key: FieldKey, val: string) => void;
  focusNext: (ref: React.RefObject<HTMLInputElement | null>) => void;
  groupedMaterials: [string, typeof MATERIALS][];
}

/**
 * مكون إدخال بيانات نوع الخامة وسعر المتر والكمية المطلوبة
 * مصمم مع min-w-0 لمنع أي تمدد أفقي على شاشات الموبايل
 */
export const MaterialPriceQtyInputs: React.FC<MaterialPriceQtyInputsProps> = ({
  material,
  setMaterial,
  unitPrice,
  qty,
  priceRef,
  qtyRef,
  widthRef,
  fieldErrors,
  onFieldChange,
  onBlurField,
  focusNext,
  groupedMaterials,
}) => {
  return (
    <div className="grid grid-cols-12 gap-2 w-full max-w-full min-w-0">
      {/* اختيار نوع الخامة */}
      <div className="col-span-6 min-w-0">
        <label className="mb-1 block text-[10px] font-bold text-muted-foreground truncate">
          نوع الخامة
        </label>
        <select
          value={material}
          onChange={(e) => setMaterial(e.target.value as MaterialKey)}
          className="h-11 w-full min-w-0 rounded-xl border border-border bg-input px-2 text-[12px] sm:text-[13px] font-bold text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/40 touch-manipulation truncate"
        >
          {groupedMaterials.map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* سعر المتر المربع */}
      <div className="col-span-4 min-w-0">
        <label className="mb-1 block text-[10px] font-bold text-muted-foreground truncate">
          السعر / م²
        </label>
        <input
          ref={priceRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="next"
          value={unitPrice}
          onChange={(e) => onFieldChange("unitPrice", e.target.value)}
          onBlur={(e) => onBlurField("unitPrice", e.target.value)}
          aria-invalid={!!fieldErrors.unitPrice}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              focusNext(qtyRef);
            }
          }}
          className={getInputValidationClass(
            !!fieldErrors.unitPrice,
            "h-11 w-full min-w-0 px-2 text-sm font-bold tabular-nums"
          )}
        />
        {fieldErrors.unitPrice && (
          <p className="mt-0.5 text-[9px] font-bold text-destructive truncate">
            {fieldErrors.unitPrice}
          </p>
        )}
      </div>

      {/* الكمية */}
      <div className="col-span-2 min-w-0">
        <label className="mb-1 block text-[10px] font-bold text-muted-foreground text-center truncate">
          الكمية
        </label>
        <input
          ref={qtyRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="next"
          value={qty}
          onChange={(e) => onFieldChange("qty", e.target.value)}
          onBlur={(e) => onBlurField("qty", e.target.value)}
          aria-invalid={!!fieldErrors.qty}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              focusNext(widthRef);
            }
          }}
          className={getInputValidationClass(
            !!fieldErrors.qty,
            "h-11 w-full min-w-0 px-1 text-center text-sm font-black tabular-nums"
          )}
        />
        {fieldErrors.qty && (
          <p className="mt-0.5 text-[9px] font-bold text-destructive text-center truncate">
            {fieldErrors.qty}
          </p>
        )}
      </div>
    </div>
  );
};
