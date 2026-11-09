import React from "react";
import { Layers, Ruler, CheckCircle2 } from "lucide-react";
import { formatNumber } from "@/lib/printCalculator";
import { MaterialDetailItem } from "./typesAndData";

interface MaterialCardProps {
  material: {
    key: string;
    label: string;
    group: string;
    defaultPrice: number;
  };
  details: MaterialDetailItem;
}

/**
 * بطاقة عرض مواصفات وسعر واستخدامات الخامة الفردية
 */
export const MaterialCard: React.FC<MaterialCardProps> = ({ material, details }) => {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col justify-between hover:border-primary/40 transition">
      <div className="space-y-3">
        {/* الترويسة واسم الخامة والسعر المعتمد */}
        <div className="flex items-start justify-between border-b border-border/70 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary font-bold">
                <Layers className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-sm font-black text-foreground">{material.label}</h3>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {material.group}
                </span>
              </div>
            </div>
          </div>

          <div className="text-left font-mono">
            <span className="text-base font-black text-primary">
              {formatNumber(material.defaultPrice)}
            </span>
            <span className="text-[10px] text-muted-foreground font-sans block">
              ج.س / م²
            </span>
          </div>
        </div>

        {/* الوصف الفني للطباعة */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {details.desc}
        </p>

        {/* أبرز الاستخدامات التجارية */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold text-foreground block">
            أبرز الاستخدامات:
          </span>
          <ul className="space-y-1">
            {details.uses.map((useItem, i) => (
              <li
                key={i}
                className="text-[11px] text-muted-foreground flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>{useItem}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ملاحظات الرول والقص */}
      <div className="mt-4 pt-2.5 border-t border-border/60 text-[10.5px] text-muted-foreground flex items-center gap-1.5 font-medium">
        <Ruler className="h-3.5 w-3.5 text-primary shrink-0" />
        <span>{details.rollNote}</span>
      </div>
    </div>
  );
};
