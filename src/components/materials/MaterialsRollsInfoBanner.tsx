import React from "react";
import { Info } from "lucide-react";

/**
 * شريط التنبيه الفني لمعايير استيعاب وحساب الرولات في الخوارزمية
 */
export const MaterialsRollsInfoBanner: React.FC = () => {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-foreground flex items-start gap-2.5">
      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
      <div className="space-y-1">
        <p className="font-bold text-primary">معايير حساب الرولات المعتمدة في النظام:</p>
        <p className="text-muted-foreground leading-relaxed">
          الرولات القياسية المتاحة هي: <b className="text-foreground">100 سم، 150 سم، 200 سم، 300 سم</b>.
          الرولة الكبيرة 300 سم تقبل في خوارزمية الحساب مقاسات تصل إلى <b className="text-foreground">320 سم كحد أقصى</b> لتقليل الهدر واستيعاب المقاسات الخاصة.
          أما الاستيكر فيتم حسابه بنظام <b className="text-foreground">الصافي</b> برولة أقصاها 150 سم.
        </p>
      </div>
    </div>
  );
};
