import { Receipt, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IssueInvoiceButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      className={`h-11 w-full gap-2 font-black text-xs sm:text-sm rounded-xl transition-all duration-150 select-none touch-manipulation active:scale-[0.98] ${
        disabled
          ? "bg-muted text-muted-foreground/60 border border-border/50 cursor-not-allowed opacity-50"
          : "bg-primary text-primary-foreground border border-primary/30 shadow-xs hover:bg-primary/90"
      }`}
    >
      <Receipt className="h-4 w-4 shrink-0" />
      <span className="tracking-wide">إصدار فاتورة</span>
      <ArrowLeft className="h-3.5 w-3.5 mr-auto opacity-70 shrink-0" />
    </Button>
  );
}
