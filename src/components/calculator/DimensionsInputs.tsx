import React from "react";
import { Ruler } from "lucide-react";
import { FieldKey } from "./types";
import { getInputValidationClass } from "./inputStyles";

interface DimensionsInputsProps {
  width: string;
  height: string;
  widthRef: React.RefObject<HTMLInputElement | null>;
  heightRef: React.RefObject<HTMLInputElement | null>;
  descriptionRef: React.RefObject<HTMLInputElement | null>;
  fieldErrors: Partial<Record<FieldKey, string>>;
  onFieldChange: (key: FieldKey, val: string) => void;
  onBlurField: (key: FieldKey, val: string) => void;
  focusNext: (ref: React.RefObject<HTMLInputElement | null>) => void;
}

/**
 * مكون إدخال أبعاد الطباعة (العرض × الارتفاع بالسنتمتر)
 * محمي بالكامل من التمدد الأفقي عبر min-w-0
 */
export const DimensionsInputs: React.FC<DimensionsInputsProps> = ({
  width,
  height,
  widthRef,
  heightRef,
  descriptionRef,
  fieldErrors,
  onFieldChange,
  onBlurField,
  focusNext,
}) => {
  return (
    <div className="mt-2.5 w-full max-w-full min-w-0">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
        <Ruler className="h-3.5 w-3.5 text-primary" />
        <span>المقاس (سم)</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2 w-full max-w-full min-w-0">
        {/* العرض */}
        <div className="min-w-0">
          <input
            ref={widthRef}
            type="tel"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            enterKeyHint="next"
            value={width}
            onChange={(e) => onFieldChange("width", e.target.value)}
            onBlur={(e) => onBlurField("width", e.target.value)}
            aria-invalid={!!fieldErrors.width}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focusNext(heightRef);
              }
            }}
            placeholder="العرض"
            className={getInputValidationClass(
              !!fieldErrors.width,
              "h-12 w-full min-w-0 px-2 text-center text-xl font-black tabular-nums placeholder:text-muted-foreground/40"
            )}
          />
          {fieldErrors.width && (
            <p className="mt-0.5 text-[10px] font-bold text-destructive text-center truncate">
              {fieldErrors.width}
            </p>
          )}
        </div>

        {/* رمز الضرب × */}
        <div className="grid h-12 w-9 sm:w-10 place-items-center rounded-xl bg-secondary/60 border border-border text-base font-black text-muted-foreground shrink-0 select-none">
          ×
        </div>

        {/* الارتفاع */}
        <div className="min-w-0">
          <input
            ref={heightRef}
            type="tel"
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            enterKeyHint="done"
            value={height}
            onChange={(e) => onFieldChange("height", e.target.value)}
            onBlur={(e) => onBlurField("height", e.target.value)}
            aria-invalid={!!fieldErrors.height}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                focusNext(descriptionRef);
              }
            }}
            placeholder="الارتفاع"
            className={getInputValidationClass(
              !!fieldErrors.height,
              "h-12 w-full min-w-0 px-2 text-center text-xl font-black tabular-nums placeholder:text-muted-foreground/40"
            )}
          />
          {fieldErrors.height && (
            <p className="mt-0.5 text-[10px] font-bold text-destructive text-center truncate">
              {fieldErrors.height}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
