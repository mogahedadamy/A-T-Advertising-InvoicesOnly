import { Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  scalePercent?: number;
}

export function InvoiceZoomControls({ zoomIn, zoomOut, reset, scalePercent }: Props) {
  return (
    <div
      dir="ltr"
      className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/10 bg-slate-900/90 px-2 py-1 text-white shadow-xl backdrop-blur-md z-10 text-xs"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="تصغير"
        title="تصغير"
        onClick={zoomOut}
        className="h-7 w-7 rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      {scalePercent !== undefined && (
        <button
          onClick={reset}
          title="إعادة تعيين الملاءمة"
          className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-200 hover:text-white hover:bg-white/10 rounded-md transition"
        >
          {scalePercent}%
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        aria-label="ملاءمة الشاشة"
        title="ملاءمة الورقة A5"
        onClick={reset}
        className="h-7 w-7 rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <RotateCcw className="h-3 w-3" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        aria-label="تكبير"
        title="تكبير"
        onClick={zoomIn}
        className="h-7 w-7 rounded-full text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}