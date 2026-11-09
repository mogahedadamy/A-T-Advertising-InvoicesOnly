import React from "react";
import { Plus, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProformaLine } from "@/lib/proforma/types";
import { formatNumber } from "@/lib/printCalculator";

interface Props {
  lines: ProformaLine[];
  onChange: (lines: ProformaLine[]) => void;
}

export function ProformaLineEditor({ lines, onChange }: Props) {
  const updateLine = (id: string, updates: Partial<ProformaLine>) => {
    const updated = lines.map((l) => {
      if (l.id !== id) return l;
      const next = { ...l, ...updates };
      // Recalculate area and total
      const w = Math.max(0, Number(next.width) || 0);
      const h = Math.max(0, Number(next.height) || 0);
      const q = Math.max(1, Number(next.qty) || 1);
      const p = Math.max(0, Number(next.unitPrice) || 0);

      const area = Number(((w * h * q) / 10000).toFixed(2));
      const total = Math.round(area * p);

      return {
        ...next,
        width: w,
        height: h,
        qty: q,
        unitPrice: p,
        area,
        total,
      };
    });
    onChange(updated);
  };

  const removeLine = (id: string) => {
    onChange(lines.filter((l) => l.id !== id));
  };

  const addLine = () => {
    const newLine: ProformaLine = {
      id: `pline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      description: `بند جديد ${lines.length + 1}`,
      material: "فلكس",
      width: 100,
      height: 100,
      qty: 1,
      unitPrice: 25000,
      area: 1.0,
      total: 25000,
    };
    onChange([...lines, newLine]);
  };

  return (
    <div className="space-y-2.5" dir="rtl">
      {/* رأس قسم البنود وزر الإضافة */}
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-black text-foreground">
            بنود ومقاسات الفاتورة ({lines.length})
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addLine}
          className="h-7.5 px-3 gap-1.5 text-xs font-black border-primary/40 text-primary hover:bg-primary/10 shadow-2xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>إضافة مقاس جديد</span>
        </Button>
      </div>

      {/* قائمة البنود مدمجة ومريحة بدون شريط تمرير داخلي مكرر */}
      <div className="space-y-2">
        {lines.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-border rounded-xl text-xs text-muted-foreground bg-muted/20">
            لا توجد بنود حالياً. اضغط على زر "إضافة مقاس جديد" للبدء.
          </div>
        ) : (
          lines.map((line, idx) => (
            <div
              key={line.id}
              className="rounded-xl border border-border/80 bg-card p-2.5 shadow-2xs space-y-2 hover:border-primary/40 transition-colors"
            >
              {/* السطر الأول: الرقم + الوصف + نوع الخام + زر الحذف */}
              <div className="flex items-center gap-1.5">
                <span className="h-6 w-6 rounded-md bg-primary/10 text-primary text-[11px] font-black flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>

                <Input
                  value={line.description}
                  onChange={(e) => updateLine(line.id, { description: e.target.value })}
                  placeholder="البيان وتفاصيل العمل"
                  className="h-7.5 text-xs font-bold flex-1"
                />

                <Input
                  value={line.material}
                  onChange={(e) => updateLine(line.id, { material: e.target.value })}
                  placeholder="الخام"
                  className="h-7.5 text-xs w-20 shrink-0 text-center font-semibold"
                />

                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeLine(line.id)}
                  className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 shrink-0 rounded-lg"
                  title="حذف البند"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* السطر الثاني: شريط القياسات والأعداد والأسعار المدمج المريح */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-xs">
                {/* القياس W × H */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-0.5 border border-border/60">
                  <span className="text-[10px] font-bold text-muted-foreground">القياس:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={line.width || ""}
                    onChange={(e) => updateLine(line.id, { width: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                    className="w-12 h-6 text-center font-mono font-bold bg-background rounded border border-border/80 text-xs text-slate-900 dark:text-slate-100 focus:border-primary outline-none"
                    title="العرض (سم)"
                  />
                  <span className="text-muted-foreground font-mono text-[11px]">×</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={line.height || ""}
                    onChange={(e) => updateLine(line.id, { height: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                    className="w-12 h-6 text-center font-mono font-bold bg-background rounded border border-border/80 text-xs text-slate-900 dark:text-slate-100 focus:border-primary outline-none"
                    title="الارتفاع (سم)"
                  />
                  <span className="text-[10px] text-muted-foreground font-semibold">سم</span>
                </div>

                {/* العدد */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-0.5 border border-border/60">
                  <span className="text-[10px] font-bold text-muted-foreground">العدد:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={line.qty || ""}
                    onChange={(e) => updateLine(line.id, { qty: Number(e.target.value.replace(/[^0-9]/g, "")) || 1 })}
                    className="w-10 h-6 text-center font-mono font-black bg-background rounded border border-border/80 text-xs text-slate-900 dark:text-slate-100 focus:border-primary outline-none"
                    title="العدد"
                  />
                </div>

                {/* سعر المتر */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-0.5 border border-border/60">
                  <span className="text-[10px] font-bold text-muted-foreground">السعر:</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]*[.,]?[0-9]*"
                    value={line.unitPrice || ""}
                    onChange={(e) => updateLine(line.id, { unitPrice: Number(e.target.value.replace(/[^0-9.]/g, "")) || 0 })}
                    className="w-16 h-6 text-center font-mono font-bold bg-background rounded border border-border/80 text-xs text-slate-900 dark:text-slate-100 focus:border-primary outline-none"
                    title="سعر المتر"
                  />
                </div>

                {/* المساحة والقيمة المحسوبة فورياً */}
                <div className="flex items-center gap-2 mr-auto text-left" dir="ltr">
                  <span className="text-[10.5px] text-muted-foreground font-mono bg-muted/40 px-1.5 py-0.5 rounded">
                    {line.area} m²
                  </span>
                  <span className="font-mono font-black text-primary text-[12px] whitespace-nowrap">
                    {formatNumber(line.total)}{" "}
                    <span className="text-[9.5px] font-bold text-muted-foreground">ج.س</span>
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
