import React from "react";
import { Calculator } from "lucide-react";
import { DraftDescriptionField } from "@/components/order/DraftDescriptionField";
import { CalculatorInputsCardProps } from "./types";
import { MaterialPriceQtyInputs } from "./MaterialPriceQtyInputs";
import { DimensionsInputs } from "./DimensionsInputs";
import { CalculatorActionButtons } from "./CalculatorActionButtons";
import { CalculatorResultPreview } from "./CalculatorResultPreview";

export * from "./types";

/**
 * بطاقة إدخال بيانات حاسبة الرولات
 * تصميم نظيف matte ومحمي من السحب الجانبي أو التمدد الأفقي
 */
export const CalculatorInputsCard: React.FC<CalculatorInputsCardProps> = ({
  material,
  setMaterial,
  unitPrice,
  qty,
  width,
  height,
  description,
  setDescription,
  descriptionRef,
  widthRef,
  heightRef,
  qtyRef,
  priceRef,
  fieldErrors,
  onFieldChange,
  onBlurField,
  focusNext,
  onCalc,
  onAddToOrder,
  error,
  result,
  groupedMaterials,
}) => {
  return (
    <section className="rounded-3xl border border-border bg-card p-3.5 sm:p-4 shadow-xs w-full max-w-full min-w-0 overflow-hidden">
      {/* رأس البطاقة */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-secondary text-foreground border border-border/60">
            <Calculator className="h-4 w-4" />
          </span>
          <h2 className="text-xs sm:text-sm font-black text-foreground">بيانات المقاس والخامة</h2>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground">حاسبة الرولات</span>
      </div>

      {/* 1. صف إدخال الخامة، السعر، والكمية */}
      <MaterialPriceQtyInputs
        material={material}
        setMaterial={setMaterial}
        unitPrice={unitPrice}
        qty={qty}
        priceRef={priceRef}
        qtyRef={qtyRef}
        widthRef={widthRef}
        fieldErrors={fieldErrors}
        onFieldChange={onFieldChange}
        onBlurField={onBlurField}
        focusNext={focusNext}
        groupedMaterials={groupedMaterials}
      />

      {/* 2. صف إدخال أبعاد المقاس (سم) */}
      <DimensionsInputs
        width={width}
        height={height}
        widthRef={widthRef}
        heightRef={heightRef}
        descriptionRef={descriptionRef}
        fieldErrors={fieldErrors}
        onFieldChange={onFieldChange}
        onBlurField={onBlurField}
        focusNext={focusNext}
      />

      {/* 3. حقل إدخال وصف البند المسودة */}
      <div className="mt-2.5 w-full min-w-0">
        <DraftDescriptionField
          ref={descriptionRef}
          value={description}
          onChange={setDescription}
          onAdd={onAddToOrder}
        />
      </div>

      {/* 4. أزرار الإجراءات (احسب الآن + إضافة) */}
      <CalculatorActionButtons onCalc={onCalc} onAddToOrder={onAddToOrder} />

      {/* 5. عرض الخطأ أو نتيجة الحساب والرول المختار */}
      <CalculatorResultPreview result={result} error={error} />
    </section>
  );
};
