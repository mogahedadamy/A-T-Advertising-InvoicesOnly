import React, { useState } from "react";
import { Sparkles, Package, Briefcase, Wrench, FileSpreadsheet, ChevronDown, ChevronUp } from "lucide-react";
import { playAddSound, playTapSound } from "@/lib/soundEffects";

export interface ItemPreset {
  title: string;
  category: "goods" | "services" | "maintenance" | "contracts";
  defaultQty?: number;
  defaultPrice?: number;
}

export const UNIVERSAL_ITEM_PRESETS: ItemPreset[] = [
  // 1. بضائع ومبيعات تجارية عامة
  { title: "توريد بضائع ومنتجات تجارية", category: "goods" },
  { title: "أجهزة ومعدات تقنية ومكتبية", category: "goods" },
  { title: "مواد خام ومستلزمات تشغيل", category: "goods" },
  { title: "قطع غيار ومكونات أصلية", category: "goods" },

  // 2. خدمات وأعمال مهنية
  { title: "خدمات فنية واستشارية متخصصة", category: "services" },
  { title: "أعمال تركيب وتنفيذ موقعي", category: "services" },
  { title: "تصميم وتجهيز أعمال تجارية", category: "services" },
  { title: "خدمات نقل وشحن وتوصيل", category: "services" },

  // 3. صيانة ودعم فني
  { title: "أعمال صيانة دورية وإصلاح", category: "maintenance" },
  { title: "دعم فني وتأهيل تشغيلي", category: "maintenance" },
  { title: "فحص وتشخيص فني شامل", category: "maintenance" },

  // 4. تعاقدات ودفعات مالية
  { title: "دفعة مقدمة / عربون تعاقد", category: "contracts" },
  { title: "دفعة إنجاز مرحلية حسب الاتفاق", category: "contracts" },
  { title: "أتعاب إدارة وإشراف عام", category: "contracts" },
];

const CATEGORIES = [
  { id: "all", label: "الكل", icon: Sparkles },
  { id: "goods", label: "بضائع وتوريدات", icon: Package },
  { id: "services", label: "خدمات وأعمال", icon: Briefcase },
  { id: "maintenance", label: "صيانة وتشغيل", icon: Wrench },
  { id: "contracts", label: "دفعات وأتعاب", icon: FileSpreadsheet },
] as const;

interface Props {
  onSelectPreset: (preset: ItemPreset) => void;
}

/**
 * شريط مقترحات البنود التجارية العامة:
 * يتيح إدراج بنود تجارية عامة شائعة بنقرة واحدة (اختياري وقابل للطي)
 * يناسب كافة الأنشطة والمبيعات والخدمات دون حصره في مجال واحد
 */
export function CustomInvoiceQuickPresets({ onSelectPreset }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredPresets =
    activeCategory === "all"
      ? UNIVERSAL_ITEM_PRESETS
      : UNIVERSAL_ITEM_PRESETS.filter((p) => p.category === activeCategory);

  return (
    <div className="rounded-xl border border-border/70 bg-muted/20 select-none overflow-hidden" dir="rtl">
      {/* زر فتح / طي المقترحات السريعة لتوفير المساحة وتجنب التشتيت */}
      <button
        type="button"
        onClick={() => {
          playTapSound();
          setIsOpen(!isOpen);
        }}
        className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition cursor-pointer"
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>قوالب بنود وخدمات تجارية جاهزة (إدراج سريع بنقرة واحدة)</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
          <span>{isOpen ? "إخفاء القوالب" : "عرض القوالب المقترحة"}</span>
          {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-3 pt-1 border-t border-border/50 space-y-2 animate-in fade-in duration-150">
          {/* تبويبات التصنيف */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1 text-xs">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-bold whitespace-nowrap transition cursor-pointer active:scale-95 ${
                    isActive
                      ? "bg-primary text-white shadow-2xs"
                      : "bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* البنود المقترحة */}
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-0.5 pt-0.5 scroll-smooth">
            {filteredPresets.map((preset, idx) => (
              <button
                key={`${preset.title}-${idx}`}
                type="button"
                onClick={() => {
                  playAddSound();
                  onSelectPreset(preset);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-background hover:bg-primary/10 text-foreground hover:text-primary border border-border/80 hover:border-primary/40 transition-all cursor-pointer active:scale-95 shadow-2xs"
                title={`إدراج «${preset.title}»`}
              >
                <span className="text-primary font-black">+</span>
                <span>{preset.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomInvoiceQuickPresets;
