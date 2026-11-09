import React from "react";
import { MATERIALS } from "@/lib/printCalculator";
import { MATERIAL_TECHNICAL_DETAILS, MaterialDetailItem } from "./typesAndData";
import { MaterialCard } from "./MaterialCard";

const defaultDetails: MaterialDetailItem = {
  desc: "خامة طباعة رقمية أوت دور / إن دور.",
  uses: ["لوحات إعلانية عامة"],
  rollNote: "رولات عريضة قياسية.",
};

/**
 * شبكة استعراض بطاقات الخامات والأسعار المعتمدة
 */
export const MaterialsGrid: React.FC = () => {
  return (
    <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
      {MATERIALS.map((mat) => {
        const details = MATERIAL_TECHNICAL_DETAILS[mat.key] ?? defaultDetails;

        return (
          <MaterialCard
            key={mat.key}
            material={mat}
            details={details}
          />
        );
      })}
    </div>
  );
};
