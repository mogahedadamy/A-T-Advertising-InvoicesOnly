// @ts-nocheck
/**
 * LicenseClockScreen.tsx — شاشة خطأ ساعة الجهاز
 */
import { Clock, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onRefresh: () => Promise<void>;
  loading: boolean;
}

export default function LicenseClockScreen({ onRefresh, loading }: Props) {
  return (
    <div
      className="min-h-screen bg-gradient-to-br from-background to-amber-500/5 flex flex-col items-center justify-center p-6"
      dir="rtl"
    >
      <div className="relative w-full max-w-sm">
        <div className="bg-card border border-border/70 rounded-2xl shadow-2xl overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
          <div className="p-7 text-center">
            <div className="h-16 w-16 mx-auto rounded-full bg-amber-500/10 ring-2 ring-amber-500/30 flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
            <h1 className="text-xl font-black text-foreground mb-2">توقيت الجهاز غير مضبوط</h1>
            <p className="text-sm text-muted-foreground leading-relaxed mb-5">
              رصد النظام تغييراً مشبوهاً في ساعة الجهاز. لحماية صلاحية الترخيص، يرجى:
            </p>
            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 mb-5 text-right">
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>1. اذهب إلى إعدادات الجهاز ← التاريخ والوقت</p>
                <p>2. فعّل «ضبط الوقت تلقائياً»</p>
                <p>3. ارجع للتطبيق واضغط «إعادة الفحص»</p>
              </div>
            </div>
            <Button onClick={onRefresh} disabled={loading} className="w-full h-11 font-bold">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري الفحص…
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  إعادة الفحص
                </>
              )}
            </Button>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-5">
          © T.A Advertising Solution
        </p>
      </div>
    </div>
  );
}
