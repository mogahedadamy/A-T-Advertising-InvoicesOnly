import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  MATERIALS,
  MaterialKey,
  calculate,
  CalcResult,
} from "@/lib/printCalculator";
import {
  playCalcSound,
  playAddSound,
  playErrorSound,
} from "@/lib/soundEffects";
import { FieldKey } from "@/components/calculator/types";
import { OrderItem } from "@/lib/orderSession";

export function useCalculatorForm(
  onAddToOrderSuccess: (item: OrderItem) => void
) {
  const [material, setMaterial] = useState<MaterialKey>("flex");
  const [unitPrice, setUnitPrice] = useState<string>("28000");
  const [qty, setQty] = useState<string>("1");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");

  const [description, setDescription] = useState("");
  const descriptionRef = useRef<HTMLInputElement>(null);

  const widthRef = useRef<HTMLInputElement>(null);
  const heightRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldKey, string>>>({});

  // تحديث السعر الافتراضي تلقائياً عند تغيير نوع الخامة
  useEffect(() => {
    const m = MATERIALS.find((x) => x.key === material);
    if (m) setUnitPrice(String(m.defaultPrice));
  }, [material]);

  // نقل التركيز إلى الحقل التالي بسلاسة
  const focusNext = useCallback((ref: React.RefObject<HTMLInputElement | null>) => {
    setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      try {
        el.select();
      } catch {
        /* noop */
      }
    }, 0);
  }, []);

  // التحقق من صحة المدخلات لكل حقل
  const validateField = useCallback((key: FieldKey, value: string): string => {
    const v = value.trim();
    if (key === "qty") {
      if (v === "") return "أدخل الكمية";
      const n = parseInt(v);
      if (!Number.isFinite(n) || n <= 0) return "كمية غير صالحة";
      if (n > 9999) return "الكمية كبيرة جدًا";
      return "";
    }
    if (key === "unitPrice") {
      if (v === "") return "أدخل السعر";
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n < 0) return "سعر غير صالح";
      return "";
    }
    if (v === "") return "أدخل القيمة";
    const n = parseFloat(v);
    if (!Number.isFinite(n) || n <= 0) return "قيمة غير صالحة";
    if (n > 10000) return "القيمة كبيرة جدًا";
    return "";
  }, []);

  const validateAll = useCallback((): Partial<Record<FieldKey, string>> => {
    const errs: Partial<Record<FieldKey, string>> = {};
    const values: Record<FieldKey, string> = { width, height, qty, unitPrice };
    (["width", "height", "qty", "unitPrice"] as FieldKey[]).forEach((k) => {
      const msg = validateField(k, values[k]);
      if (msg) errs[k] = msg;
    });
    return errs;
  }, [width, height, qty, unitPrice, validateField]);

  const refFor = useCallback((k: FieldKey) => {
    switch (k) {
      case "width":
        return widthRef;
      case "height":
        return heightRef;
      case "qty":
        return qtyRef;
      case "unitPrice":
        return priceRef;
    }
  }, []);

  const focusFirstInvalid = useCallback((errs: Partial<Record<FieldKey, string>>) => {
    const ord: FieldKey[] = ["width", "height", "qty", "unitPrice"];
    const first = ord.find((k) => errs[k]);
    if (first) focusNext(refFor(first));
  }, [focusNext, refFor]);

  // تطبيع الأرقام العربية والفواصل العشرية تلقائياً
  const handleFieldChange = useCallback((key: FieldKey, value: string) => {
    const normalized = value
      .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString())
      .replace(/،/g, ".");

    if (key === "width") setWidth(normalized);
    else if (key === "height") setHeight(normalized);
    else if (key === "qty") setQty(normalized);
    else setUnitPrice(normalized);

    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  const handleBlurField = useCallback((key: FieldKey, value: string) => {
    setFieldErrors((p) => ({
      ...p,
      [key]: validateField(key, value) || undefined,
    }));
  }, [validateField]);

  // تنفيذ عملية حساب المقاس واختيار الرول والتكلفة
  const handleCalc = useCallback((): CalcResult | null => {
    setError("");
    setResult(null);
    const errs = validateAll();
    if (Object.keys(errs).length > 0) {
      playErrorSound();
      setFieldErrors(errs);
      focusFirstInvalid(errs);
      return null;
    }
    setFieldErrors({});
    const out = calculate({
      width: parseFloat(width) || 0,
      height: parseFloat(height) || 0,
      qty: parseInt(qty) || 1,
      unitPrice: parseFloat(unitPrice) || 0,
      material,
    });
    if (out.ok === false) {
      playErrorSound();
      setError(out.error);
      return null;
    }
    playCalcSound();
    setResult(out.result);
    return out.result;
  }, [width, height, qty, unitPrice, material, validateAll, focusFirstInvalid]);

  // إضافة البند المحسوب إلى قائمة الطلب الجاري وتفريغ الحقول للإدخال التالي
  const handleAddToOrder = useCallback(() => {
    const r = result ?? handleCalc();
    if (!r) return;
    playAddSound();
    const finalDescription = descriptionRef.current?.value ?? description;
    
    onAddToOrderSuccess({ ...r, description: finalDescription });

    setDescription("");
    if (descriptionRef.current) {
      descriptionRef.current.value = "";
    }
    setWidth("");
    setHeight("");
    setQty("1");
    setResult(null);
    setFieldErrors({});
    setTimeout(() => {
      widthRef.current?.focus();
    }, 0);
  }, [result, handleCalc, description, onAddToOrderSuccess]);

  const resetCalculator = useCallback(() => {
    setResult(null);
    setError("");
    setWidth("");
    setHeight("");
    setQty("1");
    setDescription("");
    setFieldErrors({});
  }, []);

  const groupedMaterials = useMemo(() => {
    const map = new Map<string, typeof MATERIALS>();
    MATERIALS.forEach((m) => {
      const arr = map.get(m.group) ?? [];
      arr.push(m);
      map.set(m.group, arr);
    });
    return Array.from(map.entries());
  }, []);

  return {
    state: {
      material,
      unitPrice,
      qty,
      width,
      height,
      description,
      result,
      error,
      fieldErrors,
      groupedMaterials,
    },
    refs: {
      descriptionRef,
      widthRef,
      heightRef,
      qtyRef,
      priceRef,
    },
    actions: {
      setMaterial,
      setDescription,
      handleFieldChange,
      handleBlurField,
      focusNext,
      handleCalc,
      handleAddToOrder,
      resetCalculator,
    },
  };
}
