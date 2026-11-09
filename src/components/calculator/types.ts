import React from "react";
import { MaterialKey, MATERIALS, CalcResult } from "@/lib/printCalculator";

export type FieldKey = "width" | "height" | "qty" | "unitPrice";

export interface CalculatorInputsCardProps {
  material: MaterialKey;
  setMaterial: (m: MaterialKey) => void;
  unitPrice: string;
  qty: string;
  width: string;
  height: string;
  description: string;
  setDescription: (d: string) => void;
  descriptionRef: React.RefObject<HTMLInputElement | null>;
  widthRef: React.RefObject<HTMLInputElement | null>;
  heightRef: React.RefObject<HTMLInputElement | null>;
  qtyRef: React.RefObject<HTMLInputElement | null>;
  priceRef: React.RefObject<HTMLInputElement | null>;
  fieldErrors: Partial<Record<FieldKey, string>>;
  onFieldChange: (key: FieldKey, val: string) => void;
  onBlurField: (key: FieldKey, val: string) => void;
  focusNext: (ref: React.RefObject<HTMLInputElement | null>) => void;
  onCalc: () => void;
  onAddToOrder: () => void;
  error: string;
  result: CalcResult | null;
  groupedMaterials: [string, typeof MATERIALS][];
}
